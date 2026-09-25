import assert from "node:assert/strict";
import test from "node:test";
import { describeWindow, formatDia, formatHora, formatMomento } from "../app/lib/format.ts";

test("las horas se escriben en formato de 12 horas", () => {
  assert.equal(formatHora("12:30:00"), "12:30 p. m.");
  assert.equal(formatHora("20:00:00"), "8:00 p. m.");
  assert.equal(formatHora("18:00"), "6:00 p. m.");
  assert.equal(formatHora("00:15:00"), "12:15 a. m.");
});

test("el dia no se mueve con la zona horaria del telefono", () => {
  // 25/09/2026 es viernes. Se calcula en UTC a proposito: con new Date(texto)
  // un telefono en Miami podia leerlo como el jueves 24.
  assert.equal(formatDia("2026-09-25"), "viernes 25");
  assert.equal(formatDia("2026-09-27"), "domingo 27");
  assert.equal(formatMomento("2026-09-24T18:00:00"), "jueves 24 a las 6:00 p. m.");
});

const base = { hoy: "2026-09-24", hora_apertura: "12:30:00", hora_cierre: "20:00:00" };

test("cerrado: dice cuando abre y para que dia", () => {
  assert.equal(
    describeWindow({ ...base, acepta: false, fecha_entrega: "2026-09-25", abre_en: "2026-09-24T18:00:00" }),
    "Ahora no recibimos pedidos. Abrimos el jueves 24 a las 6:00 p. m. para el viernes 25.",
  );
});

test("pedido anticipado: avisa de que es para otro dia", () => {
  assert.equal(
    describeWindow({ ...base, acepta: true, fecha_entrega: "2026-09-25", abre_en: null }),
    "Estás pidiendo para el viernes 25. Entregamos de 12:30 p. m. a 8:00 p. m.",
  );
});

test("pedido para hoy: solo el horario de entrega", () => {
  assert.equal(
    describeWindow({ ...base, hoy: "2026-09-25", acepta: true, fecha_entrega: "2026-09-25", abre_en: null }),
    "Hoy entregamos de 12:30 p. m. a 8:00 p. m.",
  );
});

test("sin respuesta de la base no se inventa nada", () => {
  assert.equal(describeWindow(null), null);
});

test("las horas de entrega se ofrecen en 12 h y dentro del horario", async () => {
  const { deliverySlots, timeSlots } = await import("../app/lib/format.ts");
  assert.deepEqual(timeSlots("12:30", "14:00"), ["12:30", "13:00", "13:30", "14:00"]);
  assert.equal(formatHora("13:00"), "1:00 p. m.");
  assert.equal(formatHora("14:00"), "2:00 p. m.");
  const viernes = { acepta: true, hoy: "2026-09-24", fecha_entrega: "2026-09-25", hora_apertura: "12:30:00", hora_cierre: "20:00:00", abre_en: null };
  const todas = deliverySlots(viernes, "19:00");
  assert.equal(todas[0], "12:30");
  assert.equal(todas.at(-1), "19:30");
  // Para hoy, a las 15:10: nada antes de las 15:40.
  const hoy = { ...viernes, hoy: "2026-09-25" };
  assert.equal(deliverySlots(hoy, "15:10")[0], "16:00");
  assert.deepEqual(deliverySlots(null), []);
});
