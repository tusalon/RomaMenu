-- Dias laborables y ventana de pedidos.
--
-- Que se midio antes de escribir esto:
--   * horarios_negocio ya existia (dia_semana, apertura, cierre, trabaja) pero
--     ningun codigo la leia: abrir y cerrar dependia solo del interruptor
--     manual 'abierto'. Se reutiliza en vez de crear otra tabla.
--   * El anonimo no podia leerla, y la tienda la necesita para decir cuando abre.
--
-- Regla, en hora de Cuba (America/Havana, con su cambio de horario):
-- los pedidos para un dia laborable se aceptan desde la vispera a las 18:00
-- hasta que ese dia cierra. Viernes a domingo de 12:30 a 20:00 da una ventana
-- continua de jueves 18:00 a domingo 20:00.
--
-- Se puede correr dos veces sin romper nada.

begin;

alter table public.configuracion_negocio
  add column if not exists pedidos_vispera_desde time default '18:00';

alter table public.pedidos
  add column if not exists fecha_entrega date;

grant select on public.horarios_negocio to anon, authenticated;
drop policy if exists "Horario publico legible" on public.horarios_negocio;
create policy "Horario publico legible" on public.horarios_negocio
  for select to anon, authenticated using (true);

-- Viernes (5), sabado (6) y domingo (0), de 12:30 a 20:00. El resto, cerrado.
-- Se cambia despues desde el panel: Configuracion > Dias y horario.
insert into public.horarios_negocio (dia_semana, hora_apertura, hora_cierre, trabaja) values
  (1, null, null, false),
  (2, null, null, false),
  (3, null, null, false),
  (4, null, null, false),
  (5, '12:30', '20:00', true),
  (6, '12:30', '20:00', true),
  (0, '12:30', '20:00', true)
on conflict (dia_semana) do update set
  hora_apertura = excluded.hora_apertura,
  hora_cierre = excluded.hora_cierre,
  trabaja = excluded.trabaja;

update public.configuracion_negocio set pedidos_vispera_desde = '18:00';

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

commit;

-- Comprobacion 1: el horario cargado.
select dia_semana, hora_apertura, hora_cierre, trabaja
from public.horarios_negocio order by (dia_semana + 6) % 7;

-- Comprobacion 2: que diria la tienda ahora mismo.
select * from public.ventana_pedidos();
