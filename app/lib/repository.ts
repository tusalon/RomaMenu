import { demoCatalog, initialDemoOrders } from "./demo-data";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  BusinessSettings,
  CartItem,
  Category,
  CheckoutData,
  DeliveryZone,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  PublicCatalog,
} from "./types";

const DEMO_CATALOG_KEY = "miguelon-demo-catalog";
const DEMO_ORDERS_KEY = "miguelon-demo-orders";
const DEMO_SESSION_KEY = "miguelon-demo-admin";
const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
const cloudinaryUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();

function canUseStorage() {
  return typeof window !== "undefined";
}

function readStorage<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (canUseStorage()) window.localStorage.setItem(key, JSON.stringify(value));
}

export function getDemoCatalog() {
  return readStorage<PublicCatalog>(DEMO_CATALOG_KEY, demoCatalog);
}

export function saveDemoCatalog(catalog: PublicCatalog) {
  writeStorage(DEMO_CATALOG_KEY, catalog);
}

export function getDemoOrders() {
  return readStorage<Order[]>(DEMO_ORDERS_KEY, initialDemoOrders);
}

export async function fetchPublicCatalog(): Promise<PublicCatalog> {
  const supabase = getSupabase();
  if (!supabase) return getDemoCatalog();

  const [settingsResult, categoriesResult, productsResult, zonesResult, paymentsResult] =
    await Promise.all([
      supabase.from("configuracion_negocio").select("*").limit(1).maybeSingle(),
      supabase.from("categorias").select("*").eq("activa", true).order("orden"),
      supabase.from("productos").select("*").eq("activo", true).order("orden"),
      supabase.from("zonas_entrega").select("*").eq("activa", true).order("nombre"),
      supabase.from("metodos_pago").select("*").eq("activo", true).order("nombre"),
    ]);

  const firstError = [
    settingsResult.error,
    categoriesResult.error,
    productsResult.error,
    zonesResult.error,
    paymentsResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  return {
    settings: (settingsResult.data ?? demoCatalog.settings) as BusinessSettings,
    categories: (categoriesResult.data ?? []) as Category[],
    products: (productsResult.data ?? []) as Product[],
    zones: (zonesResult.data ?? []) as DeliveryZone[],
    paymentMethods: (paymentsResult.data ?? []) as PaymentMethod[],
  };
}

export async function createOrder(
  form: CheckoutData,
  cart: CartItem[],
  zone: DeliveryZone,
): Promise<Order> {
  const supabase = getSupabase();
  const items = cart.map(({ product, quantity }) => ({
    producto_id: product.id,
    nombre_producto: product.nombre,
    cantidad: quantity,
    precio_unitario: product.precio,
    subtotal: product.precio * quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (supabase) {
    const { data, error } = await supabase.rpc("crear_pedido_publico", {
      p_cliente: form,
      p_items: items.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return {
      ...form,
      id: String(result.id),
      numero_pedido: String(result.numero_pedido),
      items,
      subtotal: Number(result.subtotal),
      costo_entrega: Number(result.costo_entrega),
      total: Number(result.total),
      estado: "nuevo",
      origen: "web",
      created_at: new Date().toISOString(),
    };
  }

  const orders = getDemoOrders();
  const nextNumber = String(
    Math.max(0, ...orders.map((order) => Number(order.numero_pedido))) + 1,
  ).padStart(4, "0");
  const order: Order = {
    ...form,
    id: crypto.randomUUID(),
    numero_pedido: nextNumber,
    items,
    subtotal,
    costo_entrega: zone.costo,
    total: subtotal + zone.costo,
    estado: "nuevo",
    origen: "web-demo",
    created_at: new Date().toISOString(),
  };
  writeStorage(DEMO_ORDERS_KEY, [order, ...orders]);
  return order;
}

export function buildWhatsAppMessage(
  order: Order,
  catalog: PublicCatalog,
): string {
  const zone = catalog.zones.find((item) => item.id === order.zona_id);
  const payment = catalog.paymentMethods.find(
    (item) => item.id === order.metodo_pago_id,
  );
  const currency = (value: number) =>
    `${catalog.settings.simbolo_moneda}${value.toLocaleString("es-CU")}`;
  const productLines = order.items
    .map(
      (item) =>
        `${item.cantidad} × ${item.nombre_producto} — ${currency(item.subtotal)}`,
    )
    .join("\n");

  return [
    "NUEVO PEDIDO — LA COCINA DE MIGUELÓN",
    "",
    `Pedido: #${order.numero_pedido}`,
    "",
    `Cliente: ${order.nombre_cliente}`,
    `Teléfono: ${order.telefono}`,
    `Dirección: ${order.direccion}`,
    `Zona: ${zone?.nombre ?? "Sin especificar"}`,
    `Referencia: ${order.referencia || "Sin referencia"}`,
    "",
    "PRODUCTOS:",
    "",
    productLines,
    "",
    `Subtotal: ${currency(order.subtotal)}`,
    `Entrega: ${currency(order.costo_entrega)}`,
    `TOTAL: ${currency(order.total)}`,
    "",
    `Método de pago: ${payment?.nombre ?? "Sin especificar"}`,
    `Horario solicitado: ${order.horario_entrega || "Lo antes posible"}`,
    "",
    `Observaciones: ${order.observaciones || "Ninguna"}`,
  ].join("\n");
}

export async function signInAdmin(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) {
    if (!email || password.length < 6) {
      throw new Error("Introduce un correo y una contraseña de al menos 6 caracteres.");
    }
    writeStorage(DEMO_SESSION_KEY, { email, demo: true });
    return { email, demo: true };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile } = await supabase
    .from("perfiles_admin")
    .select("id")
    .eq("id", data.user.id)
    .eq("activo", true)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error("Esta cuenta no tiene acceso administrativo activo.");
  }
  return data.user;
}

export async function signOutAdmin() {
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
  if (canUseStorage()) window.localStorage.removeItem(DEMO_SESSION_KEY);
}

export async function hasAdminSession() {
  const supabase = getSupabase();
  if (!supabase) return Boolean(readStorage(DEMO_SESSION_KEY, null));
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const { data: profile } = await supabase
    .from("perfiles_admin")
    .select("id")
    .eq("id", data.session.user.id)
    .eq("activo", true)
    .maybeSingle();
  return Boolean(profile);
}

export async function fetchAdminOrders(limit?: number): Promise<Order[]> {
  const supabase = getSupabase();
  if (!supabase) {
    const orders = getDemoOrders();
    return limit ? orders.slice(0, limit) : orders;
  }

  let query = supabase
    .from("pedidos")
    .select("*, pedido_items(*)")
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((order) => ({
    ...order,
    items: order.pedido_items ?? [],
  })) as Order[];
}

export async function fetchAdminData() {
  const supabase = getSupabase();
  if (!supabase) return { catalog: getDemoCatalog(), orders: getDemoOrders() };

  const [catalog, orders] = await Promise.all([
    Promise.all([
      supabase.from("configuracion_negocio").select("*").limit(1).maybeSingle(),
      supabase.from("categorias").select("*").order("orden"),
      supabase.from("productos").select("*").order("orden"),
      supabase.from("zonas_entrega").select("*").order("nombre"),
      supabase.from("metodos_pago").select("*").order("nombre"),
    ]),
    fetchAdminOrders(),
  ]);

  const [settings, categories, products, zones, payments] = catalog;
  const error = [
    settings.error,
    categories.error,
    products.error,
    zones.error,
    payments.error,
  ].find(Boolean);
  if (error) throw error;

  return {
    catalog: {
      settings: (settings.data ?? demoCatalog.settings) as BusinessSettings,
      categories: (categories.data ?? []) as Category[],
      products: (products.data ?? []) as Product[],
      zones: (zones.data ?? []) as DeliveryZone[],
      paymentMethods: (payments.data ?? []) as PaymentMethod[],
    },
    orders,
  };
}

type CatalogCollection = "products" | "categories" | "zones" | "paymentMethods";
type TableName = "productos" | "categorias" | "zonas_entrega" | "metodos_pago";

export async function saveCatalogRecord(
  collection: CatalogCollection,
  table: TableName,
  record: Product | Category | DeliveryZone | PaymentMethod,
) {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from(table).upsert(record);
    if (error) throw error;
    return;
  }

  const catalog = getDemoCatalog();
  const current = catalog[collection] as Array<{ id: string }>;
  const next = current.some((item) => item.id === record.id)
    ? current.map((item) => (item.id === record.id ? record : item))
    : [record, ...current];
  saveDemoCatalog({ ...catalog, [collection]: next });
}

export async function archiveProduct(productId: string) {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("productos")
      .update({ activo: false })
      .eq("id", productId);
    if (error) throw error;
    return;
  }
  const catalog = getDemoCatalog();
  saveDemoCatalog({
    ...catalog,
    products: catalog.products.map((product) =>
      product.id === productId ? { ...product, activo: false } : product,
    ),
  });
}

export async function saveBusinessSettings(settings: BusinessSettings) {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("configuracion_negocio")
      .upsert(settings);
    if (error) throw error;
    return;
  }
  const catalog = getDemoCatalog();
  saveDemoCatalog({ ...catalog, settings });
}

export async function updateOrder(
  orderId: string,
  changes: { estado?: OrderStatus; notas_internas?: string },
) {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("pedidos").update(changes).eq("id", orderId);
    if (error) throw error;
    return;
  }
  const orders = getDemoOrders().map((order) =>
    order.id === orderId
      ? { ...order, ...changes, updated_at: new Date().toISOString() }
      : order,
  );
  writeStorage(DEMO_ORDERS_KEY, orders);
}

export async function deleteOrder(orderId: string) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", orderId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("El pedido no existe o no tienes permiso para eliminarlo.");
    return;
  }

  writeStorage(
    DEMO_ORDERS_KEY,
    getDemoOrders().filter((order) => order.id !== orderId),
  );
}

export async function deleteDeliveryZone(zoneId: string) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("zonas_entrega")
      .delete()
      .eq("id", zoneId)
      .select("id")
      .maybeSingle();
    if (error?.code === "23503") {
      throw new Error(
        "Esta zona está vinculada a pedidos existentes. Desactívala para conservar el historial.",
      );
    }
    if (error) throw error;
    if (!data) throw new Error("La zona no existe o no tienes permiso para eliminarla.");
    return;
  }

  const catalog = getDemoCatalog();
  saveDemoCatalog({
    ...catalog,
    zones: catalog.zones.filter((zone) => zone.id !== zoneId),
  });
}

export function isCloudinaryConfigured() {
  return Boolean(cloudinaryCloudName && cloudinaryUploadPreset);
}

export async function uploadProductImage(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Usa una imagen JPG, PNG o WebP.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("La imagen no puede superar 8 MB.");
  }
  if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error(
      "Cloudinary aún no está configurado. Añade el cloud name y el unsigned upload preset.",
    );
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", cloudinaryUploadPreset);
  body.append("folder", "roma-menu/products");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/image/upload`,
    { method: "POST", body },
  );
  const result = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "Cloudinary no pudo guardar la imagen.");
  }

  return result.secure_url.replace(
    "/upload/",
    "/upload/f_auto,q_auto,c_limit,w_1400/",
  );
}

export { isSupabaseConfigured };
