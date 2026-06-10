const CACHE_NAME = "unkast-v1";
const STATIC_ASSETS = ["/", "/feed", "/recherche", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Cache images (cache-first)
  if (request.destination === "image") {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Network-first for pages, fallback to cache or offline
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) => cached || caches.match("/offline.html")
        )
      )
    );
    return;
  }

  // Default: network with cache fallback
  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
