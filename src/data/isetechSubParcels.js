import { calculateArea } from '../utils/geoUtils';

/**
 * Sub-parcels dataset located inside Zone ISETECH including standard 20m x 30m (600 m²) plots
 */
export const ISETECH_SUB_PARCELS = [
  {
    type: 'Feature',
    id: 'isetech_plot_a01',
    properties: {
      lotNumber: 'LOT-ISETECH-A01 (20m x 30m)',
      status: 'occupe',
      occupantName: 'Famille Mbemba (Résidence 20x30m)',
      notes: 'Parcelle résidentielle 20m x 30m attribuée avec titre d\'occupation.',
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
      occupantName: 'Exploitation Koko (Plot 20x30m)',
      notes: 'Parcelle bâtie 20m x 30m.',
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
      notes: 'Parcelle urbaine 20m x 30m libre à l\'attribution.',
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
      notes: 'Parcelle libre 20m x 30m (600 m²).',
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
      occupantName: 'Revendication Coutumière (Lot 20x30m)',
      notes: 'Litige d\'attribution sur parcelle 20m x 30m.',
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
  },
  {
    type: 'Feature',
    id: 'isetech_sub_01',
    properties: {
      lotNumber: 'LOT-ISETECH-AGRO',
      status: 'occupe',
      occupantName: 'ISETECH - Agropole & Recherche Agronomique',
      notes: 'Unité d\'expérimentation agronomique ISETECH.',
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
      lotNumber: 'LOT-ISETECH-TECH',
      status: 'occupe',
      occupantName: 'ISETECH - Centre d\'Innovation Technologique',
      notes: 'Bâtiments administratifs et ateliers technologiques.',
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
  }
];
