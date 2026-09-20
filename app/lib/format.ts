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
