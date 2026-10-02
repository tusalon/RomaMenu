-- El numero de pedido vuelve a 0001 cada semana.
--
-- Que se midio antes de escribir esto:
--   * numero_pedido era UNIQUE para siempre y salia de una secuencia unica. Con
--     un #0001 por semana, el segundo #0001 habria sido rechazado y el pedido
--     habria fallado, asi que la unicidad pasa a ser (semana, numero).
--   * El codigo no usa el numero como llave en ningun sitio: todo va por id.
--
-- La semana es el lunes del dia de entrega, la misma regla que usa el panel.
-- Los pedidos que ya existen NO se renumeran: los clientes ya tienen su numero
-- en WhatsApp. La semana en curso continua desde su ultimo numero.
--
-- Se puede correr dos veces sin romper nada.

begin;

alter table public.pedidos add column if not exists semana date;

-- (Efecto lateral sin importancia: este update toca updated_at de los pedidos
-- antiguos, porque esa columna se actualiza sola en cada update.)
-- Relleno de lo que ya existe: lunes del dia de entrega, o del dia en que se
-- hizo si es un pedido antiguo sin fecha de entrega (en hora de Cuba).
update public.pedidos
set semana = date_trunc('week', coalesce(fecha_entrega, (created_at at time zone 'America/Havana')::date)::timestamp)::date
where semana is null;

-- Cualquier insercion futura sin semana la calcula sola, para que un pedido
-- nunca falle por este campo.
create or replace function public.pedidos_fijar_semana()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.semana is null then
    new.semana := date_trunc('week', coalesce(new.fecha_entrega, (coalesce(new.created_at, now()) at time zone 'America/Havana')::date)::timestamp)::date;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_fijar_semana on public.pedidos;
create trigger pedidos_fijar_semana before insert on public.pedidos
  for each row execute function public.pedidos_fijar_semana();

alter table public.pedidos alter column semana set not null;

-- Un contador por semana, empezando en el ultimo numero que ya hay en ella.
create table if not exists public.contadores_pedido (
  semana date primary key,
  ultimo integer not null default 0 check (ultimo >= 0)
);
alter table public.contadores_pedido enable row level security;
revoke all on public.contadores_pedido from anon, authenticated;

insert into public.contadores_pedido (semana, ultimo)
select semana, max(numero_pedido::integer)
from public.pedidos
where numero_pedido ~ '^[0-9]+$'
group by semana
on conflict (semana) do update set ultimo = greatest(public.contadores_pedido.ultimo, excluded.ultimo);

-- La unicidad pasa de "para siempre" a "dentro de la semana". Se busca la
-- restriccion antigua por lo que hace, no por su nombre.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.pedidos'::regclass
      and c.contype = 'u'
      and (select array_agg(a.attname::text) from pg_attribute a
           where a.attrelid = c.conrelid and a.attnum = any(c.conkey)) = array['numero_pedido']
  loop
    execute format('alter table public.pedidos drop constraint %I', r.conname);
  end loop;
end $$;

do $$
begin
  alter table public.pedidos add constraint pedidos_semana_numero_unico unique (semana, numero_pedido);
exception when duplicate_object or duplicate_table then null;
end $$;

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
  v_semana date;
  v_ultimo integer;
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

  -- La semana es el lunes del dia de entrega, la misma regla que usa el panel.
  v_semana := date_trunc('week', coalesce(v_fecha_entrega, (now() at time zone 'America/Havana')::date)::timestamp)::date;
  -- El upsert bloquea la fila de la semana hasta el final del pedido: dos pedidos
  -- a la vez no pueden recibir el mismo numero, y si este falla, el contador
  -- se deshace con el resto y no queda un hueco.
  insert into public.contadores_pedido as c (semana, ultimo) values (v_semana, 1)
  on conflict (semana) do update set ultimo = c.ultimo + 1
  returning c.ultimo into v_ultimo;
  v_numero := lpad(v_ultimo::text, 4, '0');
  insert into public.pedidos (
    id, numero_pedido, semana, nombre_cliente, telefono, direccion, zona_id,
    referencia, metodo_pago_id, horario_entrega, subtotal, costo_entrega,
    costo_extras, total, moneda_pago, tasa_cambio, total_moneda, fecha_entrega,
    observaciones, estado, origen
  ) values (
    v_pedido_id, v_numero, v_semana, trim(p_cliente->>'nombre_cliente'), trim(p_cliente->>'telefono'),
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

commit;

-- Comprobacion 1: por semana, cuantos pedidos hay, el ultimo numero y el contador.
-- 'ultimo_numero' y 'contador' deben coincidir en cada fila.
select p.semana, count(*) as pedidos, max(p.numero_pedido) as ultimo_numero, c.ultimo as contador
from public.pedidos p
left join public.contadores_pedido c on c.semana = p.semana
group by p.semana, c.ultimo
order by p.semana desc;

-- Comprobacion 2: la unicidad nueva esta y la antigua ya no.
select conname from pg_constraint
where conrelid = 'public.pedidos'::regclass and contype = 'u';
