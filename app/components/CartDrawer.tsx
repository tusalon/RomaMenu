"use client";

import {
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  convertTotal,
  deliverySlots,
  describeWindow,
  explainConversion,
  extrasFromCart,
  extrasTotal,
  formatConversion,
  formatCurrency,
  formatDia,
  formatHora,
  orderStatusLabels,
  stockState,
  trackingUrl,
} from "@/app/lib/format";
import { buildWhatsAppMessage, createOrder } from "@/app/lib/repository";
import { appPath } from "@/app/lib/site-path";
import type { CartItem, CheckoutData, Order, OrderWindow, Product, PublicCatalog } from "@/app/lib/types";

type CartDrawerProps = {
  open: boolean;
  catalog: PublicCatalog;
  orderWindow: OrderWindow | null;
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onAdd: (product: Product, quantity?: number) => void;
  onUpdate: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
};

const emptyForm: CheckoutData = {
  nombre_cliente: "",
  telefono: "",
  direccion: "",
  zona_id: "",
  referencia: "",
  metodo_pago_id: "",
  horario_entrega: "",
  observaciones: "",
};

export function CartDrawer({
  open,
  catalog,
  orderWindow,
  items,
  subtotal,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: CartDrawerProps) {
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [form, setForm] = useState<CheckoutData>(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const zone = catalog.zones.find((item) => item.id === form.zona_id);
  const delivery = zone?.costo ?? 0;
  const extraLines = useMemo(() => extrasFromCart(items), [items]);
  const extras = extrasTotal(extraLines);
  const total = subtotal + delivery + extras;
  const symbol = catalog.settings.simbolo_moneda;
  const paymentMethod = catalog.paymentMethods.find((item) => item.id === form.metodo_pago_id);
  const conversion = convertTotal(total, paymentMethod);

  // Sugerencias: los productos de la categoria elegida por el admin que aun no
  // estan en el carrito. Sin categoria configurada, no se ofrece nada.
  const suggestions = useMemo<Product[]>(() => {
    const categoryId = catalog.settings.categoria_sugerencias_id;
    if (!categoryId) return [];
    const inCart = new Set(items.map((item) => item.product.id));
    return catalog.products.filter(
      (product) =>
        product.categoria_id === categoryId &&
        product.disponible &&
        !inCart.has(product.id),
    );
  }, [catalog.products, catalog.settings.categoria_sugerencias_id, items]);

  const unavailable = useMemo(
    () => items.find((item) => {
      const current = catalog.products.find((product) => product.id === item.product.id);
      return !current || stockState(current).agotado || current.precio !== item.product.precio;
    }),
    [catalog.products, items],
  );

  // El carrito vive en el navegador y puede quedarse viejo: alguien anade tres
  // lasanas, se van dos mientras rellena sus datos, y solo queda una. Mejor
  // decirselo aqui que dejar que la base lo rechace tras enviar el formulario.
  const shortStock = useMemo(
    () => items
      .map((item) => {
        const current = catalog.products.find((product) => product.id === item.product.id);
        const restantes = current ? stockState(current).restantes : null;
        return restantes != null && restantes < item.quantity
          ? { nombre: item.product.nombre, restantes }
          : null;
      })
      .find(Boolean),
    [catalog.products, items],
  );

  function updateField(field: keyof CheckoutData, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function validate() {
    if (!items.length) return "Tu carrito está vacío.";
    if (unavailable) return `${unavailable.product.nombre} cambió de precio o ya no está disponible. Actualiza tu selección.`;
    if (shortStock) return `Solo quedan ${shortStock.restantes} de ${shortStock.nombre}. Ajusta la cantidad.`;
    if (!form.nombre_cliente.trim()) return "Escribe tu nombre.";
    if (!form.telefono.trim() || form.telefono.replace(/\D/g, "").length < 6) return "Escribe un teléfono válido.";
    if (!form.direccion.trim()) return "Escribe la dirección completa de entrega.";
    if (!zone) return "Selecciona una zona de entrega.";
    if (subtotal < (zone.pedido_minimo ?? catalog.settings.pedido_minimo)) return `El pedido mínimo para ${zone.nombre} es ${formatCurrency(zone.pedido_minimo ?? catalog.settings.pedido_minimo, symbol)}.`;
    if (!form.metodo_pago_id) return "Selecciona un método de pago.";
    if (orderWindow ? !orderWindow.acepta : !catalog.settings.abierto) return describeWindow(orderWindow) ?? catalog.settings.mensaje_cerrado;
    return "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    const whatsappWindow = window.open("about:blank", "_blank");
    try {
      const order = await createOrder(form, items, zone!, paymentMethod);
      const message = buildWhatsAppMessage(order, catalog, trackingUrl(window.location.origin, appPath("/pedido/"), order.id));
      const whatsappUrl = `https://wa.me/${catalog.settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
      else window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setConfirmedOrder(order);
      onClear();
      setForm(emptyForm);
      setStep("cart");
    } catch (requestError) {
      whatsappWindow?.close();
      setError(requestError instanceof Error ? requestError.message : "No pudimos registrar el pedido. Inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open && !confirmedOrder) return null;

  if (confirmedOrder) {
    return (
      <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Pedido confirmado">
        <div className="confirmation-card">
          <span className="confirmation-icon"><CheckCircle2 size={36} /></span>
          <span className="eyebrow centered">Pedido registrado</span>
          <h2>¡Gracias, {confirmedOrder.nombre_cliente.split(" ")[0]}!</h2>
          <p>Tu pedido <strong>#{confirmedOrder.numero_pedido}</strong> quedó guardado. Confirma el envío del mensaje en WhatsApp para que la cocina comience a prepararlo.</p>
          <div className="confirmation-summary">
            <span><small>Estado</small><b>{orderStatusLabels[confirmedOrder.estado]}</b></span>
            {confirmedOrder.fecha_entrega ? <span><small>Entrega</small><b>{formatDia(confirmedOrder.fecha_entrega)}</b></span> : null}
            <span><small>Total</small><b>{formatCurrency(confirmedOrder.total, symbol)}</b></span>
            {confirmedOrder.total_moneda ? (
              <span><small>A pagar en {confirmedOrder.moneda_pago || "USD"}</small><b>{confirmedOrder.total_moneda.toLocaleString("es-CU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {confirmedOrder.moneda_pago || "USD"}</b></span>
            ) : null}
          </div>
          <div className="confirmation-actions">
            <a className="button button-primary" href={trackingUrl(window.location.origin, appPath("/pedido/"), confirmedOrder.id)}>Seguir mi pedido</a>
            <button className="button button-secondary" type="button" onClick={() => { setConfirmedOrder(null); onClose(); }}>Volver al catálogo</button>
            <a className="button button-secondary" href={`https://wa.me/${catalog.settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Contactar al negocio</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label={step === "cart" ? "Carrito" : "Datos de entrega"}>
        <div className="drawer-header">
          <div>
            {step === "checkout" && <button className="back-button" type="button" onClick={() => setStep("cart")}><ChevronLeft size={17} /> Volver</button>}
            <h2>{step === "cart" ? "Tu pedido" : "¿Dónde lo llevamos?"}</h2>
            <p>{step === "cart" ? `${items.length} ${items.length === 1 ? "producto" : "productos"} seleccionados` : "Completa los datos para confirmar"}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar carrito"><X size={22} /></button>
        </div>

        {step === "cart" ? (
          <>
            <div className="drawer-content">
              {!items.length ? (
                <div className="empty-cart">
                  <span><ShoppingBag size={34} /></span>
                  <h3>Tu carrito está esperando</h3>
                  <p>Añade algo rico del menú para comenzar tu pedido.</p>
                  <button className="button button-primary" type="button" onClick={onClose}>Explorar el menú</button>
                </div>
              ) : items.map(({ product, quantity }) => (
                <article className="cart-line" key={product.id}>
                  <img src={product.imagen_url} alt="" />
                  <div className="cart-line-info">
                    <h3>{product.nombre}</h3>
                    <strong>{formatCurrency(product.precio * quantity, symbol)}</strong>
                    <div className="quantity-control">
                      <button type="button" onClick={() => onUpdate(product.id, quantity - 1)} aria-label={`Disminuir ${product.nombre}`}><Minus size={13} /></button>
                      <span>{quantity}</span>
                      <button type="button" onClick={() => onUpdate(product.id, quantity + 1)} aria-label={`Aumentar ${product.nombre}`}><Plus size={13} /></button>
                    </div>
                  </div>
                  <button className="remove-button" type="button" onClick={() => onRemove(product.id)} aria-label={`Eliminar ${product.nombre}`}><Trash2 size={17} /></button>
                </article>
              ))}
              {items.length > 0 && <label className="field full"><span>Observaciones generales</span><textarea value={form.observaciones} onChange={(event) => updateField("observaciones", event.target.value)} placeholder="Ej.: sin cebolla, por favor" rows={3} /></label>}
            </div>
            {items.length > 0 && (
              <div className="drawer-footer">
                <div className="total-line"><span>Subtotal</span><strong>{formatCurrency(subtotal, symbol)}</strong></div>
                {extraLines.map((line) => (
                  <div className="total-line" key={`${line.nombre}-${line.unitario}`}>
                    <span>{line.cantidad} × {formatCurrency(line.unitario, symbol)} en {line.nombre}</span>
                    <strong>{formatCurrency(line.total, symbol)}</strong>
                  </div>
                ))}
                <small>El costo de entrega se calcula según tu zona.</small>
                <button className="button button-primary button-block" type="button" onClick={() => setStep("checkout")}>Continuar con el pedido</button>
              </div>
            )}
          </>
        ) : (
          <form className="checkout-form" onSubmit={handleSubmit} noValidate>
            <div className="drawer-content form-grid">
              <label className="field"><span>Nombre completo *</span><input value={form.nombre_cliente} onChange={(event) => updateField("nombre_cliente", event.target.value)} autoComplete="name" placeholder="Tu nombre" /></label>
              <label className="field"><span>Teléfono *</span><input value={form.telefono} onChange={(event) => updateField("telefono", event.target.value)} inputMode="tel" autoComplete="tel" placeholder="55555555" /></label>
              <label className="field full"><span>Dirección completa *</span><input value={form.direccion} onChange={(event) => updateField("direccion", event.target.value)} autoComplete="street-address" placeholder="Calle, número, reparto" /></label>
              <label className="field"><span>Zona de entrega *</span><select value={form.zona_id} onChange={(event) => updateField("zona_id", event.target.value)}><option value="">Selecciona una zona</option>{catalog.zones.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {formatCurrency(item.costo, symbol)}</option>)}</select></label>
              <label className="field"><span>Método de pago *</span><select value={form.metodo_pago_id} onChange={(event) => updateField("metodo_pago_id", event.target.value)}><option value="">Selecciona</option>{catalog.paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.tasa_cup ? `${item.nombre} · 1 ${item.moneda || "USD"} = ${Number(item.tasa_cup).toLocaleString("es-CU")} ${catalog.settings.moneda || "CUP"}` : item.nombre}</option>)}</select></label>
              <label className="field full"><span>Punto de referencia</span><input value={form.referencia} onChange={(event) => updateField("referencia", event.target.value)} placeholder="Ej.: frente al parque" /></label>
              <label className="field full"><span>Hora de entrega</span><select value={form.horario_entrega} onChange={(event) => updateField("horario_entrega", event.target.value)}><option value="">Lo antes posible</option>{deliverySlots(orderWindow).map((slot) => <option key={slot} value={slot}>{formatHora(slot)}</option>)}</select></label>
              <label className="field full"><span>Observaciones</span><textarea value={form.observaciones} onChange={(event) => updateField("observaciones", event.target.value)} rows={3} placeholder="¿Cómo podemos preparar mejor tu pedido?" /></label>
              {suggestions.length > 0 && (
                <div className="field full checkout-suggestions">
                  <span>¿Añades algo más?</span>
                  <div className="suggestion-list">
                    {suggestions.map((product) => (
                      <button
                        className="suggestion-chip"
                        key={product.id}
                        type="button"
                        onClick={() => onAdd(product, 1)}
                      >
                        <b>{product.nombre}</b>
                        <span>{formatCurrency(product.precio, symbol)}</span>
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error && <div className="form-error" role="alert"><CircleAlert size={18} /> {error}</div>}
            </div>
            <div className="drawer-footer">
              <div className="checkout-totals">
                <span>Subtotal <b>{formatCurrency(subtotal, symbol)}</b></span>
                <span>Entrega <b>{formatCurrency(delivery, symbol)}</b></span>
                {extraLines.map((line) => (
                  <span key={`${line.nombre}-${line.unitario}`}>
                    {line.cantidad} × {formatCurrency(line.unitario, symbol)} en {line.nombre} <b>{formatCurrency(line.total, symbol)}</b>
                  </span>
                ))}
                {orderWindow?.acepta && orderWindow.fecha_entrega && orderWindow.fecha_entrega !== orderWindow.hoy && (
                  <span className="checkout-delivery-day">Pedido para el <b>{formatDia(orderWindow.fecha_entrega)}</b></span>
                )}
                <strong>Total <b>{formatCurrency(total, symbol)}</b></strong>
                {conversion && (
                  <span className="checkout-conversion">
                    A pagar por {paymentMethod?.nombre}: <b>{formatConversion(conversion)}</b>
                    <small>{explainConversion(total, conversion, catalog.settings.moneda || "CUP")}</small>
                  </span>
                )}
              </div>
              <button className="button button-primary button-block" type="submit" disabled={submitting}>{submitting ? "Registrando pedido…" : "Confirmar y abrir WhatsApp"}</button>
              <small className="secure-note">El pedido se guarda antes de abrir WhatsApp.</small>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

