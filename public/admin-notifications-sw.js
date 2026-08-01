self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Tienes un pedido nuevo." };
  }

  const title = payload.title || "Nuevo pedido en La Cocina de Miguelón";
  const tag = payload.tag || "nuevo-pedido";
  const url = payload.url || new URL("admin/", self.registration.scope).href;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Abre el panel para revisar los detalles.",
      data: { url },
      tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "admin/",
    self.registration.scope,
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === new URL(targetUrl).origin) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
