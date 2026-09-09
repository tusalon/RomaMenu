import assert from "node:assert/strict";
import test from "node:test";
import { extrasTotal, groupExtras } from "../app/lib/format.ts";

test("agrupa por concepto e importe y multiplica por cantidad", () => {
  const lines = groupExtras([
    { nombre: "Termo pack", unitario: 200, cantidad: 5 },
    { nombre: "Termo pack", unitario: 200, cantidad: 3 },
  ]);
  assert.deepEqual(lines, [
    { nombre: "Termo pack", unitario: 200, cantidad: 8, total: 1600 },
  ]);
  assert.equal(extrasTotal(lines), 1600);
});

test("no mezcla el mismo concepto con importes distintos", () => {
  const lines = groupExtras([
    { nombre: "Termo pack", unitario: 200, cantidad: 2 },
    { nombre: "Termo pack", unitario: 250, cantidad: 1 },
  ]);
  assert.equal(lines.length, 2);
  assert.equal(extrasTotal(lines), 650);
});

test("descarta cargos incompletos, en cero o de carritos antiguos", () => {
  assert.deepEqual(
    groupExtras([
      { nombre: "Termo pack", unitario: 0, cantidad: 4 },
      { nombre: "   ", unitario: 200, cantidad: 4 },
      { nombre: undefined, unitario: undefined, cantidad: 4 },
      { nombre: "Envase", unitario: 100, cantidad: 0 },
    ]),
    [],
  );
});
