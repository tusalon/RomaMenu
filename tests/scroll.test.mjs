import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Un fallo de desplazamiento no lo caza ningun test de HTML: hace falta mirar el CSS.
// Esto protege lo que costo un pedido atrapado en la pantalla de "Gracias": una capa
// fija a pantalla completa SIN overflow deja inalcanzable todo lo que no cabe.
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

// El cuerpo de una regla, buscada al principio de una linea. Sin regex: los selectores
// llevan puntos, ">" y "*", y escaparlos es justo donde se rompio la primera version.
function regla(selector) {
  const inicio = css.indexOf(`\n${selector} {`);
  assert.ok(inicio >= 0, `no encuentro la regla ${selector}`);
  return css.slice(inicio, css.indexOf("}", inicio));
}

test("la capa de confirmacion del pedido se puede desplazar", () => {
  assert.match(regla(".modal-layer"), /overflow-y:\s*auto/);
});

test("y su contenido se centra con margin:auto, no con place-items (que corta lo que no cabe)", () => {
  assert.match(regla(".modal-layer > *"), /margin:\s*auto/);
  assert.doesNotMatch(regla(".modal-layer"), /place-items:\s*center/);
});

test("el menu lateral del panel se puede desplazar en pantallas bajas", () => {
  assert.match(regla(".admin-sidebar"), /overflow-y:\s*auto/);
});

test("el contenido del carrito se desplaza sin arrastrar la pagina de detras", () => {
  const r = regla(".drawer-content");
  assert.match(r, /overflow-y:\s*auto/);
  assert.match(r, /overscroll-behavior:\s*contain/);
});
