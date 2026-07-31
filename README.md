# La Cocina de Miguelón

Aplicación web para mostrar un catálogo de comida preparada, recibir pedidos a domicilio por WhatsApp y gestionarlos desde un panel administrativo protegido.

## Funciones incluidas

- Catálogo responsive con fotografías, categorías, búsqueda, disponibilidad y orden por precio.
- Productos destacados, ofertas, novedades y agotados visibles.
- Carrito persistente en el navegador, cantidades, observaciones y cálculo de totales.
- Checkout con datos de entrega, zonas, pedido mínimo, formas de pago y horario preferido.
- Registro transaccional del pedido en Supabase antes de abrir WhatsApp.
- Validación en servidor de disponibilidad, precios, zona, costo de entrega y método de pago.
- Confirmación con número único de pedido.
- Acceso administrativo con Supabase Auth.
- Dashboard, pedidos, productos, categorías, zonas, pagos y configuración del negocio.
- Eliminación confirmada de pedidos y de zonas que no tengan pedidos asociados.
- Subida y entrega optimizada de fotografías mediante Cloudinary.
- Row Level Security para proteger pedidos y operaciones administrativas.
- Modo demostración local cuando Supabase aún no está configurado.

## Tecnologías

- React 19 y TypeScript.
- Vite mediante Vinext, conservando rutas compatibles con Next.
- Tailwind CSS 4 y CSS personalizado.
- Supabase Database y Auth.
- Cloudinary para almacenamiento y optimización de imágenes.
- Lucide React para iconografía.

## Instalación

Requisitos: Node.js 22.13 o superior y npm.

```powershell
cd "C:\Users\RODO\Documents\RomaMenu"
npm install
Copy-Item .env.example .env.local
```

Completa `.env.local` con la URL y la clave pública `anon` de Supabase, además del `cloud name` y el `unsigned upload preset` de Cloudinary. No uses la clave `service_role` en esta aplicación.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. Ejecuta [`supabase/seed.sql`](supabase/seed.sql) para cargar los productos de demostración.
4. En **Project Settings > API**, copia la URL y la clave pública `anon` a `.env.local`.
5. En **Authentication > Users**, crea el primer usuario administrativo con correo y contraseña.
6. Copia su UUID y ejecuta [`supabase/create-first-admin.sql`](supabase/create-first-admin.sql), sustituyendo los valores indicados.

## Configurar Cloudinary

1. Crea un `unsigned upload preset` para imágenes en Cloudinary.
2. Limita el preset a JPG, PNG y WebP, con un máximo recomendado de 8 MB.
3. Añade `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` y `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` a `.env.local`.
4. En GitHub, crea las variables `CLOUDINARY_CLOUD_NAME` y `CLOUDINARY_UPLOAD_PRESET` para el flujo de Pages.

Las imágenes se guardan en `roma-menu/products` dentro de Cloudinary. Supabase conserva únicamente la URL optimizada en el registro del producto.

## Ejecutar localmente

```powershell
npm run dev
```

Abre `http://localhost:3000` para el catálogo y `http://localhost:3000/admin` para el panel.

Si no configuras Supabase, la aplicación utiliza datos de demostración y `localStorage`. En ese modo puedes entrar al panel con cualquier correo y una contraseña de seis caracteres o más. El modo demostración sirve para revisar la experiencia; no sustituye la base de datos en producción.

## Crear el primer administrador

El usuario debe existir primero en **Supabase Auth**. Después añade su perfil a `perfiles_admin`:

```sql
insert into public.perfiles_admin (id, nombre, email, rol, activo)
values (
  'UUID-COPIADO-DE-AUTH-USERS',
  'Miguelón',
  'administrador@correo.com',
  'admin',
  true
);
```

Una cuenta de Auth sin un perfil administrativo activo podrá autenticarse, pero las políticas RLS le impedirán leer o modificar los datos privados.

## Uso del panel

- **Resumen:** métricas del día, pedidos recientes y productos más pedidos.
- **Pedidos:** busca, filtra, revisa datos de entrega, cambia estados, guarda notas internas, contacta por WhatsApp e imprime.
- **Productos:** crea o edita productos, sube imágenes y controla disponibilidad, etiquetas y publicación.
- **Categorías:** añade categorías y activa o desactiva su aparición.
- **Zonas de entrega:** define costo, pedido mínimo y tiempo estimado.
- **Métodos de pago:** activa o desactiva las opciones visibles al cliente.
- **Configuración:** cambia textos, contacto, moneda, estado abierto/cerrado y colores principales.

## Flujo seguro de pedidos

El frontend llama a la función PostgreSQL `crear_pedido_publico`. La función vuelve a consultar cada producto, utiliza los precios guardados en la base de datos, verifica disponibilidad, recalcula subtotal y entrega, comprueba el pedido mínimo y guarda pedido e ítems en una única transacción. Solo después la interfaz abre el mensaje de WhatsApp.

Los visitantes pueden leer únicamente la información pública activa. No pueden consultar pedidos. Los administradores autenticados y activos tienen acceso mediante políticas RLS.

## Estructura principal

```text
app/
  admin/                  Rutas del panel y acceso
  components/             Catálogo, carrito, checkout y administración
  lib/                    Tipos, datos demo, Supabase y repositorio
  globals.css             Sistema visual responsive
  layout.tsx              Metadatos y estructura global
  page.tsx                Catálogo público
public/
  og.png                  Tarjeta social de la marca
supabase/
  schema.sql              Tablas, índices, funciones, triggers y RLS
  seed.sql                Categorías, productos, zonas y pagos de demostración
  create-first-admin.sql  Plantilla para autorizar al primer administrador
.env.example              Variables públicas necesarias
```

## Comprobaciones

```powershell
npm run build
npm run lint
```

## Despliegue

### GitHub Pages

Cada cambio enviado a `feature/cocina-miguelon` ejecuta el flujo
`.github/workflows/deploy-pages.yml`. El flujo genera una exportación estática
con la ruta base `/RomaMenu/` y publica el catálogo en
`https://tusalon.github.io/RomaMenu/`.

### OpenAI Sites / Cloudflare

El proyecto conserva la integración `sites()` y genera salida ESM compatible con Cloudflare. Configura en el servicio de hosting las mismas variables de `.env.local` y ejecuta el flujo de publicación de Sites.

### Otro hosting compatible con Vite

1. Conecta este repositorio al proveedor.
2. Usa `npm install` como instalación y `npm run build` como compilación.
3. Configura las variables públicas de Supabase y Cloudinary indicadas en `.env.example`.
4. Publica la salida generada por el adaptador Vinext del proyecto.

Tras desplegar, añade el dominio público en **Supabase > Authentication > URL Configuration**. Nunca publiques `.env.local` ni una clave privada.

## Antes de publicar el negocio real

- Sustituye el WhatsApp, teléfono, dirección y fotografías de demostración.
- Revisa precios, zonas, pedidos mínimos, moneda y métodos de pago.
- Crea al menos una cuenta administrativa real.
- Comprueba un pedido completo desde un teléfono.
- Define las URLs permitidas en Supabase Auth.

## Licencia

Proyecto privado de La Cocina de Miguelón.
