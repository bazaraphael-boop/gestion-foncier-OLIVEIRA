// Zone ISETECH: the first zone of the concession, created in Supabase at the admin's first sign-in
// (see hooks/useZones.js). Boundary as [lat, lng], from the ISETECH sub-cadastre.
const ISETECH_BOUNDARY = [
  [-5.914822, 12.3417897],
  [-5.9143525, 12.3443968],
  [-5.9142672, 12.3467035],
  [-5.9073945, 12.3483343],
  [-5.9006024, 12.351215],
  [-5.8988142, 12.3529692],
  [-5.8959541, 12.3546429],
  [-5.8913864, 12.3538704],
  [-5.8895509, 12.3527546],
  [-5.8854527, 12.3487205],
  [-5.882806, 12.3421116],
  [-5.8819095, 12.336318],
  [-5.8819095, 12.330739],
  [-5.8890813, 12.3255033],
  [-5.9078641, 12.3209542],
  [-5.9102119, 12.3241835],
  [-5.9116633, 12.32737],
  [-5.9130933, 12.3306745],
  [-5.913883, 12.3341078],
  [-5.9145873, 12.3379487],
  [-5.9150248, 12.339955],
  [-5.914822, 12.3417897]
];

export const ISETECH_ZONE = {
  type: 'Feature',
  id: 'isetech',
  properties: { name: 'Zone ISETECH', color: '#0284C7' },
  geometry: { type: 'Polygon', coordinates: [ISETECH_BOUNDARY.map(([lat, lng]) => [lng, lat])] }
};

export const DEFAULT_ZONES = [ISETECH_ZONE];

// Colours offered for a new zone (distinct from parcel statuses and coastal bands)
export const ZONE_COLORS = ['#0284C7', '#7C3AED', '#DB2777', '#0D9488', '#CA8A04', '#4F46E5'];
