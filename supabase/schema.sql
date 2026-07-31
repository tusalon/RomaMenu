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

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on update cascade on delete restrict,
  nombre text not null,
  descripcion text not null default '',
  imagen_url text not null default '',
  precio numeric(12,2) not null check (precio >= 0),
  precio_anterior numeric(12,2) check (precio_anterior is null or precio_anterior >= 0),
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
  total numeric(12,2) not null check (total >= 0),
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

create or replace function public.crear_pedido_publico(
  p_cliente jsonb,
  p_items jsonb
)
returns table (
  id uuid,
  numero_pedido text,
  subtotal numeric,
  costo_entrega numeric,
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

  if not exists (select 1 from public.metodos_pago where id = v_metodo_id and activo = true) then
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
    select p.id, p.nombre, p.precio into v_producto
    from public.productos p
    where p.id = (v_item->>'producto_id')::uuid
      and p.activo = true and p.disponible = true
    for share;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    v_subtotal := v_subtotal + (v_producto.precio * v_cantidad);
  end loop;

  if v_subtotal < v_minimo then
    raise exception 'El pedido no alcanza el mínimo configurado para esta zona.';
  end if;

  v_numero := lpad(nextval('public.pedido_numero_seq')::text, 4, '0');
  insert into public.pedidos (
    id, numero_pedido, nombre_cliente, telefono, direccion, zona_id,
    referencia, metodo_pago_id, horario_entrega, subtotal, costo_entrega,
    total, observaciones, estado, origen
  ) values (
    v_pedido_id, v_numero, trim(p_cliente->>'nombre_cliente'), trim(p_cliente->>'telefono'),
    trim(p_cliente->>'direccion'), v_zona_id, trim(coalesce(p_cliente->>'referencia', '')),
    v_metodo_id, trim(coalesce(p_cliente->>'horario_entrega', '')), v_subtotal,
    v_entrega, v_subtotal + v_entrega, trim(coalesce(p_cliente->>'observaciones', '')),
    'nuevo', 'web'
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::integer;
    select p.id, p.nombre, p.precio into v_producto
    from public.productos p where p.id = (v_item->>'producto_id')::uuid;
    insert into public.pedido_items (
      pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal
    ) values (
      v_pedido_id, v_producto.id, v_producto.nombre, v_cantidad,
      v_producto.precio, v_producto.precio * v_cantidad
    );
  end loop;

  insert into public.historial_estados (pedido_id, estado_anterior, estado_nuevo)
  values (v_pedido_id, null, 'nuevo');

  return query select v_pedido_id, v_numero, v_subtotal, v_entrega, v_subtotal + v_entrega;
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
  public.zonas_entrega, public.metodos_pago to anon, authenticated;
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
