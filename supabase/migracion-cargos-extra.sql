-- Migracion: cargo extra por producto (termo pack, envase, etc.)
-- Pegar completo en Supabase > SQL Editor. Es idempotente y no borra datos.

alter table public.productos
  add column if not exists extra_nombre text not null default '',
  add column if not exists extra_costo numeric(12,2) not null default 0;

alter table public.pedidos
  add column if not exists costo_extras numeric(12,2) not null default 0;

alter table public.pedido_items
  add column if not exists extra_nombre text not null default '',
  add column if not exists extra_unitario numeric(12,2) not null default 0,
  add column if not exists extra_subtotal numeric(12,2) not null default 0;

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
  total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
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
  v_abierto boolean;
  v_aceptar_fuera boolean;
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

  select z.costo, coalesce(z.pedido_minimo, c.pedido_minimo), c.abierto, c.aceptar_fuera_horario
    into v_entrega, v_minimo, v_abierto, v_aceptar_fuera
  from public.zonas_entrega z
  cross join lateral (select * from public.configuracion_negocio limit 1) c
  where z.id = v_zona_id and z.activa = true;
  if not found then raise exception 'La zona de entrega no está disponible.'; end if;

  if not exists (select 1 from public.metodos_pago where metodos_pago.id = v_metodo_id and activo = true) then
    raise exception 'El método de pago no está disponible.';
  end if;
  if not v_abierto and not v_aceptar_fuera then
    raise exception 'El negocio está cerrado y no acepta pedidos programados.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := greatest(0, coalesce((v_item->>'cantidad')::integer, 0));
    if v_cantidad < 1 or v_cantidad > 50 then
      raise exception 'La cantidad solicitada no es válida.';
    end if;
    select p.id, p.nombre, p.precio, p.extra_nombre, p.extra_costo into v_producto
    from public.productos p
    where p.id = (v_item->>'producto_id')::uuid
      and p.activo = true and p.disponible = true
    for share;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    v_subtotal := v_subtotal + (v_producto.precio * v_cantidad);
    if v_producto.extra_costo > 0 and length(trim(v_producto.extra_nombre)) > 0 then
      v_extras := v_extras + (v_producto.extra_costo * v_cantidad);
    end if;
  end loop;

  if v_subtotal < v_minimo then
    raise exception 'El pedido no alcanza el mínimo configurado para esta zona.';
  end if;

  v_numero := lpad(nextval('public.pedido_numero_seq')::text, 4, '0');
  insert into public.pedidos (
    id, numero_pedido, nombre_cliente, telefono, direccion, zona_id,
    referencia, metodo_pago_id, horario_entrega, subtotal, costo_entrega,
    costo_extras, total, observaciones, estado, origen
  ) values (
    v_pedido_id, v_numero, trim(p_cliente->>'nombre_cliente'), trim(p_cliente->>'telefono'),
    trim(p_cliente->>'direccion'), v_zona_id, trim(coalesce(p_cliente->>'referencia', '')),
    v_metodo_id, trim(coalesce(p_cliente->>'horario_entrega', '')), v_subtotal,
    v_entrega, v_extras, v_subtotal + v_entrega + v_extras,
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

  return query select v_pedido_id, v_numero, v_subtotal, v_entrega, v_extras, v_subtotal + v_entrega + v_extras;
end;
$$;

revoke all on function public.crear_pedido_publico(jsonb, jsonb) from public;
grant execute on function public.crear_pedido_publico(jsonb, jsonb) to anon, authenticated;
