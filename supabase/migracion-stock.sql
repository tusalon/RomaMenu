-- Control de stock por producto.
--
-- Que se midio antes de escribir esto:
--   * productos no tenia ninguna columna de stock; solo el booleano manual
--     'disponible', y los 25 productos estaban en true.
--   * La UI publica ya sabia pintar el estado agotado (etiqueta, boton
--     deshabilitado, clase .sold-out), asi que no se inventa nada nuevo:
--     el stock simplemente pasa a ser otra forma de llegar a ese estado.
--
-- stock nulo = sin control de stock. El producto no se agota solo y se sigue
-- gobernando a mano con 'disponible'. Asi no hay que poner un numero a los 25
-- productos para empezar a usar la funcion en dos o tres.
--
-- El descuento ocurre dentro de crear_pedido_publico, bajo 'for update', para
-- que dos pedidos simultaneos no puedan vender la misma ultima unidad.
--
-- Se puede correr dos veces sin romper nada.

begin;

alter table public.productos
  add column if not exists stock integer,
  add column if not exists stock_minimo integer not null default 0;

do $$
begin
  alter table public.productos
    add constraint productos_stock_no_negativo check (stock is null or stock >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.productos
    add constraint productos_stock_minimo_no_negativo check (stock_minimo >= 0);
exception when duplicate_object then null;
end $$;

-- La funcion publica pasa a comprobar y descontar el stock.

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

-- Comprobacion: deben aparecer stock y stock_minimo.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'productos'
  and column_name in ('stock', 'stock_minimo')
order by column_name;
