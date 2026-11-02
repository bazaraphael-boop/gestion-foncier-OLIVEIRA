import { useEffect, useRef, useState } from 'react';
import { gridDistance } from '../utils/geoUtils';
import {
  publishSurveyorPosition,
  setSurveyorOffline,
  fetchLiveSurveyors,
  subscribeLiveSurveyors
} from '../services/trackingService';
import { MIN_MOVE_M, isTrailPoint, isUsableFix } from '../utils/trackingFilter';

// Live tracking of the arpenteur (see services/trackingService.js)

const MIN_INTERVAL_MS = 4000; // at most one send every 4 s while moving
const HEARTBEAT_MS = 20000; // still alive signal when he does not move
export const OFFLINE_AFTER_MS = 90000; // no news for 1 min 30: shown as offline
const SEND_TIMEOUT_MS = 15000; // a request stuck on weak 4G must not block the next ones
const ADMIN_REFRESH_MS = 30000; // live updates can be missed when the connection drops

const distanceM = (a, b) => gridDistance([a[1], a[0]], [b[1], b[0]]);

/**
 * Arpenteur side: sends his position while `enabled` (GPS on, real fix, signed in as arpenteur).
 * Nothing is shown to him; a failed send (weak 4G, screen locked) is retried on the next GPS fix
 * or heartbeat, and the trail point is kept until it gets through.
 */
export function useShareSurveyorPosition({ enabled, session, position, accuracy }) {
  const latest = useRef({ position, accuracy });
  const lastSent = useRef({ at: 0, trailPos: null, trailAt: 0, failed: false });
  const lastGood = useRef(null); // { position, accuracy, at }: last fix precise enough for the map
  const inFlight = useRef(false);
  const wasEnabled = useRef(false);

  latest.current = { position, accuracy };

  const send = async (force) => {
    if (!latest.current.position || inFlight.current) return;
    const now = Date.now();
    // A very rough fix does not replace a recent good one: the marker stays where it is
    if (isUsableFix({ accuracy: latest.current.accuracy, lastGoodAt: lastGood.current?.at, now })) {
      lastGood.current = { position: latest.current.position, accuracy: latest.current.accuracy, at: now };
    }
    const { position: pos, accuracy: acc } = lastGood.current;
    const distance = lastSent.current.trailPos ? distanceM(pos, lastSent.current.trailPos) : null;
    const moved = distance === null || distance >= MIN_MOVE_M;
    const addTrailPoint = isTrailPoint({ distanceM: distance, accuracy: acc, lastTrailAt: lastSent.current.trailAt, now });
    const due = now - lastSent.current.at >= MIN_INTERVAL_MS;
    if (!force && !(due && (moved || lastSent.current.failed))) return;
    inFlight.current = true;
    const res = await Promise.race([
      publishSurveyorPosition(session, { lat: pos[0], lng: pos[1], accuracy: acc }, { addTrailPoint }),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: 'Délai dépassé' }), SEND_TIMEOUT_MS))
    ]);
    inFlight.current = false;
    if (res.ok) {
      lastSent.current = {
        at: now,
        trailPos: addTrailPoint ? pos : lastSent.current.trailPos,
        trailAt: addTrailPoint ? now : lastSent.current.trailAt,
        failed: false
      };
    } else {
      // Retried at the next GPS fix (at most every 4 s) or heartbeat
      console.warn('Suivi arpenteur : envoi impossible', res.error);
      lastSent.current = { ...lastSent.current, at: now, failed: true };
    }
  };

  // New GPS position
  useEffect(() => {
    if (enabled && position) send(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, position?.[0], position?.[1]]);

  // Heartbeat, and offline signal when the GPS is turned off or the page is closed
  useEffect(() => {
    if (!enabled) {
      if (wasEnabled.current) {
        wasEnabled.current = false;
        lastSent.current = { at: 0, trailPos: null, trailAt: 0, failed: false };
        lastGood.current = null;
        setSurveyorOffline(session);
      }
      return undefined;
    }
    wasEnabled.current = true;
    const timer = setInterval(() => send(true), HEARTBEAT_MS);
    const onPageHide = () => setSurveyorOffline(session);
    window.addEventListener('pagehide', onPageHide);

    // Browsers stop the GPS when the screen locks: the screen stays on while the GPS is active
    // (where the browser allows it), and the position leaves at once when the app comes back
    let wakeLock = null;
    let stopped = false;
    const keepScreenOn = async () => {
      try {
        if (document.visibilityState !== 'visible' || !navigator.wakeLock) return;
        const lock = await navigator.wakeLock.request('screen');
        if (stopped) lock.release();
        else wakeLock = lock;
      } catch {
        // Refused (low battery, unsupported): tracking continues without it
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        send(true);
        keepScreenOn();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    keepScreenOn();

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLock?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.user?.id]);
}

/**
 * Admin side: every arpenteur's latest position and today's trail, updated live.
 * @returns {Array<{ userId, name, lat, lng, accuracy, updatedAt: Date, online: boolean, trail: Array<[lat, lng]> }>}
 */
export function useLiveSurveyors(enabled) {
  const [byUser, setByUser] = useState({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const applyLocation = (row) =>
      setByUser((prev) => ({
        ...prev,
        [row.user_id]: { trail: [], ...prev[row.user_id], location: row }
      }));
    const applyPoint = (row) =>
      setByUser((prev) => {
        const entry = prev[row.user_id] || { trail: [], location: null };
        return { ...prev, [row.user_id]: { ...entry, trail: [...entry.trail, [row.lat, row.lng]] } };
      });

    // Full reload: at the start, then regularly and when the page comes back, so that updates missed
    // during a connection drop are recovered. A failed reload keeps what is shown.
    const refresh = async () => {
      const { locations, points, error } = await fetchLiveSurveyors();
      if (cancelled || error) return;
      const next = {};
      locations.forEach((row) => {
        next[row.user_id] = { location: row, trail: [] };
      });
      points.forEach((row) => {
        if (!next[row.user_id]) next[row.user_id] = { location: null, trail: [] };
        next[row.user_id].trail.push([row.lat, row.lng]);
      });
      setByUser(next);
      setNow(Date.now());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    const unsubscribe = subscribeLiveSurveyors({
      onLocation: (row) => {
        applyLocation(row);
        setNow(Date.now());
      },
      onPoint: applyPoint
    });
    const timer = setInterval(() => setNow(Date.now()), 15000);
    const refreshTimer = setInterval(refresh, ADMIN_REFRESH_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  if (!enabled) return [];
  return Object.entries(byUser)
    .filter(([, entry]) => Number.isFinite(entry.location?.lat) && Number.isFinite(entry.location?.lng))
    .map(([userId, { location, trail }]) => {
      const updatedAt = new Date(location.updated_at);
      return {
        userId,
        name: location.full_name || 'Arpenteur',
        lat: location.lat,
        lng: location.lng,
        accuracy: Number.isFinite(location.accuracy) ? location.accuracy : null,
        updatedAt,
        online: location.is_active && now - updatedAt.getTime() < OFFLINE_AFTER_MS,
        trail: trail.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.updatedAt - a.updatedAt);
}
