"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  BarChart3,
  BellRing,
  Archive,
  Boxes,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { extrasFromOrder, formatCurrency, formatDate, lowStockProducts, orderStatusLabels, stockState } from "@/app/lib/format";
import { appPath } from "@/app/lib/site-path";
import {
  archiveProduct,
  deleteProduct,
  deleteDeliveryZone,
  deleteOrder,
  fetchAdminData,
  fetchAdminOrders,
  hasAdminSession,
  isCloudinaryConfigured,
  isSupabaseConfigured,
  saveBusinessSettings,
  saveCatalogRecord,
  signOutAdmin,
  updateOrder,
  uploadProductImage,
} from "@/app/lib/repository";
import { getSupabase } from "@/app/lib/supabase";
import type {
  BusinessSettings,
  Category,
  DeliveryZone,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  PublicCatalog,
} from "@/app/lib/types";

type Section = "dashboard" | "orders" | "products" | "categories" | "zones" | "payments" | "settings";
type NotificationSupport = "checking" | "unsupported" | NotificationPermission;
type OrderAlert = { order: Order; count: number };

const ORDER_POLL_MS = 30000;
const ORDER_REFRESH_LIMIT = 50;
const ADMIN_NOTIFICATION_WORKER = appPath("/admin-notifications-sw.js");
const ADMIN_NOTIFICATION_SCOPE = appPath("/admin/");

function nativePermissionStatus(display: string): NotificationSupport {
  if (display === "granted" || display === "denied") return display;
  return "default";
}

function notificationId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return (hash & 0x7fffffff) || 1;
}

async function showOrderNotification(order: Order, currencySymbol: string) {
  const title = `Nuevo pedido #${order.numero_pedido}`;
  const body = `${order.nombre_cliente} · ${formatCurrency(order.total, currencySymbol)}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId(order.id),
            title,
            body,
            extra: { url: appPath("/admin/") },
            autoCancel: true,
          },
        ],
      });
    } catch {
      // La alerta visible dentro del panel permanece disponible como respaldo.
    }
    return;
  }

  if (!("Notification" in window) || window.Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body,
    data: { url: appPath("/admin/") },
    tag: order.id,
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(ADMIN_NOTIFICATION_WORKER, {
        scope: ADMIN_NOTIFICATION_SCOPE,
      });
      const activeRegistration = registration.active ? registration : await navigator.serviceWorker.ready;
      await activeRegistration.showNotification(title, options);
      return;
    } catch {
      // Algunos navegadores de escritorio aún pueden usar el constructor clásico.
    }
  }

  try {
    const notification = new window.Notification(title, options);
    notification.onclick = () => {
      window.focus();
      window.location.href = appPath("/admin/");
      notification.close();
    };
  } catch {
    // El aviso visible dentro del panel permanece disponible como respaldo.
  }
}

const navItems: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "orders", label: "Pedidos", icon: ClipboardList },
  { id: "products", label: "Productos", icon: ShoppingBag },
  { id: "categories", label: "Categorías", icon: Boxes },
  { id: "zones", label: "Zonas de entrega", icon: MapPinned },
  { id: "payments", label: "Métodos de pago", icon: CreditCard },
  { id: "settings", label: "Configuración", icon: Settings },
];

const sectionTitles: Record<Section, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Vista general", title: "Buenos días, Miguelón" },
  orders: { eyebrow: "Operaciones", title: "Gestión de pedidos" },
  products: { eyebrow: "Catálogo", title: "Productos" },
  categories: { eyebrow: "Catálogo", title: "Categorías" },
  zones: { eyebrow: "Logística", title: "Zonas de entrega" },
  payments: { eyebrow: "Cobros", title: "Métodos de pago" },
  settings: { eyebrow: "Negocio", title: "Configuración" },
};

export function AdminApp() {
  const [section, setSection] = useState<Section>("dashboard");
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationSupport>("checking");
  const [orderAlert, setOrderAlert] = useState<OrderAlert | null>(null);
  const knownOrderIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    let notificationActionListener: ReturnType<typeof LocalNotifications.addListener> | undefined;

    async function checkNotificationPermission() {
      if (Capacitor.isNativePlatform()) {
        try {
          const permission = await LocalNotifications.checkPermissions();
          if (!cancelled) setNotificationPermission(nativePermissionStatus(permission.display));
          notificationActionListener = LocalNotifications.addListener(
            "localNotificationActionPerformed",
            () => {
              window.location.href = appPath("/admin/");
            },
          );
        } catch {
          if (!cancelled) setNotificationPermission("unsupported");
        }
        return;
      }

      if (!cancelled) {
        setNotificationPermission(
          "Notification" in window ? window.Notification.permission : "unsupported",
        );
      }
    }

    void checkNotificationPermission();

    return () => {
      cancelled = true;
      void notificationActionListener?.then((listener) => listener.remove());
    };
  }, []);

  useEffect(() => {
    if (!orderAlert) return;
    const timeout = window.setTimeout(() => setOrderAlert(null), 12000);
    return () => window.clearTimeout(timeout);
  }, [orderAlert]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let stopRealtime: (() => void) | undefined;
    let refreshPromise: Promise<void> | null = null;
    let currencySymbol = "$";

    function refreshOrders(notify: boolean) {
      if (refreshPromise) return refreshPromise;

      refreshPromise = fetchAdminOrders(ORDER_REFRESH_LIMIT)
        .then((nextOrders) => {
          if (cancelled) return;

          const seenIds = knownOrderIds.current;
          const nextIds = new Set(nextOrders.map((order) => order.id));
          const newOrders = notify ? nextOrders.filter((order) => !seenIds.has(order.id)) : [];

          knownOrderIds.current = new Set([...seenIds, ...nextIds]);
          setOrders((current) => [
            ...nextOrders,
            ...current.filter((order) => !nextIds.has(order.id)),
          ]);
          setError("");

          if (newOrders.length) {
            setOrderAlert({ order: newOrders[0], count: newOrders.length });
            newOrders.forEach((order) => void showOrderNotification(order, currencySymbol));
          }
        })
        .finally(() => {
          refreshPromise = null;
        });

      return refreshPromise;
    }

    function reportRefreshError(requestError: unknown) {
      if (!cancelled) {
        setError(requestError instanceof Error ? requestError.message : "No pudimos actualizar los pedidos.");
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshOrders(true).catch(reportRefreshError);
    }

    async function startAdmin() {
      try {
        const active = await hasAdminSession();
        if (cancelled) return;
        if (!active) {
          window.location.href = appPath("/admin/login/");
          return;
        }

        const data = await fetchAdminData();
        if (cancelled) return;

        currencySymbol = data.catalog.settings.simbolo_moneda;
        knownOrderIds.current = new Set(data.orders.map((order) => order.id));
        setCatalog(data.catalog);
        setOrders(data.orders);

        const supabase = getSupabase();
        if (supabase) {
          const channel = supabase
            .channel("admin-new-orders")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "pedidos" },
              () => void refreshOrders(true).catch(reportRefreshError),
            )
            .subscribe();
          stopRealtime = () => void supabase.removeChannel(channel);
        }

        timer = window.setInterval(() => void refreshOrders(true).catch(reportRefreshError), ORDER_POLL_MS);
        window.addEventListener("focus", refreshWhenVisible);
        document.addEventListener("visibilitychange", refreshWhenVisible);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No pudimos cargar el panel.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void startAdmin();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stopRealtime?.();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  async function handleLogout() {
    await signOutAdmin();
    window.location.href = appPath("/admin/login/");
  }

  function navigate(next: Section) {
    setSection(next);
    setSidebarOpen(false);
  }

  async function enableNotifications() {
    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await LocalNotifications.requestPermissions();
        setNotificationPermission(nativePermissionStatus(permission.display));
      } catch {
        setNotificationPermission("unsupported");
      }
      return;
    }

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
  }

  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" size={27} /> Preparando el panel…</div>;
  if (!catalog) return <div className="admin-loading">{error || "No fue posible abrir el panel."}</div>;

  const title = sectionTitles[section];
  return (
    <div className="admin-shell" style={{ "--brand": catalog.settings.color_primario, "--accent": catalog.settings.color_secundario } as React.CSSProperties}>
      <aside className={sidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
        <a className="brand" href={appPath("/")}><span className="brand-mark"><ChefHat size={24} /></span><span><strong>La Cocina</strong><small>de Miguelón</small></span></a>
        <nav className="admin-nav" aria-label="Panel administrativo">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={section === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)}><Icon size={17} /> {item.label}</button>;
          })}
        </nav>
        <div className="admin-sidebar-bottom"><button type="button" onClick={handleLogout}><LogOut size={17} /> Cerrar sesión</button></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-title"><small>{title.eyebrow}</small><h1>{title.title}</h1></div>
          <div className="admin-top-actions">
            {!isSupabaseConfigured() && <span className="admin-mode">Modo demostración</span>}
            {notificationPermission === "default" && (
              <button className="button button-secondary button-small" type="button" onClick={enableNotifications}>
                <BellRing size={15} /> Activar alertas
              </button>
            )}
            {notificationPermission === "granted" && <span className="admin-mode admin-mode-success"><BellRing size={13} /> Alertas activas</span>}
            {notificationPermission === "denied" && <span className="admin-mode" title="Permite las notificaciones desde la configuración del navegador.">Alertas bloqueadas</span>}
            {notificationPermission === "unsupported" && <span className="admin-mode">Alertas no disponibles</span>}
            <a className="button button-secondary button-small" href={appPath("/")} target="_blank" rel="noreferrer">Ver tienda</a>
            <button className="icon-button admin-mobile-menu" type="button" onClick={() => setSidebarOpen((value) => !value)}>{sidebarOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </header>
        {error && <div className="inline-notice">{error}</div>}
        {section === "dashboard" && <Dashboard orders={orders} catalog={catalog} onOpenOrders={() => navigate("orders")} />}
        {section === "orders" && <OrdersSection orders={orders} catalog={catalog} setOrders={setOrders} />}
        {section === "products" && <ProductsSection catalog={catalog} setCatalog={setCatalog} />}
        {section === "categories" && <CategoriesSection catalog={catalog} setCatalog={setCatalog} />}
        {section === "zones" && <ZonesSection catalog={catalog} setCatalog={setCatalog} />}
        {section === "payments" && <PaymentsSection catalog={catalog} setCatalog={setCatalog} />}
        {section === "settings" && <SettingsSection catalog={catalog} setCatalog={setCatalog} />}
      </main>
      {orderAlert && (
        <button
          className="toast admin-order-toast"
          type="button"
          onClick={() => {
            navigate("orders");
            setOrderAlert(null);
          }}
        >
          <BellRing size={17} />
          {orderAlert.count > 1
            ? `${orderAlert.count} pedidos nuevos`
            : `Nuevo pedido #${orderAlert.order.numero_pedido} de ${orderAlert.order.nombre_cliente}`}
        </button>
      )}
    </div>
  );
}

function Dashboard({ orders, catalog, onOpenOrders }: { orders: Order[]; catalog: PublicCatalog; onOpenOrders: () => void }) {
  const lowStock = useMemo(() => lowStockProducts(catalog.products), [catalog.products]);
  const today = new Date().toDateString();
  const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === today);
  const delivered = todayOrders.filter((order) => order.estado === "entregado");
  const todaySales = delivered.reduce((sum, order) => sum + Number(order.total), 0);
  const stats = [
    { label: "Pedidos nuevos", value: orders.filter((order) => order.estado === "nuevo").length, helper: "Requieren atención", icon: ClipboardList },
    { label: "Pedidos de hoy", value: todayOrders.length, helper: "Todos los estados", icon: ShoppingBag },
    { label: "En preparación", value: orders.filter((order) => order.estado === "en_preparacion").length, helper: "En la cocina", icon: PackageCheck },
    { label: "Ventas del día", value: formatCurrency(todaySales, catalog.settings.simbolo_moneda), helper: `${delivered.length} entregados`, icon: TrendingUp },
  ];
  const popular = useMemo(() => {
    const count = new Map<string, number>();
    orders.flatMap((order) => order.items).forEach((item) => count.set(item.nombre_producto, (count.get(item.nombre_producto) ?? 0) + item.cantidad));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [orders]);

  return <>
    <section className="stats-grid">{stats.map((stat) => { const Icon = stat.icon; return <article className="stat-card" key={stat.label}><div className="stat-card-head"><span>{stat.label}</span><i><Icon size={17} /></i></div><strong>{stat.value}</strong><small>{stat.helper}</small></article>; })}</section>
    <div className="dashboard-columns">
      <section className="admin-card"><div className="admin-card-header"><div><h2>Pedidos recientes</h2><p>Los últimos movimientos de la cocina</p></div><button className="table-action" type="button" onClick={onOpenOrders}>Ver todos</button></div><OrdersTable orders={orders.slice(0, 6)} symbol={catalog.settings.simbolo_moneda} onSelect={onOpenOrders} /></section>
      <section className="admin-card popular-card">
        <div className="admin-card-header"><div><h2>Reponer</h2><p>{lowStock.length ? `${lowStock.length} por debajo del aviso` : "Todo con existencias"}</p></div><PackageCheck size={18} /></div>
        <div className="simple-list restock-list">
          {lowStock.length ? lowStock.map((product) => {
            const restantes = Number(product.stock ?? 0);
            return <div key={product.id}><span className="list-index"><Boxes size={15} /></span><div><strong>{product.nombre}</strong><small>Aviso cuando queden {product.stock_minimo}</small></div><span className={`status-badge ${restantes > 0 ? "en_preparacion" : "cancelado"}`}>{restantes > 0 ? `Quedan ${restantes}` : "Agotado"}</span></div>;
          }) : <p className="empty-admin">Ningún producto con control de stock está bajo mínimos.</p>}
        </div>
      </section>
      <section className="admin-card popular-card"><div className="admin-card-header"><div><h2>Más pedidos</h2><p>Preferencias de tus clientes</p></div><BarChart3 size={18} /></div><div className="popular-list">{popular.length ? popular.map(([name, count], index) => <div key={name}><span>{index + 1}</span><strong>{name}</strong><b>{count} uds.</b></div>) : <p>Aún no hay suficientes pedidos.</p>}</div></section>
    </div>
  </>;
}

function OrdersTable({ orders, symbol, onSelect, onDelete }: { orders: Order[]; symbol: string; onSelect: (order: Order) => void; onDelete?: (order: Order) => void }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Hora</th><th>Estado</th><th>Total</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className={order.estado === "nuevo" ? "is-new" : ""}><td className="order-number">#{order.numero_pedido}</td><td>{order.nombre_cliente}</td><td>{formatDate(order.created_at)}</td><td><span className={`status-badge ${order.estado}`}>{orderStatusLabels[order.estado]}</span></td><td><strong>{formatCurrency(order.total, symbol)}</strong></td><td><div className="table-row-actions"><button className="table-action" type="button" onClick={() => onSelect(order)}>Ver detalle</button>{onDelete && <button className="table-action danger" type="button" aria-label={`Eliminar pedido #${order.numero_pedido}`} onClick={() => onDelete(order)}><Trash2 size={12} /> Eliminar</button>}</div></td></tr>)}</tbody></table>{!orders.length && <div className="empty-admin">No hay pedidos con estos filtros.</div>}</div>;
}

function OrdersSection({ orders, catalog, setOrders }: { orders: Order[]; catalog: PublicCatalog; setOrders: React.Dispatch<React.SetStateAction<Order[]>> }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState("");
  const filtered = orders.filter((order) => {
    const needle = search.toLocaleLowerCase("es");
    const matchesSearch = !needle || order.numero_pedido.includes(needle) || order.nombre_cliente.toLocaleLowerCase("es").includes(needle) || order.telefono.includes(needle);
    const matchesStatus = status === "all" || order.estado === status;
    const matchesDate = !date || order.created_at.startsWith(date);
    return matchesSearch && matchesStatus && matchesDate;
  });

  async function changeOrder(order: Order, changes: { estado?: OrderStatus; notas_internas?: string }) {
    await updateOrder(order.id, changes);
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...changes, updated_at: new Date().toISOString() } : item));
    setSelected((current) => current?.id === order.id ? { ...current, ...changes } : current);
  }

  async function removeOrder(order: Order) {
    if (!window.confirm(`¿Eliminar definitivamente el pedido #${order.numero_pedido}? Esta acción no se puede deshacer.`)) return;
    setActionError("");
    try {
      await deleteOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelected((current) => current?.id === order.id ? null : current);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo eliminar el pedido.");
    }
  }

  if (selected) return <section className="admin-card"><div className="admin-card-header"><div><button className="back-button" type="button" onClick={() => setSelected(null)}>← Volver a pedidos</button><h2>Pedido #{selected.numero_pedido}</h2><p>Recibido {formatDate(selected.created_at)}</p></div><div className="admin-top-actions"><button className="button button-danger button-small" type="button" onClick={() => removeOrder(selected)}><Trash2 size={15} /> Eliminar pedido</button><button className="button button-secondary button-small" type="button" onClick={() => window.print()}><Printer size={15} /> Imprimir</button><a className="button button-primary button-small" href={`https://wa.me/${selected.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Contactar</a></div></div>{actionError && <div className="inline-notice">{actionError}</div>}<div className="order-detail"><div className="order-detail-grid"><div className="detail-block"><small>Cliente</small><strong>{selected.nombre_cliente}</strong><span>{selected.telefono}</span></div><div className="detail-block"><small>Entrega</small><strong>{selected.direccion}</strong><span>{catalog.zones.find((zone) => zone.id === selected.zona_id)?.nombre} · {selected.referencia || "Sin referencia"}</span></div></div><div className="order-products">{selected.items.map((item) => <div key={`${item.producto_id}-${item.nombre_producto}`}><span>{item.cantidad} × {item.nombre_producto}</span><strong>{formatCurrency(item.subtotal, catalog.settings.simbolo_moneda)}</strong></div>)}</div>{extrasFromOrder(selected.items).map((line) => <div className="order-products" key={`${line.nombre}-${line.unitario}`}><div><span>{line.cantidad} × {formatCurrency(line.unitario, catalog.settings.simbolo_moneda)} en {line.nombre}</span><strong>{formatCurrency(line.total, catalog.settings.simbolo_moneda)}</strong></div></div>)}<div className="order-total"><span>Total</span><strong>{formatCurrency(selected.total, catalog.settings.simbolo_moneda)}</strong></div><div className="admin-form order-controls"><label className="field"><span>Estado del pedido</span><select value={selected.estado} onChange={(event) => changeOrder(selected, { estado: event.target.value as OrderStatus })}>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Notas internas</span><textarea rows={3} value={notes || selected.notas_internas || ""} onChange={(event) => setNotes(event.target.value)} placeholder="Solo visible para administración" /></label><div className="form-actions"><button className="button button-secondary button-small" type="button" onClick={() => changeOrder(selected, { notas_internas: notes })}>Guardar notas</button><button className="button button-danger button-small" type="button" onClick={() => changeOrder(selected, { estado: "cancelado" })}>Cancelar pedido</button><button className="button button-primary button-small" type="button" onClick={() => changeOrder(selected, { estado: "entregado" })}>Marcar entregado</button></div></div></div></section>;

  return <><div className="admin-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por número, cliente o teléfono" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>{actionError && <div className="inline-notice">{actionError}</div>}<section className="admin-card"><div className="admin-card-header"><div><h2>Todos los pedidos</h2><p>{filtered.length} resultados</p></div></div><OrdersTable orders={filtered} symbol={catalog.settings.simbolo_moneda} onDelete={removeOrder} onSelect={(order) => { setSelected(order); setNotes(order.notas_internas || ""); setActionError(""); }} /></section></>;
}

function ProductsSection({ catalog, setCatalog }: { catalog: PublicCatalog; setCatalog: React.Dispatch<React.SetStateAction<PublicCatalog | null>> }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  async function saved(product: Product) {
    await saveCatalogRecord("products", "productos", product);
    setCatalog((current) => current ? { ...current, products: current.products.some((item) => item.id === product.id) ? current.products.map((item) => item.id === product.id ? product : item) : [product, ...current.products] } : current);
    setEditing(null); setCreating(false);
  }
  const [actionError, setActionError] = useState("");
  async function remove(product: Product) {
    if (!window.confirm(`¿Eliminar ${product.nombre} para siempre? Los pedidos anteriores conservan su nombre y su precio, pero el producto no se podrá recuperar. Si solo quieres quitarlo del catálogo, archívalo.`)) return;
    setActionError("");
    try {
      await deleteProduct(product.id);
      setCatalog((current) => current ? { ...current, products: current.products.filter((item) => item.id !== product.id) } : current);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo eliminar el producto.");
    }
  }
  async function archive(product: Product) {
    if (!window.confirm(`¿Archivar ${product.nombre}? Dejará de aparecer en el catálogo.`)) return;
    await archiveProduct(product.id);
    setCatalog((current) => current ? { ...current, products: current.products.map((item) => item.id === product.id ? { ...item, activo: false } : item) } : current);
  }
  if (creating || editing) return <ProductEditor product={editing} catalog={catalog} onCancel={() => { setEditing(null); setCreating(false); }} onSave={saved} />;
  return <><div className="admin-toolbar"><label className="search-box"><Search size={17} /><input placeholder="Buscar productos" /></label><button className="button button-primary button-small" type="button" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo producto</button></div>{actionError && <div className="inline-notice">{actionError}</div>}<div className="admin-grid">{catalog.products.map((product) => <article className="manage-card" key={product.id}><img className="manage-card-image" src={product.imagen_url} alt={product.nombre} /><h3>{product.nombre}</h3><p>{product.descripcion}</p><div className="manage-card-meta"><strong>{formatCurrency(product.precio, catalog.settings.simbolo_moneda)}</strong>{(() => { const stock = stockState(product); const label = !product.activo ? "Archivado" : stock.agotado ? "Agotado" : stock.restantes != null ? `${stock.restantes} en stock` : "Disponible"; const tone = !product.activo ? "cancelado" : stock.agotado ? "cancelado" : stock.bajo ? "en_preparacion" : "entregado"; return <span className={`status-badge ${tone}`}>{label}</span>; })()}</div><div className="manage-card-actions"><button type="button" onClick={() => setEditing(product)}><Pencil size={12} /> Editar</button><button type="button" onClick={() => archive(product)}><Archive size={12} /> Archivar</button><button className="danger" type="button" onClick={() => remove(product)}><Trash2 size={12} /> Eliminar</button></div></article>)}</div></>;
}

function ProductEditor({ product, catalog, onCancel, onSave }: { product: Product | null; catalog: PublicCatalog; onCancel: () => void; onSave: (product: Product) => Promise<void> }) {
  const [form, setForm] = useState<Product>(product ?? { id: crypto.randomUUID(), categoria_id: catalog.categories[0]?.id ?? "", nombre: "", descripcion: "", imagen_url: "", precio: 0, precio_anterior: null, extra_nombre: "", extra_costo: 0, stock: null, stock_minimo: 0, disponible: true, recomendado: false, nuevo: false, activo: true, orden: catalog.products.length + 1 });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const cloudinaryReady = isCloudinaryConfigured();
  function change<K extends keyof Product>(key: K, value: Product[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function upload(file?: File) { if (!file) return; setError(""); setUploading(true); try { change("imagen_url", await uploadProductImage(file)); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo subir la imagen."); } finally { setUploading(false); } }
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.nombre.trim() || !form.descripcion.trim() || !form.categoria_id || form.precio <= 0 || !form.imagen_url) { setError("Completa nombre, descripción, categoría, precio e imagen."); return; } setSaving(true); try { await onSave(form); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo guardar."); } finally { setSaving(false); } }
  return <section className="admin-card"><div className="admin-card-header"><div><h2>{product ? "Editar producto" : "Nuevo producto"}</h2><p>Los cambios se reflejan en el catálogo público</p></div></div><form className="admin-form" onSubmit={submit}><label className={`image-upload span-2 ${uploading ? "uploading" : ""}`}><Upload size={22} /><strong>{uploading ? "Subiendo a Cloudinary…" : form.imagen_url ? "Cambiar fotografía" : "Subir fotografía"}</strong><small>{cloudinaryReady ? "JPG, PNG o WebP · máximo 8 MB · optimización automática" : "Configura Cloudinary para habilitar la subida; también puedes pegar una URL."}</small><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || !cloudinaryReady} onChange={(event) => upload(event.target.files?.[0])} /></label><label className="field"><span>Nombre *</span><input value={form.nombre} onChange={(event) => change("nombre", event.target.value)} /></label><label className="field"><span>Categoría *</span><select value={form.categoria_id} onChange={(event) => change("categoria_id", event.target.value)}>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="field span-2"><span>Descripción *</span><textarea rows={3} value={form.descripcion} onChange={(event) => change("descripcion", event.target.value)} /></label><label className="field"><span>Precio *</span><input type="number" min="1" step="0.01" value={form.precio} onChange={(event) => change("precio", Number(event.target.value))} /></label><label className="field"><span>Precio anterior</span><input type="number" min="0" step="0.01" value={form.precio_anterior ?? ""} onChange={(event) => change("precio_anterior", event.target.value ? Number(event.target.value) : null)} /></label><label className="field"><span>Cargo extra · opcional</span><input value={form.extra_nombre} onChange={(event) => change("extra_nombre", event.target.value)} placeholder="Ej.: Termo pack" /></label><label className="field"><span>Importe por unidad</span><input type="number" min="0" step="0.01" value={form.extra_costo ? form.extra_costo : ""} placeholder="Sin cargo" onChange={(event) => change("extra_costo", event.target.value === "" ? 0 : Math.max(0, Number(event.target.value)))} /></label>{(form.extra_nombre.trim() === "") !== (Number(form.extra_costo) === 0) && <p className="field-hint span-2">El cargo extra necesita nombre e importe. Con uno solo de los dos no se cobra nada.</p>}<label className="field"><span>Stock (unidades)</span><input type="number" min="0" step="1" value={form.stock ?? ""} placeholder="Sin control" onChange={(event) => change("stock", event.target.value === "" ? null : Math.max(0, Math.trunc(Number(event.target.value))))} /></label><label className="field"><span>Avisarme cuando queden</span><input type="number" min="0" step="1" value={form.stock_minimo} onChange={(event) => change("stock_minimo", Math.max(0, Math.trunc(Number(event.target.value))))} /></label><label className="field span-2"><span>URL de imagen *</span><input value={form.imagen_url} onChange={(event) => change("imagen_url", event.target.value)} placeholder="https://res.cloudinary.com/…" /></label><label className="switch-field"><span>Disponible</span><input className="switch" type="checkbox" checked={form.disponible} onChange={(event) => change("disponible", event.target.checked)} /></label><label className="switch-field"><span>Recomendado</span><input className="switch" type="checkbox" checked={form.recomendado} onChange={(event) => change("recomendado", event.target.checked)} /></label><label className="switch-field"><span>Nuevo</span><input className="switch" type="checkbox" checked={form.nuevo} onChange={(event) => change("nuevo", event.target.checked)} /></label><label className="switch-field"><span>Activo</span><input className="switch" type="checkbox" checked={form.activo} onChange={(event) => change("activo", event.target.checked)} /></label>{error && <div className="form-error span-2">{error}</div>}<div className="form-actions"><button className="button button-secondary button-small" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary button-small" type="submit" disabled={saving || uploading}>{saving ? "Guardando…" : "Guardar producto"}</button></div></form></section>;
}

function CategoriesSection({ catalog, setCatalog }: { catalog: PublicCatalog; setCatalog: React.Dispatch<React.SetStateAction<PublicCatalog | null>> }) {
  const [name, setName] = useState("");
  async function add(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; const item: Category = { id: crypto.randomUUID(), nombre: name.trim(), descripcion: "", orden: catalog.categories.length + 1, activa: true }; await saveCatalogRecord("categories", "categorias", item); setCatalog((current) => current ? { ...current, categories: [...current.categories, item] } : current); setName(""); }
  async function toggle(item: Category) { const next = { ...item, activa: !item.activa }; await saveCatalogRecord("categories", "categorias", next); setCatalog((current) => current ? { ...current, categories: current.categories.map((value) => value.id === item.id ? next : value) } : current); }
  return <div className="settings-columns"><section className="admin-card"><div className="admin-card-header"><div><h2>Categorías del menú</h2><p>Organízalas con el campo de orden</p></div></div><div className="simple-list">{catalog.categories.map((item) => <div key={item.id}><span className="list-index">{item.orden}</span><div><strong>{item.nombre}</strong><small>{item.descripcion || "Sin descripción"}</small></div><button className={`status-badge ${item.activa ? "entregado" : "cancelado"}`} type="button" onClick={() => toggle(item)}>{item.activa ? "Activa" : "Inactiva"}</button></div>)}</div></section><section className="admin-card"><div className="admin-card-header"><div><h2>Nueva categoría</h2><p>Aparecerá como filtro del catálogo</p></div></div><form className="admin-form" onSubmit={add}><label className="field span-2"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Ofertas" /></label><div className="form-actions"><button className="button button-primary button-small" type="submit"><Plus size={15} /> Añadir categoría</button></div></form></section></div>;
}

function ZonesSection({ catalog, setCatalog }: { catalog: PublicCatalog; setCatalog: React.Dispatch<React.SetStateAction<PublicCatalog | null>> }) {
  const [form, setForm] = useState({ nombre: "", costo: 0, pedido_minimo: 0, tiempo_estimado: "45–60 min" });
  const [error, setError] = useState("");
  async function add(event: FormEvent) { event.preventDefault(); if (!form.nombre || form.costo < 0) return; const item: DeliveryZone = { id: crypto.randomUUID(), ...form, activa: true }; await saveCatalogRecord("zones", "zonas_entrega", item); setCatalog((current) => current ? { ...current, zones: [...current.zones, item] } : current); setForm({ nombre: "", costo: 0, pedido_minimo: 0, tiempo_estimado: "45–60 min" }); }
  async function toggle(item: DeliveryZone) { const next = { ...item, activa: !item.activa }; await saveCatalogRecord("zones", "zonas_entrega", next); setCatalog((current) => current ? { ...current, zones: current.zones.map((value) => value.id === item.id ? next : value) } : current); }
  async function remove(item: DeliveryZone) { if (!window.confirm(`¿Eliminar la zona ${item.nombre}? Esta acción no se puede deshacer.`)) return; setError(""); try { await deleteDeliveryZone(item.id); setCatalog((current) => current ? { ...current, zones: current.zones.filter((zone) => zone.id !== item.id) } : current); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la zona."); } }
  return <div className="settings-columns"><section className="admin-card"><div className="admin-card-header"><div><h2>Zonas configuradas</h2><p>Puedes activar, desactivar o eliminar zonas sin uso</p></div></div>{error && <div className="inline-notice">{error}</div>}<div className="simple-list">{catalog.zones.map((item) => <div key={item.id}><span className="list-index"><MapPinned size={15} /></span><div><strong>{item.nombre} · {formatCurrency(item.costo, catalog.settings.simbolo_moneda)}</strong><small>{item.tiempo_estimado} · Mínimo {formatCurrency(item.pedido_minimo ?? 0, catalog.settings.simbolo_moneda)}</small></div><span className="simple-list-actions"><button className={`status-badge ${item.activa ? "entregado" : "cancelado"}`} type="button" onClick={() => toggle(item)}>{item.activa ? "Activa" : "Inactiva"}</button><button className="list-delete-button" type="button" aria-label={`Eliminar zona ${item.nombre}`} onClick={() => remove(item)}><Trash2 size={13} /> Eliminar</button></span></div>)}{!catalog.zones.length && <p className="empty-admin">No hay zonas configuradas. Añade una para habilitar entregas.</p>}</div></section><section className="admin-card"><div className="admin-card-header"><div><h2>Nueva zona</h2><p>Define costo, tiempo y pedido mínimo</p></div></div><form className="admin-form" onSubmit={add}><label className="field span-2"><span>Nombre</span><input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label className="field"><span>Costo</span><input type="number" min="0" step="0.01" value={form.costo} onChange={(event) => setForm({ ...form, costo: Number(event.target.value) })} /></label><label className="field"><span>Pedido mínimo</span><input type="number" min="0" step="0.01" value={form.pedido_minimo} onChange={(event) => setForm({ ...form, pedido_minimo: Number(event.target.value) })} /></label><label className="field span-2"><span>Tiempo estimado</span><input required value={form.tiempo_estimado} onChange={(event) => setForm({ ...form, tiempo_estimado: event.target.value })} /></label><div className="form-actions"><button className="button button-primary button-small" type="submit"><Plus size={15} /> Añadir zona</button></div></form></section></div>;
}

function PaymentsSection({ catalog, setCatalog }: { catalog: PublicCatalog; setCatalog: React.Dispatch<React.SetStateAction<PublicCatalog | null>> }) {
  const [name, setName] = useState("");
  async function add(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; const item: PaymentMethod = { id: crypto.randomUUID(), nombre: name.trim(), descripcion: "", moneda: "", tasa_cup: null, activo: true }; await saveCatalogRecord("paymentMethods", "metodos_pago", item); setCatalog((current) => current ? { ...current, paymentMethods: [...current.paymentMethods, item] } : current); setName(""); }

  // Moneda y tasa se guardan al salir del campo: son dos datos sueltos, no
  // merecen un formulario aparte.
  async function saveRate(item: PaymentMethod, patch: Partial<PaymentMethod>) {
    const next = { ...item, ...patch };
    if (next.moneda === item.moneda && next.tasa_cup === item.tasa_cup) return;
    await saveCatalogRecord("paymentMethods", "metodos_pago", next);
    setCatalog((current) => current ? { ...current, paymentMethods: current.paymentMethods.map((value) => value.id === item.id ? next : value) } : current);
  }
  async function toggle(item: PaymentMethod) { const next = { ...item, activo: !item.activo }; await saveCatalogRecord("paymentMethods", "metodos_pago", next); setCatalog((current) => current ? { ...current, paymentMethods: current.paymentMethods.map((value) => value.id === item.id ? next : value) } : current); }
  return <div className="settings-columns"><section className="admin-card"><div className="admin-card-header"><div><h2>Métodos disponibles</h2><p>Los dos campos son para métodos que cobran en moneda extranjera: la moneda (USD) y cuántos {catalog.settings.moneda || "CUP"} vale una unidad. Déjalos vacíos si el método cobra en {catalog.settings.moneda || "CUP"}.</p></div></div><div className="simple-list">{catalog.paymentMethods.map((item) => <div key={item.id}><span className="list-index"><CreditCard size={15} /></span><div><strong>{item.nombre}</strong><small>{item.descripcion || "Sin descripción"}</small><span className="payment-rate"><input aria-label={`Moneda extranjera de ${item.nombre}`} defaultValue={item.moneda} placeholder="USD" onBlur={(event) => void saveRate(item, { moneda: event.target.value.trim().toUpperCase() })} /><input aria-label={`Cuantos ${catalog.settings.moneda || "CUP"} vale 1 unidad de la moneda de ${item.nombre}`} type="number" min="0" step="0.01" defaultValue={item.tasa_cup ?? ""} placeholder={`Cobra en ${catalog.settings.moneda || "CUP"}`} onBlur={(event) => void saveRate(item, { tasa_cup: event.target.value ? Number(event.target.value) : null })} /></span></div><button className={`status-badge ${item.activo ? "entregado" : "cancelado"}`} type="button" onClick={() => toggle(item)}>{item.activo ? "Activo" : "Inactivo"}</button></div>)}</div></section><section className="admin-card"><div className="admin-card-header"><div><h2>Nuevo método</h2><p>Configura otra forma de pago</p></div></div><form className="admin-form" onSubmit={add}><label className="field span-2"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Transfermóvil" /></label><div className="form-actions"><button className="button button-primary button-small" type="submit"><Plus size={15} /> Añadir método</button></div></form></section></div>;
}

function SettingsSection({ catalog, setCatalog }: { catalog: PublicCatalog; setCatalog: React.Dispatch<React.SetStateAction<PublicCatalog | null>> }) {
  const [form, setForm] = useState<BusinessSettings>(catalog.settings);
  const [saving, setSaving] = useState(false);
  function change<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { await saveBusinessSettings(form); setCatalog((current) => current ? { ...current, settings: form } : current); } finally { setSaving(false); } }
  return <form onSubmit={submit}><div className="settings-columns"><section className="admin-card"><div className="admin-card-header"><div><h2>Identidad del negocio</h2><p>Información visible para los clientes</p></div></div><div className="admin-form"><label className="field span-2"><span>Nombre</span><input value={form.nombre_negocio} onChange={(event) => change("nombre_negocio", event.target.value)} /></label><label className="field span-2"><span>Texto de bienvenida</span><textarea rows={4} value={form.texto_bienvenida} onChange={(event) => change("texto_bienvenida", event.target.value)} /></label><label className="field"><span>WhatsApp</span><input value={form.whatsapp} onChange={(event) => change("whatsapp", event.target.value)} /></label><label className="field"><span>Teléfono</span><input value={form.telefono} onChange={(event) => change("telefono", event.target.value)} /></label><label className="field span-2"><span>Dirección</span><input value={form.direccion} onChange={(event) => change("direccion", event.target.value)} /></label><label className="field"><span>Color principal</span><input type="color" value={form.color_primario} onChange={(event) => change("color_primario", event.target.value)} /></label><label className="field"><span>Color secundario</span><input type="color" value={form.color_secundario} onChange={(event) => change("color_secundario", event.target.value)} /></label></div></section><section className="admin-card"><div className="admin-card-header"><div><h2>Pedidos y horarios</h2><p>Reglas operativas de la tienda</p></div></div><div className="admin-form"><label className="field"><span>Símbolo de moneda</span><input value={form.simbolo_moneda} onChange={(event) => change("simbolo_moneda", event.target.value)} /></label><label className="field"><span>Pedido mínimo</span><input type="number" min="0" value={form.pedido_minimo} onChange={(event) => change("pedido_minimo", Number(event.target.value))} /></label><label className="field span-2"><span>Tiempo estimado</span><input value={form.tiempo_entrega} onChange={(event) => change("tiempo_entrega", event.target.value)} /></label><label className="field span-2"><span>Categoría de sugerencias</span><select value={form.categoria_sugerencias_id ?? ""} onChange={(event) => change("categoria_sugerencias_id", event.target.value || null)}><option value="">No ofrecer ninguna</option>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="switch-field span-2"><span>Negocio abierto</span><input className="switch" type="checkbox" checked={form.abierto} onChange={(event) => change("abierto", event.target.checked)} /></label><label className="switch-field span-2"><span>Aceptar pedidos programados fuera de horario</span><input className="switch" type="checkbox" checked={form.aceptar_fuera_horario} onChange={(event) => change("aceptar_fuera_horario", event.target.checked)} /></label><label className="field span-2"><span>Mensaje cuando está abierto</span><textarea rows={2} value={form.mensaje_abierto} onChange={(event) => change("mensaje_abierto", event.target.value)} /></label><label className="field span-2"><span>Mensaje cuando está cerrado</span><textarea rows={2} value={form.mensaje_cerrado} onChange={(event) => change("mensaje_cerrado", event.target.value)} /></label></div></section></div><div className="settings-save"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button></div></form>;
}
