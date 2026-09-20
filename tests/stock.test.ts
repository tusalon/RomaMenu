import assert from "node:assert/strict";
import test from "node:test";
import { lowStockProducts, stockState } from "../app/lib/format.ts";

test("sin stock declarado el producto nunca se agota solo", () => {
  const s = stockState({ disponible: true, stock: null, stock_minimo: 0 });
  assert.deepEqual(s, { agotado: false, bajo: false, restantes: null });
});

test("stock en cero agota el producto", () => {
  assert.equal(stockState({ disponible: true, stock: 0, stock_minimo: 2 }).agotado, true);
});

test("apagar 'disponible' agota aunque queden unidades", () => {
  const s = stockState({ disponible: false, stock: 10, stock_minimo: 2 });
  assert.equal(s.agotado, true);
  assert.equal(s.restantes, 10);
});

test("bajo minimos avisa, pero solo por encima de cero", () => {
  assert.equal(stockState({ disponible: true, stock: 2, stock_minimo: 3 }).bajo, true);
  assert.equal(stockState({ disponible: true, stock: 4, stock_minimo: 3 }).bajo, false);
  // Agotado no es "bajo": es otra cosa y se pinta distinto.
  assert.equal(stockState({ disponible: true, stock: 0, stock_minimo: 3 }).bajo, false);
});

test("la lista de reposicion ignora lo que no lleva control de stock", () => {
  const productos = [
    { id: "a", nombre: "Sin control", disponible: true, stock: null, stock_minimo: 0 },
    { id: "b", nombre: "Bajo", disponible: true, stock: 2, stock_minimo: 3 },
    { id: "c", nombre: "Agotado", disponible: true, stock: 0, stock_minimo: 1 },
    { id: "d", nombre: "De sobra", disponible: true, stock: 40, stock_minimo: 3 },
  ];
  assert.deepEqual(lowStockProducts(productos).map((p) => p.id), ["c", "b"]);
});

test("un producto apagado a mano con existencias no es falta de stock", () => {
  // Este era el fallo: 'agotado' por 'disponible: false' colaba en la lista de
  // reposicion, y mandaba a Miguelon a comprar algo que tiene en la nevera.
  const productos = [{ id: "x", disponible: false, stock: 10, stock_minimo: 2 }];
  assert.deepEqual(lowStockProducts(productos), []);
});
