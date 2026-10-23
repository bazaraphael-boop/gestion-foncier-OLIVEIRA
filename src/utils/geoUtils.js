import * as turf from '@turf/turf';
import { getOceanZoneInfo } from './coastalZones';

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
    } else if (featureOrGeometry.type === 'Polygon' && featureOrGeometry.coordinates) {
      polyFeature = turf.polygon(featureOrGeometry.coordinates);
    } else if (Array.isArray(featureOrGeometry)) {
      polyFeature = turf.polygon(featureOrGeometry);
    } else {
      return { sqMeters: 0, hectares: 0, formattedSqM: '0 m²', formattedHa: '0.00 ha' };
    }

    const sqMeters = turf.area(polyFeature);
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
          const overlapArea = turf.area(overlap);
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

export function dmsToDd(dmsStr) {
  if (typeof dmsStr === 'number') return dmsStr;
  if (!dmsStr) return NaN;

  const str = dmsStr.trim();
  if (!isNaN(Number(str))) return parseFloat(str);

  const regex = /(\d+)[\s°]+(\d+)[\s']+(\d+(?:\.\d+)?)[\s"]*\s*([NSEW])?/i;
  const match = str.match(regex);

  if (match) {
    const deg = parseFloat(match[1]);
    const min = parseFloat(match[2]);
    const sec = parseFloat(match[3]);
    const dir = match[4] ? match[4].toUpperCase() : null;

    let dd = deg + min / 60 + sec / 3600;
    if (dir === 'S' || dir === 'W') {
      dd = -dd;
    }
    return dd;
  }

  return parseFloat(str);
}

export function ddToDms(dd, isLatitude = true) {
  if (isNaN(dd)) return '';

  const absolute = Math.abs(dd);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

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
  return bornes.map((a, i) => turf.distance(turf.point(a), turf.point(bornes[(i + 1) % bornes.length]), { units: 'meters' }));
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
    .map((a, i) => turf.distance(turf.point(a), turf.point(coords[(i + 1) % coords.length]), { units: 'meters' }));
  const perimeterM = sides.reduce((sum, m) => sum + m, 0);
  const areaM2 = coords.length >= 3 ? turf.area(turf.polygon([[...coords, coords[0]]])) : 0;
  return { sides, perimeterM, areaM2, areaHa: areaM2 / 10000 };
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
