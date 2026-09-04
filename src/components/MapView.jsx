import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, useMap, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_COLORS, ddToDms } from '../utils/geoUtils';
import {
  Layers,
  MapPin,
  Eye,
  Compass,
  Pencil,
  Check,
  X,
  Camera,
  Loader2,
  Navigation,
  Layers3,
  ArrowLeft,
  ChevronDown,
  Globe,
  ZoomIn,
  ZoomOut,
  Route,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  Percent,
  Sparkles,
  Radio,
  Download,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Palette
} from 'lucide-react';
import * as turf from '@turf/turf';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Zoom level (5-22) to Percentage mapping (100% baseline = Zoom 14)
const ZOOM_TO_PCT = {
  5: 10,
  6: 15,
  7: 20,
  8: 30,
  9: 40,
  10: 50,
  11: 65,
  12: 80,
  13: 90,
  14: 100,
  15: 125,
  16: 150,
  17: 200,
  18: 300,
  19: 450,
  20: 600,
  21: 800,
  22: 1000
};

// Preset Percentage Options
const PRESET_PERCENTAGES = [
  { pct: 50, level: 10, label: '50% (Vue Pays)' },
  { pct: 100, level: 14, label: '100% (Vue Concession)' },
  { pct: 150, level: 16, label: '150% (Vue Secteur)' },
  { pct: 300, level: 18, label: '300% (Vue Parcelles)' },
  { pct: 600, level: 20, label: '600% (Gros Zoom 20x30m)' },
  { pct: 1000, level: 22, label: '1000% (Zoom Max HD)' }
];

// Exact Hardcoded Boundary Coords for Zone ISETECH (1 002,61 ha)
const ISETECH_OUTER_BOUNDARY_COORDS = [
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

// Auto-fit bounds controller with deep zoom for ISETECH sub-parcels
function MapBoundsController({ concessionPolygon, selectedParcel, activeView, isSidebarCollapsed }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 200);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSidebarCollapsed, map]);

  useEffect(() => {
    if (selectedParcel && selectedParcel.geometry) {
      try {
        const bbox = turf.bbox(selectedParcel.geometry);
        const bounds = [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]]
        ];
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 19, duration: 1.2 });
      } catch (e) {
        console.warn('Could not fit bounds to selected parcel', e);
      }
    }
  }, [selectedParcel, map]);

  useEffect(() => {
    if (activeView === 'isetech' && !selectedParcel) {
      try {
        const isetechPolygon = turf.polygon([
          ISETECH_OUTER_BOUNDARY_COORDS.map(([lat, lng]) => [lng, lat])
        ]);
        const bbox = turf.bbox(isetechPolygon);
        const bounds = [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]]
        ];
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17 });
      } catch (e) {
        map.setView([-5.903, 12.338], 15);
      }
    } else if (concessionPolygon && !selectedParcel && activeView === 'global') {
      try {
        const bbox = turf.bbox(concessionPolygon);
        const bounds = [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]]
        ];
        map.fitBounds(bounds, { padding: [25, 25] });
      } catch (e) {
        console.warn('Could not fit bounds to concession', e);
      }
    }
  }, [concessionPolygon, activeView, selectedParcel, map]);

  return null;
}

// Professional HUD with Interactive Zoom Percentage Controller & Molette D-Pad
function ProfessionalGisHud({ onAddPoint, isDrawing, mapType }) {
  const map = useMap();
  const [mouseCoords, setMouseCoords] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  useEffect(() => {
    const scaleControl = L.control.scale({
      imperial: false,
      metric: true,
      position: 'bottomright'
    });
    scaleControl.addTo(map);
    return () => {
      scaleControl.remove();
    };
  }, [map]);

  useMapEvents({
    mousemove(e) {
      setMouseCoords([e.latlng.lat, e.latlng.lng]);
    },
    zoomend() {
      setCurrentZoom(map.getZoom());
    },
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });

  const zoomPct = ZOOM_TO_PCT[currentZoom] || Math.round((currentZoom / 14) * 100);

  const handleSetZoomLevel = (level) => {
    map.setZoom(level);
    setShowZoomMenu(false);
  };

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  // Pan Navigation Movement Wheel Handlers
  const handlePan = (dx, dy) => {
    map.panBy([dx, dy], { animate: true, duration: 0.3 });
  };

  const handleCenterView = () => {
    map.setView([-5.913, 12.335], currentZoom);
  };

  return (
    <>
      {/* Sleek Integrated Bottom HUD Bar */}
      <div className="absolute bottom-2 left-4 right-20 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1 rounded border border-slate-200 text-[11px] font-mono text-slate-700 flex items-center justify-between shadow-xs select-none pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-slate-900 font-bold">
            <Compass className="w-3.5 h-3.5 text-emerald-600" />
            <span>SIG</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Radio className="w-3 h-3 text-emerald-600" />
            <span>Flux Auto-Sync</span>
          </div>

          {mouseCoords && (
            <div className="flex items-center gap-3">
              <span>Lat: <strong className="text-slate-900">{mouseCoords[0].toFixed(5)}°</strong></span>
              <span>Lng: <strong className="text-slate-900">{mouseCoords[1].toFixed(5)}°</strong></span>
            </div>
          )}
        </div>

        {/* Integrated Zoom Controller */}
        <div className="flex items-center gap-1">
          <button onClick={handleZoomOut} className="p-0.5 text-slate-700 hover:bg-slate-100 rounded" title="Dézoomer">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowZoomMenu(!showZoomMenu)}
              className="px-1.5 py-0.5 bg-slate-900 text-white font-bold rounded text-[10px] flex items-center gap-0.5 cursor-pointer"
            >
              <span>{zoomPct}%</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showZoomMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-48 bg-white text-slate-800 border border-slate-200 rounded shadow-xl p-1 z-[1200] space-y-0.5 text-xs font-sans">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Niveau de Zoom
                </div>
                {PRESET_PERCENTAGES.map((preset) => (
                  <button
                    key={preset.level}
                    onClick={() => handleSetZoomLevel(preset.level)}
                    className={`w-full text-left px-2 py-1 rounded flex items-center justify-between font-medium ${
                      currentZoom === preset.level ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{preset.pct}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleZoomIn} className="p-0.5 text-slate-700 hover:bg-slate-100 rounded" title="Zoomer">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sleek Compact Pan Wheel D-Pad (Top Right) */}
      <div className="absolute top-4 right-14 z-[1000] bg-white/95 backdrop-blur-md p-1 rounded-full border border-slate-200 shadow-md flex flex-col items-center justify-center select-none w-16 h-16">
        <button
          onClick={() => handlePan(0, -160)}
          className="p-0.5 text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          title="Nord (Haut)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center justify-between w-full px-0.5">
          <button
            onClick={() => handlePan(-160, 0)}
            className="p-0.5 text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
            title="Ouest (Gauche)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCenterView}
            className="w-3.5 h-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center text-[7px] font-bold cursor-pointer"
            title="Recentrer"
          >
            🎯
          </button>

          <button
            onClick={() => handlePan(160, 0)}
            className="p-0.5 text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
            title="Est (Droite)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => handlePan(0, 160)}
          className="p-0.5 text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          title="Sud (Bas)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Professional North Arrow Indicator */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-1.5 rounded border border-slate-200 shadow-xs flex flex-col items-center gap-0.5 select-none">
        <Navigation className="w-3.5 h-3.5 text-rose-600 transform -rotate-45" />
        <span className="text-[8px] font-bold text-slate-700 tracking-wider">N</span>
      </div>
    </>
  );
}

export default function MapView({
  concessionPolygon,
  subZones = [],
  parcels = [],
  selectedParcel,
  selectedParcelIds = [],
  onSelectParcel,
  onOpenCreateFormWithPoints,
  activeView = 'global',
  onExploreSubZone,
  onReturnToGlobal,
  isSidebarCollapsed,
  onToggleSidebar,
  isVisitorMode
}) {
  const mapContainerRef = useRef(null);
  const [mapType, setMapType] = useState('google-pure');
  const [showRoadsOverlay, setShowRoadsOverlay] = useState(false);
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [showConcession, setShowConcession] = useState(true);
  const [showSubZones, setShowSubZones] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [sharpnessHD, setSharpnessHD] = useState(true);

  // Collapsible Legend Drawer State
  const [showLegendDrawer, setShowLegendDrawer] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  const getLeafletCoords = (feature) => {
    if (!feature || !feature.geometry) return [];
    const geomType = feature.geometry.type;

    if (geomType === 'Polygon') {
      return feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    } else if (geomType === 'MultiPolygon') {
      return feature.geometry.coordinates.map((poly) =>
        poly[0].map(([lng, lat]) => [lat, lng])
      );
    }
    return [];
  };

  let defaultCenter = [-5.903, 12.338]; // Centered directly on Zone ISETECH cadastre
  if (activeView === 'global' && concessionPolygon) {
    try {
      const center = turf.center(concessionPolygon);
      defaultCenter = [center.geometry.coordinates[1], center.geometry.coordinates[0]];
    } catch (e) {
      // fallback
    }
  }

  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation([latitude, longitude]);
        },
        (err) => {
          alert('Impossible d\'obtenir la position GPS actuelle : ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawnPoints([]);
  };

  const handleAddDrawnPoint = (point) => {
    setDrawnPoints((prev) => [...prev, point]);
  };

  const handleFinishDrawing = () => {
    if (drawnPoints.length < 3) {
      alert('Veuillez cliquer au moins 3 points sur la carte pour former un polygone.');
      return;
    }
    const pointsList = drawnPoints.map(([lat, lng]) => ({
      latStr: lat.toFixed(6),
      lngStr: lng.toFixed(6)
    }));

    setIsDrawing(false);
    setDrawnPoints([]);
    onOpenCreateFormWithPoints(pointsList);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawnPoints([]);
  };

  // High-Resolution 4K Map Composite Exporter
  const handleExportMapHD = async () => {
    if (!mapContainerRef.current) return;
    setIsExporting(true);

    try {
      const mapEl = mapContainerRef.current.querySelector('.leaflet-container');
      if (!mapEl) return;

      const rect = mapEl.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      const scaleFactor = 2; // 2x HD resolution
      canvas.width = rect.width * scaleFactor;
      canvas.height = rect.height * scaleFactor;
      const ctx = canvas.getContext('2d');
      ctx.scale(scaleFactor, scaleFactor);

      // Dark Slate Background
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // 1. Draw Satellite Tile Images currently on screen
      const tiles = mapEl.querySelectorAll('.leaflet-tile-pane img.leaflet-tile');
      const tilePromises = Array.from(tiles).map((img) => {
        return new Promise((resolve) => {
          if (!img.src) return resolve();
          const tileImg = new Image();
          tileImg.crossOrigin = 'anonymous';
          tileImg.onload = () => {
            try {
              const tileRect = img.getBoundingClientRect();
              const x = tileRect.left - rect.left;
              const y = tileRect.top - rect.top;
              ctx.drawImage(tileImg, x, y, tileRect.width, tileRect.height);
            } catch (e) {
              // Ignore individual tile CORS taint
            }
            resolve();
          };
          tileImg.onerror = () => resolve();
          tileImg.src = img.src;
        });
      });

      await Promise.all(tilePromises);

      // 2. Draw SVG Overlay Pane (Parcel Polygons & Boundary Lines)
      const svgEl = mapEl.querySelector('.leaflet-overlay-pane svg');
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const svgImg = new Image();
        await new Promise((resolve) => {
          svgImg.onload = () => {
            ctx.drawImage(svgImg, 0, 0, rect.width, rect.height);
            URL.revokeObjectURL(svgUrl);
            resolve();
          };
          svgImg.onerror = () => resolve();
          svgImg.src = svgUrl;
        });
      }

      // 3. Official Cartographic Header Banner Overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(15, 15, 540, 65);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(15, 15, 540, 65);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText("CADASTRE - CONCESSION MANUEL JOAQUIM D'OLIVEIRA", 28, 38);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText("SYSTÈME D'INFORMATION GÉOGRAPHIQUE (MUANDA / KONGO CENTRAL)", 28, 58);

      // 4. Cartographic Legend Box Overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(15, rect.height - 130, 240, 115);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(15, rect.height - 130, 240, 115);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText("Légende Cadastrale", 25, rect.height - 110);

      // Green - Available
      ctx.fillStyle = '#10B981';
      ctx.fillRect(25, rect.height - 95, 16, 12);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '11px sans-serif';
      ctx.fillText("Disponible / Libre", 48, rect.height - 85);

      // Red - Occupied
      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(25, rect.height - 75, 16, 12);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText("Occupé / Attribué", 48, rect.height - 65);

      // Orange - Dispute
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(25, rect.height - 55, 16, 12);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText("Litige / Sous réserve", 48, rect.height - 45);

      // Timestamp & WGS84 Datum
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px monospace';
      ctx.fillText(`Exporté : ${new Date().toLocaleString('fr-FR')} | WGS84`, rect.width - 290, rect.height - 15);

      // 5. Trigger File Download
      const dataUrl = canvas.toDataURL('image/png', 0.98);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `Carte_SIG_Cadastre_HD_${timestamp}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('HD Export Error:', err);
      alert('Erreur d\'exportation HD : ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const concessionCoords = getLeafletCoords(concessionPolygon);

  return (
    <div ref={mapContainerRef} className="relative w-full h-full min-h-[550px] bg-slate-900 flex flex-col select-none">

      {/* Re-open Right Sidebar Floating Button (Top Right of Map) */}
      {isSidebarCollapsed && (
        <button
          onClick={onToggleSidebar}
          className="absolute top-4 right-4 z-[1010] bg-white text-slate-900 border border-slate-200 px-3 py-2 rounded shadow-md font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-100 transition-all cursor-pointer"
          title="Afficher le registre des parcelles"
        >
          <PanelRightOpen className="w-4 h-4 text-emerald-600" />
          <span>Afficher Registre</span>
        </button>
      )}

      {/* Sleek Minimal Icon-Only Floating GIS Toolbar (Top Left) */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1 select-none">

        {/* Basemap Switcher Icon Popover */}
        <div className="relative">
          <button
            onClick={() => setShowBasemapMenu(!showBasemapMenu)}
            className="p-2 bg-white text-slate-800 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
            title="Changer le fond de carte"
          >
            <Globe className="w-4 h-4 text-emerald-600" />
          </button>

          {showBasemapMenu && (
            <div className="absolute top-0 left-12 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-1 space-y-0.5 z-[1010] text-xs font-sans animate-in fade-in duration-150">
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Fond de carte
              </div>
              <button
                onClick={() => { setMapType('google-pure'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 font-medium ${
                  mapType === 'google-pure' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🛰️</span> Google Satellite Pur (Sans gros textes)
              </button>
              <button
                onClick={() => { setMapType('google-hybrid'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 font-medium ${
                  mapType === 'google-hybrid' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🌍</span> Google Satellite Hybride (Avec noms)
              </button>
              <button
                onClick={() => { setMapType('sentinel-live'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 font-medium ${
                  mapType === 'sentinel-live' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🛰️</span> Copernicus Sentinel-2 Live
              </button>
              <button
                onClick={() => { setMapType('esri-clarity'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 font-medium ${
                  mapType === 'esri-clarity' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🏔️</span> Esri World Imagery HD
              </button>
              <button
                onClick={() => { setMapType('google-roads'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 font-medium ${
                  mapType === 'google-roads' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🛣️</span> Google Plan des Routes
              </button>
            </div>
          )}
        </div>

        {/* Road Overlay Toggle */}
        <button
          onClick={() => setShowRoadsOverlay(!showRoadsOverlay)}
          className={`p-2 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer ${
            showRoadsOverlay ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
          title="Calque des routes"
        >
          <Route className="w-4 h-4" />
        </button>

        {/* High Sharpness HD Filter */}
        <button
          onClick={() => setSharpnessHD(!sharpnessHD)}
          className={`p-2 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer ${
            sharpnessHD ? 'bg-cyan-50 text-cyan-700 border-cyan-300' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
          title="Mode Super-Netteté HD"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Drawing Tool (Hidden in Visitor Read-Only Mode) */}
        {!isVisitorMode && (
          !isDrawing ? (
            <button
              onClick={handleStartDrawing}
              className="p-2 bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
              title="Dessiner une parcelle"
            >
              <Pencil className="w-4 h-4 text-emerald-600" />
            </button>
          ) : (
            <div className="flex flex-col gap-1 p-1 bg-amber-50 rounded-lg border border-amber-200 shadow-md">
              <button
                onClick={handleFinishDrawing}
                disabled={drawnPoints.length < 3}
                className="p-1.5 bg-emerald-600 text-white rounded font-bold text-xs flex items-center justify-center cursor-pointer"
                title="Valider le polygone"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCancelDrawing}
                className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                title="Annuler"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}

        {/* Concession Perimeter Boundary Toggle */}
        <button
          onClick={() => setShowConcession(!showConcession)}
          className={`p-2 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer ${
            showConcession ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
          title="Afficher/Masquer le périmètre"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* GPS Live Position */}
        <button
          onClick={handleLocateMe}
          className="p-2 bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
          title="Position GPS Live"
        >
          <Compass className="w-4 h-4 text-indigo-600" />
        </button>

        {/* 4K HD Map Export */}
        <button
          onClick={handleExportMapHD}
          disabled={isExporting}
          className="p-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-500 transition-all cursor-pointer"
          title="Exporter la carte en 4K HD"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>

        {/* Discrete Collapsible Legend Drawer Toggle Button */}
        <button
          onClick={() => setShowLegendDrawer(!showLegendDrawer)}
          className={`p-2 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer mt-2 ${
            showLegendDrawer ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
          title="Afficher la légende"
        >
          <Palette className="w-4 h-4 text-amber-500" />
        </button>
      </div>

      {/* Discrete Collapsible Legend Card */}
      {showLegendDrawer && (
        <div className="absolute top-4 left-16 z-[1010] bg-white/95 backdrop-blur-md p-3 rounded-lg border border-slate-200 shadow-xl text-xs space-y-1.5 max-w-xs text-slate-800 select-none animate-in fade-in duration-150">
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between gap-4">
            <span>Légende Cadastrale</span>
            <button onClick={() => setShowLegendDrawer(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-emerald-500/40 border-2 border-emerald-600"></div>
            <span className="text-slate-700">Disponible / Libre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-rose-500/40 border-2 border-rose-600"></div>
            <span className="text-slate-700">Occupé / Attribué</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-amber-500/40 border-2 border-amber-600"></div>
            <span className="text-slate-700">Litige / Sous réserve</span>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-200 pt-1">
            <div className="w-4 h-0 border-2 border-dashed border-cyan-600"></div>
            <span className="text-cyan-700 font-semibold text-[11px]">Limite Zone ISETECH</span>
          </div>
        </div>
      )}

      {/* Main Leaflet Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={14}
        maxZoom={22}
        minZoom={5}
        className="w-full h-full flex-1 z-0"
        scrollWheelZoom={true}
      >
        <MapBoundsController
          concessionPolygon={concessionPolygon}
          subZones={subZones}
          selectedParcel={selectedParcel}
          activeView={activeView}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <ProfessionalGisHud onAddPoint={handleAddDrawnPoint} isDrawing={isDrawing} mapType={mapType} />

        {/* Clean Google Pure Satellite Layer */}
        {mapType === 'google-pure' && (
          <TileLayer
            attribution='&copy; Google Satellite Pure HD'
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            maxZoom={22}
            maxNativeZoom={19}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'google-hybrid' && (
          <TileLayer
            attribution='&copy; Google Satellite Hybrid'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            maxZoom={22}
            maxNativeZoom={19}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'sentinel-live' && (
          <TileLayer
            attribution='&copy; Copernicus Sentinel-2 Live (ESA / EOX Sentinel-2 Cloudless)'
            url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg"
            maxZoom={22}
            maxNativeZoom={14}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'esri-clarity' && (
          <TileLayer
            attribution='&copy; Esri World Imagery'
            url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={22}
            maxNativeZoom={19}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'google-roads' && (
          <TileLayer
            attribution='&copy; Google Maps Vector'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            maxZoom={22}
            maxNativeZoom={19}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'osm-roads' && (
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={22}
            maxNativeZoom={19}
            crossOrigin="anonymous"
          />
        )}

        {/* Discrete Road Overlay */}
        {showRoadsOverlay && mapType !== 'google-roads' && mapType !== 'osm-roads' && (
          <TileLayer
            attribution='&copy; Google Roads Overlay'
            url="https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
            maxZoom={22}
            maxNativeZoom={19}
            crossOrigin="anonymous"
          />
        )}

        {/* Outer Concession Polygon */}
        {showConcession && concessionCoords.length > 0 && (
          <Polygon
            positions={concessionCoords}
            pathOptions={{
              color: '#D97706',
              weight: 2.5,
              dashArray: '6, 6',
              fillColor: '#D97706',
              fillOpacity: 0.04
            }}
          >
            <Tooltip direction="top" className="bg-slate-900 text-white font-semibold text-[11px] px-2 py-0.5 rounded shadow-sm border border-slate-700">
              📍 Concession Manuel Joaquim d'Oliveira (5 404,80 ha)
            </Tooltip>
          </Polygon>
        )}

        {/* Outer Delimitation Boundary of Zone ISETECH */}
        {showSubZones && (
          <Polygon
            positions={ISETECH_OUTER_BOUNDARY_COORDS}
            pathOptions={{
              color: '#0284C7',
              weight: activeView === 'isetech' ? 3.5 : 2.5,
              dashArray: '8, 6',
              fillColor: '#0284C7',
              fillOpacity: activeView === 'isetech' ? 0.02 : 0.12
            }}
            eventHandlers={{
              click: () => {
                if (activeView === 'global' && onExploreSubZone) {
                  onExploreSubZone('isetech');
                }
              }
            }}
          >
            <Tooltip direction="top" className="bg-cyan-900 text-cyan-100 font-bold text-[11px] px-2.5 py-1 rounded shadow-md border border-cyan-400">
              🔷 Périmètre Zone ISETECH (1 002,61 ha) {activeView === 'global' ? '• Cliquer pour explorer' : ''}
            </Tooltip>
          </Polygon>
        )}

        {/* Inner Parcels & Sub-parcels */}
        {parcels.map((parcel) => {
          if (!parcel || !parcel.id) return null;
          const isSingleSelected = selectedParcel && selectedParcel.id === parcel.id;
          const isMultiSelected = Array.isArray(selectedParcelIds) && selectedParcelIds.includes(parcel.id);
          const isIsetechMain = parcel.id === 'parcelle_isetech' || (parcel.properties && parcel.properties.lotNumber === 'LOT-ISETECH');
          const statusKey = (parcel.properties && parcel.properties.status) || 'disponible';
          const colorConfig = STATUS_COLORS[statusKey] || STATUS_COLORS.disponible;
          const coords = getLeafletCoords(parcel);

          if (!coords || coords.length === 0) return null;

          return (
            <Polygon
              key={parcel.id}
              positions={coords}
              pathOptions={{
                color: isMultiSelected ? '#0284C7' : colorConfig.hex,
                weight: isMultiSelected ? 4.5 : isSingleSelected ? 4 : 2,
                dashArray: isMultiSelected ? '4, 4' : undefined,
                fillColor: colorConfig.hex,
                fillOpacity: isMultiSelected ? 0.75 : isSingleSelected ? 0.65 : 0.4
              }}
              eventHandlers={{
                click: () => {
                  onSelectParcel(parcel);
                  if (isIsetechMain && activeView === 'global') {
                    onExploreSubZone('isetech');
                  }
                }
              }}
            >
              <Popup>
                <div className="text-xs p-1 space-y-2 font-sans text-slate-800">
                  <div className="font-bold text-sm text-slate-900">{parcel.properties?.lotNumber || 'Lot'}</div>
                  <div className="text-slate-600">Statut : <strong>{colorConfig.label}</strong></div>
                  <div className="font-bold text-emerald-700 text-sm">{parcel.properties?.formattedHa} ({parcel.properties?.formattedSqM})</div>
                  {parcel.properties?.occupantName && (
                    <div className="italic text-slate-600">{parcel.properties.occupantName}</div>
                  )}

                  {isIsetechMain && activeView === 'global' && (
                    <div className="pt-2 border-t border-slate-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExploreSubZone('isetech');
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Zoomer dans le Sous-Cadastre ISETECH</span>
                      </button>
                    </div>
                  )}
                </div>
              </Popup>

              <Tooltip direction="center" opacity={0.9} sticky>
                <div className="text-xs p-1 font-sans text-center">
                  <div className="font-bold text-slate-900">{parcel.properties?.lotNumber || 'Lot'}</div>
                  <div className="font-semibold text-emerald-700">{parcel.properties?.formattedHa}</div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Drawn Points */}
        {isDrawing && drawnPoints.length > 0 && (
          <>
            {drawnPoints.map((pt, i) => (
              <Marker key={`draw-pt-${i}`} position={pt}>
                <Tooltip permanent direction="top" className="text-[10px] font-bold">
                  P{i + 1}
                </Tooltip>
              </Marker>
            ))}
            {drawnPoints.length >= 2 && (
              <Polygon
                positions={drawnPoints}
                pathOptions={{
                  color: '#F59E0B',
                  weight: 2.5,
                  dashArray: '4, 4',
                  fillColor: '#F59E0B',
                  fillOpacity: 0.25
                }}
              />
            )}
          </>
        )}

        {/* User Location */}
        {userLocation && (
          <Marker position={userLocation}>
            <Popup>
              <div className="text-xs font-semibold text-slate-900">
                📍 Votre position GPS <br />
                <span className="font-mono text-slate-600">
                  {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
