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

export async function fetchAdminData() {
  const supabase = getSupabase();
  if (!supabase) return { catalog: getDemoCatalog(), orders: getDemoOrders() };

  const [catalog, ordersResult] = await Promise.all([
    Promise.all([
      supabase.from("configuracion_negocio").select("*").limit(1).maybeSingle(),
      supabase.from("categorias").select("*").order("orden"),
      supabase.from("productos").select("*").order("orden"),
      supabase.from("zonas_entrega").select("*").order("nombre"),
      supabase.from("metodos_pago").select("*").order("nombre"),
    ]),
    supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .order("created_at", { ascending: false }),
  ]);

  const [settings, categories, products, zones, payments] = catalog;
  const error = [
    settings.error,
    categories.error,
    products.error,
    zones.error,
    payments.error,
    ordersResult.error,
  ].find(Boolean);
  if (error) throw error;

  const orders = (ordersResult.data ?? []).map((order) => ({
    ...order,
    items: order.pedido_items ?? [],
  })) as Order[];

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

export async function uploadProductImage(file: File) {
  const supabase = getSupabase();
  if (!supabase) return URL.createObjectURL(file);
  const extension = file.name.split(".").pop() || "jpg";
  const path = `products/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export { isSupabaseConfigured };
