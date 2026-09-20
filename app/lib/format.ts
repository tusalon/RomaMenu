import type { CartItem, OrderItem, OrderStatus } from "./types";

export function formatCurrency(value: number, symbol = "$") {
  return `${symbol}${Number(value).toLocaleString("es-CU")}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  pendiente_confirmacion: "Pendiente de confirmación",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};


export type ExtraLine = {
  nombre: string;
  unitario: number;
  cantidad: number;
  total: number;
};

// Agrupa los cargos extra por concepto e importe: dos productos con el mismo
// "Termo pack" a 200 salen en una sola linea de 8; si uno costara 250, en dos.
export function groupExtras(
  entries: { nombre?: string | null; unitario?: number | null; cantidad: number }[],
): ExtraLine[] {
  const lines = new Map<string, ExtraLine>();
  for (const entry of entries) {
    const nombre = (entry.nombre ?? "").trim();
    const unitario = Number(entry.unitario ?? 0);
    if (!nombre || !(unitario > 0) || !(entry.cantidad > 0)) continue;
    const key = `${nombre}|${unitario}`;
    const current = lines.get(key);
    if (current) {
      current.cantidad += entry.cantidad;
      current.total += unitario * entry.cantidad;
    } else {
      lines.set(key, { nombre, unitario, cantidad: entry.cantidad, total: unitario * entry.cantidad });
    }
  }
  return [...lines.values()];
}

export function extrasFromCart(items: CartItem[]): ExtraLine[] {
  return groupExtras(
    items.map(({ product, quantity }) => ({
      nombre: product.extra_nombre,
      unitario: product.extra_costo,
      cantidad: quantity,
    })),
  );
}

export function extrasFromOrder(items: OrderItem[]): ExtraLine[] {
  return groupExtras(
    items.map((item) => ({
      nombre: item.extra_nombre,
      unitario: item.extra_unitario,
      cantidad: item.cantidad,
    })),
  );
}

export function extrasTotal(lines: ExtraLine[]) {
  return lines.reduce((sum, line) => sum + line.total, 0);
}

export type PaymentConversion = {
  moneda: string;
  tasa: number;
  total: number;
};

/**
 * Convierte un total en CUP a la moneda del metodo de pago.
 * Devuelve null cuando el metodo no declara tasa: ese metodo cobra en CUP y no
 * hay nada que convertir. Guardar un 1 en su lugar mentiria sobre el pedido.
 *
 * En el checkout esto es solo una vista previa; el importe que vale es el que
 * calcula y guarda la base al crear el pedido.
 */
export function convertTotal(
  total: number,
  method?: { moneda?: string | null; tasa_cup?: number | null } | null,
): PaymentConversion | null {
  const tasa = Number(method?.tasa_cup ?? 0);
  if (!(tasa > 0) || !(total > 0)) return null;
  return {
    moneda: (method?.moneda ?? "").trim() || "USD",
    tasa,
    total: Math.round((total / tasa) * 100) / 100,
  };
}

export function formatConversion(conversion: PaymentConversion) {
  const amount = conversion.total.toLocaleString("es-CU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${conversion.moneda}`;
}

export type StockState = {
  /** Sin unidades: el cliente no puede pedirlo. */
  agotado: boolean;
  /** Queda poco: solo se avisa al admin, el cliente no lo ve. */
  bajo: boolean;
  /** Unidades restantes, o null si el producto no lleva control de stock. */
  restantes: number | null;
};

/**
 * Estado de existencias de un producto.
 *
 * "Agotado" tiene dos caminos y los dos valen: que el admin lo apague a mano
 * con 'disponible', o que el stock llegue a cero. Son cosas distintas — "hoy no
 * lo cocino" no es lo mismo que "se acabo" — pero para el cliente se ven igual.
 */
export function stockState(product: {
  disponible: boolean;
  stock?: number | null;
  stock_minimo?: number | null;
}): StockState {
  const restantes = product.stock == null ? null : Number(product.stock);
  const minimo = Number(product.stock_minimo ?? 0);
  if (restantes == null) {
    return { agotado: !product.disponible, bajo: false, restantes: null };
  }
  return {
    agotado: !product.disponible || restantes <= 0,
    bajo: restantes > 0 && restantes <= minimo,
    restantes,
  };
}

/**
 * Productos que el admin deberia reponer, de menos a mas unidades.
 *
 * Solo entran los que llevan control de stock. Un producto apagado a mano con
 * diez unidades en la nevera no es falta de stock y no debe aparecer aqui.
 */
export function lowStockProducts<T extends { disponible: boolean; stock?: number | null; stock_minimo?: number | null }>(
  products: T[],
): T[] {
  return products
    .filter((product) => {
      const state = stockState(product);
      if (state.restantes == null) return false;
      return state.restantes <= 0 || state.bajo;
    })
    .sort((a, b) => Number(a.stock ?? 0) - Number(b.stock ?? 0));
}
