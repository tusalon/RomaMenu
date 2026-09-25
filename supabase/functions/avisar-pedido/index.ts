// Envia un push a los moviles del admin cuando entra un pedido.
//
// La llama un disparador de la base al insertar en 'pedidos', y el panel una
// vez para pedir la clave publica ({ accion: "clave" }). Se despliega con la
// verificacion de JWT desactivada: no la necesita, porque
//   * la clave publica es publica por definicion, y
//   * solo avisa de pedidos reales, de hace menos de 10 minutos y que no se
//     hayan avisado ya; repetir la llamada no reenvia nada ni devuelve datos.
//
// Las claves VAPID se generan aqui la primera vez y se guardan en push_config,
// que solo puede leer esta funcion (RLS sin politicas). Nadie las copia a mano.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function claves() {
  const leer = () =>
    db.from("push_config").select("vapid_publica, vapid_privada").eq("id", 1).maybeSingle();
  const { data } = await leer();
  if (data?.vapid_publica && data?.vapid_privada) return data;

  const nuevas = webpush.generateVAPIDKeys();
  // Si dos llamadas generan a la vez, gana la primera y las dos releen la misma.
  await db.from("push_config").upsert(
    { id: 1, vapid_publica: nuevas.publicKey, vapid_privada: nuevas.privateKey },
    { onConflict: "id", ignoreDuplicates: true },
  );
  const { data: final, error } = await leer();
  if (error || !final) throw new Error(`No se pudieron guardar las claves: ${error?.message}`);
  return final;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const { vapid_publica, vapid_privada } = await claves();
    if (body.accion === "clave") return json({ publicKey: vapid_publica });

    if (typeof body.pedido_id !== "string") return json({ error: "Falta pedido_id." }, 400);

    // Marca el pedido como avisado en el mismo paso que lo lee: si llegan dos
    // llamadas por el mismo pedido, solo una encuentra avisado_at vacio.
    const { data: pedido } = await db
      .from("pedidos")
      .update({ avisado_at: new Date().toISOString() })
      .eq("id", body.pedido_id)
      .is("avisado_at", null)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .select("numero_pedido, nombre_cliente, total, fecha_entrega")
      .maybeSingle();
    if (!pedido) return json({ enviados: 0, motivo: "Pedido inexistente, antiguo o ya avisado." });

    webpush.setVapidDetails("https://tusalon.github.io/RomaMenu/", vapid_publica, vapid_privada);
    const payload = JSON.stringify({
      title: `Nuevo pedido #${pedido.numero_pedido}`,
      body: `${pedido.nombre_cliente} · $${Number(pedido.total).toLocaleString("es-CU")}`,
      url: "/RomaMenu/admin/",
      tag: `pedido-${pedido.numero_pedido}`,
    });

    const { data: subs } = await db.from("push_suscripciones").select("id, endpoint, p256dh, auth");
    let enviados = 0;
    const fallos: string[] = [];
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60, urgency: "high" },
        );
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: el movil dio de baja la suscripcion. Se borra para no insistir.
        if (status === 404 || status === 410) {
          await db.from("push_suscripciones").delete().eq("id", s.id);
        } else {
          fallos.push(String(status ?? (e as Error).message));
        }
      }
    }
    if (fallos.length) console.error("push fallidos", fallos);
    return json({ enviados, suscripciones: subs?.length ?? 0, fallos });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
