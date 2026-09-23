import * as turf from '@turf/turf';

export const OCEAN_COASTLINE_LEAFLET = [
  [
    -5.8796419,
    12.2844379
  ],
  [
    -5.8916803,
    12.2934493
  ],
  [
    -5.8940922,
    12.2961743
  ],
  [
    -5.8949673,
    12.298041
  ],
  [
    -5.8984037,
    12.3040276
  ],
  [
    -5.9032061,
    12.309671
  ],
  [
    -5.9277937,
    12.3359363
  ],
  [
    -5.9277937,
    12.3359363
  ]
];

export const LINE_100M_LEAFLET = [
  [
    -5.8791208,
    12.2851712
  ],
  [
    -5.8910678,
    12.2941142
  ],
  [
    -5.8933329,
    12.2966733
  ],
  [
    -5.8941688,
    12.2984564
  ],
  [
    -5.897665,
    12.3045473
  ],
  [
    -5.902535,
    12.3102701
  ],
  [
    -5.927124,
    12.3365368
  ],
  [
    -5.9273598,
    12.3368114
  ]
];

export const LINE_200M_LEAFLET = [
  [
    -5.8785997,
    12.2859045
  ],
  [
    -5.8904553,
    12.2947791
  ],
  [
    -5.8925736,
    12.2971724
  ],
  [
    -5.8933703,
    12.2988719
  ],
  [
    -5.8969264,
    12.3050669
  ],
  [
    -5.9018639,
    12.3108691
  ],
  [
    -5.9264542,
    12.3371373
  ],
  [
    -5.9269258,
    12.3376866
  ]
];

export const LINE_400M_LEAFLET = [
  [
    -5.8775574,
    12.2873711
  ],
  [
    -5.8892303,
    12.2961088
  ],
  [
    -5.891055,
    12.2981704
  ],
  [
    -5.8917734,
    12.2997027
  ],
  [
    -5.8954491,
    12.3061062
  ],
  [
    -5.9005217,
    12.3120672
  ],
  [
    -5.9251147,
    12.3383383
  ],
  [
    -5.9260579,
    12.3394368
  ]
];

export const LINE_600M_LEAFLET = [
  [
    -5.8765152,
    12.2888376
  ],
  [
    -5.8880053,
    12.2974386
  ],
  [
    -5.8895364,
    12.2991685
  ],
  [
    -5.8901764,
    12.3005336
  ],
  [
    -5.8939717,
    12.3071455
  ],
  [
    -5.8991795,
    12.3132653
  ],
  [
    -5.9237753,
    12.3395393
  ],
  [
    -5.9249103,
    12.3408612
  ]
];

export const MIDPOINT_0M = [-5.885661, 12.288943];
export const MIDPOINT_100M = [-5.891068, 12.294114];
export const MIDPOINT_200M = [-5.893370, 12.298872];
export const MIDPOINT_400M = [-5.908719, 12.320824];
export const MIDPOINT_600M = [-5.918000, 12.333500];

export const COASTAL_ZONES = [
  {
    "id": "zone_up",
    "code": "UP",
    "name": "Zone d'Utilité Publique (0 à 100 m de l'océan)",
    "shortName": "Utilité Publique (0-100m)",
    "range": "0 à 100 m",
    "areaHa": 78.65,
    "formattedArea": "78,65 ha",
    "color": "#EF4444",
    "fillOpacity": 0.28,
    "strokeColor": "#DC2626",
    "isRestricted": true,
    "coordinates": [
      [
            -5.8796419,
            12.2844379
      ],
      [
            -5.8916803,
            12.2934493
      ],
      [
            -5.8940922,
            12.2961743
      ],
      [
            -5.8949673,
            12.298041
      ],
      [
            -5.8984037,
            12.3040276
      ],
      [
            -5.9032061,
            12.309671
      ],
      [
            -5.9277937,
            12.3359363
      ],
      [
            -5.9277937,
            12.3359363
      ],
      [
            -5.9273598,
            12.3368114
      ],
      [
            -5.927124,
            12.3365368
      ],
      [
            -5.902535,
            12.3102701
      ],
      [
            -5.897665,
            12.3045473
      ],
      [
            -5.8941688,
            12.2984564
      ],
      [
            -5.8933329,
            12.2966733
      ],
      [
            -5.8910678,
            12.2941142
      ],
      [
            -5.8791208,
            12.2851712
      ],
      [
            -5.8796419,
            12.2844379
      ]
],
    "description": "Domaine public maritime et servitude de l'État (0 à 100 m) • Inaliénable et non constructible",
    "badgeBg": "bg-rose-500/20 text-rose-300 border-rose-500/40"
  },
  {
    "id": "zone_a",
    "code": "A",
    "name": "Zone A (101 à 200 m de l'océan)",
    "shortName": "Zone A (101-200m)",
    "range": "101 à 200 m",
    "areaHa": 78.83,
    "formattedArea": "78,83 ha",
    "color": "#06B6D4",
    "fillOpacity": 0.22,
    "strokeColor": "#0891B2",
    "coordinates": [
      [
            -5.8791208,
            12.2851712
      ],
      [
            -5.8910678,
            12.2941142
      ],
      [
            -5.8933329,
            12.2966733
      ],
      [
            -5.8941688,
            12.2984564
      ],
      [
            -5.897665,
            12.3045473
      ],
      [
            -5.902535,
            12.3102701
      ],
      [
            -5.927124,
            12.3365368
      ],
      [
            -5.9273598,
            12.3368114
      ],
      [
            -5.9269258,
            12.3376866
      ],
      [
            -5.9264542,
            12.3371373
      ],
      [
            -5.9018639,
            12.3108691
      ],
      [
            -5.8969264,
            12.3050669
      ],
      [
            -5.8933703,
            12.2988719
      ],
      [
            -5.8925736,
            12.2971724
      ],
      [
            -5.8904553,
            12.2947791
      ],
      [
            -5.8785997,
            12.2859045
      ],
      [
            -5.8791208,
            12.2851712
      ]
],
    "description": "Bande littorale secondaire (101 à 200 m de l'océan)",
    "badgeBg": "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
  },
  {
    "id": "zone_b",
    "code": "B",
    "name": "Zone B (201 à 400 m de l'océan)",
    "shortName": "Zone B (201-400m)",
    "range": "201 à 400 m",
    "areaHa": 158.19,
    "formattedArea": "158,19 ha",
    "color": "#F59E0B",
    "fillOpacity": 0.2,
    "strokeColor": "#D97706",
    "coordinates": [
      [
            -5.8785997,
            12.2859045
      ],
      [
            -5.8904553,
            12.2947791
      ],
      [
            -5.8925736,
            12.2971724
      ],
      [
            -5.8933703,
            12.2988719
      ],
      [
            -5.8969264,
            12.3050669
      ],
      [
            -5.9018639,
            12.3108691
      ],
      [
            -5.9264542,
            12.3371373
      ],
      [
            -5.9269258,
            12.3376866
      ],
      [
            -5.9260579,
            12.3394368
      ],
      [
            -5.9251147,
            12.3383383
      ],
      [
            -5.9005217,
            12.3120672
      ],
      [
            -5.8954491,
            12.3061062
      ],
      [
            -5.8917734,
            12.2997027
      ],
      [
            -5.891055,
            12.2981704
      ],
      [
            -5.8892303,
            12.2961088
      ],
      [
            -5.8775574,
            12.2873711
      ],
      [
            -5.8785997,
            12.2859045
      ]
],
    "description": "Bande littorale intermédiaire (201 à 400 m de l'océan)",
    "badgeBg": "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  {
    "id": "zone_c",
    "code": "C",
    "name": "Zone C (401 à 600 m de l'océan)",
    "shortName": "Zone C (401-600m)",
    "range": "401 à 600 m",
    "areaHa": 158.47,
    "formattedArea": "158,47 ha",
    "color": "#8B5CF6",
    "fillOpacity": 0.2,
    "strokeColor": "#7C3AED",
    "coordinates": [
      [
            -5.8775574,
            12.2873711
      ],
      [
            -5.8892303,
            12.2961088
      ],
      [
            -5.891055,
            12.2981704
      ],
      [
            -5.8917734,
            12.2997027
      ],
      [
            -5.8954491,
            12.3061062
      ],
      [
            -5.9005217,
            12.3120672
      ],
      [
            -5.9251147,
            12.3383383
      ],
      [
            -5.9260579,
            12.3394368
      ],
      [
            -5.9249103,
            12.3408612
      ],
      [
            -5.9237753,
            12.3395393
      ],
      [
            -5.8991795,
            12.3132653
      ],
      [
            -5.8939717,
            12.3071455
      ],
      [
            -5.8901764,
            12.3005336
      ],
      [
            -5.8895364,
            12.2991685
      ],
      [
            -5.8880053,
            12.2974386
      ],
      [
            -5.8765152,
            12.2888376
      ],
      [
            -5.8775574,
            12.2873711
      ]
],
    "description": "Bande de transition intérieure (401 à 600 m de l'océan)",
    "badgeBg": "bg-purple-500/20 text-purple-300 border-purple-500/40"
  },
  {
    "id": "zone_d",
    "code": "D",
    "name": "Zone D (601 m et plus de l'océan)",
    "shortName": "Zone D (>600m)",
    "range": "601 m et plus",
    "areaHa": 4930.66,
    "formattedArea": "4 930,66 ha",
    "color": "#10B981",
    "fillOpacity": 0.08,
    "strokeColor": "#059669",
    "coordinates": [
      [
            -5.8765152,
            12.2888376
      ],
      [
            -5.8880053,
            12.2974386
      ],
      [
            -5.8895364,
            12.2991685
      ],
      [
            -5.8901764,
            12.3005336
      ],
      [
            -5.8939717,
            12.3071455
      ],
      [
            -5.8991795,
            12.3132653
      ],
      [
            -5.9237753,
            12.3395393
      ],
      [
            -5.9249103,
            12.3408612
      ],
      [
            -5.923301,
            12.3427602
      ],
      [
            -5.9196886,
            12.3458288
      ],
      [
            -5.9157348,
            12.3470091
      ],
      [
            -5.9079978,
            12.3482537
      ],
      [
            -5.9043001,
            12.3493911
      ],
      [
            -5.9006024,
            12.351215
      ],
      [
            -5.8986121,
            12.3555279
      ],
      [
            -5.8979879,
            12.3598409
      ],
      [
            -5.8973636,
            12.3648404
      ],
      [
            -5.8981907,
            12.3701833
      ],
      [
            -5.8985908,
            12.3762128
      ],
      [
            -5.8998447,
            12.3820706
      ],
      [
            -5.8991482,
            12.386802
      ],
      [
            -5.8964881,
            12.3893017
      ],
      [
            -5.8934865,
            12.3905998
      ],
      [
            -5.8917296,
            12.3900901
      ],
      [
            -5.8897166,
            12.3880355
      ],
      [
            -5.8386584,
            12.3471801
      ],
      [
            -5.8507833,
            12.332697
      ],
      [
            -5.856931,
            12.3249403
      ],
      [
            -5.8600049,
            12.3164968
      ],
      [
            -5.8664939,
            12.3098555
      ],
      [
            -5.8712751,
            12.3011542
      ],
      [
            -5.874434,
            12.2917662
      ],
      [
            -5.8765152,
            12.2888376
      ]
],
    "description": "Zone continentale et concession profonde (601 m et plus de l'océan)",
    "badgeBg": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  }
];

export const SEPARATION_LINES = [
  {
    "id": "line_0m",
    "distMeters": 0,
    "label": "Trait de Côte (0 m - Océan Atlantique)",
    "shortLabel": "Océan (0 m)",
    "color": "#0284C7",
    "weight": 3.5,
    "coordinates": OCEAN_COASTLINE_LEAFLET,
    "midpoint": MIDPOINT_0M
  },
  {
    "id": "line_100m",
    "distMeters": 100,
    "label": "Ligne des 100 m (Limite d'Utilité Publique)",
    "shortLabel": "Utilité Publique (100 m)",
    "color": "#EF4444",
    "dashArray": "6, 4",
    "weight": 3.0,
    "coordinates": LINE_100M_LEAFLET,
    "midpoint": MIDPOINT_100M
  },
  {
    "id": "line_200m",
    "distMeters": 200,
    "label": "Ligne de Séparation 200 m (Zone A / Zone B)",
    "shortLabel": "Ligne 200 m",
    "color": "#06B6D4",
    "dashArray": "6, 6",
    "weight": 2.5,
    "coordinates": LINE_200M_LEAFLET,
    "midpoint": MIDPOINT_200M
  },
  {
    "id": "line_400m",
    "distMeters": 400,
    "label": "Ligne de Séparation 400 m (Zone B / Zone C)",
    "shortLabel": "Ligne 400 m",
    "color": "#F59E0B",
    "dashArray": "6, 6",
    "weight": 2.5,
    "coordinates": LINE_400M_LEAFLET,
    "midpoint": MIDPOINT_400M
  },
  {
    "id": "line_600m",
    "distMeters": 600,
    "label": "Ligne de Séparation 600 m (Zone C / Zone D)",
    "shortLabel": "Ligne 600 m",
    "color": "#8B5CF6",
    "dashArray": "6, 6",
    "weight": 2.5,
    "coordinates": LINE_600M_LEAFLET,
    "midpoint": MIDPOINT_600M
  }
];

const COASTLINE_TURF_LINE = turf.lineString(
  OCEAN_COASTLINE_LEAFLET.map(([lat, lng]) => [lng, lat])
);

const oceanZoneCache = new Map();

export function getOceanZoneInfo(geometryOrPoints) {
  if (!geometryOrPoints) return null;

  let cacheKey = null;
  if (geometryOrPoints.id) {
    cacheKey = `id_${geometryOrPoints.id}`;
  } else if (geometryOrPoints.properties && geometryOrPoints.properties.lotNumber) {
    cacheKey = `lot_${geometryOrPoints.properties.lotNumber}`;
  } else if (Array.isArray(geometryOrPoints) && geometryOrPoints.length === 2 && typeof geometryOrPoints[0] === 'number') {
    cacheKey = `pt_${geometryOrPoints[0].toFixed(5)}_${geometryOrPoints[1].toFixed(5)}`;
  }

  if (cacheKey && oceanZoneCache.has(cacheKey)) {
    return oceanZoneCache.get(cacheKey);
  }

  try {
    let pts = [];

    if (Array.isArray(geometryOrPoints)) {
      if (typeof geometryOrPoints[0] === 'number') {
        const p = geometryOrPoints;
        const lng = p[0] > 0 && p[0] < 20 ? p[0] : p[1];
        const lat = p[0] < 0 ? p[0] : p[1];
        pts = [[lng, lat]];
      } else {
        pts = geometryOrPoints.map(p => {
          const lng = p[0] > 0 && p[0] < 20 ? p[0] : p[1];
          const lat = p[0] < 0 ? p[0] : p[1];
          return [lng, lat];
        });
      }
    } else if (geometryOrPoints.geometry) {
      const geom = geometryOrPoints.geometry;
      if (geom.type === 'Polygon') {
        pts = geom.coordinates[0];
      } else if (geom.type === 'Point') {
        pts = [geom.coordinates];
      }
    } else if (geometryOrPoints.type === 'Polygon') {
      pts = geometryOrPoints.coordinates[0];
    } else if (geometryOrPoints.type === 'Point') {
      pts = [geometryOrPoints.coordinates];
    }

    if (pts.length === 0) return null;

    let minDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      if (Array.isArray(pt) && pt.length >= 2) {
        const d = turf.pointToLineDistance(turf.point(pt), COASTLINE_TURF_LINE, { units: 'meters' });
        if (d < minDist) minDist = d;
      }
    }

    if (minDist === Infinity) return null;

    const distanceMeters = Math.round(minDist);
    const distanceFormatted = `${distanceMeters.toLocaleString('fr-FR')} m`;

    let result = null;

    if (distanceMeters <= 100) {
      result = {
        distanceMeters,
        distanceFormatted,
        zone: 'UP',
        zoneName: "Zone d'Utilité Publique (0 à 100 m de l'océan)",
        shortName: 'Utilité Publique (0-100m)',
        color: '#EF4444',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        description: "Domaine public maritime et servitude de l'État (0 à 100 m) • Inaliénable & non constructible",
        isRestricted: true
      };
    } else if (distanceMeters <= 200) {
      result = {
        distanceMeters,
        distanceFormatted,
        zone: 'A',
        zoneName: "Zone A (101 à 200 m de l'océan)",
        shortName: 'Zone A (101-200m)',
        color: '#06B6D4',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        description: "Bande littorale secondaire (101 à 200 m de l'océan)"
      };
    } else if (distanceMeters <= 400) {
      result = {
        distanceMeters,
        distanceFormatted,
        zone: 'B',
        zoneName: "Zone B (201 à 400 m de l'océan)",
        shortName: 'Zone B (201-400m)',
        color: '#F59E0B',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        description: "Bande littorale intermédiaire (201 à 400 m de l'océan)"
      };
    } else if (distanceMeters <= 600) {
      result = {
        distanceMeters,
        distanceFormatted,
        zone: 'C',
        zoneName: "Zone C (401 à 600 m de l'océan)",
        shortName: 'Zone C (401-600m)',
        color: '#8B5CF6',
        badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        description: "Bande de transition intérieure (401 à 600 m de l'océan)"
      };
    } else {
      result = {
        distanceMeters,
        distanceFormatted,
        zone: 'D',
        zoneName: "Zone D (601 m et plus de l'océan)",
        shortName: 'Zone D (>600m)',
        color: '#10B981',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        description: "Zone continentale et concession profonde (601 m et plus de l'océan)"
      };
    }

    if (cacheKey && result) {
      if (oceanZoneCache.size > 2000) oceanZoneCache.clear();
      oceanZoneCache.set(cacheKey, result);
    }

    return result;

  } catch (err) {
    console.warn('Error computing ocean zone info:', err);
    return null;
  }
}
