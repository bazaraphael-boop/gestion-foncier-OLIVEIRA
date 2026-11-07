// Service Worker for Concession Manuel Joaquim d'Oliveira PWA
const CACHE_NAME = 'cadastre-oliveira-pwa-v6';

// Every file of the built app (pages, scripts, images), filled in by vite.config.js at build time,
// so that screens never opened online also work offline
const PRECACHE = ["./","./apple-touch-icon.png","./assets/AdminSecurityModal-CfGi0GZp.js","./assets/AuditLogModal-wOfhIX8V.js","./assets/CadastreBatchModal-D-X-O5f9.js","./assets/GeoJsonImporterModal-B9Ouushq.js","./assets/KmlImporter-BaS6zMrC.js","./assets/KmlParcelImporterModal-EGoUbEXE.js","./assets/ParcelDocuments-5i-KmPJr.js","./assets/ParcelFormModal-DysRlnVw.js","./assets/ParcelModal-CBA1u9Ei.js","./assets/QrScanner-BP2YKYZK.js","./assets/SupabaseModal-CWbfv7VN.js","./assets/ZoneManagerModal-DGUM4evz.js","./assets/es-dwxWGq35.js","./assets/full.esm-C6rQxTCf.js","./assets/html2canvas-DRDVBo_a.js","./assets/index-BgxUA0Lt.css","./assets/index-Bk70CI-c.js","./assets/index.es-DyQA6LUk.js","./assets/jsQR-DhF7sT1x.js","./assets/purify.es-Dqk5qvad.js","./assets/rolldown-runtime-BYOrzxDO.js","./assets/vendor-icons-DtUi5ieV.js","./assets/vendor-leaflet-Cl77iyjf.js","./assets/vendor-leaflet-vh-t_kPv.css","./assets/vendor-supabase-DZ50stWo.js","./assets/vendor-turf-DJhL0UD7.js","./favicon-64.png","./favicon.svg","./header_banner.jpg","./icons.svg","./index.html","./manifest.json","./manifest.webmanifest","./muanda_bg.jpg","./pwa-192x192.png","./pwa-512x512.png","./pwa-maskable-512x512.png"];

// Satellite / map images already viewed, kept on the device: they show instantly and without a
// connection in the field (src/utils/offlineTiles.js reads and empties this cache)
const TILE_CACHE = 'cadastre-tiles-v1';
const TILE_HOSTS = /(^mt\d\.google\.com$)|(arcgisonline\.com$)|(^tiles\.maps\.eox\.at$)|(^tile\.openstreetmap\.org$)/;
const MAX_TILES = 6000; // about 150 to 250 MB of satellite images
let putsSinceTrim = 0;

// Only cache immutable brand static icons, NEVER HTML or dynamic JS bundles
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png',
  './favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // One file failing (bad network) must not cancel the others
      Promise.allSettled([...new Set([...STATIC_ASSETS, ...PRECACHE])].map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILE_CACHE) {
            console.log('Purge ancien cache PWA:', key);
            return caches.delete(key);
          }
        })
      );
    })
      .then(() => pruneOldBuild())
      .then(() => self.clients.claim())
  );
});

// Scripts of previous versions are removed once the new version is fully stored
async function pruneOldBuild() {
  if (!PRECACHE.length) return;
  const keep = new Set(PRECACHE.map((path) => new URL(path, self.registration.scope).href));
  const cache = await caches.open(CACHE_NAME);
  for (const request of await cache.keys()) {
    if (request.url.includes('/assets/') && !keep.has(request.url)) await cache.delete(request);
  }
}

// The same Google tile comes from mt0…mt3: one copy is kept
const tileKey = (url) => url.replace(/^https:\/\/mt\d\.google\.com\//, 'https://mt0.google.com/');

// Oldest images are removed once the limit is reached (keys are in insertion order)
async function trimTiles(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_TILES;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function tileResponse(request) {
  const cache = await caches.open(TILE_CACHE);
  const key = tileKey(request.url);
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    // CORS request so the image can be stored (an opaque copy would weigh several MB of quota)
    const response = await fetch(key, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      await cache.put(key, response.clone());
      if (++putsSinceTrim >= 200) {
        putsSinceTrim = 0;
        trimTiles(cache);
      }
    }
    return response;
  } catch {
    // Offline and never viewed, or server refusing CORS: the browser tries on its own
    return fetch(request);
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'GET' && TILE_HOSTS.test(url.hostname)) {
    event.respondWith(tileResponse(event.request));
    return;
  }

  // 1. Do not intercept Supabase API requests, other tile servers, or websockets
  if (
    url.origin.includes('supabase.co') ||
    url.hostname.includes('google') ||
    url.hostname.includes('arcgisonline') ||
    url.hostname.includes('sentinel') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. Navigation / HTML requests: STRICT NETWORK-FIRST (NEVER serve stale index.html)
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        // Offline: this page if it was stored, else the app's page (any address of the app works)
        .catch(async () =>
          (await caches.match(event.request)) ||
          (await caches.match(new URL('./', self.registration.scope).href)) ||
          caches.match(new URL('./index.html', self.registration.scope).href)
        )
    );
    return;
  }

  // 3. Bundles and assets: Network-First with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
