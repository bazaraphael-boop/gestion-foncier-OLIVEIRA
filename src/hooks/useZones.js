import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ZONES } from '../data/defaultZones';
import { fetchZoneRows, activeZones, saveZone, deleteZone, subscribeZones } from '../services/zoneService';

// Zones of the concession: cached on the device, synced with Supabase, written by the admin only

const STORAGE_KEY = 'geocadastre_zones_v1';

function loadCachedZones() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // No cache: default zones
  }
  return DEFAULT_ZONES;
}

function cacheZones(zones) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  } catch {
    // Storage unavailable: zones come back from the cloud next time
  }
}

/**
 * @param {{ signedIn: boolean, isAdmin: boolean }} options
 * @returns {{ zones: Array, addZone: (zone) => Promise<void>, removeZone: (id) => Promise<void> }}
 */
export function useZones({ signedIn, isAdmin }) {
  const [zones, setZones] = useState(loadCachedZones);

  const applyZones = useCallback((next) => {
    setZones(next);
    cacheZones(next);
  }, []);

  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;

    const refresh = async () => {
      const rows = await fetchZoneRows();
      if (cancelled || rows === null) return; // table missing or offline: keep what is shown
      if (rows.length === 0) {
        // First use: the admin stores the default zones (ISETECH) in the cloud
        if (isAdmin) {
          try {
            await Promise.all(DEFAULT_ZONES.map(saveZone));
          } catch (err) {
            console.warn('Zones par défaut non enregistrées :', err.message);
          }
        }
        if (!cancelled) applyZones(DEFAULT_ZONES);
        return;
      }
      applyZones(activeZones(rows));
    };

    refresh();
    const unsubscribe = subscribeZones(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [signedIn, isAdmin, applyZones]);

  // Saved in the cloud first: a zone refused by Supabase never appears only on this device
  const addZone = useCallback(
    async (zone) => {
      await saveZone(zone);
      setZones((prev) => {
        const next = [...prev.filter((z) => z.id !== zone.id), zone];
        cacheZones(next);
        return next;
      });
    },
    []
  );

  const removeZone = useCallback(async (id) => {
    await deleteZone(id);
    setZones((prev) => {
      const next = prev.filter((z) => z.id !== id);
      cacheZones(next);
      return next;
    });
  }, []);

  return { zones, addZone, removeZone };
}
