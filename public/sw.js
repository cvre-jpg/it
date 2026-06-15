const CACHE_VERSION = "v4";
const APP_SHELL_CACHE = `shopict-app-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `shopict-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `shopict-assets-${CACHE_VERSION}`;
const PRECACHE_URLS = ["/manifest.webmanifest", "/logo.png", "/app-icon.jpg", "/whatsapp.svg"];
const CACHEABLE_DESTINATIONS = new Set(["font", "image", "manifest", "script", "style"]);
const EXTERNAL_ASSET_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_SHELL_CACHE, PAGE_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isExternalAsset = EXTERNAL_ASSET_HOSTS.has(url.hostname);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request, isSameOrigin && isNetworkFirstNavigation(url)));
    return;
  }

  if (isCacheableAssetRequest(request, isSameOrigin, isExternalAsset)) {
    event.respondWith(handleAssetRequest(request));
  }
});

self.addEventListener("push", (event) => {
  const payload = event.data ? safeJson(event.data.text()) : {};
  const title = payload.title || "Shop ICT Gadgets";
  const options = {
    body: payload.body || "You have a new notification.",
    icon: "/app-icon.jpg",
    badge: "/app-icon.jpg",
    tag: payload.tag || "shopict-notification",
    data: {
      url: payload.url || "/admin/notifications",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});

function isNetworkFirstNavigation(url) {
  return url.pathname.startsWith("/admin") || url.pathname.startsWith("/auth");
}

async function handleNavigationRequest(request, networkFirst) {
  if (!networkFirst) {
    const cachedPage = await caches.match(request);
    if (cachedPage) return cachedPage;

    const appShell = await caches.match("/");
    if (appShell) return appShell;
  }

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedPage = await caches.match(request);
    if (cachedPage) return cachedPage;

    const appShell = await caches.match("/");
    if (appShell) return appShell;

    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function handleAssetRequest(request) {
  const cached = await caches.match(request);
  const networkFetch = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        const cache = await caches.open(ASSET_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}

function isCacheableAssetRequest(request, isSameOrigin, isExternalAsset) {
  if (CACHEABLE_DESTINATIONS.has(request.destination)) return isSameOrigin || isExternalAsset;

  if (!isSameOrigin) return false;

  return /\.(?:css|gif|ico|jpeg|jpg|js|mjs|png|svg|webp|woff|woff2)$/i.test(new URL(request.url).pathname);
}

function isCacheableResponse(response) {
  return Boolean(response) && (response.status === 200 || response.type === "opaque");
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
