import type { OrderStatus } from "./types";

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

