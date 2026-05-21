/* ============================================================
   Service Worker — Calculadora de Importación Rutas del Sur
   Network-first for HTML/JSON, cache-first for static assets
============================================================ */

const CACHE_NAME = 'importacion-rs-v18-nofontmono';

const PRECACHE_ASSETS = [
  '/icons/icon.svg',
  '/manifest-importacion.json'
];

/* ---- Install: precache only static stuff (NOT the HTML) ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

/* ---- Activate: nuke all old caches + claim every open page ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Tell all open pages to reload so they get the new shell immediately
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

/* ---- Fetch strategy ----
   - HTML pages: NETWORK FIRST (so the user always gets the latest UI)
   - CDN assets: stale-while-revalidate
   - Local static: cache first
============================================================ */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isCDN = url.hostname !== self.location.hostname;
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html') ||
    url.pathname.endsWith('.html');

  // HTML — always try network first, fallback to cache only if offline
  if (isHTML) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/dashboard-importacion.html')))
    );
    return;
  }

  // CDN assets — network first with cache fallback
  if (isCDN) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Local static (icons, manifest, css/js) — cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});
