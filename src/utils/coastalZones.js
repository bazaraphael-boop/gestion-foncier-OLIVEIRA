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

export const LINE_200M_LEAFLET = [
  [
    -5.878599669721918,
    12.28590447505807
  ],
  [
    -5.890455284884434,
    12.294779051315228
  ],
  [
    -5.892573616636255,
    12.297172373602102
  ],
  [
    -5.893370327999689,
    12.298871860634579
  ],
  [
    -5.8969263800943015,
    12.305066908204598
  ],
  [
    -5.901863912157288,
    12.310869104698904
  ],
  [
    -5.926454221307222,
    12.337137298703842
  ],
  [
    -5.926925823152696,
    12.337686558510104
  ]
];

export const LINE_400M_LEAFLET = [
  [
    -5.877557439433258,
    12.287371050130425
  ],
  [
    -5.889230269768861,
    12.29610880263045
  ],
  [
    -5.891055033272511,
    12.298170447204207
  ],
  [
    -5.891773355999381,
    12.299702721269167
  ],
  [
    -5.895449060188605,
    12.306106216409201
  ],
  [
    -5.900521724314524,
    12.312067209397751
  ],
  [
    -5.9251147426144275,
    12.338338297407661
  ],
  [
    -5.926057945492629,
    12.339436817725609
  ]
];

export const LINE_600M_LEAFLET = [
  [
    -5.876515209134105,
    12.288837625216942
  ],
  [
    -5.888005254653299,
    12.297438553945682
  ],
  [
    -5.889536449908766,
    12.299168520806308
  ],
  [
    -5.890176383999068,
    12.300533581903746
  ],
  [
    -5.893971740282907,
    12.3071455246138
  ],
  [
    -5.899179536471812,
    12.313265314096656
  ],
  [
    -5.923775263921631,
    12.339539296111482
  ],
  [
    -5.924910263357198,
    12.34086119704639
  ]
];

export const MIDPOINT_0M = [-5.885661, 12.288943];

export const MIDPOINT_200M = [-5.893370, 12.298872];

export const MIDPOINT_400M = [-5.908719, 12.320824];

export const MIDPOINT_600M = [-5.918000, 12.333500];

export const COASTAL_ZONES = [
  {
    "id": "zone_a",
    "code": "A",
    "name": "Zone A (0 \u00e0 200 m de l'oc\u00e9an)",
    "shortName": "Zone A (0-200m)",
    "range": "0 \u00e0 200 m",
    "areaHa": 157.48,
    "formattedArea": "157,48 ha",
    "color": "#06B6D4",
    "fillOpacity": 0.22,
    "strokeColor": "#0891B2",
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
        -5.9269258192989085,
        12.337686561854676
      ],
      [
        -5.926454221307222,
        12.337137298703842
      ],
      [
        -5.901863912157288,
        12.310869104698904
      ],
      [
        -5.8969263800943015,
        12.305066908204598
      ],
      [
        -5.893370327999689,
        12.298871860634579
      ],
      [
        -5.892573616636255,
        12.297172373602102
      ],
      [
        -5.890455284884434,
        12.294779051315228
      ],
      [
        -5.878599669391863,
        12.285904475503678
      ],
      [
        -5.8796419,
        12.2844379
      ]
    ],
    "description": "Bande littorale imm\u00e9diate et servitude maritime (0 \u00e0 200 m de l'oc\u00e9an)",
    "badgeBg": "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
  },
  {
    "id": "zone_b",
    "code": "B",
    "name": "Zone B (201 \u00e0 400 m de l'oc\u00e9an)",
    "shortName": "Zone B (201-400m)",
    "range": "201 \u00e0 400 m",
    "areaHa": 158.19,
    "formattedArea": "158,19 ha",
    "color": "#F59E0B",
    "fillOpacity": 0.2,
    "strokeColor": "#D97706",
    "coordinates": [
      [
        -5.878599669391863,
        12.285904475503678
      ],
      [
        -5.890455284884434,
        12.294779051315228
      ],
      [
        -5.892573616636255,
        12.297172373602102
      ],
      [
        -5.893370327999689,
        12.298871860634579
      ],
      [
        -5.8969263800943015,
        12.305066908204598
      ],
      [
        -5.901863912157288,
        12.310869104698904
      ],
      [
        -5.926454221307222,
        12.337137298703842
      ],
      [
        -5.9269258192989085,
        12.337686561854676
      ],
      [
        -5.926057938597818,
        12.33943682370935
      ],
      [
        -5.9251147426144275,
        12.338338297407661
      ],
      [
        -5.900521724314524,
        12.312067209397751
      ],
      [
        -5.895449060188605,
        12.306106216409201
      ],
      [
        -5.891773355999381,
        12.299702721269167
      ],
      [
        -5.891055033272511,
        12.298170447204207
      ],
      [
        -5.889230269768861,
        12.29610880263045
      ],
      [
        -5.877557438783726,
        12.287371051007357
      ],
      [
        -5.878599669391863,
        12.285904475503678
      ]
    ],
    "description": "Bande littorale secondaire (201 \u00e0 400 m de l'oc\u00e9an)",
    "badgeBg": "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  {
    "id": "zone_c",
    "code": "C",
    "name": "Zone C (401 \u00e0 600 m de l'oc\u00e9an)",
    "shortName": "Zone C (401-600m)",
    "range": "401 \u00e0 600 m",
    "areaHa": 158.47,
    "formattedArea": "158,47 ha",
    "color": "#8B5CF6",
    "fillOpacity": 0.2,
    "strokeColor": "#7C3AED",
    "coordinates": [
      [
        -5.877557438783726,
        12.287371051007357
      ],
      [
        -5.889230269768861,
        12.29610880263045
      ],
      [
        -5.891055033272511,
        12.298170447204207
      ],
      [
        -5.891773355999381,
        12.299702721269167
      ],
      [
        -5.895449060188605,
        12.306106216409201
      ],
      [
        -5.900521724314524,
        12.312067209397751
      ],
      [
        -5.9251147426144275,
        12.338338297407661
      ],
      [
        -5.926057938597818,
        12.33943682370935
      ],
      [
        -5.9259742,
        12.3396057
      ],
      [
        -5.924910255491022,
        12.3408612038731
      ],
      [
        -5.923775263921631,
        12.339539296111482
      ],
      [
        -5.899179536471812,
        12.313265314096656
      ],
      [
        -5.893971740282907,
        12.3071455246138
      ],
      [
        -5.890176383999068,
        12.300533581903746
      ],
      [
        -5.889536449908766,
        12.299168520806308
      ],
      [
        -5.888005254653299,
        12.297438553945682
      ],
      [
        -5.87651520817559,
        12.288837626511036
      ],
      [
        -5.877557438783726,
        12.287371051007357
      ]
    ],
    "description": "Bande de transition int\u00e9rieure (401 \u00e0 600 m de l'oc\u00e9an)",
    "badgeBg": "bg-purple-500/20 text-purple-300 border-purple-500/40"
  },
  {
    "id": "zone_d",
    "code": "D",
    "name": "Zone D (601 m et plus de l'oc\u00e9an)",
    "shortName": "Zone D (>600m)",
    "range": "601 m et plus",
    "areaHa": 4930.66,
    "formattedArea": "4930,66 ha",
    "color": "#10B981",
    "fillOpacity": 0.08,
    "strokeColor": "#059669",
    "coordinates": [
      [
        -5.87651520817559,
        12.288837626511036
      ],
      [
        -5.888005254653299,
        12.297438553945682
      ],
      [
        -5.889536449908766,
        12.299168520806308
      ],
      [
        -5.890176383999068,
        12.300533581903746
      ],
      [
        -5.893971740282907,
        12.3071455246138
      ],
      [
        -5.899179536471812,
        12.313265314096656
      ],
      [
        -5.923775263921631,
        12.339539296111482
      ],
      [
        -5.924910255491022,
        12.3408612038731
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
        -5.87651520817559,
        12.288837626511036
      ]
    ],
    "description": "Zone continentale et concession profonde (601 m et plus de l'oc\u00e9an)",
    "badgeBg": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  }
];

export const SEPARATION_LINES = [
  {
    "id": "line_0m",
    "distMeters": 0,
    "label": "Trait de C\u00f4te (0 m - Oc\u00e9an Atlantique)",
    "shortLabel": "Oc\u00e9an (0 m)",
    "color": "#0284C7",
    "weight": 3.5,
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
      ]
    ],
    "midpoint": [
      -5.885661,
      12.288943
    ]
  },
  {
    "id": "line_200m",
    "distMeters": 200,
    "label": "Ligne de S\u00e9paration 200 m (Zone A / Zone B)",
    "shortLabel": "Ligne 200 m",
    "color": "#06B6D4",
    "dashArray": "6, 6",
    "weight": 2.5,
    "coordinates": [
      [
        -5.878599669721918,
        12.28590447505807
      ],
      [
        -5.890455284884434,
        12.294779051315228
      ],
      [
        -5.892573616636255,
        12.297172373602102
      ],
      [
        -5.893370327999689,
        12.298871860634579
      ],
      [
        -5.8969263800943015,
        12.305066908204598
      ],
      [
        -5.901863912157288,
        12.310869104698904
      ],
      [
        -5.926454221307222,
        12.337137298703842
      ],
      [
        -5.926925823152696,
        12.337686558510104
      ]
    ],
    "midpoint": [
      -5.893370,
      12.298872
    ]
  },
  {
    "id": "line_400m",
    "distMeters": 400,
    "label": "Ligne de S\u00e9paration 400 m (Zone B / Zone C)",
    "shortLabel": "Ligne 400 m",
    "color": "#F59E0B",
    "dashArray": "6, 6",
    "weight": 2.5,
    "coordinates": [
      [
        -5.877557439433258,
        12.287371050130425
      ],
      [
        -5.889230269768861,
        12.29610880263045
      ],
      [
        -5.891055033272511,
        12.298170447204207
      ],
      [
        -5.891773355999381,
        12.299702721269167
      ],
      [
        -5.895449060188605,
        12.306106216409201
      ],
      [
        -5.900521724314524,
        12.312067209397751
      ],
      [
        -5.9251147426144275,
        12.338338297407661
      ],
      [
        -5.926057945492629,
        12.339436817725609
      ]
    ],
    "midpoint": [
      -5.908719,
      12.320824
    ]
  },
  {
    "id": "line_600m",
    "distMeters": 600,
    "label": "Ligne de S\u00e9paration 600 m (Zone C / Zone D)",
    "shortLabel": "Ligne 600 m",
    "color": "#8B5CF6",
    "dashArray": "6, 6",
    "weight": 2.5,
    "coordinates": [
      [
        -5.876515209134105,
        12.288837625216942
      ],
      [
        -5.888005254653299,
        12.297438553945682
      ],
      [
        -5.889536449908766,
        12.299168520806308
      ],
      [
        -5.890176383999068,
        12.300533581903746
      ],
      [
        -5.893971740282907,
        12.3071455246138
      ],
      [
        -5.899179536471812,
        12.313265314096656
      ],
      [
        -5.923775263921631,
        12.339539296111482
      ],
      [
        -5.924910263357198,
        12.34086119704639
      ]
    ],
    "midpoint": [
      -5.918000,
      12.333500
    ]
  }
];

const COASTLINE_TURF_LINE = turf.lineString(
  OCEAN_COASTLINE_LEAFLET.map(([lat, lng]) => [lng, lat])
);

export function getOceanZoneInfo(geometryOrPoints) {
  if (!geometryOrPoints) return null;

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

    if (distanceMeters <= 200) {
      return {
        distanceMeters,
        distanceFormatted,
        zone: 'A',
        zoneName: "Zone A (0 à 200 m de l'océan)",
        shortName: 'Zone A (0-200m)',
        color: '#06B6D4',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        description: "Bande littorale immédiate et servitude maritime (0 à 200 m)"
      };
    }

    if (distanceMeters <= 400) {
      return {
        distanceMeters,
        distanceFormatted,
        zone: 'B',
        zoneName: "Zone B (201 à 400 m de l'océan)",
        shortName: 'Zone B (201-400m)',
        color: '#F59E0B',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        description: "Bande littorale secondaire (201 à 400 m)"
      };
    }

    if (distanceMeters <= 600) {
      return {
        distanceMeters,
        distanceFormatted,
        zone: 'C',
        zoneName: "Zone C (401 à 600 m de l'océan)",
        shortName: 'Zone C (401-600m)',
        color: '#8B5CF6',
        badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        description: "Bande de transition intérieure (401 à 600 m)"
      };
    }

    return {
      distanceMeters,
      distanceFormatted,
      zone: 'D',
      zoneName: "Zone D (601 m et plus de l'océan)",
      shortName: 'Zone D (>600m)',
      color: '#10B981',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: "Zone continentale et concession profonde (601 m et plus)"
    };

  } catch (err) {
    console.warn('Error computing ocean zone info:', err);
    return null;
  }
}
