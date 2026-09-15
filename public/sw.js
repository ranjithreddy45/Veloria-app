/* ============================================================
 * Veloria Grand — service worker
 * ------------------------------------------------------------
 * Purpose: make the app INSTALLABLE on Android/Chrome (which requires a
 * registered SW with a fetch handler) and give a graceful offline screen.
 *
 * DELIBERATELY CONSERVATIVE. This app is a live ERP with auth, money and
 * server-rendered pages, so the SW must never serve stale application code:
 *   - We do NOT precache or cache-first any HTML, JS, CSS or API response.
 *     Aggressive caching is how PWAs trap users on an old deploy.
 *   - Navigations are NETWORK-FIRST; the cache is only a fallback for when
 *     the network genuinely fails (offline), and only for page navigations.
 *   - Non-GET (POST/PATCH/DELETE — every mutation) and API/auth requests are
 *     passed straight through: we never call respondWith for them.
 * Bump CACHE_VERSION to evict old offline assets.
 * ============================================================ */

const CACHE_VERSION = "veloria-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      // Never block installation on a precache miss.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Mutations, cross-origin, API and auth traffic: untouched.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: always try the network first so users get the latest
  // build; fall back to the cached offline screen only when truly offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ??
          new Response("You are offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      })
    );
    return;
  }

  // Everything else (static assets) falls through to the network untouched.
});

/* ============================================================
 * Web Push
 * ------------------------------------------------------------
 * Payload is JSON from src/lib/push/send.ts: { title, body, url, tag? }.
 * Icons come from the manifest set. Click focuses an open app tab (navigating
 * it to the target) or opens a new one; only same-origin targets are honoured.
 * ============================================================ */

const NOTIFICATION_ICON = "/icons/icon-192x192.svg";
const NOTIFICATION_BADGE = "/icons/icon-96x96.svg";
const NOTIFICATION_DEFAULT_URL = "/notifications";

function parsePushData(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch {
    return { body: event.data.text() };
  }
}

function resolveSameOrigin(url) {
  try {
    const target = new URL(url || NOTIFICATION_DEFAULT_URL, self.location.origin);
    if (target.origin !== self.location.origin) throw new Error("cross-origin");
    return target.href;
  } catch {
    return new URL(NOTIFICATION_DEFAULT_URL, self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const title = data.title || "Veloria Grand";
  const options = {
    body: data.body || "",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    data: { url: resolveSameOrigin(data.url) },
  };
  if (data.tag) {
    options.tag = String(data.tag);
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = resolveSameOrigin(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const exact = clients.find((client) => client.url === target);
        if (exact) return exact.focus();

        const appTab = clients.find(
          (client) => new URL(client.url).origin === self.location.origin
        );
        if (appTab && "navigate" in appTab) {
          return appTab
            .focus()
            .then((focused) => focused.navigate(target))
            .catch(() => self.clients.openWindow(target));
        }
        return self.clients.openWindow(target);
      })
  );
});
