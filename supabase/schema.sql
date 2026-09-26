-- La Cocina de Miguelón · Esquema completo para Supabase/PostgreSQL
-- Ejecutar una sola vez desde Supabase > SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.estado_pedido as enum (
    'nuevo',
    'pendiente_confirmacion',
    'confirmado',
    'en_preparacion',
    'listo',
    'en_camino',
    'entregado',
    'cancelado'
  );
exception when duplicate_object then null;
end $$;

create sequence if not exists public.pedido_numero_seq start 1;

create table if not exists public.perfiles_admin (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  rol text not null default 'admin' check (rol in ('admin', 'operador')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.configuracion_negocio (
  id uuid primary key default gen_random_uuid(),
  nombre_negocio text not null,
  descripcion text not null default '',
  logo_url text,
  portada_url text not null default '',
  whatsapp text not null default '',
  telefono text not null default '',
  direccion text not null default '',
  texto_bienvenida text not null default '',
  moneda text not null default 'CUP',
  simbolo_moneda text not null default '$',
  pedido_minimo numeric(12,2) not null default 0 check (pedido_minimo >= 0),
  tiempo_entrega text not null default '45–60 min',
  abierto boolean not null default true,
  aceptar_fuera_horario boolean not null default false,
  mensaje_abierto text not null default 'Estamos abiertos.',
  mensaje_cerrado text not null default 'Ahora mismo estamos cerrados.',
  pedidos_vispera_desde time default '18:00',
  color_primario text not null default '#8f241f',
  color_secundario text not null default '#ee7d32',
  redes_sociales jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  imagen_url text,
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- La categoria de sugerencias se declara aqui porque configuracion_negocio
-- se crea antes que categorias y la clave foranea necesita que ya exista.
alter table public.configuracion_negocio
  add column if not exists categoria_sugerencias_id uuid
  references public.categorias(id) on delete set null;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on update cascade on delete restrict,
  nombre text not null,
  descripcion text not null default '',
  imagen_url text not null default '',
  precio numeric(12,2) not null check (precio >= 0),
  precio_anterior numeric(12,2) check (precio_anterior is null or precio_anterior >= 0),
  extra_nombre text not null default '',
  extra_costo numeric(12,2) not null default 0 check (extra_costo >= 0),
  stock integer check (stock is null or stock >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  disponible boolean not null default true,
  recomendado boolean not null default false,
  nuevo boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zonas_entrega (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  costo numeric(12,2) not null default 0 check (costo >= 0),
  pedido_minimo numeric(12,2) check (pedido_minimo is null or pedido_minimo >= 0),
  tiempo_estimado text not null default '',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.metodos_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  moneda text not null default '',
  tasa_cup numeric(12,4) check (tasa_cup is null or tasa_cup > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.horarios_negocio (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_apertura time,
  hora_cierre time,
  trabaja boolean not null default true,
  unique (dia_semana)
);

create table if not exists public.horarios_especiales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  hora_apertura time,
  hora_cierre time,
  cerrado boolean not null default false,
  mensaje text not null default ''
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text not null unique,
  nombre_cliente text not null,
  telefono text not null,
  direccion text not null,
  zona_id uuid not null references public.zonas_entrega(id) on update cascade on delete restrict,
  referencia text not null default '',
  metodo_pago_id uuid not null references public.metodos_pago(id) on update cascade on delete restrict,
  horario_entrega text not null default '',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  costo_entrega numeric(12,2) not null check (costo_entrega >= 0),
  costo_extras numeric(12,2) not null default 0 check (costo_extras >= 0),
  total numeric(12,2) not null check (total >= 0),
  moneda_pago text not null default '',
  tasa_cambio numeric(12,4),
  total_moneda numeric(12,2),
  fecha_entrega date,
  observaciones text not null default '',
  notas_internas text not null default '',
  estado public.estado_pedido not null default 'nuevo',
  origen text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid references public.productos(id) on update cascade on delete set null,
  nombre_producto text not null,
  cantidad integer not null check (cantidad >= 1),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  extra_nombre text not null default '',
  extra_unitario numeric(12,2) not null default 0 check (extra_unitario >= 0),
  extra_subtotal numeric(12,2) not null default 0 check (extra_subtotal >= 0),
  observaciones text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.historial_estados (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  estado_anterior public.estado_pedido,
  estado_nuevo public.estado_pedido not null,
  cambiado_por uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_productos_categoria on public.productos(categoria_id);
create index if not exists idx_productos_catalogo on public.productos(activo, disponible, orden);
create index if not exists idx_categorias_orden on public.categorias(activa, orden);
create index if not exists idx_pedidos_fecha on public.pedidos(created_at desc);
create index if not exists idx_pedidos_estado on public.pedidos(estado, created_at desc);
create index if not exists idx_pedidos_cliente on public.pedidos(lower(nombre_cliente));
create index if not exists idx_pedidos_telefono on public.pedidos(telefono);
create index if not exists idx_items_pedido on public.pedido_items(pedido_id);
create index if not exists idx_historial_pedido on public.historial_estados(pedido_id, changed_at desc);

-- Permite que el panel administrativo reciba pedidos nuevos al instante.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productos_updated_at on public.productos;
create trigger productos_updated_at before update on public.productos
for each row execute function public.set_updated_at();

drop trigger if exists configuracion_updated_at on public.configuracion_negocio;
create trigger configuracion_updated_at before update on public.configuracion_negocio
for each row execute function public.set_updated_at();

drop trigger if exists pedidos_updated_at on public.pedidos;
create trigger pedidos_updated_at before update on public.pedidos
for each row execute function public.set_updated_at();

create or replace function public.registrar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado is distinct from new.estado then
    insert into public.historial_estados (
      pedido_id, estado_anterior, estado_nuevo, cambiado_por
    ) values (
      new.id, old.estado, new.estado, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_historial_estado on public.pedidos;
create trigger pedidos_historial_estado after update of estado on public.pedidos
for each row execute function public.registrar_cambio_estado();

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles_admin
    where id = auth.uid() and activo = true
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

-- Decide si ahora se aceptan pedidos y para que dia de servicio, en hora de
-- Cuba. Todo el calculo de fechas vive aqui: la tienda pregunta y la funcion de
-- pedidos obedece, asi que la hora del telefono del cliente no importa.
--
-- Regla: los pedidos para un dia laborable D se aceptan desde la vispera a la
-- hora 'pedidos_vispera_desde' hasta que D cierra. Con viernes a domingo y 18:00
-- eso es una ventana continua de jueves 18:00 a domingo al cierre.
create or replace function public.ventana_pedidos(p_ahora timestamptz default now())
returns table (
  acepta boolean,
  hoy date,
  fecha_entrega date,
  hora_apertura time,
  hora_cierre time,
  abre_en timestamp
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_local timestamp := p_ahora at time zone 'America/Havana';
  v_abierto boolean;
  v_fuera boolean;
  v_vispera time;
  v_dia date;
  v_apertura time;
  v_cierre time;
  v_inicio timestamp;
begin
  select c.abierto, c.aceptar_fuera_horario, c.pedidos_vispera_desde
    into v_abierto, v_fuera, v_vispera
  from public.configuracion_negocio c
  limit 1;

  -- Interruptor general, el de vacaciones: apagado, no se acepta nada.
  if not coalesce(v_abierto, false) then
    return query select false, v_local::date, null::date, null::time, null::time, null::timestamp;
    return;
  end if;

  -- Sin horario configurado se comporta como antes: abierto = acepta, para hoy.
  if not exists (
    select 1 from public.horarios_negocio h
    where h.trabaja and h.hora_apertura is not null and h.hora_cierre is not null
  ) then
    return query select true, v_local::date, v_local::date, null::time, null::time, null::timestamp;
    return;
  end if;

  -- El primer dia laborable cuyo servicio no ha terminado es el unico candidato.
  for i in 0..7 loop
    v_dia := v_local::date + i;
    select h.hora_apertura, h.hora_cierre into v_apertura, v_cierre
    from public.horarios_negocio h
    where h.dia_semana = extract(dow from v_dia)::int
      and h.trabaja and h.hora_apertura is not null and h.hora_cierre is not null;
    continue when not found;
    continue when v_local >= v_dia + v_cierre;

    v_inicio := case
      when v_fuera then '-infinity'::timestamp
      when v_vispera is not null then (v_dia - 1) + v_vispera
      else v_dia + v_apertura
    end;

    if v_local >= v_inicio then
      return query select true, v_local::date, v_dia, v_apertura, v_cierre, null::timestamp;
    else
      return query select false, v_local::date, v_dia, v_apertura, v_cierre, v_inicio;
    end if;
    return;
  end loop;

  return query select false, v_local::date, null::date, null::time, null::time, null::timestamp;
end;
$$;

revoke all on function public.ventana_pedidos(timestamptz) from public;
grant execute on function public.ventana_pedidos(timestamptz) to anon, authenticated;

drop function if exists public.crear_pedido_publico(jsonb, jsonb);
create function public.crear_pedido_publico(
  p_cliente jsonb,
  p_items jsonb
)
returns table (
  id uuid,
  numero_pedido text,
  subtotal numeric,
  costo_entrega numeric,
  costo_extras numeric,
  total numeric,
  moneda_pago text,
  tasa_cambio numeric,
  total_moneda numeric,
  fecha_entrega date
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pedido_id uuid := gen_random_uuid();
  v_numero text;
  v_subtotal numeric(12,2) := 0;
  v_extras numeric(12,2) := 0;
  v_entrega numeric(12,2);
  v_minimo numeric(12,2);
  v_producto record;
  v_item jsonb;
  v_cantidad integer;
  v_zona_id uuid;
  v_metodo_id uuid;
  v_acepta boolean;
  v_fecha_entrega date;
  v_moneda text;
  v_tasa numeric(12,4);
  v_total numeric(12,2);
  v_total_moneda numeric(12,2);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;
  if length(trim(coalesce(p_cliente->>'nombre_cliente', ''))) < 2 then
    raise exception 'El nombre es obligatorio.';
  end if;
  if length(regexp_replace(coalesce(p_cliente->>'telefono', ''), '\D', '', 'g')) < 6 then
    raise exception 'El teléfono no es válido.';
  end if;
  if length(trim(coalesce(p_cliente->>'direccion', ''))) < 5 then
    raise exception 'La dirección es obligatoria.';
  end if;

  begin
    v_zona_id := (p_cliente->>'zona_id')::uuid;
    v_metodo_id := (p_cliente->>'metodo_pago_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'La zona o el método de pago no son válidos.';
  end;

  select z.costo, coalesce(z.pedido_minimo, c.pedido_minimo)
    into v_entrega, v_minimo
  from public.zonas_entrega z
  cross join lateral (select * from public.configuracion_negocio limit 1) c
  where z.id = v_zona_id and z.activa = true;
  if not found then raise exception 'La zona de entrega no está disponible.'; end if;

  select mp.moneda, mp.tasa_cup into v_moneda, v_tasa
  from public.metodos_pago mp
  where mp.id = v_metodo_id and mp.activo = true;
  if not found then raise exception 'El método de pago no está disponible.'; end if;
  select vp.acepta, vp.fecha_entrega into v_acepta, v_fecha_entrega
  from public.ventana_pedidos(now()) vp;
  if not coalesce(v_acepta, false) then
    raise exception 'Ahora mismo no estamos recibiendo pedidos. Mira en la página cuándo abrimos.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := greatest(0, coalesce((v_item->>'cantidad')::integer, 0));
    if v_cantidad < 1 or v_cantidad > 50 then
      raise exception 'La cantidad solicitada no es válida.';
    end if;
    select p.id, p.nombre, p.precio, p.extra_nombre, p.extra_costo, p.stock into v_producto
    from public.productos p
    where p.id = (v_item->>'producto_id')::uuid
      and p.activo = true and p.disponible = true
    for update;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;

    -- stock nulo = sin control. Con control, se comprueba y se descuenta dentro
    -- del mismo bloqueo, para que dos pedidos simultaneos no vendan la misma unidad.
    if v_producto.stock is not null then
      if v_producto.stock < v_cantidad then
        raise exception 'Solo quedan % unidades de %.', v_producto.stock, trim(v_producto.nombre);
      end if;
      update public.productos pr
        set stock = pr.stock - v_cantidad, updated_at = now()
        where pr.id = v_producto.id;
    end if;

    v_subtotal := v_subtotal + (v_producto.precio * v_cantidad);
    if v_producto.extra_costo > 0 and length(trim(v_producto.extra_nombre)) > 0 then
      v_extras := v_extras + (v_producto.extra_costo * v_cantidad);
    end if;
  end loop;

  if v_subtotal < v_minimo then
    raise exception 'El pedido no alcanza el mínimo configurado para esta zona.';
  end if;

  v_total := v_subtotal + v_entrega + v_extras;

  -- Solo se convierte si el metodo declara tasa. Sin tasa, el metodo cobra en CUP
  -- y el pedido queda sin conversion en vez de guardar un 1 enganoso.
  if v_tasa is not null and v_tasa > 0 then
    v_total_moneda := round(v_total / v_tasa, 2);
    v_moneda := trim(coalesce(v_moneda, ''));
  else
    v_moneda := '';
    v_tasa := null;
    v_total_moneda := null;
  end if;

  v_numero := lpad(nextval('public.pedido_numero_seq')::text, 4, '0');
  insert into public.pedidos (
    id, numero_pedido, nombre_cliente, telefono, direccion, zona_id,
    referencia, metodo_pago_id, horario_entrega, subtotal, costo_entrega,
    costo_extras, total, moneda_pago, tasa_cambio, total_moneda, fecha_entrega,
    observaciones, estado, origen
  ) values (
    v_pedido_id, v_numero, trim(p_cliente->>'nombre_cliente'), trim(p_cliente->>'telefono'),
    trim(p_cliente->>'direccion'), v_zona_id, trim(coalesce(p_cliente->>'referencia', '')),
    v_metodo_id, trim(coalesce(p_cliente->>'horario_entrega', '')), v_subtotal,
    v_entrega, v_extras, v_total, v_moneda, v_tasa, v_total_moneda, v_fecha_entrega,
    trim(coalesce(p_cliente->>'observaciones', '')), 'nuevo', 'web'
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::integer;
    select p.id, p.nombre, p.precio, p.extra_nombre, p.extra_costo into v_producto
    from public.productos p where p.id = (v_item->>'producto_id')::uuid;
    insert into public.pedido_items (
      pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal,
      extra_nombre, extra_unitario, extra_subtotal
    ) values (
      v_pedido_id, v_producto.id, v_producto.nombre, v_cantidad,
      v_producto.precio, v_producto.precio * v_cantidad,
      case when v_producto.extra_costo > 0 then trim(v_producto.extra_nombre) else '' end,
      case when v_producto.extra_costo > 0 then v_producto.extra_costo else 0 end,
      case when v_producto.extra_costo > 0 then v_producto.extra_costo * v_cantidad else 0 end
    );
  end loop;

  insert into public.historial_estados (pedido_id, estado_anterior, estado_nuevo)
  values (v_pedido_id, null, 'nuevo');

  return query select v_pedido_id, v_numero, v_subtotal, v_entrega, v_extras, v_total, v_moneda, v_tasa, v_total_moneda, v_fecha_entrega;
end;
$$;

revoke all on function public.crear_pedido_publico(jsonb, jsonb) from public;
grant execute on function public.crear_pedido_publico(jsonb, jsonb) to anon, authenticated;

alter table public.perfiles_admin enable row level security;
alter table public.configuracion_negocio enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.zonas_entrega enable row level security;
alter table public.metodos_pago enable row level security;
alter table public.horarios_negocio enable row level security;
alter table public.horarios_especiales enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.historial_estados enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.configuracion_negocio, public.categorias, public.productos,
  public.zonas_entrega, public.metodos_pago, public.horarios_negocio to anon, authenticated;
grant select, insert, update, delete on public.perfiles_admin,
  public.configuracion_negocio, public.categorias, public.productos,
  public.zonas_entrega, public.metodos_pago, public.horarios_negocio,
  public.horarios_especiales, public.pedidos, public.pedido_items,
  public.historial_estados to authenticated;

drop policy if exists "Configuracion publica legible" on public.configuracion_negocio;
create policy "Configuracion publica legible" on public.configuracion_negocio for select to anon, authenticated using (true);
drop policy if exists "Categorias activas publicas" on public.categorias;
create policy "Categorias activas publicas" on public.categorias for select to anon, authenticated using (activa or public.es_admin());
drop policy if exists "Productos activos publicos" on public.productos;
create policy "Productos activos publicos" on public.productos for select to anon, authenticated using (activo or public.es_admin());
drop policy if exists "Zonas activas publicas" on public.zonas_entrega;
create policy "Zonas activas publicas" on public.zonas_entrega for select to anon, authenticated using (activa or public.es_admin());
drop policy if exists "Pagos activos publicos" on public.metodos_pago;
create policy "Pagos activos publicos" on public.metodos_pago for select to anon, authenticated using (activo or public.es_admin());

drop policy if exists "Horario publico legible" on public.horarios_negocio;
create policy "Horario publico legible" on public.horarios_negocio for select to anon, authenticated using (true);

drop policy if exists "Admins ven perfiles" on public.perfiles_admin;
create policy "Admins ven perfiles" on public.perfiles_admin for select to authenticated using (public.es_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array['configuracion_negocio','categorias','productos','zonas_entrega','metodos_pago','horarios_negocio','horarios_especiales']
  loop
    execute format('drop policy if exists "Administradores gestionan %s" on public.%I', table_name, table_name);
    execute format('create policy "Administradores gestionan %s" on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', table_name, table_name);
  end loop;
end $$;

drop policy if exists "Administradores gestionan pedidos" on public.pedidos;
create policy "Administradores gestionan pedidos" on public.pedidos for all to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "Administradores ven items" on public.pedido_items;
create policy "Administradores ven items" on public.pedido_items for select to authenticated using (public.es_admin());
drop policy if exists "Administradores ven historial" on public.historial_estados;
create policy "Administradores ven historial" on public.historial_estados for select to authenticated using (public.es_admin());

-- ===== Avisos push y monedas validas (migracion-push-y-monedas.sql) =====

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

-- ===== Seguimiento de pedidos (migracion-seguimiento.sql) =====

create or replace function public.seguimiento_pedido(p_id uuid)
returns table (
  numero_pedido text,
  estado public.estado_pedido,
  nombre text,
  creado timestamptz,
  fecha_entrega date,
  horario_entrega text,
  total numeric,
  metodo_pago text,
  moneda_pago text,
  total_moneda numeric,
  items jsonb,
  historial jsonb,
  negocio text,
  whatsapp text,
  simbolo_moneda text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.numero_pedido,
    p.estado,
    split_part(trim(p.nombre_cliente), ' ', 1),
    p.created_at,
    p.fecha_entrega,
    p.horario_entrega,
    p.total,
    mp.nombre,
    p.moneda_pago,
    p.total_moneda,
    coalesce((
      select jsonb_agg(jsonb_build_object('nombre', i.nombre_producto, 'cantidad', i.cantidad)
                       order by i.nombre_producto)
      from public.pedido_items i where i.pedido_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('estado', h.estado_nuevo, 'fecha', h.changed_at)
                       order by h.changed_at)
      from public.historial_estados h where h.pedido_id = p.id
    ), '[]'::jsonb),
    c.nombre_negocio,
    c.whatsapp,
    c.simbolo_moneda
  from public.pedidos p
  left join public.metodos_pago mp on mp.id = p.metodo_pago_id
  cross join lateral (select * from public.configuracion_negocio limit 1) c
  where p.id = p_id;
$$;

revoke all on function public.seguimiento_pedido(uuid) from public;
grant execute on function public.seguimiento_pedido(uuid) to anon, authenticated;
