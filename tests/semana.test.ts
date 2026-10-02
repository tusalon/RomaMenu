import assert from "node:assert/strict";
import test from "node:test";
import { fechaServicio, hoyCuba, lunesDe, pedidosDeLaSemana } from "../app/lib/format.ts";

test("el lunes de cualquier dia de la semana", () => {
  assert.equal(lunesDe("2026-10-02"), "2026-09-28"); // viernes
  assert.equal(lunesDe("2026-10-04"), "2026-09-28"); // domingo
  assert.equal(lunesDe("2026-10-05"), "2026-10-05"); // lunes
});

test("la fecha de hoy es la de La Habana, no la del telefono", () => {
  // Domingo 23:30 en Cuba (UTC-4) ya es lunes en UTC.
  assert.equal(hoyCuba(new Date("2026-10-05T03:30:00Z")), "2026-10-04");
});

const pedidos = [
  { id: "viernes pasado", fecha_entrega: "2026-09-25", created_at: "2026-09-24T22:30:00Z" },
  { id: "domingo pasado", fecha_entrega: "2026-09-27", created_at: "2026-09-27T16:00:00Z" },
  { id: "este viernes", fecha_entrega: "2026-10-02", created_at: "2026-10-01T22:10:00Z" },
  { id: "el siguiente", fecha_entrega: "2026-10-09", created_at: "2026-10-04T23:50:00Z" },
  { id: "antiguo sin fecha", fecha_entrega: null, created_at: "2026-09-20T15:00:00Z" },
];

test("en pleno fin de semana solo se ve el de ahora y lo que viene", () => {
  assert.deepEqual(pedidosDeLaSemana(pedidos, "2026-10-03").map((p) => p.id), ["este viernes", "el siguiente"]);
});

test("el lunes arranca de cero salvo lo pedido para mas adelante", () => {
  assert.deepEqual(pedidosDeLaSemana(pedidos, "2026-10-05").map((p) => p.id), ["el siguiente"]);
});

test("un pedido sin fecha de entrega cuenta por el dia en que se hizo", () => {
  assert.equal(fechaServicio(pedidos[4]), "2026-09-20");
});
