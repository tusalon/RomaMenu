import assert from "node:assert/strict";
import test from "node:test";
import { convertTotal, formatConversion } from "../app/lib/format.ts";

test("convierte el total con la tasa declarada por el metodo", () => {
  const conversion = convertTotal(4200, { moneda: "USD", tasa_cup: 420 });
  assert.deepEqual(conversion, { moneda: "USD", tasa: 420, total: 10 });
  // es-CU en Node formatea como 3,500 / 8.81, igual que ya hace formatCurrency.
  assert.equal(formatConversion(conversion!), "10.00 USD");
});

test("redondea a dos decimales, como hace la base", () => {
  // 3700 / 420 = 8.80952... El pedido guardado dira 8.81; la vista previa
  // tiene que decir lo mismo o el cliente vera dos cifras distintas.
  assert.equal(convertTotal(3700, { moneda: "USD", tasa_cup: 420 })?.total, 8.81);
});

test("sin tasa no hay conversion, nunca un uno por uno", () => {
  assert.equal(convertTotal(3700, { moneda: "", tasa_cup: null }), null);
  assert.equal(convertTotal(3700, { moneda: "USD", tasa_cup: 0 }), null);
  assert.equal(convertTotal(3700, undefined), null);
  assert.equal(convertTotal(0, { moneda: "USD", tasa_cup: 420 }), null);
});

test("un metodo con tasa pero sin moneda se etiqueta USD", () => {
  assert.equal(convertTotal(4200, { tasa_cup: 420 })?.moneda, "USD");
});

test("el ejemplo de Miguelon: 57000 CUP por Zelle a 690 son 82.61 USD", async () => {
  const { explainConversion } = await import("../app/lib/format.ts");
  const conversion = convertTotal(57000, { moneda: "USD", tasa_cup: 690 })!;
  assert.equal(conversion.total, 82.61);
  assert.equal(explainConversion(57000, conversion), "57,000 CUP ÷ 690 = 82.61 USD");
});

test("la mitad exacta redondea hacia arriba, como Postgres", () => {
  // 1005 / 200 = 5.025 -> 5.03 en round(numeric, 2).
  assert.equal(convertTotal(1005, { moneda: "USD", tasa_cup: 200 })?.total, 5.03);
  assert.equal(convertTotal(3700, { moneda: "USD", tasa_cup: 690 })?.total, 5.36);
});
