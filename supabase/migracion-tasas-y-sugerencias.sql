-- Tasas de cambio por metodo de pago + categoria de sugerencias opcional.
--
-- Por que existe esta migracion, y que se midio antes de escribirla:
--   * metodos_pago solo tenia id/nombre/descripcion/activo/created_at.
--     No habia donde declarar a cuanto se cambia el USD ni el Zelle.
--   * configuracion_negocio.moneda ya era 'CUP', pero sin ninguna tasa.
--   * "Sugerencias del chef" ya existia como categoria activa con 1 producto,
--     asi que no se crea ninguna categoria: se elige cual de las que ya hay
--     hace de sugerencias, y se puede dejar vacia.
--
-- La tasa vive en el metodo de pago, no en la configuracion del negocio:
-- cada metodo trae la suya y anadir otro manana no toca el esquema.
--
-- El pedido guarda la tasa usada y el importe convertido. Si la tasa cambia
-- despues, los pedidos ya hechos no se mueven.
--
-- Se puede correr dos veces sin romper nada.

begin;

-- 1. Cada metodo de pago declara en que moneda cobra y a cuanto la cambia.
--    tasa_cup nula = el metodo ya cobra en CUP, no se convierte nada.
alter table public.metodos_pago
  add column if not exists moneda text not null default '',
  add column if not exists tasa_cup numeric(12,4);

do $$
begin
  alter table public.metodos_pago
    add constraint metodos_pago_tasa_cup_positiva
    check (tasa_cup is null or tasa_cup > 0);
exception when duplicate_object then null;
end $$;

-- 2. Que categoria se ofrece como sugerencia al cerrar el pedido.
--    Nula = no se ofrece ninguna.
alter table public.configuracion_negocio
  add column if not exists categoria_sugerencias_id uuid
  references public.categorias(id) on delete set null;

-- 3. El pedido conserva la conversion tal como estaba el dia que se hizo.
alter table public.pedidos
  add column if not exists moneda_pago text not null default '',
  add column if not exists tasa_cambio numeric(12,4),
  add column if not exists total_moneda numeric(12,2);

-- 4. La funcion publica calcula la conversion desde la base, nunca desde el
--    navegador, igual que ya hacia con precios y cargos extra.

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
  total_moneda numeric
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

  select z.costo, coalesce(z.pedido_minimo, c.pedido_minimo), c.abierto, c.aceptar_fuera_horario
    into v_entrega, v_minimo, v_abierto, v_aceptar_fuera
  from public.zonas_entrega z
  cross join lateral (select * from public.configuracion_negocio limit 1) c
  where z.id = v_zona_id and z.activa = true;
  if not found then raise exception 'La zona de entrega no está disponible.'; end if;

  select mp.moneda, mp.tasa_cup into v_moneda, v_tasa
  from public.metodos_pago mp
  where mp.id = v_metodo_id and mp.activo = true;
  if not found then raise exception 'El método de pago no está disponible.'; end if;
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
    costo_extras, total, moneda_pago, tasa_cambio, total_moneda,
    observaciones, estado, origen
  ) values (
    v_pedido_id, v_numero, trim(p_cliente->>'nombre_cliente'), trim(p_cliente->>'telefono'),
    trim(p_cliente->>'direccion'), v_zona_id, trim(coalesce(p_cliente->>'referencia', '')),
    v_metodo_id, trim(coalesce(p_cliente->>'horario_entrega', '')), v_subtotal,
    v_entrega, v_extras, v_total, v_moneda, v_tasa, v_total_moneda,
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

  return query select v_pedido_id, v_numero, v_subtotal, v_entrega, v_extras, v_total, v_moneda, v_tasa, v_total_moneda;
end;
$$;

revoke all on function public.crear_pedido_publico(jsonb, jsonb) from public;
grant execute on function public.crear_pedido_publico(jsonb, jsonb) to anon, authenticated;

commit;

-- Comprobacion: las tres columnas nuevas deben aparecer aqui.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'metodos_pago' and column_name in ('moneda', 'tasa_cup'))
    or (table_name = 'configuracion_negocio' and column_name = 'categoria_sugerencias_id')
    or (table_name = 'pedidos' and column_name in ('moneda_pago', 'tasa_cambio', 'total_moneda'))
  )
order by table_name, column_name;
