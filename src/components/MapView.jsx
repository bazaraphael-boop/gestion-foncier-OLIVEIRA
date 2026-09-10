import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Popup, Tooltip, useMap, Marker, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_COLORS, ddToDms } from '../utils/geoUtils';
import { COASTAL_ZONES, SEPARATION_LINES, getOceanZoneInfo } from '../utils/coastalZones';
import {
  Layers,
  MapPin,
  Eye,
  Waves,
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

// Controller to smoothly fly/zoom to user GPS location when triggered
function LocationFlyToController({ flyToTrigger, userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation && flyToTrigger) {
      map.flyTo(userLocation, 18, { animate: true, duration: 1.2 });
    }
  }, [flyToTrigger, userLocation, map]);
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
      <div className="absolute bottom-2 left-2 sm:left-4 z-[1000] bg-white/95 backdrop-blur-md px-2 sm:px-3 py-1 rounded border border-slate-200 text-[10px] sm:text-[11px] font-mono text-slate-700 flex items-center justify-between shadow-xs select-none pointer-events-auto gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
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
            <div className="hidden sm:flex items-center gap-3">
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

      {/* Sleek Compact Pan Wheel D-Pad (Desktop Only - Hidden on Mobile touchscreens) */}
      <div className="hidden md:flex absolute top-4 right-14 z-[1000] bg-white/95 backdrop-blur-md p-1 rounded-full border border-slate-200 shadow-md flex-col items-center justify-center select-none w-16 h-16">
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
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1000] bg-white/95 backdrop-blur-md p-1 sm:p-1.5 rounded border border-slate-200 shadow-xs flex flex-col items-center gap-0.5 select-none">
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
  isVisitorMode,
  userLocation: externalUserLocation,
  locationAccuracy,
  locationZoneInfo,
  isInConcession,
  locatedParcel,
  flyToTrigger
}) {
  const mapContainerRef = useRef(null);
  const [mapType, setMapType] = useState('google-pure');
  const [showRoadsOverlay, setShowRoadsOverlay] = useState(false);
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [showConcession, setShowConcession] = useState(true);
  const [showSubZones, setShowSubZones] = useState(true);
  const [showOceanZones, setShowOceanZones] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [sharpnessHD, setSharpnessHD] = useState(true);
  const [showMobileGisMenu, setShowMobileGisMenu] = useState(false);

  const effectiveUserLocation = externalUserLocation || userLocation;

  // Pulsing Radar Beacon Icon for Admin Real-Time GPS Localization
  const userLocationBeaconIcon = L.divIcon({
    className: 'custom-admin-gps-beacon',
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 9999px; background: rgba(6, 182, 212, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 14px; height: 14px; border-radius: 9999px; background: #06B6D4; border: 2.5px solid #FFFFFF; box-shadow: 0 0 10px rgba(6, 182, 212, 0.95); z-index: 2;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const createCoastalLabelIcon = (text, bgColor, textColor, borderColor) => {
    return L.divIcon({
      className: 'custom-coastal-label',
      html: `<div style="background-color: ${bgColor}; color: ${textColor}; border: 1.5px solid ${borderColor}; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.35); transform: translate(-50%, -50%); display: inline-block;">${text}</div>`,
      iconSize: [0, 0]
    });
  };

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

      {/* Mobile Floating GIS Quick Access Button */}
      <div className="md:hidden absolute top-3 left-3 z-[1000]">
        <button
          onClick={() => setShowMobileGisMenu(true)}
          className="px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-full shadow-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Calques &amp; SIG</span>
          {showOceanZones && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>}
        </button>
      </div>

      {/* Mobile GIS Controls Bottom Sheet / Modal */}
      {showMobileGisMenu && (
        <div className="md:hidden fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-slate-100 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Calques &amp; Outils SIG</span>
              </div>
              <button
                onClick={() => setShowMobileGisMenu(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fond de Carte Switcher */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Fond de carte satellite
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'google-pure', label: 'Google Satellite Pur', icon: '🛰️' },
                  { id: 'google-hybrid', label: 'Google Hybride', icon: '🌍' },
                  { id: 'sentinel-live', label: 'Sentinel-2 Live', icon: '📡' },
                  { id: 'esri-clarity', label: 'Esri World HD', icon: '🏔️' }
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setMapType(b.id); }}
                    className={`p-2 rounded-lg border text-left text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      mapType === b.id
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{b.icon}</span>
                    <span className="truncate">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles List */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Affichage des Calques
              </div>
              
              {/* Ocean Zones Toggle */}
              <div
                onClick={() => setShowOceanZones(!showOceanZones)}
                className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/80 rounded-lg cursor-pointer active:bg-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  <span>Zonage Littoral Océan (Zones A, B, C, D)</span>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showOceanZones ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showOceanZones ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Perimeter Boundary Toggle */}
              <div
                onClick={() => setShowConcession(!showConcession)}
                className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/80 rounded-lg cursor-pointer active:bg-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Tracé Périmètre Concession (5 404 ha)</span>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showConcession ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showConcession ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Road Overlay Toggle */}
              <div
                onClick={() => setShowRoadsOverlay(!showRoadsOverlay)}
                className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/80 rounded-lg cursor-pointer active:bg-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Route className="w-4 h-4 text-amber-400" />
                  <span>Tracé Réseau Routier</span>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showRoadsOverlay ? 'bg-amber-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showRoadsOverlay ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Sharpness HD Toggle */}
              <div
                onClick={() => setSharpnessHD(!sharpnessHD)}
                className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/80 rounded-lg cursor-pointer active:bg-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Super-Netteté HD Satellite</span>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${sharpnessHD ? 'bg-purple-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${sharpnessHD ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => { setShowLegendDrawer(true); setShowMobileGisMenu(false); }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Palette className="w-4 h-4 text-amber-400" />
                <span>Voir Légende</span>
              </button>

              <button
                onClick={() => { handleLocateMe(); setShowMobileGisMenu(false); }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Position GPS</span>
              </button>

              <button
                onClick={() => { handleExportMapHD(); setShowMobileGisMenu(false); }}
                disabled={isExporting}
                className="col-span-2 p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Télécharger Carte HD</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Minimal Icon-Only Floating GIS Toolbar (Desktop Only) */}
      <div className="hidden md:flex absolute top-4 left-4 z-[1000] flex-col gap-1 select-none">

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

        {/* Coastal Zoning / Separation Lines Toggle */}
        <button
          onClick={() => setShowOceanZones(!showOceanZones)}
          className={`p-2 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer ${
            showOceanZones ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
          title="Afficher/Masquer le zonage littoral & les lignes de séparation océan (Zones A, B, C, D)"
        >
          <Waves className={`w-4 h-4 ${showOceanZones ? 'text-cyan-700' : 'text-cyan-600'}`} />
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
        <div className="absolute top-3 sm:top-4 left-3 sm:left-16 right-3 sm:right-auto z-[1010] bg-white/95 backdrop-blur-md p-3 rounded-lg border border-slate-200 shadow-xl text-xs space-y-1.5 max-w-sm text-slate-800 select-none animate-in fade-in duration-150 max-h-[75vh] overflow-y-auto">
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

          {/* Coastal Zoning Legend Section */}
          <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
            <div className="font-bold text-slate-900 text-[11px] flex items-center justify-between">
              <span>Zonage Littoral Océan</span>
              <span className="text-[10px] text-cyan-700 font-normal">0 m à &gt;600 m</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-cyan-500/40 border-2 border-cyan-600"></div>
              <span className="text-slate-700 text-[11px]"><strong>Zone A</strong> : 0 à 200 m (157 ha)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-amber-500/40 border-2 border-amber-600"></div>
              <span className="text-slate-700 text-[11px]"><strong>Zone B</strong> : 201 à 400 m (158 ha)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-purple-500/40 border-2 border-purple-600"></div>
              <span className="text-slate-700 text-[11px]"><strong>Zone C</strong> : 401 à 600 m (158 ha)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border-2 border-emerald-600"></div>
              <span className="text-slate-700 text-[11px]"><strong>Zone D</strong> : 601 m et + (4 931 ha)</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
              <div className="w-4 h-0 border-2 border-dashed border-cyan-500"></div>
              <span>Lignes 200m / 400m / 600m</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Leaflet Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={14}
        maxZoom={22}
        minZoom={5}
        zoomControl={false}
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

        {/* Coastal Ocean Zones A, B, C, D Polygons */}
        {showOceanZones && COASTAL_ZONES.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.coordinates}
            pathOptions={{
              color: zone.strokeColor,
              weight: 1.5,
              dashArray: '4, 4',
              fillColor: zone.color,
              fillOpacity: zone.fillOpacity
            }}
          >
            <Tooltip direction="center" className="bg-slate-900/90 text-white font-semibold text-[11px] px-2 py-0.5 rounded shadow-sm border border-slate-700">
              🌊 {zone.shortName} • {zone.formattedArea}
            </Tooltip>
            <Popup>
              <div className="p-1.5 space-y-1.5 text-xs font-sans text-slate-800">
                <div className="font-bold text-sm" style={{ color: zone.strokeColor }}>{zone.name}</div>
                <div className="text-slate-600 text-[11px] leading-relaxed">{zone.description}</div>
                <div className="font-semibold text-slate-900">Superficie couverte : <span className="text-emerald-700 font-bold">{zone.formattedArea}</span></div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>Distance du rivage</span>
                  <strong className="font-mono text-slate-700">{zone.range}</strong>
                </div>
              </div>
            </Popup>
          </Polygon>
        ))}

        {/* Coastal Separation Lines (0m, 200m, 400m, 600m) & Midpoint Distance Markers */}
        {showOceanZones && SEPARATION_LINES.map((line) => (
          <React.Fragment key={line.id}>
            <Polyline
              positions={line.coordinates}
              pathOptions={{
                color: line.color,
                weight: line.weight,
                dashArray: line.dashArray
              }}
            >
              <Tooltip direction="top" className="bg-slate-900 text-white font-bold text-[11px] px-2 py-0.5 rounded shadow-sm border border-slate-700">
                📏 {line.label}
              </Tooltip>
            </Polyline>
            {line.midpoint && (
              <Marker
                position={line.midpoint}
                icon={createCoastalLabelIcon(
                  line.shortLabel,
                  line.id === 'line_0m' ? '#0369A1' : '#0F172A',
                  '#FFFFFF',
                  line.color
                )}
                interactive={false}
              />
            )}
          </React.Fragment>
        ))}

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

                  {(() => {
                    const oceanInfo = getOceanZoneInfo(parcel);
                    if (!oceanInfo) return null;
                    return (
                      <div
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold border"
                        style={{
                          backgroundColor: `${oceanInfo.color}15`,
                          borderColor: `${oceanInfo.color}50`,
                          color: oceanInfo.color
                        }}
                      >
                        <Waves className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{oceanInfo.shortName} • {oceanInfo.distanceFormatted} de l'océan</span>
                      </div>
                    );
                  })()}

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

        {/* Location FlyTo Controller */}
        <LocationFlyToController flyToTrigger={flyToTrigger} userLocation={effectiveUserLocation} />

        {/* User Real-Time GPS Location Beacon & Accuracy Circle */}
        {effectiveUserLocation && (
          <>
            {locationAccuracy && locationAccuracy > 5 && (
              <Circle
                center={effectiveUserLocation}
                radius={locationAccuracy}
                pathOptions={{
                  color: '#06B6D4',
                  fillColor: '#06B6D4',
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: '3, 3'
                }}
              />
            )}
            <Marker position={effectiveUserLocation} icon={userLocationBeaconIcon}>
              <Popup>
                <div className="text-xs p-1 space-y-1.5 font-sans text-slate-900 min-w-[210px]">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
                    <span>Position GPS de l'Administrateur</span>
                  </div>
                  
                  <div className="font-mono text-[11px] text-slate-600">
                    {effectiveUserLocation[0].toFixed(6)}°, {effectiveUserLocation[1].toFixed(6)}°
                    {locationAccuracy && <span className="text-slate-400"> (±{Math.round(locationAccuracy)}m)</span>}
                  </div>

                  {locationZoneInfo && (
                    <div
                      className="px-2 py-1 rounded font-semibold text-[11px] flex items-center justify-between border"
                      style={{
                        backgroundColor: `${locationZoneInfo.color}18`,
                        borderColor: `${locationZoneInfo.color}60`,
                        color: locationZoneInfo.color
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Waves className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{locationZoneInfo.zoneName}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{locationZoneInfo.distanceFormatted} océan</span>
                    </div>
                  )}

                  <div className="text-[11px] space-y-1 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Statut Concession:</span>
                      <strong className={isInConcession ? 'text-emerald-700' : 'text-amber-700'}>
                        {isInConcession ? "Dans d'Oliveira" : 'Hors Concession'}
                      </strong>
                    </div>
                    {locatedParcel && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Parcelle:</span>
                        <strong className="text-indigo-700">
                          {locatedParcel.properties?.lotNumber || locatedParcel.id}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                <div className="text-[11px] font-sans font-bold text-cyan-950 text-center">
                  {locationZoneInfo ? `${locationZoneInfo.shortName} (${locationZoneInfo.distanceFormatted})` : '📍 Vous êtes ici'}
                </div>
              </Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}
