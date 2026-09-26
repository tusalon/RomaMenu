-- Seguimiento de pedidos para el cliente.
--
-- El enlace es /pedido/?id=<id del pedido>. El id es un uuid aleatorio de 122
-- bits que ya devolvia crear_pedido_publico: no se puede adivinar, asi que
-- sirve de llave sin crear columnas nuevas.
--
-- Esta funcion devuelve solo lo que el cliente necesita para saber como va su
-- pedido. No devuelve telefono ni direccion, y del nombre solo el primero: el
-- enlace puede acabar reenviado a otra persona.
--
-- Se puede correr dos veces sin romper nada.

begin;

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

commit;

-- Comprobacion: el ultimo pedido, tal como lo veria su cliente.
select numero_pedido, estado, nombre, fecha_entrega, jsonb_array_length(items) as platos
from public.seguimiento_pedido((select id from public.pedidos order by created_at desc limit 1));
