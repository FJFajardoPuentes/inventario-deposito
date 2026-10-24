const CACHE_NAME = "inventario-deposito-v2";

const ARCHIVOS_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/login.html",
  "/login.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARCHIVOS_CACHE);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", event => {
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(respuestaCache => {
      return respuestaCache || fetch(event.request);
    })
  );
});