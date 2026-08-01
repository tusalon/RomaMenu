import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the public storefront with product content", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /La Cocina de Miguelón/);
  assert.match(html, /Hoy cocinamos/);
  assert.match(html, /Nuestro menú/);
  assert.match(html, /Pollo asado/);
  assert.match(html, /Ver carrito/);
  assert.doesNotMatch(html, /admin\.webmanifest/);
  assert.doesNotMatch(html, /pwa-install-button/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders the protected admin entry surface", async () => {
  const [loginResponse, adminResponse] = await Promise.all([
    render("/admin/login"),
    render("/admin"),
  ]);
  assert.equal(loginResponse.status, 200);
  assert.equal(adminResponse.status, 200);

  const [loginHtml, adminHtml] = await Promise.all([
    loginResponse.text(),
    adminResponse.text(),
  ]);
  assert.match(loginHtml, /Bienvenido de vuelta/);
  assert.match(loginHtml, /Panel administrativo/);
  assert.match(loginHtml, /admin\.webmanifest/);
  assert.match(loginHtml, /icons\/admin-192\.png/);
  assert.match(adminHtml, /admin\.webmanifest/);
});

test("keeps mobile section navigation responsive and accessible", async () => {
  const [header, styles] = await Promise.all([
    readFile(new URL("../app/components/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(header, /setMenuOpen\(false\)/);
  assert.match(header, /scrollIntoView/);
  assert.match(header, /history\.pushState/);
  assert.match(header, /aria-controls="main-navigation"/);
  assert.match(styles, /scroll-padding-top:\s*76px/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test("ships Supabase security, Cloudinary uploads and admin deletion actions", async () => {
  const [schema, packageJson, repository, adminApp] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /crear_pedido_publico/);
  assert.doesNotMatch(schema, /product-images/);
  assert.match(repository, /api\.cloudinary\.com/);
  assert.match(repository, /deleteOrder/);
  assert.match(repository, /deleteDeliveryZone/);
  assert.match(adminApp, /Eliminar pedido/);
  assert.match(adminApp, /Eliminar zona/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot)));
  await assert.rejects(access(new URL("app/_sites-preview/preview.css", projectRoot)));
});

test("ships an installable admin PWA and an Android APK workflow", async () => {
  const [manifestText, capacitorConfig, androidWorkflow, adminApp, pwaControls, rootLayout, serviceWorker] = await Promise.all([
    readFile(new URL("../public/admin.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/build-android-apk.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPwaControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/admin-notifications-sw.js", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.start_url, "./admin/");
  assert.equal(manifest.scope, "./admin/");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.match(capacitorConfig, /com\.tusalon\.romamenu\.admin/);
  assert.match(capacitorConfig, /appStartPath:\s*"\/admin\/"/);
  assert.match(androidWorkflow, /assembleRelease/);
  assert.match(androidWorkflow, /RomaMenu-Admin\.apk/);
  assert.match(androidWorkflow, /java-version: 21/);
  assert.match(androidWorkflow, /chmod \+x \.\/gradlew/);
  assert.match(androidWorkflow, /test -n "\$ANDROID_KEYSTORE_PASSWORD"/);
  assert.match(adminApp, /LocalNotifications\.schedule/);
  assert.match(pwaControls, /ADMIN_SCOPE = appPath\("\/admin\/"\)/);
  assert.match(pwaControls, /navigator\.serviceWorker\.getRegistrations/);
  assert.match(pwaControls, /registration\.unregister/);
  assert.match(rootLayout, /CAPACITOR_BUILD === "true"/);
  assert.doesNotMatch(rootLayout, /next\/font/);
  assert.match(serviceWorker, /payload\.url \|\| self\.registration\.scope/);
  assert.match(serviceWorker, /admin-offline\.html/);

  await Promise.all([
    access(new URL("../public/icons/admin-180.png", import.meta.url)),
    access(new URL("../public/icons/admin-192.png", import.meta.url)),
    access(new URL("../public/icons/admin-512.png", import.meta.url)),
    access(new URL("../public/admin-offline.html", import.meta.url)),
    access(new URL("../android/gradlew", import.meta.url)),
  ]);
});
