const OFFLINE_CACHE = "romamenu-admin-offline-v1";
const OFFLINE_URL = new URL("../admin-offline.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("romamenu-admin-offline-") && name !== OFFLINE_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () =>
      (await caches.match(OFFLINE_URL)) || Response.error(),
    ),
  );
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
  const url = payload.url || self.registration.scope;

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
    event.notification.data?.url || "./",
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
