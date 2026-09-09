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
};

