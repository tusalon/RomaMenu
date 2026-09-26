import type { CartItem, OrderItem, OrderStatus, OrderWindow } from "./types";

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
    total: Math.round((total * 100) / tasa + 1e-9) / 100,
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

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "12:30:00" -> "12:30 p. m.". El texto ya es hora de Cuba: solo se formatea. */
export function formatHora(value?: string | null) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const sufijo = h >= 12 ? "p. m." : "a. m.";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** "2026-09-25" -> "viernes 25". Se calcula en UTC para que ninguna zona lo mueva de dia. */
export function formatDia(value?: string | null) {
  if (!value) return "";
  const [y, mo, d] = value.slice(0, 10).split("-").map(Number);
  return `${DIAS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]} ${d}`;
}

/** "2026-09-24T18:00:00" -> "jueves 24 a las 6:00 p. m." */
export function formatMomento(value?: string | null) {
  if (!value) return "";
  const [fecha, hora = "00:00"] = value.replace(" ", "T").split("T");
  return `${formatDia(fecha)} a las ${formatHora(hora)}`;
}

/** El aviso que ve el cliente arriba de la tienda. Nulo si no hay nada que decir. */
export function describeWindow(ventana: OrderWindow | null) {
  if (!ventana) return null;
  const horario = ventana.hora_apertura && ventana.hora_cierre
    ? `de ${formatHora(ventana.hora_apertura)} a ${formatHora(ventana.hora_cierre)}`
    : "";
  if (!ventana.acepta) {
    return ventana.abre_en
      ? `Ahora no recibimos pedidos. Abrimos el ${formatMomento(ventana.abre_en)} para el ${formatDia(ventana.fecha_entrega)}.`
      : null;
  }
  if (ventana.fecha_entrega && ventana.fecha_entrega !== ventana.hoy) {
    return horario
      ? `Estás pidiendo para el ${formatDia(ventana.fecha_entrega)}. Entregamos ${horario}`
      : `Estás pidiendo para el ${formatDia(ventana.fecha_entrega)}.`;
  }
  return horario ? `Hoy entregamos ${horario}` : null;
}

/** "57,000 CUP ÷ 690 = 82.61 USD": la cuenta entera, para que nadie dude. */
export function explainConversion(total: number, conversion: PaymentConversion, monedaLocal = "CUP") {
  return `${Number(total).toLocaleString("es-CU")} ${monedaLocal} ÷ ${conversion.tasa.toLocaleString("es-CU")} = ${formatConversion(conversion)}`;
}

/** Horas cada `paso` minutos entre dos "HH:MM", ambas incluidas. Se guardan en 24 h y se ensenan con formatHora. */
export function timeSlots(desde = "00:00", hasta = "23:30", paso = 30) {
  const aMinutos = (hora: string) => { const [h, m] = hora.split(":").map(Number); return h * 60 + m; };
  const slots: string[] = [];
  for (let m = aMinutos(desde); m <= aMinutos(hasta); m += paso) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

/** Hora actual en La Habana como "HH:MM", sea cual sea la zona del telefono. */
export function horaCuba(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Havana", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(fecha);
}

/**
 * Horas que el cliente puede elegir para su entrega: dentro del horario del dia
 * del pedido y, si es para hoy, a partir de media hora desde ahora. La ultima es
 * media hora antes del cierre.
 */
export function deliverySlots(ventana: OrderWindow | null, ahora = horaCuba()) {
  if (!ventana?.hora_apertura || !ventana.hora_cierre) return [];
  const [hc, mc] = ventana.hora_cierre.split(":").map(Number);
  const ultimo = `${String(Math.floor((hc * 60 + mc - 30) / 60)).padStart(2, "0")}:${String((hc * 60 + mc - 30) % 60).padStart(2, "0")}`;
  const slots = timeSlots(ventana.hora_apertura.slice(0, 5), ultimo);
  if (ventana.fecha_entrega !== ventana.hoy) return slots;
  const [h, m] = ahora.split(":").map(Number);
  const minimo = h * 60 + m + 30;
  return slots.filter((slot) => { const [sh, sm] = slot.split(":").map(Number); return sh * 60 + sm >= minimo; });
}

/** Los pasos que ve el cliente. Varios estados internos caen en el mismo paso. */
export const TRACKING_STEPS = ["Recibido", "Confirmado", "En la cocina", "En camino", "Entregado"] as const;

const STEP_OF: Record<OrderStatus, number> = {
  nuevo: 0,
  pendiente_confirmacion: 0,
  confirmado: 1,
  en_preparacion: 2,
  listo: 2,
  en_camino: 3,
  entregado: 4,
  cancelado: -1,
};

/** Paso actual (0-4) y la hora a la que se llego a cada paso, si consta. */
export function trackingProgress(estado: OrderStatus, historial: { estado: OrderStatus; fecha: string }[] = []) {
  const horas: (string | null)[] = TRACKING_STEPS.map(() => null);
  for (const entrada of historial) {
    const paso = STEP_OF[entrada.estado];
    if (paso >= 0 && !horas[paso]) horas[paso] = entrada.fecha;
  }
  return { paso: STEP_OF[estado], cancelado: estado === "cancelado", horas };
}

/** Enlace de seguimiento de un pedido, en el mismo sitio donde se hizo. */
export function trackingUrl(origin: string, basePath: string, orderId: string) {
  return `${origin}${basePath}?id=${encodeURIComponent(orderId)}`;
}
