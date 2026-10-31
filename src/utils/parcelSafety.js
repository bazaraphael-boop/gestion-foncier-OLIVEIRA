// Parcels come from a shared database: one malformed row must never crash the app for everyone.
// Invalid lots are left out (the server refuses new ones, see 20261101000000_attack_simulation_fixes.sql);
// fields of an unexpected type are dropped so the screens can rely on them.

const TEXT_FIELDS = ['lotNumber', 'occupantName', 'notes', 'status', 'formattedHa', 'formattedSqM', 'createdAt', 'updatedAt'];
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function isValidGeometry(geometry) {
  const ring = geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates) ? geometry.coordinates[0] : null;
  return (
    Array.isArray(ring) &&
    ring.length >= 3 &&
    ring.every((pt) => Array.isArray(pt) && isNumber(pt[0]) && isNumber(pt[1]) && Math.abs(pt[0]) <= 180 && Math.abs(pt[1]) <= 90)
  );
}

const cleanLocation = (loc) => (loc && isNumber(loc.lat) && isNumber(loc.lng) ? { ...loc, accuracy: isNumber(loc.accuracy) ? loc.accuracy : null, altitude: isNumber(loc.altitude) ? loc.altitude : null } : null);

function cleanProperties(raw) {
  const props = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  TEXT_FIELDS.forEach((field) => {
    if (props[field] != null && typeof props[field] !== 'string') delete props[field];
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(props.releveIssuedOn ?? ''))) delete props.releveIssuedOn;

  if (props.photos !== undefined) {
    props.photos = (Array.isArray(props.photos) ? props.photos : [])
      .filter((p) => typeof p?.path === 'string')
      .map((p) => ({ ...p, location: cleanLocation(p.location) }));
  }
  if (props.documents !== undefined) {
    props.documents = (Array.isArray(props.documents) ? props.documents : [])
      .filter((d) => typeof d?.path === 'string')
      .map((d) => ({ ...d, name: String(d.name ?? 'Document'), sizeKb: isNumber(d.sizeKb) ? d.sizeKb : 0 }));
  }
  const points = props.sourceCoordinates?.points;
  if (props.sourceCoordinates !== undefined && !(Array.isArray(points) && points.every((p) => typeof p === 'string'))) {
    delete props.sourceCoordinates;
  }
  return props;
}

/** Valid parcels only, with their fields checked */
export function sanitizeParcels(parcels) {
  if (!Array.isArray(parcels)) return [];
  return parcels.reduce((kept, parcel) => {
    if (parcel && typeof parcel.id === 'string' && isValidGeometry(parcel.geometry)) {
      kept.push({ ...parcel, properties: cleanProperties(parcel.properties) });
    } else {
      console.warn('Parcelle invalide ignorée :', parcel?.id);
    }
    return kept;
  }, []);
}
