-- Avisos push de pedidos nuevos + metodos de pago cuadrados.
--
-- Que se midio antes de escribir esto:
--   * Los tres metodos activos tenian "690" en la columna moneda y la tasa
--     vacia: se escribio la tasa en la casilla equivocada, asi que no se
--     convertia nada. Habia ademas dos Zelle activos.
--   * No habia push: los avisos solo salian con el panel abierto. El service
--     worker tenia receptor de push, pero nadie se suscribia ni enviaba nada.
--
-- Se puede correr dos veces sin romper nada.

begin;

-- 1. Metodos de pago: efectivo en CUP sin cambio; Zelle y USD en efectivo a 690.
update public.metodos_pago set moneda = '', tasa_cup = null
where id = '50000000-0000-4000-8000-000000000001';

update public.metodos_pago set moneda = 'USD', tasa_cup = 690, activo = true
where id = 'e3b1caac-f2b2-43f0-aae2-bc1e8f7e7c04';

-- El Zelle repetido se apaga en vez de borrarse: puede tener pedidos.
update public.metodos_pago set activo = false
where id = '6d0f5f22-09d5-4e79-b0fc-d7267b3f1f26';

insert into public.metodos_pago (nombre, descripcion, moneda, tasa_cup, activo)
select 'USD en efectivo', 'Paga en dólares al recibir tu pedido.', 'USD', 690, true
where not exists (select 1 from public.metodos_pago where nombre = 'USD en efectivo');

-- Cualquier otro con basura en la moneda vuelve a CUP sin cambio.
update public.metodos_pago set moneda = '', tasa_cup = null
where moneda not in ('', 'USD', 'EUR');

-- Y a partir de ahora la moneda solo puede ser vacia (CUP), USD o EUR.
do $$
begin
  alter table public.metodos_pago
    add constraint metodos_pago_moneda_valida check (moneda in ('', 'USD', 'EUR'));
exception when duplicate_object then null;
end $$;

-- 2. Suscripciones de los moviles del admin.
create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_suscripciones enable row level security;
revoke all on public.push_suscripciones from anon;
grant select, insert, update, delete on public.push_suscripciones to authenticated;
drop policy if exists "Admins gestionan sus avisos" on public.push_suscripciones;
create policy "Admins gestionan sus avisos" on public.push_suscripciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- 3. Claves VAPID. Las genera la funcion avisar-pedido la primera vez. RLS sin
--    politicas: solo la funcion (service role) puede leerlas; nadie las copia.
create table if not exists public.push_config (
  id smallint primary key default 1 check (id = 1),
  vapid_publica text not null,
  vapid_privada text not null,
  created_at timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- 4. Cada pedido se avisa una sola vez.
alter table public.pedidos add column if not exists avisado_at timestamptz;

-- 5. Al entrar un pedido, la base llama a la funcion. pg_net encola la llamada
--    y la envia al confirmarse el pedido, sin hacerlo esperar.
create extension if not exists pg_net;

create or replace function public.avisar_pedido_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://zfozknltebjdxwzwoyjf.supabase.co/functions/v1/avisar-pedido',
    body := jsonb_build_object('pedido_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_alE5AiBzLESvnHLT3BD1Pw_51zIM7DH'
    )
  );
  return new;
exception when others then
  -- Un fallo del aviso nunca puede tumbar un pedido.
  raise warning 'avisar_pedido_nuevo: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists pedidos_avisar on public.pedidos;
create trigger pedidos_avisar
  after insert on public.pedidos
  for each row execute function public.avisar_pedido_nuevo();

commit;

-- Comprobacion 1: Efectivo sin moneda; Zelle y USD en efectivo con USD y 690.
select nombre, moneda, tasa_cup, activo from public.metodos_pago order by activo desc, nombre;

-- Comprobacion 2: pg_net instalado y el disparador creado.
select
  exists (select 1 from pg_extension where extname = 'pg_net') as pg_net,
  exists (select 1 from pg_trigger where tgname = 'pedidos_avisar') as disparador;
