"use client";

import { Check, ChefHat, CircleAlert, LoaderCircle, MessageCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDia, formatHora, TRACKING_STEPS, trackingProgress } from "@/app/lib/format";
import { fetchOrderTracking } from "@/app/lib/repository";
import { appPath } from "@/app/lib/site-path";
import type { OrderTracking as Tracking } from "@/app/lib/types";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin-enlace" }
  | { tipo: "no-existe" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; pedido: Tracking; actualizado: Date };

const REFRESCO_MS = 30_000;

function horaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-CU", {
    timeZone: "America/Havana", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

export function OrderTracking() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    let cancelado = false;
    let timer = 0;

    async function cargar() {
      if (!id) {
        setEstado({ tipo: "sin-enlace" });
        return;
      }
      try {
        const pedido = await fetchOrderTracking(id);
        if (cancelado) return;
        if (!pedido) {
          setEstado({ tipo: "no-existe" });
          return;
        }
        setEstado({ tipo: "listo", pedido, actualizado: new Date() });
        // Se deja de preguntar cuando ya no va a cambiar.
        if (pedido.estado !== "entregado" && pedido.estado !== "cancelado") {
          timer = window.setTimeout(cargar, REFRESCO_MS);
        }
      } catch (error) {
        if (!cancelado) setEstado({ tipo: "error", mensaje: error instanceof Error ? error.message : "No pudimos cargar tu pedido." });
      }
    }

    timer = window.setTimeout(cargar, 0);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="tracking-page">
      <a className="brand tracking-brand" href={appPath("/")}>
        <span className="brand-mark"><ChefHat size={25} /></span>
        <span><strong>La Cocina</strong><small>de Miguelón</small></span>
      </a>

      <section className="tracking-card" aria-live="polite">
        {estado.tipo === "cargando" && <p className="tracking-message"><LoaderCircle className="spin" size={22} /> Buscando tu pedido…</p>}
        {estado.tipo === "sin-enlace" && <Aviso titulo="Falta el número de pedido" texto="Abre el enlace completo que te llegó en el mensaje de WhatsApp." />}
        {estado.tipo === "no-existe" && <Aviso titulo="No encontramos ese pedido" texto="Comprueba que el enlace esté completo. Si el problema sigue, escríbenos por WhatsApp." />}
        {estado.tipo === "error" && <Aviso titulo="No pudimos cargar tu pedido" texto={estado.mensaje} />}
        {estado.tipo === "listo" && <Detalle pedido={estado.pedido} actualizado={estado.actualizado} />}
      </section>
    </main>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="tracking-message">
      <CircleAlert size={24} />
      <h1>{titulo}</h1>
      <p>{texto}</p>
      <a className="button button-secondary" href={appPath("/")}>Ir al menú</a>
    </div>
  );
}

function Detalle({ pedido, actualizado }: { pedido: Tracking; actualizado: Date }) {
  const { paso, cancelado, horas } = trackingProgress(pedido.estado, pedido.historial);
  const whatsapp = `https://wa.me/${pedido.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, pregunto por mi pedido #${pedido.numero_pedido}`)}`;
  const titulo = cancelado ? "Tu pedido fue cancelado" : paso === 4 ? `¡Que aproveche, ${pedido.nombre}!` : `Hola, ${pedido.nombre}`;

  return (
    <>
      <span className="eyebrow">Pedido #{pedido.numero_pedido}</span>
      <h1>{titulo}</h1>
      {pedido.fecha_entrega && !cancelado && (
        <p className="tracking-when">
          Para el <b>{formatDia(pedido.fecha_entrega)}</b>
          {pedido.horario_entrega ? <> · hacia las <b>{formatHora(pedido.horario_entrega)}</b></> : " · lo antes posible"}
        </p>
      )}

      {cancelado ? (
        <p className="tracking-cancelled"><CircleAlert size={18} /> Si no esperabas esto, escríbenos y lo resolvemos.</p>
      ) : (
        <ol className="tracking-steps">
          {TRACKING_STEPS.map((nombre, indice) => {
            const hora = horas[indice];
            return (
              <li key={nombre} className={indice < paso ? "done" : indice === paso ? "current" : ""}>
                <span className="tracking-dot">{indice <= paso ? <Check size={13} /> : null}</span>
                <span className="tracking-step-name">{nombre}</span>
                {hora && indice <= paso ? <small>{horaCorta(hora)}</small> : null}
              </li>
            );
          })}
        </ol>
      )}

      <div className="tracking-items">
        {pedido.items.map((item) => (
          <div key={item.nombre}><span>{item.cantidad} × {item.nombre}</span></div>
        ))}
        <div className="tracking-total">
          <span>Total</span>
          <strong>{pedido.simbolo_moneda}{Number(pedido.total).toLocaleString("es-CU")}</strong>
        </div>
        {pedido.total_moneda ? (
          <div className="tracking-total tracking-total-moneda">
            <span>A pagar por {pedido.metodo_pago}</span>
            <strong>{Number(pedido.total_moneda).toLocaleString("es-CU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pedido.moneda_pago || "USD"}</strong>
          </div>
        ) : pedido.metodo_pago ? <p className="tracking-method">Pago: {pedido.metodo_pago}</p> : null}
      </div>

      <a className="button button-primary button-block" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Escribir a {pedido.negocio}</a>
      {!cancelado && paso < 4 && (
        <p className="tracking-refresh"><RefreshCw size={12} /> Se actualiza solo. Última vez: {actualizado.toLocaleTimeString("es-CU", { hour: "numeric", minute: "2-digit" })}</p>
      )}
    </>
  );
}
