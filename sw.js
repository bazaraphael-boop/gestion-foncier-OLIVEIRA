// Service Worker for Concession Manuel Joaquim d'Oliveira PWA
const CACHE_NAME = 'cadastre-oliveira-pwa-v5';

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
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching some static icons failed', err);
      });
    })
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
    }).then(() => self.clients.claim())
  );
});

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
        .catch(() => caches.match(event.request))
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
