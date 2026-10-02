const CACHE_NAME = "hemip-shell-v5";
const APP_SHELL = ["/", "/manifest.json", "/icons/pwa-icon-192.png", "/icons/pwa-icon-512.png"];
const STATIC_ASSET = /\.(?:js|css|png|jpe?g|webp|avif|gif|svg|ico|woff2?|json)$/i;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "Une nouvelle information est disponible." };
  }

  const title = typeof payload.title === "string" ? payload.title.slice(0, 140) : "Information HEMIP";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 240) : "Une nouvelle information est disponible dans votre espace HEMIP.";
  const notificationUrl = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")
    ? payload.url
    : "/annonces";

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body,
      icon: "/icons/pwa-icon-192.png",
      badge: "/icons/pwa-icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "hemip-announcement",
      data: { url: notificationUrl },
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
      windows.forEach(client => client.postMessage({ type: "HEMIP_PUSH", url: notificationUrl }));
    }),
  ]));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/annonces", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(url.href);
      return;
    }
    await self.clients.openWindow(url.href);
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache authenticated APIs, POSTs, cross-origin providers, or non-GET traffic.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  if (!STATIC_ASSET.test(url.pathname)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
