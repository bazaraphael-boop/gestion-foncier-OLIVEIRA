import { useEffect, useState } from 'react';

// Satellite images kept on the device by the service worker (public/sw.js, same cache name)
const TILE_CACHE = 'cadastre-tiles-v1';

/** Number of images kept, or null when the browser has no cache storage */
export async function countCachedTiles() {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(TILE_CACHE);
    return (await cache.keys()).length;
  } catch {
    return null;
  }
}

export async function clearCachedTiles() {
  if (typeof caches === 'undefined') return;
  await caches.delete(TILE_CACHE);
}

/** true while the device has a connection */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
