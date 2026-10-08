import assert from "node:assert/strict";
import test from "node:test";
import { photoSrcSet, photoUrl } from "../app/lib/images.ts";

const producto = "https://res.cloudinary.com/uyvla7fj/image/upload/f_auto,q_auto,c_limit,w_1400/v1788796384/roma-menu/products/u.webp";
const portada = "https://res.cloudinary.com/uyvla7fj/image/upload/v1789935068/roma-menu/zvoktvwqqxiqfa1ttcv7.webp";

test("cambia el ancho de una foto de producto sin tocar el resto de la direccion", () => {
  assert.equal(
    photoUrl(producto, 720),
    "https://res.cloudinary.com/uyvla7fj/image/upload/f_auto,q_auto,c_limit,w_720/v1788796384/roma-menu/products/u.webp",
  );
});

test("a una foto sin transformacion le anade la suya", () => {
  assert.equal(
    photoUrl(portada, 640),
    "https://res.cloudinary.com/uyvla7fj/image/upload/f_auto,q_auto,c_limit,w_640/v1789935068/roma-menu/zvoktvwqqxiqfa1ttcv7.webp",
  );
});

test("sustituye varias transformaciones encadenadas, no solo la primera", () => {
  const encadenada = "https://res.cloudinary.com/x/image/upload/c_crop,w_900/e_sharpen/v12/a/b.jpg";
  assert.equal(photoUrl(encadenada, 400), "https://res.cloudinary.com/x/image/upload/f_auto,q_auto,c_limit,w_400/v12/a/b.jpg");
});

test("redondea el ancho a un entero", () => {
  assert.match(photoUrl(producto, 719.6), /w_720\//);
});

test("lo que no es de Cloudinary se deja exactamente como esta", () => {
  const unsplash = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=86";
  assert.equal(photoUrl(unsplash, 640), unsplash);
  assert.equal(photoSrcSet(unsplash, [400, 800]), undefined);
  // Sin version no se puede saber donde acaba la transformacion: mejor no tocar.
  const sinVersion = "https://res.cloudinary.com/x/image/upload/roma-menu/a.webp";
  assert.equal(photoUrl(sinVersion, 640), sinVersion);
  assert.equal(photoUrl("", 640), "");
});

test("srcset: un candidato por ancho, con su descriptor", () => {
  const set = photoSrcSet(producto, [400, 800])!;
  assert.deepEqual(set.split(", ").map((s) => s.split(" ")[1]), ["400w", "800w"]);
  assert.match(set, /w_400\/.* 400w, .*w_800\/.* 800w$/);
});
