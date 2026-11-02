// Filters a phone's GPS fixes before they reach the admin's map. Phones often give a rough fix
// (cell towers, weak signal), which would make the marker jump and the trail zigzag.

export const MIN_MOVE_M = 5;
export const TRAIL_MAX_ACCURACY_M = 40; // rougher fixes move the marker but do not draw the trail
export const MARKER_MAX_ACCURACY_M = 150; // much rougher fixes do not replace a recent good one
export const GOOD_FIX_VALID_MS = 60000;
const MAX_SPEED_M_S = 60; // about 215 km/h: beyond that, the jump is a GPS error

/** Does this fix replace the last good one on the map? */
export function isUsableFix({ accuracy, lastGoodAt, now }) {
  if (accuracy == null || accuracy <= MARKER_MAX_ACCURACY_M) return true;
  return !lastGoodAt || now - lastGoodAt > GOOD_FIX_VALID_MS;
}

/** Does this fix extend the trail? `distanceM` is the distance from the last trail point (null for the first) */
export function isTrailPoint({ distanceM, accuracy, lastTrailAt, now }) {
  if (accuracy != null && accuracy > TRAIL_MAX_ACCURACY_M) return false;
  if (distanceM == null) return true;
  if (distanceM < Math.max(MIN_MOVE_M, (accuracy || 0) / 2)) return false;
  const seconds = Math.max(1, (now - lastTrailAt) / 1000);
  return distanceM / seconds <= MAX_SPEED_M_S;
}
