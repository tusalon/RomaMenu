import assert from "node:assert/strict";
import test from "node:test";
import { trackingProgress, trackingUrl } from "../app/lib/format.ts";

test("cada estado interno cae en el paso que ve el cliente", () => {
  assert.equal(trackingProgress("nuevo").paso, 0);
  assert.equal(trackingProgress("pendiente_confirmacion").paso, 0);
  assert.equal(trackingProgress("listo").paso, 2);
  assert.equal(trackingProgress("en_camino").paso, 3);
  assert.equal(trackingProgress("entregado").paso, 4);
  assert.equal(trackingProgress("cancelado").cancelado, true);
});

test("la hora de cada paso es la primera vez que se llego a el", () => {
  const { horas } = trackingProgress("en_camino", [
    { estado: "nuevo", fecha: "2026-09-25T15:00:00Z" },
    { estado: "en_preparacion", fecha: "2026-09-25T15:10:00Z" },
    { estado: "listo", fecha: "2026-09-25T15:40:00Z" },
    { estado: "en_camino", fecha: "2026-09-25T15:45:00Z" },
  ]);
  assert.deepEqual(horas, ["2026-09-25T15:00:00Z", null, "2026-09-25T15:10:00Z", "2026-09-25T15:45:00Z", null]);
});

test("el enlace lleva el id del pedido", () => {
  assert.equal(
    trackingUrl("https://tusalon.github.io", "/RomaMenu/pedido/", "3f2a-9c"),
    "https://tusalon.github.io/RomaMenu/pedido/?id=3f2a-9c",
  );
});
