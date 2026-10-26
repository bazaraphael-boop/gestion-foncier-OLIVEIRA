// UTM <-> geographic coordinates on the WGS84 ellipsoid (Krüger series, millimetre accuracy).
// Muanda / Kongo Central lies in UTM zone 33 South: the Cadastre writes X (Easting) and
// Y (Northing) in metres, e.g. 0203417, 9346432.

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const K0 = 0.9996;
const FALSE_EASTING = 500000;
const FALSE_NORTHING_SOUTH = 10000000;

export const DEFAULT_UTM_ZONE = { zone: 33, hemisphere: 'S' };

const n = WGS84_F / (2 - WGS84_F);
const A = (WGS84_A / (1 + n)) * (1 + (n * n) / 4 + (n ** 4) / 64);
const ALPHA = [n / 2 - (2 * n * n) / 3 + (5 * n ** 3) / 16, (13 * n * n) / 48 - (3 * n ** 3) / 5, (61 * n ** 3) / 240];
const BETA = [n / 2 - (2 * n * n) / 3 + (37 * n ** 3) / 96, (n * n) / 48 + (n ** 3) / 15, (17 * n ** 3) / 480];
const DELTA = [2 * n - (2 * n * n) / 3 - 2 * n ** 3, (7 * n * n) / 3 - (8 * n ** 3) / 5, (56 * n ** 3) / 15];

const centralMeridian = (zone) => ((zone * 6 - 183) * Math.PI) / 180;

/** UTM (Easting X, Northing Y in metres) -> { lat, lng } in decimal degrees */
export function utmToLatLng(easting, northing, { zone = DEFAULT_UTM_ZONE.zone, hemisphere = DEFAULT_UTM_ZONE.hemisphere } = {}) {
  const xi = (northing - (hemisphere === 'S' ? FALSE_NORTHING_SOUTH : 0)) / (K0 * A);
  const eta = (easting - FALSE_EASTING) / (K0 * A);

  let xiP = xi;
  let etaP = eta;
  BETA.forEach((b, i) => {
    const j = 2 * (i + 1);
    xiP -= b * Math.sin(j * xi) * Math.cosh(j * eta);
    etaP -= b * Math.cos(j * xi) * Math.sinh(j * eta);
  });

  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  DELTA.forEach((d, i) => {
    phi += d * Math.sin(2 * (i + 1) * chi);
  });
  const lambda = centralMeridian(zone) + Math.atan2(Math.sinh(etaP), Math.cos(xiP));

  return { lat: (phi * 180) / Math.PI, lng: (lambda * 180) / Math.PI };
}

/** { lat, lng } in decimal degrees -> UTM { easting, northing } in metres */
export function latLngToUtm(lat, lng, { zone = DEFAULT_UTM_ZONE.zone, hemisphere = DEFAULT_UTM_ZONE.hemisphere } = {}) {
  const phi = (lat * Math.PI) / 180;
  const dLambda = (lng * Math.PI) / 180 - centralMeridian(zone);
  const k = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - k * Math.atanh(k * Math.sin(phi)));
  const xiP = Math.atan2(t, Math.cos(dLambda));
  const etaP = Math.atanh(Math.sin(dLambda) / Math.sqrt(1 + t * t));

  let xi = xiP;
  let eta = etaP;
  ALPHA.forEach((a, i) => {
    const j = 2 * (i + 1);
    xi += a * Math.sin(j * xiP) * Math.cosh(j * etaP);
    eta += a * Math.cos(j * xiP) * Math.sinh(j * etaP);
  });

  return {
    easting: FALSE_EASTING + K0 * A * eta,
    northing: (hemisphere === 'S' ? FALSE_NORTHING_SOUTH : 0) + K0 * A * xi
  };
}

/** Cadastre style: Easting on 7 digits with leading zeros (0203417), Northing as is (9346432) */
export function formatUtm({ easting, northing }) {
  return `${String(Math.round(easting)).padStart(7, '0')},${Math.round(northing)}`;
}

/**
 * Parses a pasted list of UTM points: pairs "X,Y" (or "X Y") separated by ":" or ";" or new lines.
 * The first number of each pair is the Easting (X), the second the Northing (Y). Original text is kept
 * (leading zeros included) so the record matches the Cadastre document.
 * @returns {{ points: Array<{ xStr: string, yStr: string, easting: number, northing: number }>, errors: string[] }}
 */
export function parseUtmList(text) {
  const points = [];
  const errors = [];
  const chunks = String(text || '')
    .split(/[:;\n\r]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  chunks.forEach((chunk) => {
    const nums = chunk.match(/\d+(?:[.]\d+)?/g);
    if (!nums || nums.length < 2) {
      errors.push(`« ${chunk} » n'est pas un couple X,Y.`);
      return;
    }
    const [xStr, yStr] = nums;
    const easting = parseFloat(xStr);
    const northing = parseFloat(yStr);
    if (easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) {
      errors.push(`« ${chunk} » : valeurs hors des limites UTM (X entre 100 000 et 900 000, Y entre 0 et 10 000 000).`);
      return;
    }
    points.push({ xStr, yStr, easting, northing });
  });
  return { points, errors };
}

/**
 * Several parcels at once: one parcel per line (or per block), optionally named before "=".
 * "Parcelle 1 = 0203417,9346432: 0203434,9346394: 0203453,9346417: 0203436,9346427"
 */
export function parseUtmParcels(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim());

  // A line holding a single pair continues the current parcel (one point per line input);
  // a named line, a line with 3+ pairs or a blank line starts a new parcel
  const groups = [];
  let startNew = true;
  lines.forEach((line) => {
    if (!line) {
      startNew = true;
      return;
    }
    const named = line.match(/^([^=]*[A-Za-zÀ-ÿ][^=]*)=(.*)$/);
    const label = named ? named[1].trim() : null;
    const body = named ? named[2] : line;
    const pairs = (body.match(/\d+(?:\.\d+)?\s*[, ]\s*\d+(?:\.\d+)?/g) || []).length;
    if (startNew || label || pairs >= 3) groups.push({ label, body });
    else groups[groups.length - 1].body += `\n${body}`;
    startNew = pairs >= 3;
  });

  return groups.map((g, i) => {
    const { points, errors } = parseUtmList(g.body);
    return { label: g.label || `Parcelle ${i + 1}`, points, errors };
  });
}
