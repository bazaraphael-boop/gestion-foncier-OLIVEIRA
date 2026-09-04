/**
 * Official Cadastral Dataset for Zone ISETECH (1 002,61 ha)
 * 11 real contiguous parcels matching Image 2
 */
export const INITIAL_PARCELS = [
  {
    type: 'Feature',
    id: 'isetech_sub_01',
    properties: {
      lotNumber: 'LOT-ISETECH-01',
      status: 'occupe',
      occupantName: "ISETECH - Agropole & Recherche Agronomique",
      notes: "Unité d'expérimentation agronomique et serres solaires ISETECH.",
      areaHa: 250.0,
      areaSqM: 2500000,
      formattedHa: '250,00 ha',
      formattedSqM: '2 500 000 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3417897, -5.914822],
          [12.3443968, -5.9143525],
          [12.3467035, -5.9142672],
          [12.3483343, -5.9073945],
          [12.338, -5.905],
          [12.334, -5.913883],
          [12.3379487, -5.9145873],
          [12.3417897, -5.914822]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_sub_02',
    properties: {
      lotNumber: 'LOT-ISETECH-02',
      status: 'occupe',
      occupantName: "ISETECH - Centre d'Innovation Technologique",
      notes: "Bâtiments administratifs, laboratoires et ateliers technologiques.",
      areaHa: 180.5,
      areaSqM: 1805000,
      formattedHa: '180,50 ha',
      formattedSqM: '1 805 000 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3483343, -5.9073945],
          [12.351215, -5.9006024],
          [12.3529692, -5.8988142],
          [12.345, -5.895],
          [12.338, -5.905],
          [12.3483343, -5.9073945]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_sub_03',
    properties: {
      lotNumber: 'LOT-ISETECH-03',
      status: 'occupe',
      occupantName: "ISETECH - Centrale Énergétique Solar-Grid",
      notes: "Parc photovoltaïque et poste de transformation électrique.",
      areaHa: 120.0,
      areaSqM: 1200000,
      formattedHa: '120,00 ha',
      formattedSqM: '1 200 000 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3529692, -5.8988142],
          [12.3546429, -5.8959541],
          [12.3538704, -5.8913864],
          [12.346, -5.890],
          [12.345, -5.895],
          [12.3529692, -5.8988142]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_sub_04',
    properties: {
      lotNumber: 'LOT-ISETECH-04',
      status: 'disponible',
      occupantName: '',
      notes: "Extension Ouest ISETECH - Parcelle disponible pour attribution industrielle.",
      areaHa: 220.11,
      areaSqM: 2201100,
      formattedHa: '220,11 ha',
      formattedSqM: '2 201 100 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3538704, -5.8913864],
          [12.3527546, -5.8895509],
          [12.3487205, -5.8854527],
          [12.3421116, -5.882806],
          [12.340, -5.888],
          [12.346, -5.890],
          [12.3538704, -5.8913864]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_sub_05',
    properties: {
      lotNumber: 'LOT-ISETECH-05',
      status: 'disponible',
      occupantName: '',
      notes: "Réserve foncière Sud ISETECH - Terrain viabilisé libre.",
      areaHa: 150.0,
      areaSqM: 1500000,
      formattedHa: '150,00 ha',
      formattedSqM: '1 500 000 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3421116, -5.882806],
          [12.336318, -5.8819095],
          [12.330739, -5.8819095],
          [12.3255033, -5.8890813],
          [12.332, -5.895],
          [12.340, -5.888],
          [12.3421116, -5.882806]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_sub_06',
    properties: {
      lotNumber: 'LOT-ISETECH-06',
      status: 'litige',
      occupantName: "Collectivité Riveraine Est (Sous-Réclamation)",
      notes: "Revendication coutumière partielle sur l'emprise riveraine Sud-Est.",
      areaHa: 82.0,
      areaSqM: 820000,
      formattedHa: '82,00 ha',
      formattedSqM: '820 000 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.3255033, -5.8890813],
          [12.3209542, -5.9078641],
          [12.3241835, -5.9102119],
          [12.32737, -5.9116633],
          [12.3306745, -5.9130933],
          [12.334, -5.913883],
          [12.332, -5.895],
          [12.3255033, -5.8890813]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_plot_a01',
    properties: {
      lotNumber: 'LOT-ISETECH-A01 (20m x 30m)',
      status: 'occupe',
      occupantName: "Famille Mbemba (Résidence 20x30m)",
      notes: "Parcelle résidentielle 20m x 30m attribuée avec titre d'occupation.",
      areaHa: 0.06,
      areaSqM: 600,
      formattedHa: '0,06 ha',
      formattedSqM: '600 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.33600, -5.90500],
          [12.33618, -5.90500],
          [12.33618, -5.90527],
          [12.33600, -5.90527],
          [12.33600, -5.90500]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_plot_a02',
    properties: {
      lotNumber: 'LOT-ISETECH-A02 (20m x 30m)',
      status: 'occupe',
      occupantName: "Exploitation Koko (Plot 20x30m)",
      notes: "Parcelle bâtie 20m x 30m.",
      areaHa: 0.06,
      areaSqM: 600,
      formattedHa: '0,06 ha',
      formattedSqM: '600 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.33622, -5.90500],
          [12.33640, -5.90500],
          [12.33640, -5.90527],
          [12.33622, -5.90527],
          [12.33622, -5.90500]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_plot_a03',
    properties: {
      lotNumber: 'LOT-ISETECH-A03 (20m x 30m)',
      status: 'disponible',
      occupantName: '',
      notes: "Parcelle urbaine 20m x 30m libre à l'attribution.",
      areaHa: 0.06,
      areaSqM: 600,
      formattedHa: '0,06 ha',
      formattedSqM: '600 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.33644, -5.90500],
          [12.33662, -5.90500],
          [12.33662, -5.90527],
          [12.33644, -5.90527],
          [12.33644, -5.90500]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_plot_a04',
    properties: {
      lotNumber: 'LOT-ISETECH-A04 (20m x 30m)',
      status: 'disponible',
      occupantName: '',
      notes: "Parcelle libre 20m x 30m (600 m²).",
      areaHa: 0.06,
      areaSqM: 600,
      formattedHa: '0,06 ha',
      formattedSqM: '600 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.33600, -5.90532],
          [12.33618, -5.90532],
          [12.33618, -5.90559],
          [12.33600, -5.90559],
          [12.33600, -5.90532]
        ]
      ]
    }
  },
  {
    type: 'Feature',
    id: 'isetech_plot_a05',
    properties: {
      lotNumber: 'LOT-ISETECH-A05 (20m x 30m)',
      status: 'litige',
      occupantName: "Revendication Coutumière (Lot 20x30m)",
      notes: "Litige d'attribution sur parcelle 20m x 30m.",
      areaHa: 0.06,
      areaSqM: 600,
      formattedHa: '0,06 ha',
      formattedSqM: '600 m²'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [12.33622, -5.90532],
          [12.33640, -5.90532],
          [12.33640, -5.90559],
          [12.33622, -5.90559],
          [12.33622, -5.90532]
        ]
      ]
    }
  }
];
