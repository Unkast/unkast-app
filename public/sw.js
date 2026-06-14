// Bump ce nom à chaque correctif de stratégie de cache : l'ancien cache (et ses
// éventuelles réponses "empoisonnées") est supprimé dans l'event `activate`.
const CACHE_NAME = "unkast-v2";
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

  // Images : cache-first, MAIS on ne met JAMAIS en cache une réponse en échec.
  // (Mettre en cache un 404/erreur "empoisonne" l'image définitivement : le SW
  // resert l'échec à chaque requête, même une fois le fichier en place.)
  if (request.destination === "image") {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first pour les pages, fallback cache puis offline.
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

  // Defaut : reseau avec fallback cache.
  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
