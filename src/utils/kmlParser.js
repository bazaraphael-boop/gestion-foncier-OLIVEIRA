import * as turf from '@turf/turf';

/**
 * Custom robust KML to GeoJSON parser for concession polygons and sub-zones.
 */
export function parseKMLToGeoJSON(kmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const features = [];

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      const nameNode = placemark.getElementsByTagName('name')[0];
      const name = nameNode ? nameNode.textContent.trim() : `Élément ${i + 1}`;
      
      const descNode = placemark.getElementsByTagName('description')[0];
      const description = descNode ? descNode.textContent.trim() : '';

      // Polygon
      const polygonNode = placemark.getElementsByTagName('Polygon')[0];
      if (polygonNode) {
        const coordNode = polygonNode.getElementsByTagName('coordinates')[0];
        if (coordNode) {
          const rawCoords = coordNode.textContent.trim();
          const ring = parseCoordinatesString(rawCoords);
          if (ring.length >= 3) {
            // Ensure closed ring
            if (
              ring[0][0] !== ring[ring.length - 1][0] ||
              ring[0][1] !== ring[ring.length - 1][1]
            ) {
              ring.push([ring[0][0], ring[0][1]]);
            }
            const feature = turf.polygon([ring], {
              name,
              description,
              id: `kml-poly-${i}`,
              isSubZone: !name.toLowerCase().includes('polygone 4')
            });
            features.push(feature);
          }
        }
      }

      // Point marker
      const pointNode = placemark.getElementsByTagName('Point')[0];
      if (pointNode) {
        const coordNode = pointNode.getElementsByTagName('coordinates')[0];
        if (coordNode) {
          const rawCoords = coordNode.textContent.trim();
          const coords = parseSingleCoordinate(rawCoords);
          if (coords) {
            const feature = turf.point(coords, {
              name,
              description,
              id: `kml-point-${i}`
            });
            features.push(feature);
          }
        }
      }
    }

    if (features.length === 0) {
      return parseKMLRegex(kmlText);
    }

    return turf.featureCollection(features);
  } catch (err) {
    console.warn('DOMParser failed, fallback to Regex KML parser', err);
    return parseKMLRegex(kmlText);
  }
}

function parseCoordinatesString(coordStr) {
  const points = coordStr.trim().split(/\s+/);
  const result = [];
  for (const pt of points) {
    const parts = pt.split(',').map((v) => parseFloat(v.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      result.push([parts[0], parts[1]]);
    }
  }
  return result;
}

function parseSingleCoordinate(coordStr) {
  const parts = coordStr.trim().split(',').map((v) => parseFloat(v.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

function parseKMLRegex(kmlText) {
  const features = [];
  const coordRegex = /<coordinates>([\s\S]*?)<\/coordinates>/gi;
  let match;
  let idx = 0;

  while ((match = coordRegex.exec(kmlText)) !== null) {
    const coordStr = match[1];
    const ring = parseCoordinatesString(coordStr);
    if (ring.length >= 3) {
      if (
        ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1]
      ) {
        ring.push([ring[0][0], ring[0][1]]);
      }
      features.push(
        turf.polygon([ring], {
          name: `Zone Extrait ${idx + 1}`,
          id: `kml-regex-${idx}`
        })
      );
      idx++;
    }
  }

  return turf.featureCollection(features);
}

/**
 * Extracts the primary concession perimeter (largest polygon by area)
 */
export function extractMainConcessionPolygon(featureCollection) {
  if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) {
    return null;
  }

  const polygons = featureCollection.features.filter(
    (f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
  );

  if (polygons.length === 0) return null;

  const namedPoly = polygons.find(
    (p) => p.properties && p.properties.name && p.properties.name.toLowerCase().includes('polygone 4')
  );

  if (namedPoly) return namedPoly;

  let maxArea = -1;
  let mainPoly = polygons[0];

  for (const poly of polygons) {
    const area = turf.area(poly);
    if (area > maxArea) {
      maxArea = area;
      mainPoly = poly;
    }
  }

  return mainPoly;
}

/**
 * Extracts sub-zones (like "isetech")
 */
export function extractSubZones(featureCollection) {
  if (!featureCollection || !featureCollection.features) return [];

  const mainPoly = extractMainConcessionPolygon(featureCollection);
  const mainId = mainPoly ? mainPoly.properties.id : null;

  return featureCollection.features.filter(
    (f) =>
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
      f.properties.id !== mainId
  );
}
