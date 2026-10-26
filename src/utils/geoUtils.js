import * as turf from '@turf/turf';
import { getOceanZoneInfo } from './coastalZones';
import { latLngToUtm, DEFAULT_UTM_ZONE } from './utm';

// Surfaces and side lengths are measured like the Cadastre: on the plane UTM zone 33S grid
// (the coordinates written on the Cadastre plans), not on Turf's sphere, which reads ~0.3 % high here.

/** [lng, lat] -> [easting, northing] in metres, UTM zone 33S */
export function toUtmGrid([lng, lat]) {
  const { easting, northing } = latLngToUtm(lat, lng, DEFAULT_UTM_ZONE);
  return [easting, northing];
}

/** Grid distance in metres between two [lng, lat] points */
export function gridDistance(a, b) {
  const [x1, y1] = toUtmGrid(a);
  const [x2, y2] = toUtmGrid(b);
  return Math.hypot(x2 - x1, y2 - y1);
}

// Shoelace area of one ring of [lng, lat] (closed or not), in m²
function ringGridArea(ring) {
  const pts = ring.map(toUtmGrid);
  let sum = 0;
  pts.forEach(([x, y], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x * y2 - x2 * y;
  });
  return Math.abs(sum) / 2;
}

const polygonGridArea = (rings) => ringGridArea(rings[0]) - rings.slice(1).reduce((s, hole) => s + ringGridArea(hole), 0);

/** Grid area in m² of a Polygon / MultiPolygon geometry or feature */
export function gridArea(featureOrGeometry) {
  const geometry = featureOrGeometry?.geometry || featureOrGeometry;
  if (geometry?.type === 'Polygon') return polygonGridArea(geometry.coordinates);
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.reduce((s, rings) => s + polygonGridArea(rings), 0);
  return 0;
}

/** True when two sides of the ring cross (bornes entered in the wrong order) */
export function hasCrossingSides(ringLngLat) {
  if (!ringLngLat || ringLngLat.length < 4) return false;
  const first = ringLngLat[0];
  const last = ringLngLat[ringLngLat.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1] ? ringLngLat : [...ringLngLat, first];
  try {
    return turf.kinks(turf.polygon([closed])).features.length > 0;
  } catch {
    return false;
  }
}

/**
 * Reads a typed number: decimal comma or point, thousands spaces allowed ("-5,9063675", "203 417").
 * Returns NaN for anything that is not entirely a number, instead of silently cutting it ("-5,9" -> -5).
 * Other spaces are kept so that "-5 54 22.92" (degrees minutes seconds) is not read as -55422.92.
 */
export function parseDecimal(value) {
  if (typeof value === 'number') return value;
  const str = String(value ?? '')
    .trim()
    .replace(/(\d)[\s  ](?=\d{3}(?:\D|$))/g, '$1')
    .replace(',', '.');
  return str === '' ? NaN : Number(str);
}

/**
 * Calculates surface area of a polygon or feature in m² and Hectares
 */
export function calculateArea(featureOrGeometry) {
  if (!featureOrGeometry) return { sqMeters: 0, hectares: 0, formattedSqM: '0 m²', formattedHa: '0.00 ha' };

  try {
    let polyFeature;
    if (featureOrGeometry.type === 'Feature') {
      polyFeature = featureOrGeometry;
    } else if (featureOrGeometry.geometry && featureOrGeometry.geometry.coordinates) {
      polyFeature = turf.polygon(featureOrGeometry.geometry.coordinates);
    } else if ((featureOrGeometry.type === 'Polygon' || featureOrGeometry.type === 'MultiPolygon') && featureOrGeometry.coordinates) {
      polyFeature = featureOrGeometry;
    } else if (Array.isArray(featureOrGeometry)) {
      polyFeature = turf.polygon(featureOrGeometry);
    } else {
      return { sqMeters: 0, hectares: 0, formattedSqM: '0 m²', formattedHa: '0.00 ha' };
    }

    const sqMeters = gridArea(polyFeature);
    const hectares = sqMeters / 10000;

    const formattedSqM = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0
    }).format(Math.round(sqMeters)) + ' m²';

    const formattedHa = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(hectares) + ' ha';

    return {
      sqMeters,
      hectares,
      formattedSqM,
      formattedHa
    };
  } catch (err) {
    console.error('Error calculating area in geoUtils:', err);
    return { sqMeters: 0, hectares: 0, formattedSqM: '0 m²', formattedHa: '0.00 ha' };
  }
}

/**
 * Validates a parcel polygon geometry:
 * 1. Checks minimum 3 points
 * 2. Ensures closed ring
 * 3. Checks if contained inside concession boundary
 * 4. Checks for overlaps with existing parcels
 */
export function validateParcelGeometry(ringCoords, concessionPolygon = null, existingParcels = [], ignoreId = null) {
  const warnings = [];
  const errors = [];

  if (!ringCoords || ringCoords.length < 3) {
    errors.push('La parcelle doit comporter au moins 3 points GPS distincts.');
    return { isValid: false, errors, warnings, areaInfo: null };
  }

  const closedCoords = [...ringCoords];
  const first = closedCoords[0];
  const last = closedCoords[closedCoords.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedCoords.push([first[0], first[1]]);
  }

  let parcelPolygon;
  try {
    parcelPolygon = turf.polygon([closedCoords]);
  } catch (e) {
    errors.push('La géométrie du polygone créée est invalide (auto-intersection possible).');
    return { isValid: false, errors, warnings, areaInfo: null };
  }

  // Crossed sides give a wrong surface (e.g. 267 m² instead of 611 m² with B3 and B4 swapped)
  if (hasCrossingSides(closedCoords)) {
    errors.push('Des côtés du tracé se croisent : les bornes ne sont pas dans l’ordre. Saisissez-les en faisant le tour de la parcelle (B1, B2, B3, B4…).');
    return { isValid: false, errors, warnings, areaInfo: calculateArea(parcelPolygon) };
  }

  const areaInfo = calculateArea(parcelPolygon);
  if (areaInfo.sqMeters <= 0) {
    errors.push('La surface de la parcelle est nulle ou invalide.');
    return { isValid: false, errors, warnings, areaInfo };
  }

  if (concessionPolygon) {
    try {
      const isCompletelyInside = turf.booleanWithin(parcelPolygon, concessionPolygon);
      if (!isCompletelyInside) {
        const intersection = turf.intersect(
          turf.featureCollection([parcelPolygon, concessionPolygon])
        );
        if (!intersection) {
          errors.push('La parcelle est complètement en dehors du périmètre de la concession.');
        } else {
          warnings.push('Attention : La parcelle dépasse partiellement les limites de la concession.');
        }
      }
    } catch (err) {
      console.warn('Concession inclusion check warning:', err);
    }
  }

  if (existingParcels && existingParcels.length > 0) {
    for (const existing of existingParcels) {
      if (ignoreId && existing.id === ignoreId) continue;
      try {
        const existPoly = turf.polygon(existing.geometry.coordinates);
        const overlap = turf.intersect(
          turf.featureCollection([parcelPolygon, existPoly])
        );
        if (overlap) {
          const overlapArea = gridArea(overlap);
          if (overlapArea > 0.1) {
            warnings.push(
              `Chevauchement détecté avec le lot ${existing.properties.lotNumber || existing.id} (${Math.round(overlapArea)} m²).`
            );
          }
        }
      } catch (e) {
        // continue
      }
    }
  }

  // Vérification de la servitude littorale d'utilité publique (Bande des 100 m de l'océan)
  try {
    const oceanInfo = getOceanZoneInfo(parcelPolygon);
    if (oceanInfo && oceanInfo.isRestricted) {
      warnings.push(
        `Attention : La parcelle empiète sur la zone d'utilité publique des 100 m de l'océan (${oceanInfo.distanceFormatted} du rivage, servitude maritime de l'État non constructible).`
      );
    }
  } catch (err) {
    console.warn('Ocean proximity check error:', err);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    areaInfo,
    polygonFeature: parcelPolygon
  };
}

/**
 * Degrees-minutes-seconds text -> decimal degrees. Accepts 5°54'22.92"S, 5 54 22,92 S, -5 54 22.92,
 * and O (Ouest) for W. Returns NaN when the hemisphere is missing (S/N, E/O or a minus sign), since
 * guessing it would move the parcel by hundreds of km, and when minutes or seconds reach 60.
 */
export function dmsToDd(dmsStr) {
  if (typeof dmsStr === 'number') return dmsStr;
  if (!dmsStr) return NaN;

  const str = String(dmsStr).trim();
  const plain = parseDecimal(str);
  if (!isNaN(plain)) return plain;

  const regex = /^(-)?\s*(\d+)[\s°]+(\d+)[\s'’]+(\d+(?:[.,]\d+)?)[\s"”]*([NSEWO])?$/i;
  const match = str.match(regex);
  if (!match) return NaN;

  const deg = parseFloat(match[2]);
  const min = parseFloat(match[3]);
  const sec = parseDecimal(match[4]);
  const dir = match[5] ? match[5].toUpperCase() : null;
  if (min >= 60 || sec >= 60) return NaN;
  if (!dir && !match[1]) return NaN;

  const dd = deg + min / 60 + sec / 3600;
  return match[1] || dir === 'S' || dir === 'W' || dir === 'O' ? -dd : dd;
}

export function ddToDms(dd, isLatitude = true) {
  if (isNaN(dd)) return '';

  // Rounded to the hundredth of a second first, so 59.999" carries over (no 5°54'60.00")
  const totalCentiSec = Math.round(Math.abs(dd) * 360000);
  const degrees = Math.floor(totalCentiSec / 360000);
  const minutes = Math.floor((totalCentiSec % 360000) / 6000);
  const seconds = ((totalCentiSec % 6000) / 100).toFixed(2);

  let direction = '';
  if (isLatitude) {
    direction = dd >= 0 ? 'N' : 'S';
  } else {
    direction = dd >= 0 ? 'E' : 'O';
  }

  return `${degrees}°${minutes}'${seconds}" ${direction}`;
}

// Bornes of a polygon ring as [lng, lat], without the closing vertex that repeats the first one
export function getParcelBornes(parcelOrGeometry) {
  const geometry = parcelOrGeometry?.geometry || parcelOrGeometry;
  const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] || [] : [];
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}

// Side lengths between consecutive bornes, in meters
export function getSideLengths(parcel) {
  const bornes = getParcelBornes(parcel);
  return bornes.map((a, i) => gridDistance(a, bornes[(i + 1) % bornes.length]));
}

export function formatMeters(m) {
  return m >= 1000
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(m / 1000)} km`
    : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(m)} m`;
}

export function exportParcelToCSV(parcel) {
  const bornes = getParcelBornes(parcel);
  let csv = 'Borne,Latitude,Longitude,Latitude_DMS,Longitude_DMS\n';

  bornes.forEach((pt, idx) => {
    const lng = pt[0];
    const lat = pt[1];
    const latDms = ddToDms(lat, true);
    const lngDms = ddToDms(lng, false);
    csv += `B${idx + 1},${lat},${lng},"${latDms}","${lngDms}"\n`;
  });

  return csv;
}

export function exportParcelsToGeoJSON(parcels) {
  const collection = turf.featureCollection(
    parcels.map((p) => turf.polygon(p.geometry.coordinates, p.properties))
  );
  return JSON.stringify(collection, null, 2);
}

export const STATUS_COLORS = {
  disponible: {
    hex: '#22C55E',
    label: 'Disponible / Libre',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
  },
  occupe: {
    hex: '#EF4444',
    label: 'Occupé / Attribué',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
  },
  litige: {
    hex: '#F97316',
    label: 'En Litige / Réservé',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
  }
};

/**
 * Automatically calculates the next sequential RMB parcel lot number (e.g. RMB/001, RMB/002)
 */
export function getNextRmbLotNumber(parcels = []) {
  let maxNum = 0;
  if (Array.isArray(parcels)) {
    parcels.forEach((p) => {
      const lot = p?.properties?.lotNumber || p?.id || '';
      const match = String(lot).match(/RMB[/-]?(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    });
  }
  const nextNum = maxNum + 1;
  return `RMB/${String(nextNum).padStart(3, '0')}`;
}

const elevationCache = new Map();

/**
 * Fetches ground elevation (altitude in meters above sea level) for a given GPS coordinate
 * using the public Open-Meteo Elevation API (SRTM / Copernicus DEM 30m resolution).
 */
export async function fetchElevation(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (elevationCache.has(key)) {
    return elevationCache.get(key);
  }
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.elevation) && data.elevation.length > 0 && data.elevation[0] !== null) {
        const alt = Math.round(data.elevation[0] * 10) / 10;
        elevationCache.set(key, alt);
        return alt;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch elevation for', lat, lng, err);
  }
  return null;
}

// Measurement of an open polyline (2 points) or closed polygon (3+ points), points as [lat, lng]
export function measurePoints(points) {
  const coords = points.map(([lat, lng]) => [lng, lat]);
  const sides = coords.length < 2 ? [] : coords
    .slice(0, coords.length >= 3 ? coords.length : coords.length - 1)
    .map((a, i) => gridDistance(a, coords[(i + 1) % coords.length]));
  const perimeterM = sides.reduce((sum, m) => sum + m, 0);
  const areaM2 = coords.length >= 3 ? gridArea({ type: 'Polygon', coordinates: [[...coords, coords[0]]] }) : 0;
  const crossing = hasCrossingSides(coords);
  return { sides, perimeterM, areaM2, areaHa: areaM2 / 10000, crossing };
}

// Theoretical lot count for an area: a share is kept for roads and common spaces,
// the rest is divided by the lot area (surface-based, the shape of the area is not taken into account)
export function computeLotQuota({ areaM2, lotWidthM, lotLengthM, reservePct }) {
  const lotAreaM2 = Math.max(0, lotWidthM) * Math.max(0, lotLengthM);
  const reserve = Math.min(Math.max(reservePct, 0), 95) / 100;
  const reservedM2 = areaM2 * reserve;
  const usableM2 = areaM2 - reservedM2;
  const lots = lotAreaM2 > 0 ? Math.floor(usableM2 / lotAreaM2) : 0;
  const leftoverM2 = usableM2 - lots * lotAreaM2;
  return { lotAreaM2, reservedM2, usableM2, lots, leftoverM2 };
}

export function formatArea(m2) {
  const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { m2: `${nf0.format(m2)} m²`, ha: `${nf2.format(m2 / 10000)} ha` };
}

// Text stored in the relevé QR code: readable by any phone camera, even offline. It repeats the
// key facts printed on the document so that an altered copy (retouched or AI-generated) is exposed
// as soon as the code is scanned. Kept short so the code stays scannable once printed (~30 mm).
export function buildVerificationText(parcel, issuedOn, fingerprint) {
  const props = parcel.properties || {};
  const area = calculateArea(parcel);
  const sides = getSideLengths(parcel)
    .map((m) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(m))
    .join(' × ');
  return [
    "CADASTRE OFFICIEL – CONCESSION M.J. D'OLIVEIRA, MUANDA",
    `Lot : ${props.lotNumber || parcel.id}`,
    `Propriétaire : ${props.occupantName || 'Aucun (domaine libre)'}`,
    `Superficie : ${area.formattedHa} (${area.formattedSqM})`,
    `Côtés : ${sides} m`,
    `Émis le ${issuedOn} – Réf. ${getReleveReference(parcel)}`,
    ...(fingerprint ? [`Empreinte : ${fingerprint}`] : []),
    'ANTI-FRAUDE / ANTI-IA : si le nom, la superficie ou les côtés imprimés diffèrent de ce message, le document a été modifié (retouche ou IA) et est NUL.'
  ].join('\n');
}

export function getReleveReference(parcel) {
  return `RMB-AUTH-${String(parcel.id || '').slice(0, 10).toUpperCase()}`;
}
