import { useEffect, useRef, useState } from 'react';
import { gridDistance } from '../utils/geoUtils';
import {
  publishSurveyorPosition,
  setSurveyorOffline,
  fetchLiveSurveyors,
  subscribeLiveSurveyors
} from '../services/trackingService';

// Live tracking of the arpenteur (see services/trackingService.js)

const MIN_MOVE_M = 5; // a new trail point once he moved this far
const MIN_INTERVAL_MS = 4000; // at most one send every 4 s while moving
const HEARTBEAT_MS = 20000; // still alive signal when he does not move
export const OFFLINE_AFTER_MS = 90000; // no news for 1 min 30: shown as offline

const distanceM = (a, b) => gridDistance([a[1], a[0]], [b[1], b[0]]);

/**
 * Arpenteur side: sends his position while `enabled` (GPS on, real fix, signed in as arpenteur).
 * Nothing is shown to him; a failed send (weak 4G, screen locked) is retried on the next GPS fix
 * or heartbeat, and the trail point is kept until it gets through.
 */
export function useShareSurveyorPosition({ enabled, session, position, accuracy }) {
  const latest = useRef({ position, accuracy });
  const lastSent = useRef({ at: 0, trailPos: null, failed: false });
  const inFlight = useRef(false);
  const wasEnabled = useRef(false);

  latest.current = { position, accuracy };

  const send = async (force) => {
    const { position: pos, accuracy: acc } = latest.current;
    if (!pos || inFlight.current) return;
    const now = Date.now();
    const moved = !lastSent.current.trailPos || distanceM(pos, lastSent.current.trailPos) >= MIN_MOVE_M;
    const due = now - lastSent.current.at >= MIN_INTERVAL_MS;
    if (!force && !(due && (moved || lastSent.current.failed))) return;
    inFlight.current = true;
    const res = await publishSurveyorPosition(session, { lat: pos[0], lng: pos[1], accuracy: acc }, { addTrailPoint: moved });
    inFlight.current = false;
    if (res.ok) {
      lastSent.current = { at: now, trailPos: moved ? pos : lastSent.current.trailPos, failed: false };
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
        lastSent.current = { at: 0, trailPos: null, failed: false };
        setSurveyorOffline(session);
      }
      return undefined;
    }
    wasEnabled.current = true;
    const timer = setInterval(() => send(true), HEARTBEAT_MS);
    const onPageHide = () => setSurveyorOffline(session);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
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

    fetchLiveSurveyors().then(({ locations, points }) => {
      if (cancelled) return;
      const next = {};
      locations.forEach((row) => {
        next[row.user_id] = { location: row, trail: [] };
      });
      points.forEach((row) => {
        if (!next[row.user_id]) next[row.user_id] = { location: null, trail: [] };
        next[row.user_id].trail.push([row.lat, row.lng]);
      });
      setByUser(next);
    });
    const unsubscribe = subscribeLiveSurveyors({ onLocation: applyLocation, onPoint: applyPoint });
    const timer = setInterval(() => setNow(Date.now()), 15000);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled) return [];
  return Object.entries(byUser)
    .filter(([, entry]) => entry.location)
    .map(([userId, { location, trail }]) => {
      const updatedAt = new Date(location.updated_at);
      return {
        userId,
        name: location.full_name || 'Arpenteur',
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        updatedAt,
        online: location.is_active && now - updatedAt.getTime() < OFFLINE_AFTER_MS,
        trail
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.updatedAt - a.updatedAt);
}
