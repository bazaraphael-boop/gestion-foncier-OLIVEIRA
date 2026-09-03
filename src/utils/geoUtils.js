import * as turf from '@turf/turf';

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

export function exportParcelToCSV(parcel) {
  const coords = parcel.geometry.coordinates[0];
  let csv = 'Index,Latitude,Longitude,Latitude_DMS,Longitude_DMS\n';

  coords.forEach((pt, idx) => {
    const lng = pt[0];
    const lat = pt[1];
    const latDms = ddToDms(lat, true);
    const lngDms = ddToDms(lng, false);
    csv += `${idx + 1},${lat},${lng},"${latDms}","${lngDms}"\n`;
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
