export type OrderStatus =
  | "nuevo"
  | "pendiente_confirmacion"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "en_camino"
  | "entregado"
  | "cancelado";

export type Category = {
  id: string;
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  orden: number;
  activa: boolean;
};

export type Product = {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string;
  imagen_url: string;
  precio: number;
  precio_anterior?: number | null;
  extra_nombre: string;
  extra_costo: number;
  /** Unidades restantes. Nulo = sin control de stock, nunca se agota solo. */
  stock?: number | null;
  /** Umbral de aviso al admin. Solo cuenta si stock no es nulo. */
  stock_minimo: number;
  disponible: boolean;
  recomendado: boolean;
  nuevo: boolean;
  activo: boolean;
  orden: number;
};

export type DeliveryZone = {
  id: string;
  nombre: string;
  costo: number;
  pedido_minimo?: number | null;
  tiempo_estimado: string;
  activa: boolean;
};

export type PaymentMethod = {
  id: string;
  nombre: string;
  descripcion?: string;
  /** Moneda en la que cobra el metodo: "USD", "EUR"... Vacio si cobra en CUP. */
  moneda: string;
  /** Cuantos CUP vale una unidad de esa moneda. Nulo = no se convierte nada. */
  tasa_cup?: number | null;
  activo: boolean;
};

export type BusinessSettings = {
  id: string;
  nombre_negocio: string;
  descripcion: string;
  logo_url?: string;
  portada_url: string;
  whatsapp: string;
  telefono: string;
  direccion: string;
  moneda: string;
  simbolo_moneda: string;
  pedido_minimo: number;
  tiempo_entrega: string;
  abierto: boolean;
  aceptar_fuera_horario: boolean;
  mensaje_abierto: string;
  mensaje_cerrado: string;
  color_primario: string;
  color_secundario: string;
  texto_bienvenida: string;
  /** Categoria que se ofrece al cerrar el pedido. Nula = no se ofrece ninguna. */
  categoria_sugerencias_id?: string | null;
  /** Hora de la vispera a la que abren los pedidos del dia siguiente. Nula = solo en horario. */
  pedidos_vispera_desde?: string | null;
};

/** Un dia de la semana en horarios_negocio. dia_semana: 0 domingo ... 6 sabado. */
export type BusinessHours = {
  id?: string;
  dia_semana: number;
  hora_apertura: string | null;
  hora_cierre: string | null;
  trabaja: boolean;
};

/**
 * Lo que responde ventana_pedidos(). Fechas y horas ya vienen en hora de Cuba
 * como texto de reloj de pared ("2026-09-25", "12:30:00"): no se convierten.
 */
export type OrderWindow = {
  acepta: boolean;
  hoy: string;
  fecha_entrega: string | null;
  hora_apertura: string | null;
  hora_cierre: string | null;
  abre_en: string | null;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CheckoutData = {
  nombre_cliente: string;
  telefono: string;
  direccion: string;
  zona_id: string;
  referencia: string;
  metodo_pago_id: string;
  horario_entrega: string;
  observaciones: string;
};

export type OrderItem = {
  id?: string;
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  extra_nombre: string;
  extra_unitario: number;
  extra_subtotal: number;
};

export type Order = CheckoutData & {
  id: string;
  numero_pedido: string;
  items: OrderItem[];
  subtotal: number;
  costo_entrega: number;
  costo_extras: number;
  total: number;
  /** Conversion congelada el dia del pedido. Vacia si se cobro en CUP. */
  moneda_pago: string;
  tasa_cambio?: number | null;
  total_moneda?: number | null;
  /** Dia de servicio para el que es el pedido, en hora de Cuba. */
  fecha_entrega?: string | null;
  estado: OrderStatus;
  origen: string;
  notas_internas?: string;
  created_at: string;
  updated_at?: string;
};

export type PublicCatalog = {
  settings: BusinessSettings;
  categories: Category[];
  products: Product[];
  zones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
  /** Solo lo carga el panel; la tienda pregunta a ventana_pedidos(). */
  hours?: BusinessHours[];
};

