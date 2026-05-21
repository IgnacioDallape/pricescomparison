/* ============================================================
   Service Worker — Calculadora de Importación Rutas del Sur
   Cache-first strategy for offline support
============================================================ */

const CACHE_NAME = 'importacion-rs-v6-mobile';

const PRECACHE_ASSETS = [
  '/dashboard-importacion.html',
  '/icons/icon.svg',
  '/manifest-importacion.json'
];

/* ---- Install: precache shell assets ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ---- Activate: clean old caches ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---- Fetch: stale-while-revalidate for CDN, cache-first for local ---- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CDN resources (Chart.js, fonts, html2pdf) — network first, fallback to cache
  const isCDN = url.hostname !== self.location.hostname;

  if (isCDN) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Local assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Revalidate in background
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
