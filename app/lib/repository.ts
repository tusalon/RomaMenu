import { demoCatalog, initialDemoOrders } from "./demo-data";
import { convertTotal, extrasFromOrder, formatDia, formatHora } from "./format";
import { appPath } from "./site-path";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { repairMojibake, repairMojibakeValue } from "./text-encoding";
import type {
  BusinessHours,
  BusinessSettings,
  CartItem,
  Category,
  CheckoutData,
  DeliveryZone,
  Order,
  OrderStatus,
  OrderWindow,
  PaymentMethod,
  Product,
  PublicCatalog,
} from "./types";

const DEMO_CATALOG_KEY = "miguelon-demo-catalog";
const DEMO_ORDERS_KEY = "miguelon-demo-orders";
const DEMO_SESSION_KEY = "miguelon-demo-admin";
const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
const cloudinaryUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();

const CATALOG_TEXT_FIELDS = {
  configuracion_negocio: [
    "nombre_negocio",
    "descripcion",
    "direccion",
    "tiempo_entrega",
    "mensaje_abierto",
    "mensaje_cerrado",
    "texto_bienvenida",
  ],
  categorias: ["nombre", "descripcion"],
  productos: ["nombre", "descripcion", "extra_nombre"],
  zonas_entrega: ["nombre", "tiempo_estimado"],
  metodos_pago: ["nombre", "descripcion"],
} as const;

async function repairRemoteCatalogEncoding() {
  const supabase = getSupabase();
  if (!supabase) return;

  for (const [table, fields] of Object.entries(CATALOG_TEXT_FIELDS)) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;

    for (const record of data ?? []) {
      const changes: Record<string, string> = {};
      for (const field of fields) {
        const current = record[field];
        if (typeof current !== "string") continue;
        const repaired = repairMojibake(current);
        if (repaired !== current) changes[field] = repaired;
      }

      if (Object.keys(changes).length) {
        const { error: updateError } = await supabase
          .from(table)
          .update(changes)
          .eq("id", record.id);
        if (updateError) throw updateError;
      }
    }
  }
}

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
  return repairMojibakeValue(
    readStorage<PublicCatalog>(DEMO_CATALOG_KEY, demoCatalog),
  );
}

export function saveDemoCatalog(catalog: PublicCatalog) {
  writeStorage(DEMO_CATALOG_KEY, repairMojibakeValue(catalog));
}

export function getDemoOrders() {
  return repairMojibakeValue(
    readStorage<Order[]>(DEMO_ORDERS_KEY, initialDemoOrders),
  );
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

  return repairMojibakeValue({
    settings: (settingsResult.data ?? demoCatalog.settings) as BusinessSettings,
    categories: (categoriesResult.data ?? []) as Category[],
    products: (productsResult.data ?? []) as Product[],
    zones: (zonesResult.data ?? []) as DeliveryZone[],
    paymentMethods: (paymentsResult.data ?? []) as PaymentMethod[],
  });
}

export async function createOrder(
  form: CheckoutData,
  cart: CartItem[],
  zone: DeliveryZone,
  paymentMethod?: PaymentMethod | null,
): Promise<Order> {
  const supabase = getSupabase();
  const items = cart.map(({ product, quantity }) => {
    const extraNombre = (product.extra_nombre ?? "").trim();
    const extraUnitario = Number(product.extra_costo ?? 0);
    const cobraExtra = Boolean(extraNombre) && extraUnitario > 0;
    return {
      producto_id: product.id,
      nombre_producto: product.nombre,
      cantidad: quantity,
      precio_unitario: product.precio,
      subtotal: product.precio * quantity,
      extra_nombre: cobraExtra ? extraNombre : "",
      extra_unitario: cobraExtra ? extraUnitario : 0,
      extra_subtotal: cobraExtra ? extraUnitario * quantity : 0,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const extras = items.reduce((sum, item) => sum + item.extra_subtotal, 0);

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
      costo_extras: Number(result.costo_extras ?? 0),
      total: Number(result.total),
      moneda_pago: String(result.moneda_pago ?? ""),
      tasa_cambio: result.tasa_cambio == null ? null : Number(result.tasa_cambio),
      total_moneda: result.total_moneda == null ? null : Number(result.total_moneda),
      fecha_entrega: result.fecha_entrega ?? null,
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
    costo_extras: extras,
    total: subtotal + zone.costo + extras,
    ...demoConversion(subtotal + zone.costo + extras, paymentMethod),
    estado: "nuevo",
    origen: "web-demo",
    created_at: new Date().toISOString(),
  };
  writeStorage(DEMO_ORDERS_KEY, [order, ...orders]);
  return order;
}

function demoConversion(total: number, paymentMethod?: PaymentMethod | null) {
  const conversion = convertTotal(total, paymentMethod);
  if (!conversion) return { moneda_pago: "", tasa_cambio: null, total_moneda: null };
  return {
    moneda_pago: conversion.moneda,
    tasa_cambio: conversion.tasa,
    total_moneda: conversion.total,
  };
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

  const extraLines = extrasFromOrder(order.items);
  const extraBlock = extraLines.length
    ? [
        "OTROS GASTOS:",
        "",
        ...extraLines.map(
          (line) =>
            `${line.cantidad} × ${currency(line.unitario)} en ${line.nombre} — ${currency(line.total)}`,
        ),
        "",
      ]
    : [];

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
    ...extraBlock,
    `Subtotal: ${currency(order.subtotal)}`,
    `Entrega: ${currency(order.costo_entrega)}`,
    ...(order.costo_extras > 0 ? [`Otros gastos: ${currency(order.costo_extras)}`] : []),
    `TOTAL: ${currency(order.total)}`,
    ...(order.total_moneda
      ? [
          `A PAGAR POR ${(payment?.nombre ?? "").toUpperCase()}: ${order.total_moneda.toLocaleString("es-CU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.moneda_pago || "USD"}`,
          `(${Number(order.total).toLocaleString("es-CU")} ${catalog.settings.moneda || "CUP"} ÷ ${Number(order.tasa_cambio ?? 0).toLocaleString("es-CU")})`,
        ]
      : []),
    "",
    ...(order.fecha_entrega ? [`Entrega: ${formatDia(order.fecha_entrega)}`] : []),
    `Método de pago: ${payment?.nombre ?? "Sin especificar"}`,
    `Hora de entrega: ${order.horario_entrega ? formatHora(order.horario_entrega) : "Lo antes posible"}`,
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
  await repairRemoteCatalogEncoding().catch(() => undefined);
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
  if (!profile) return false;
  await repairRemoteCatalogEncoding().catch(() => undefined);
  return true;
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

  return repairMojibakeValue((data ?? []).map((order) => ({
    ...order,
    items: order.pedido_items ?? [],
  }))) as Order[];
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
      supabase.from("horarios_negocio").select("*"),
    ]),
    fetchAdminOrders(),
  ]);

  const [settings, categories, products, zones, payments, hours] = catalog;
  const error = [
    settings.error,
    categories.error,
    products.error,
    zones.error,
    payments.error,
    hours.error,
  ].find(Boolean);
  if (error) throw error;

  return repairMojibakeValue({
    catalog: {
      settings: (settings.data ?? demoCatalog.settings) as BusinessSettings,
      categories: (categories.data ?? []) as Category[],
      products: (products.data ?? []) as Product[],
      zones: (zones.data ?? []) as DeliveryZone[],
      hours: (hours.data ?? []) as BusinessHours[],
      paymentMethods: (payments.data ?? []) as PaymentMethod[],
    },
    orders,
  });
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

/**
 * Borra un producto de verdad, no lo archiva.
 *
 * El historial de pedidos no se rompe: pedido_items guarda el nombre, el
 * precio y los cargos como valores propios, y su clave foranea es
 * 'on delete set null'. Los pedidos viejos siguen mostrando lo que se vendio
 * y a que precio; lo unico que se pierde es el enlace al producto.
 */
export async function deleteProduct(productId: string) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("productos")
      .delete()
      .eq("id", productId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("El producto no existe o no tienes permiso para eliminarlo.");
    return;
  }

  const catalog = getDemoCatalog();
  saveDemoCatalog({
    ...catalog,
    products: catalog.products.filter((product) => product.id !== productId),
  });
}

/**
 * Pregunta a la base si ahora se aceptan pedidos y para que dia. Toda la
 * logica de horario y zona horaria vive en ventana_pedidos(); aqui no se
 * calcula nada, para que la hora del telefono del cliente no cuente.
 */
export async function fetchOrderWindow(): Promise<OrderWindow> {
  const supabase = getSupabase();
  if (!supabase) {
    const hoy = new Date().toISOString().slice(0, 10);
    return { acepta: true, hoy, fecha_entrega: hoy, hora_apertura: null, hora_cierre: null, abre_en: null };
  }
  const { data, error } = await supabase.rpc("ventana_pedidos");
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as OrderWindow;
}

export async function saveBusinessHours(hours: BusinessHours[]) {
  const supabase = getSupabase();
  if (!supabase) return;
  const rows = hours.map(({ dia_semana, hora_apertura, hora_cierre, trabaja }) => ({
    dia_semana,
    trabaja,
    // Un dia que no se trabaja no guarda horas: asi no quedan horarios fantasma.
    hora_apertura: trabaja ? hora_apertura : null,
    hora_cierre: trabaja ? hora_cierre : null,
  }));
  const { error } = await supabase.from("horarios_negocio").upsert(rows, { onConflict: "dia_semana" });
  if (error) throw error;
}

function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/**
 * Suscribe este dispositivo a los avisos push de pedidos nuevos y lo guarda en
 * push_suscripciones. Se puede llamar cada vez que se abre el panel: si ya
 * estaba suscrito, solo refresca la fila.
 *
 * Necesita navegador con Push (Chrome en Android, o la app instalada en iPhone).
 * La APK no lo tiene: su WebView no trae servicio de push.
 */
export async function savePushSubscription() {
  const supabase = getSupabase();
  if (!supabase) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Este navegador no recibe avisos push. En iPhone, instala el panel en la pantalla de inicio.");
  }
  await navigator.serviceWorker.register(appPath("/admin-notifications-sw.js"), { scope: appPath("/admin/") });
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { data, error } = await supabase.functions.invoke("avisar-pedido", { body: { accion: "clave" } });
    if (error) throw new Error(`No se pudo pedir la clave de avisos: ${error.message}`);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(data.publicKey),
    });
  }

  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error("La suscripción de avisos llegó incompleta.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("push_suscripciones").upsert(
    { endpoint, p256dh: keys.p256dh, auth: keys.auth, usuario_id: auth.user?.id ?? null },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
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
