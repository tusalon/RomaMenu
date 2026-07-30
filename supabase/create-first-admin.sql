-- 1. Crea primero el usuario desde Supabase > Authentication > Users.
-- 2. Copia el UUID del usuario y reemplaza los tres valores siguientes.

insert into public.perfiles_admin (id, nombre, email, rol, activo)
values (
  'REEMPLAZA-CON-UUID-DE-AUTH-USERS',
  'Miguelón',
  'administrador@correo.com',
  'admin',
  true
)
on conflict (id) do update set
  nombre = excluded.nombre,
  email = excluded.email,
  rol = excluded.rol,
  activo = excluded.activo;

