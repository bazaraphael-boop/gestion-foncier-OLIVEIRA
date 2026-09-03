import { calculateArea } from '../utils/geoUtils';

/**
 * Initial dataset featuring Zone Isetech (1 002,61 ha, Occupied / Red #EF4444)
 */
export const INITIAL_PARCELS = [
  {
    type: 'Feature',
    id: 'parcelle_isetech',
    properties: {
      lotNumber: 'LOT-ISETECH',
      status: 'occupe',
      occupantName: 'Zone Isetech (Exploitation Attribuée)',
      notes: 'Sous-zone Isetech comprise dans le périmètre global de la Concession Manuel Joaquim d\'Oliveira.',
      createdAt: '2026-09-03',
      color: '#EF4444'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3417897, -5.914822],
          [12.3443968, -5.9143525],
          [12.3467035, -5.9142672],
          [12.3483343, -5.9073945],
          [12.351215, -5.9006024],
          [12.3529692, -5.8988142],
          [12.3546429, -5.8959541],
          [12.3538704, -5.8913864],
          [12.3527546, -5.8895509],
          [12.3487205, -5.8854527],
          [12.3421116, -5.882806],
          [12.336318, -5.8819095],
          [12.330739, -5.8819095],
          [12.3255033, -5.8890813],
          [12.3209542, -5.9078641],
          [12.3241835, -5.9102119],
          [12.32737, -5.9116633],
          [12.3306745, -5.9130933],
          [12.3341078, -5.913883],
          [12.3379487, -5.9145873],
          [12.339955, -5.9150248],
          [12.3417897, -5.914822]
        ]
      ]
    }
  }
].map((p) => {
  const area = calculateArea(p);
  return {
    ...p,
    properties: {
      ...p.properties,
      areaSqM: area.sqMeters > 0 ? area.sqMeters : 10026098,
      areaHa: area.hectares > 0 ? area.hectares : 1002.61,
      formattedSqM: area.sqMeters > 0 ? area.formattedSqM : '10 026 098 m²',
      formattedHa: area.hectares > 0 ? area.formattedHa : '1 002,61 ha'
    }
  };
});
