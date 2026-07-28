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
