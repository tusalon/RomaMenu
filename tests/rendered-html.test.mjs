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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders the protected admin entry surface", async () => {
  const response = await render("/admin/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Bienvenido de vuelta/);
  assert.match(html, /Panel administrativo/);
});

test("ships Supabase security and no starter preview", async () => {
  const [schema, packageJson] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /crear_pedido_publico/);
  assert.match(schema, /product-images/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot)));
  await assert.rejects(access(new URL("app/_sites-preview/preview.css", projectRoot)));
});
