// BuildBid service worker — offline-first PWA
const CACHE_NAME = "buildbid-v2";
const SHELL_CACHE = "buildbid-shell-v2";
const ESTIMATE_CACHE = "buildbid-estimates-v2";

// App shell assets to cache on install
const SHELL_ASSETS = ["/", "/dashboard", "/estimates", "/login", "/manifest.json"];

// Install — cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHELL_CACHE && k !== ESTIMATE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for shell/assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith("/api/");
  const isEstimate = url.pathname.match(/\/estimates\//);
  const isSignature = url.pathname.includes("signature");

  // API calls: network-first, no cache (handled by client-side offline queue)
  if (isApi) {
    return;
  }

  // Navigation and shell: cache-first, fallback to network
  if (event.request.mode === "navigate" || SHELL_ASSETS.some((a) => url.pathname === a)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Estimate pages: cache in estimate-cache (last 5 estimates)
  if (isEstimate) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(ESTIMATE_CACHE).then((cache) => {
            cache.put(event.request, clone);
            // Keep only last 5 estimate pages
            cache.keys().then((keys) => {
              const estKeys = keys.filter((k) => k.url.match(/\/estimates\//));
              if (estKeys.length > 5) {
                cache.delete(estKeys[0]);
              }
            });
          });
        }
        return res;
      }))
    );
    return;
  }

  // Signature assets: cache
  if (isSignature) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
