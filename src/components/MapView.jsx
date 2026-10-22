import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Popup, Tooltip, useMap, Marker, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_COLORS, ddToDms, fetchElevation, calculateArea } from '../utils/geoUtils';
import { COASTAL_ZONES, SEPARATION_LINES, getOceanZoneInfo } from '../utils/coastalZones';
import BorneMoveConfirmModal from './BorneMoveConfirmModal';
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
  Palette,
  Satellite,
  Mountain,
  RotateCcw,
  Crosshair,
  Trash2,
  Save
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

// Selected Parcel Borne Icon (draggable for Admin only). Created once per borne:
// a new icon on each render would reset the marker and cancel an ongoing drag.
const createParcelBorneIcon = (num, isDraggable) => L.divIcon({
  className: 'parcel-borne-marker',
  html: `<div style="background-color: ${isDraggable ? '#EA580C' : '#0F172A'}; color: #FFFFFF; border: 2px solid #FFFFFF; border-radius: 9999px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; font-family: ui-monospace, monospace; box-shadow: 0 2px 8px rgba(0,0,0,0.55); cursor: ${isDraggable ? 'grab' : 'pointer'};">B${num}</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Auto-fit bounds controller with deep zoom for ISETECH sub-parcels
function MapBoundsController({ concessionPolygon, selectedParcel, activeView, isSidebarCollapsed }) {
  const map = useMap();
  const prevViewRef = useRef(activeView);
  const initialFitDone = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 150);
    const t2 = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 500);
    return () => {
      clearTimeout(t);
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
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 19, duration: 0.8 });
      } catch (e) {
        console.warn('Could not fit bounds to selected parcel', e);
      }
    }
  }, [selectedParcel, map]);

  useEffect(() => {
    if (!initialFitDone.current || prevViewRef.current !== activeView) {
      const isFirst = !initialFitDone.current;
      initialFitDone.current = true;
      prevViewRef.current = activeView;

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
          map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17, animate: !isFirst });
        } catch (e) {
          map.setView([-5.8988, 12.3375], 15);
        }
      } else if (concessionPolygon && !selectedParcel && activeView === 'global') {
        try {
          const bbox = turf.bbox(concessionPolygon);
          const bounds = [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]]
          ];
          map.fitBounds(bounds, { padding: [25, 25], animate: !isFirst });
        } catch (e) {
          console.warn('Could not fit bounds to concession', e);
        }
      }
    }
  }, [concessionPolygon, activeView, selectedParcel, map]);

  return null;
}

// Controller to smoothly fly/zoom to user GPS location ONLY when explicitly triggered
function LocationFlyToController({ flyToTrigger, userLocation }) {
  const map = useMap();
  const lastTriggerRef = useRef(0);

  useEffect(() => {
    if (userLocation && flyToTrigger && flyToTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = flyToTrigger;
      map.flyTo(userLocation, Math.max(map.getZoom(), 17), { animate: true, duration: 0.8 });
    }
  }, [flyToTrigger, userLocation, map]);

  return null;
}

// Watcher for real-time map tile loading status
function TileLoadingWatcher({ onLoadingChange }) {
  const map = useMap();
  useEffect(() => {
    let pendingTiles = 0;
    let timer = null;

    const onStart = () => {
      pendingTiles++;
      onLoadingChange(true);
    };

    const onEnd = () => {
      pendingTiles = Math.max(0, pendingTiles - 1);
      if (pendingTiles === 0) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          onLoadingChange(false);
        }, 250);
      }
    };

    map.on('tileloadstart', onStart);
    map.on('tileload', onEnd);
    map.on('tileerror', onEnd);
    map.on('load', () => onLoadingChange(false));

    return () => {
      if (timer) clearTimeout(timer);
      map.off('tileloadstart', onStart);
      map.off('tileload', onEnd);
      map.off('tileerror', onEnd);
    };
  }, [map, onLoadingChange]);

  return null;
}

// Professional HUD with Interactive Zoom Percentage Controller & Molette D-Pad
function ProfessionalGisHud({ onAddPoint, isDrawing, mapType, onCenterChange, onZoomChange }) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const coordsRef = useRef(null);
  const lastMoveTime = useRef(0);

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

  // Initial and reactive center coordinates & zoom sync
  useEffect(() => {
    if (map) {
      if (onCenterChange) {
        const c = map.getCenter();
        onCenterChange([c.lat, c.lng]);
      }
      if (onZoomChange) {
        onZoomChange(map.getZoom());
      }
    }
  }, [map, onCenterChange, onZoomChange]);

  // When drawing mode activates, close any active popups so the screen is completely unobstructed
  useEffect(() => {
    if (isDrawing && map) {
      map.closePopup();
    }
  }, [isDrawing, map]);

  useMapEvents({
    mousemove(e) {
      const now = performance.now();
      if (now - lastMoveTime.current > 120) {
        lastMoveTime.current = now;
        if (coordsRef.current) {
          coordsRef.current.innerHTML = `<span>Lat: <strong class="text-slate-900">${e.latlng.lat.toFixed(5)}°</strong></span><span>Lng: <strong class="text-slate-900">${e.latlng.lng.toFixed(5)}°</strong></span>`;
        }
      }
    },
    move() {
      if (onCenterChange) {
        const c = map.getCenter();
        onCenterChange([c.lat, c.lng]);
      }
    },
    zoomend() {
      const z = map.getZoom();
      setCurrentZoom(z);
      if (onZoomChange) {
        onZoomChange(z);
      }
      if (onCenterChange) {
        const c = map.getCenter();
        onCenterChange([c.lat, c.lng]);
      }
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
      <div className="absolute bottom-16 md:bottom-2 left-2 sm:left-4 z-[1000] bg-white/95 backdrop-blur-md px-2 sm:px-3 py-1 rounded border border-slate-200 text-[10px] sm:text-[11px] font-mono text-slate-700 flex items-center justify-between shadow-xs select-none pointer-events-auto gap-2">
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

          <div ref={coordsRef} className="hidden sm:flex items-center gap-3">
            <span>Lat: <strong className="text-slate-900">-5.89880°</strong></span>
            <span>Lng: <strong className="text-slate-900">12.33750°</strong></span>
          </div>
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
            aria-label="Recentrer la carte"
            className="w-3.5 h-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
            title="Recentrer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
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
  flyToTrigger,
  drawTrigger,
  onToggleLocation,
  isLocating,
  onUpdateConcessionPolygon,
  onUpdateParcel,
  isAdmin = false,
  isArpenteur = false,
  editConcessionTrigger = 0,
  onCancelConcessionEditing
}) {
  const mapContainerRef = useRef(null);

  // Strict role permissions: Parcel Tracing is strictly reserved to Admin & Arpenteur, Bornes are viewable by all
  const canDrawAndManageParcels = !isVisitorMode && (isAdmin || isArpenteur);
  const canViewAndInspectBornes = true;

  const [mapType, setMapType] = useState('google-pure');
  const [mapZoom, setMapZoom] = useState(13);
  const [showRoadsOverlay, setShowRoadsOverlay] = useState(false);
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [showConcession, setShowConcession] = useState(true);
  const [showConcessionBornes, setShowConcessionBornes] = useState(false);
  const [isEditingConcession, setIsEditingConcession] = useState(false);
  const [customConcessionPoints, setCustomConcessionPoints] = useState(null);
  const [inspectedBorne, setInspectedBorne] = useState(null);
  const [showSubZones, setShowSubZones] = useState(true);
  const [showOceanZones, setShowOceanZones] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [sharpnessHD, setSharpnessHD] = useState(true);
  const [showMobileGisMenu, setShowMobileGisMenu] = useState(false);
  const [isTilesLoading, setIsTilesLoading] = useState(true);

  const effectiveUserLocation = externalUserLocation || userLocation;

  // Real-Time Center Coordinates (for Crosshair Viseur) & GPS State
  const [centerCoords, setCenterCoords] = useState([-5.8988, 12.3375]);
  const [isGpsAcquiring, setIsGpsAcquiring] = useState(false);
  const [lastMarkedInfo, setLastMarkedInfo] = useState(null);

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

  // Custom Numbered Vertex Icon for Field Tracing
  const createVertexIcon = (num) => L.divIcon({
    className: 'custom-vertex-marker',
    html: `<div style="background-color: #059669; color: #FFFFFF; border: 2px solid #FFFFFF; border-radius: 9999px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; font-family: ui-monospace, monospace; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  // Bornes of the selected parcel as [lat, lng] (closing vertex removed)
  const selectedParcelBornes = useMemo(() => {
    if (!selectedParcel || selectedParcel.geometry?.type !== 'Polygon') return [];
    const ring = selectedParcel.geometry.coordinates?.[0] || [];
    const first = ring[0];
    const last = ring[ring.length - 1];
    const isClosed = ring.length > 3 && first[0] === last[0] && first[1] === last[1];
    return (isClosed ? ring.slice(0, -1) : ring).map(([lng, lat]) => [lat, lng]);
  }, [selectedParcel]);

  // Live position of bornes while the Admin drags one
  const [parcelBorneDraft, setParcelBorneDraft] = useState(null);
  const displayedParcelBornes =
    parcelBorneDraft && parcelBorneDraft.parcelId === selectedParcel?.id ? parcelBorneDraft.points : selectedParcelBornes;
  const canMoveParcelBornes = isAdmin && !isVisitorMode && typeof onUpdateParcel === 'function';
  const parcelBorneCount = selectedParcelBornes.length;
  const parcelBorneIcons = useMemo(
    () => Array.from({ length: parcelBorneCount }, (_, i) => createParcelBorneIcon(i + 1, canMoveParcelBornes)),
    [parcelBorneCount, canMoveParcelBornes]
  );

  const movedParcelBornes = (index, latlng) =>
    displayedParcelBornes.map((pt, i) => (i === index ? [latlng.lat, latlng.lng] : pt));

  const handleDragParcelBorne = (index, latlng) => {
    setParcelBorneDraft({ parcelId: selectedParcel.id, points: movedParcelBornes(index, latlng) });
  };

  // Borne move awaiting confirmation in BorneMoveConfirmModal
  const [pendingBorneMove, setPendingBorneMove] = useState(null);

  const handleDropParcelBorne = (index, marker) => {
    const points = movedParcelBornes(index, marker.getLatLng());
    // Keep the new shape on the map while the Admin confirms
    setParcelBorneDraft({ parcelId: selectedParcel.id, points });

    const ring = points.map(([lat, lng]) => [lng, lat]);
    ring.push([...ring[0]]);
    const geometry = { type: 'Polygon', coordinates: [ring] };

    setPendingBorneMove({
      parcel: selectedParcel,
      marker,
      geometry,
      borneNumber: index + 1,
      lotRef: selectedParcel.properties?.lotNumber || selectedParcel.id,
      before: selectedParcelBornes[index],
      after: points[index],
      oldArea: calculateArea(selectedParcel.geometry),
      newArea: calculateArea(geometry)
    });
  };

  const handleCancelBorneMove = () => {
    if (pendingBorneMove) {
      pendingBorneMove.marker.setLatLng(pendingBorneMove.before);
    }
    setParcelBorneDraft(null);
    setPendingBorneMove(null);
  };

  const handleConfirmBorneMove = () => {
    const { parcel, geometry, newArea } = pendingBorneMove;
    onUpdateParcel({
      ...parcel,
      properties: {
        ...parcel.properties,
        areaSqM: newArea.sqMeters,
        areaHa: newArea.hectares,
        formattedSqM: newArea.formattedSqM,
        formattedHa: newArea.formattedHa,
        updatedAt: new Date().toISOString().split('T')[0]
      },
      geometry
    });
    setParcelBorneDraft(null);
    setPendingBorneMove(null);
  };

  const createCoastalLabelIcon = (text, bgColor, textColor, borderColor) => {
    return L.divIcon({
      className: 'custom-coastal-label',
      html: `<div style="background-color: rgba(15, 23, 42, 0.88); backdrop-filter: blur(4px); color: ${textColor}; border: 1px solid ${borderColor}; padding: 1.5px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; font-family: ui-sans-serif, system-ui, sans-serif; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transform: translate(-50%, -50%); display: inline-block;">${text}</div>`,
      iconSize: [0, 0]
    });
  };

  // Collapsible Legend Drawer State
  const [showLegendDrawer, setShowLegendDrawer] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Trigger drawing mode only for authorized surveyor or admin
  useEffect(() => {
    if (drawTrigger && canDrawAndManageParcels) {
      setIsDrawing(true);
      setDrawnPoints([]);
      setLastMarkedInfo(null);
    }
  }, [drawTrigger, canDrawAndManageParcels]);

  // Strict enforcement: if client/visitor, ensure drawing and borne inspection are terminated immediately
  useEffect(() => {
    if (!canDrawAndManageParcels) {
      setIsDrawing(false);
      setDrawnPoints([]);
      setLastMarkedInfo(null);
    }
    if (!canViewAndInspectBornes) {
      setInspectedBorne(null);
      setIsEditingConcession(false);
    }
  }, [canDrawAndManageParcels, canViewAndInspectBornes]);

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

  // Extract clean concession ring coordinates (without duplicated closing vertex)
  const rawConcessionRing = useMemo(() => {
    if (!concessionPolygon || !concessionPolygon.geometry) return [];
    const coords = concessionPolygon.geometry.coordinates[0] || [];
    if (
      coords.length > 1 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
    ) {
      return coords.slice(0, -1);
    }
    return coords;
  }, [concessionPolygon]);

  // Active ring being displayed / edited
  const activeConcessionRing = customConcessionPoints || rawConcessionRing;

  // Memoized Concession Perimeter Bornes (P1, P2... P32)
  const concessionBornes = useMemo(() => {
    return activeConcessionRing.map(([lng, lat], idx) => ({
      number: idx + 1,
      index: idx,
      lat,
      lng,
      position: [lat, lng]
    }));
  }, [activeConcessionRing]);

  // Recalculated live area and perimeter metrics during concession editing
  const editingConcessionMetrics = useMemo(() => {
    if (!activeConcessionRing || activeConcessionRing.length < 3) return null;
    try {
      const closed = [...activeConcessionRing, activeConcessionRing[0]];
      const poly = turf.polygon([closed]);
      const areaM2 = turf.area(poly);
      const areaHa = areaM2 / 10000;
      const lengthKm = turf.length(turf.lineString(closed), { units: 'kilometers' });
      return {
        areaHa: areaHa.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        areaSqM: Math.round(areaM2).toLocaleString('fr-FR'),
        perimeterKm: lengthKm.toFixed(2),
        pointsCount: activeConcessionRing.length
      };
    } catch (e) {
      return null;
    }
  }, [activeConcessionRing]);

  // Handle external trigger to start concession edit
  const lastHandledTriggerRef = useRef(0);
  useEffect(() => {
    if (editConcessionTrigger && editConcessionTrigger > lastHandledTriggerRef.current && isAdmin) {
      lastHandledTriggerRef.current = editConcessionTrigger;
      if (rawConcessionRing && rawConcessionRing.length > 0) {
        setCustomConcessionPoints([...rawConcessionRing]);
        setIsEditingConcession(true);
        setShowConcessionBornes(true);
      }
    } else if (!editConcessionTrigger) {
      lastHandledTriggerRef.current = 0;
    }
  }, [editConcessionTrigger, isAdmin, rawConcessionRing]);

  // Concession Borne Pin Icon with adaptive zoom-level styling
  const createConcessionBorneIcon = (number, isDraggable, isZoomedIn) => {
    // 1. Draggable Editing Mode (Admin calibration)
    if (isDraggable) {
      return L.divIcon({
        className: 'concession-borne-marker-edit',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab; user-select: none; pointer-events: auto; touch-action: none;">
            <div style="background: #EA580C; color: #FFFFFF; font-weight: 800; font-size: 11px; font-family: ui-monospace, monospace; padding: 2px 7px; border-radius: 9999px; border: 2px solid #FFFFFF; box-shadow: 0 2px 10px rgba(234, 88, 12, 0.7); white-space: nowrap;">
              <span>P${number}</span>
            </div>
            <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #EA580C;"></div>
          </div>
        `,
        iconSize: [36, 26],
        iconAnchor: [18, 26]
      });
    }

    // 2. High-Zoom Detail Mode (zoom >= 14): Refined compact numbered badge
    if (isZoomedIn) {
      return L.divIcon({
        className: 'concession-borne-marker-badge',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none; transition: transform 0.15s ease;">
            <div style="background: rgba(217, 119, 6, 0.92); backdrop-filter: blur(2px); color: #FFFFFF; font-weight: 700; font-size: 9px; font-family: ui-monospace, monospace; padding: 1.5px 5px; border-radius: 9999px; border: 1.5px solid #FFFFFF; box-shadow: 0 1px 4px rgba(0,0,0,0.4); white-space: nowrap;">
              <span>P${number}</span>
            </div>
            <div style="width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-top: 4px solid rgba(217, 119, 6, 0.92);"></div>
          </div>
        `,
        iconSize: [28, 20],
        iconAnchor: [14, 20]
      });
    }

    // 3. Overview Mode (zoom < 14): Sleek minimalist geodesic micro-dot marker
    return L.divIcon({
      className: 'concession-borne-marker-dot',
      html: `
        <div style="width: 9px; height: 9px; border-radius: 9999px; background: #F59E0B; border: 1.5px solid #FFFFFF; box-shadow: 0 0 3px rgba(0,0,0,0.5), 0 0 6px rgba(245, 158, 11, 0.6); cursor: pointer;" title="Borne P${number}"></div>
      `,
      iconSize: [9, 9],
      iconAnchor: [4.5, 4.5]
    });
  };

  // Inspect Borne geodetic details (Altitude, Longitude, Latitude) - Admin & Arpenteur only
  const handleInspectBorne = async (borne) => {
    if (!canViewAndInspectBornes) return;
    setInspectedBorne({
      number: borne.number,
      index: borne.index,
      lat: borne.lat,
      lng: borne.lng,
      altitude: null,
      isLoadingAltitude: true,
      manualLat: borne.lat.toFixed(7),
      manualLng: borne.lng.toFixed(7),
      isEditingManual: false
    });

    try {
      const elev = await fetchElevation(borne.lat, borne.lng);
      setInspectedBorne((prev) => {
        if (!prev || prev.index !== borne.index) return prev;
        return {
          ...prev,
          altitude: elev !== null ? Math.round(elev * 10) / 10 : null,
          isLoadingAltitude: false
        };
      });
    } catch (e) {
      setInspectedBorne((prev) => {
        if (!prev || prev.index !== borne.index) return prev;
        return { ...prev, isLoadingAltitude: false };
      });
    }
  };

  const handleStartConcessionEditing = () => {
    if (!isAdmin) return;
    setCustomConcessionPoints([...rawConcessionRing]);
    setIsEditingConcession(true);
    setShowConcessionBornes(true);
  };

  const handleCancelConcessionEditing = () => {
    setCustomConcessionPoints(null);
    setIsEditingConcession(false);
    if (onCancelConcessionEditing) {
      onCancelConcessionEditing();
    }
  };

  const handleSaveConcessionEditing = () => {
    if (!isAdmin || !customConcessionPoints || customConcessionPoints.length < 3) return;
    const closedCoords = [...customConcessionPoints, customConcessionPoints[0]];
    const updatedConcession = {
      ...concessionPolygon,
      geometry: {
        ...concessionPolygon.geometry,
        coordinates: [closedCoords]
      }
    };
    if (onUpdateConcessionPolygon) {
      onUpdateConcessionPolygon(updatedConcession);
    }
    setIsEditingConcession(false);
    setCustomConcessionPoints(null);
    if (onCancelConcessionEditing) {
      onCancelConcessionEditing();
    }
  };

  const handleMoveConcessionBorne = (index, newLatLng) => {
    if (!isAdmin || !isEditingConcession) return;
    const currentRing = customConcessionPoints || rawConcessionRing;
    const newPoints = [...currentRing];
    newPoints[index] = [newLatLng.lng, newLatLng.lat];
    setCustomConcessionPoints(newPoints);

    if (inspectedBorne && inspectedBorne.index === index) {
      handleInspectBorne({
        number: index + 1,
        index,
        lat: newLatLng.lat,
        lng: newLatLng.lng
      });
    }
  };

  const handleSaveManualCoordinates = (newLat, newLng) => {
    if (!isAdmin || !inspectedBorne) return;
    const latNum = parseFloat(newLat);
    const lngNum = parseFloat(newLng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('Coordonnées invalides. Veuillez saisir des nombres décimaux valides.');
      return;
    }
    const currentPts = customConcessionPoints ? [...customConcessionPoints] : [...rawConcessionRing];
    const updatedPts = [...currentPts];
    updatedPts[inspectedBorne.index] = [lngNum, latNum];
    setCustomConcessionPoints(updatedPts);
    if (!isEditingConcession) {
      setIsEditingConcession(true);
    }
    handleInspectBorne({
      number: inspectedBorne.number,
      index: inspectedBorne.index,
      lat: latNum,
      lng: lngNum
    });
  };

  const handleDeleteConcessionBorne = (index) => {
    if (!isAdmin) return;
    const currentPts = customConcessionPoints || rawConcessionRing;
    if (currentPts.length <= 3) {
      alert('Une concession doit comporter au moins 3 sommets pour former une aire valide.');
      return;
    }
    if (!isEditingConcession) {
      setIsEditingConcession(true);
    }
    const nextPts = currentPts.filter((_, i) => i !== index);
    setCustomConcessionPoints(nextPts);
    setInspectedBorne(null);
  };

  let defaultCenter = [-5.8988, 12.3375]; // Centered directly on Zone ISETECH cadastre
  let defaultZoom = 15;
  if (activeView === 'global' && concessionPolygon) {
    try {
      const center = turf.center(concessionPolygon);
      defaultCenter = [center.geometry.coordinates[1], center.geometry.coordinates[0]];
      defaultZoom = 12;
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
    if (!canDrawAndManageParcels) return;
    setIsDrawing(true);
    setDrawnPoints([]);
    setLastMarkedInfo(null);
  };

  const handleAddDrawnPoint = (point) => {
    setDrawnPoints((prev) => [...prev, point]);
    setLastMarkedInfo(`Borne ${drawnPoints.length + 1} marquée (${point[0].toFixed(5)}°, ${point[1].toFixed(5)}°)`);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(40); } catch (e) {}
    }
  };

  const handleMoveDrawnPoint = (index, newLatLng) => {
    if (!newLatLng) return;
    setDrawnPoints((prev) => {
      const updated = [...prev];
      updated[index] = [newLatLng.lat, newLatLng.lng];
      return updated;
    });
    setLastMarkedInfo(`Borne ${index + 1} réajustée (${newLatLng.lat.toFixed(5)}°, ${newLatLng.lng.toFixed(5)}°)`);
  };

  const handleUndoDrawnPoint = () => {
    setDrawnPoints((prev) => prev.slice(0, -1));
    setLastMarkedInfo(null);
  };

  // Add Point via Center Reticle Crosshair (Viseur)
  const handleAddCenterPoint = () => {
    if (centerCoords && centerCoords.length === 2) {
      const pt = [centerCoords[0], centerCoords[1]];
      setDrawnPoints((prev) => [...prev, pt]);
      setLastMarkedInfo(`Borne ${drawnPoints.length + 1} marquée au viseur (${pt[0].toFixed(5)}°, ${pt[1].toFixed(5)}°)`);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch (e) {}
      }
    }
  };

  // Mark Point via Real Field GPS (Never disabled, auto-acquires if needed)
  const handleAddCurrentGpsPoint = () => {
    if (effectiveUserLocation && Array.isArray(effectiveUserLocation) && effectiveUserLocation.length >= 2) {
      const pt = [effectiveUserLocation[0], effectiveUserLocation[1]];
      setDrawnPoints((prev) => [...prev, pt]);
      setLastMarkedInfo(`Borne ${drawnPoints.length + 1} marquée au GPS (${pt[0].toFixed(5)}°, ${pt[1].toFixed(5)}°)`);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(60); } catch (e) {}
      }
    } else {
      setIsGpsAcquiring(true);
      if (onToggleLocation && !isLocating) {
        onToggleLocation();
      }
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setUserLocation([latitude, longitude]);
            setDrawnPoints((prev) => [...prev, [latitude, longitude]]);
            setIsGpsAcquiring(false);
            setLastMarkedInfo(`Borne ${drawnPoints.length + 1} marquée au GPS (${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°)`);
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate(60); } catch (e) {}
            }
          },
          (err) => {
            setIsGpsAcquiring(false);
            alert("Signal GPS en attente ou non disponible. Vous pouvez pointer le viseur central sur la borne et cliquer sur 'Borne " + (drawnPoints.length + 1) + " (Viseur)' ou toucher l'écran.");
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
        );
      } else {
        setIsGpsAcquiring(false);
        alert("La géolocalisation n'est pas supportée. Pointez le viseur ou touchez l'écran pour ajouter des bornes.");
      }
    }
  };

  // Real-time area & perimeter calculation while tracing
  const drawnMetrics = useMemo(() => {
    if (!drawnPoints || drawnPoints.length < 2) return null;
    try {
      const lineCoords = drawnPoints.map(([lat, lng]) => [lng, lat]);
      const line = turf.lineString(lineCoords);
      const perimeterM = turf.length(line, { units: 'meters' });
      let areaHa = 0;
      let areaM2 = 0;
      if (drawnPoints.length >= 3) {
        const polyCoords = [...lineCoords, lineCoords[0]];
        const poly = turf.polygon([polyCoords]);
        areaM2 = turf.area(poly);
        areaHa = areaM2 / 10000;
      }
      return {
        perimeterM: perimeterM.toFixed(1),
        areaHa: areaHa.toFixed(3),
        areaM2: areaM2.toFixed(1)
      };
    } catch (e) {
      return null;
    }
  }, [drawnPoints]);

  const handleFinishDrawing = () => {
    if (drawnPoints.length < 3) {
      alert('Veuillez marquer au moins 3 bornes pour former une parcelle fermée.');
      return;
    }
    const pointsList = drawnPoints.map(([lat, lng]) => ({
      latStr: lat.toFixed(6),
      lngStr: lng.toFixed(6)
    }));

    setIsDrawing(false);
    setDrawnPoints([]);
    setLastMarkedInfo(null);
    onOpenCreateFormWithPoints(pointsList);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawnPoints([]);
    setLastMarkedInfo(null);
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

  const concessionCoords = useMemo(() => {
    if (activeConcessionRing && activeConcessionRing.length > 0) {
      return activeConcessionRing.map(([lng, lat]) => [lat, lng]);
    }
    return getLeafletCoords(concessionPolygon);
  }, [activeConcessionRing, concessionPolygon]);

  return (
    <div ref={mapContainerRef} className={`relative w-full h-full min-h-0 flex-1 bg-slate-900 flex flex-col select-none ${sharpnessHD ? 'sharpness-hd' : ''}`}>

      {/* Re-open Right Sidebar Floating Button (Top Right of Map) - Desktop Only */}
      {isSidebarCollapsed && (
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex absolute top-4 right-4 z-[1010] bg-white text-slate-900 border border-slate-200 px-3 py-2 rounded shadow-md font-semibold text-xs items-center gap-1.5 hover:bg-slate-100 transition-all cursor-pointer"
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
            {/* Visual Drag Handle */}
            <div className="w-12 h-1 bg-slate-700/90 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Calques &amp; Outils SIG</span>
              </div>
              <button
                onClick={() => setShowMobileGisMenu(false)}
                aria-label="Fermer le menu des calques"
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fond de Carte Switcher */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Fond de carte satellite
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'google-pure', label: 'Google Satellite Pur', icon: <Satellite className="w-4 h-4 text-emerald-400" /> },
                  { id: 'google-hybrid', label: 'Google Hybride', icon: <Globe className="w-4 h-4 text-cyan-400" /> },
                  { id: 'sentinel-live', label: 'Copernicus Live', icon: <Radio className="w-4 h-4 text-amber-400" /> },
                  { id: 'esri-clarity', label: 'Esri World HD', icon: <Mountain className="w-4 h-4 text-purple-400" /> }
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setMapType(b.id); }}
                    className={`p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
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
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Affichage des Calques
              </div>
              
              {/* Ocean Zones Toggle */}
              <div
                onClick={() => setShowOceanZones(!showOceanZones)}
                className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/80 rounded-lg cursor-pointer active:bg-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  <span>Zonage Littoral &amp; Utilité Publique (100m)</span>
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
                  <span>Tracé Périmètre Concession (5 326 ha)</span>
                </div>
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showConcession ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showConcession ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Concession Bornes Toggle (Réservé Admin & Arpenteur) */}
              {canViewAndInspectBornes && (
                <div
                  onClick={() => setShowConcessionBornes(!showConcessionBornes)}
                  className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/80 rounded-lg cursor-pointer active:bg-slate-800"
                >
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>Bornes Périmètre P1..P32 (Altitudes)</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showConcessionBornes ? 'bg-amber-500' : 'bg-slate-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showConcessionBornes ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </div>
              )}

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

      {/* High-Precision Center Crosshair (Viseur Réticule pour Arpenteur & Admin) */}
      {isDrawing && canDrawAndManageParcels && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1000] select-none">
          <div className="relative flex items-center justify-center">
            {/* Target Reticle Circle */}
            <div className="w-10 h-10 rounded-full border-2 border-emerald-400/90 flex items-center justify-center shadow-2xl shadow-emerald-950/80 bg-emerald-500/15 backdrop-blur-[1px]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs"></div>
            </div>
            {/* Horizontal & Vertical Crosshair Lines */}
            <div className="absolute w-16 h-[1.5px] bg-emerald-400/80"></div>
            <div className="absolute h-16 w-[1.5px] bg-emerald-400/80"></div>

            {/* Next Borne Badge */}
            <div className="absolute -top-9 px-2.5 py-1 rounded-full bg-slate-950/95 border border-emerald-400/80 text-[11px] font-mono text-emerald-300 font-bold shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Borne {drawnPoints.length + 1}</span>
            </div>

            {/* Center Lat/Lng Coordinates Preview */}
            {centerCoords && (
              <div className="absolute -bottom-8 px-2 py-0.5 rounded bg-slate-950/85 text-[10px] font-mono text-slate-300 border border-slate-700/80 whitespace-nowrap">
                {centerCoords[0].toFixed(5)}°, {centerCoords[1].toFixed(5)}°
              </div>
            )}
          </div>
        </div>
      )}

      {/* High-Precision GPS Field Tracing Floating Toolbar */}
      {isDrawing && canDrawAndManageParcels && (
        <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[1150] w-[96%] sm:w-auto sm:min-w-[500px] max-w-xl bg-slate-950/95 backdrop-blur-xl border border-emerald-500/60 rounded-2xl shadow-2xl p-2.5 sm:p-3 text-white animate-in slide-in-from-top-4 duration-200 select-none">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-bold text-xs sm:text-sm text-emerald-300">
                Traçage Cadastral en Direct
              </span>
              <span className="text-[11px] font-mono bg-emerald-950/80 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-700/60">
                {drawnPoints.length} borne{drawnPoints.length > 1 ? 's' : ''} posée{drawnPoints.length > 1 ? 's' : ''}
              </span>
            </div>

            {drawnMetrics && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                {drawnPoints.length >= 3 && (
                  <span className="text-emerald-300 font-bold bg-emerald-950/90 border border-emerald-600 px-2 py-0.5 rounded shadow-sm">
                    {drawnMetrics.areaHa} ha ({Math.round(drawnMetrics.areaM2)} m²)
                  </span>
                )}
                <span className="text-slate-400 hidden sm:inline">
                  Périmètre: {Math.round(drawnMetrics.perimeterM)} m
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2">
            {/* Add GPS point */}
            <button
              onClick={handleAddCurrentGpsPoint}
              disabled={isGpsAcquiring}
              className="flex-1 py-2 px-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-cyan-950/40 cursor-pointer"
              title="Enregistrer votre position GPS actuelle sur le terrain comme borne"
            >
              {isGpsAcquiring ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-200 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-cyan-200 flex-shrink-0" />
              )}
              <span className="truncate">
                {isGpsAcquiring
                  ? 'Recherche GPS...'
                  : effectiveUserLocation
                  ? `📍 Borne ${drawnPoints.length + 1} (GPS)`
                  : `📍 Activer GPS & Borne ${drawnPoints.length + 1}`}
              </span>
            </button>

            {/* Mark Center / Crosshair point */}
            <button
              onClick={handleAddCenterPoint}
              className="flex-1 py-2 px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-950/40 cursor-pointer border border-emerald-500/40"
              title="Poser la borne à l'endroit pointé par le viseur central"
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-200 flex-shrink-0" />
              <span className="truncate">🎯 Borne {drawnPoints.length + 1} (Viseur)</span>
            </button>

            {/* Undo last point */}
            <button
              onClick={handleUndoDrawnPoint}
              disabled={drawnPoints.length === 0}
              className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer border border-slate-700"
              title="Annuler la dernière borne posée"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Annuler</span>
            </button>

            {/* Finish & validate */}
            <button
              onClick={handleFinishDrawing}
              disabled={drawnPoints.length < 3}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-950/40 cursor-pointer"
              title="Terminer le tracé et enregistrer la parcelle"
            >
              <Check className="w-3.5 h-3.5 text-emerald-100" />
              <span>Valider ({drawnPoints.length})</span>
            </button>

            {/* Cancel all */}
            <button
              onClick={handleCancelDrawing}
              className="p-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 rounded-xl transition-all cursor-pointer border border-slate-700"
              title="Quitter le mode tracé"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-1.5 text-[10px] text-slate-400 flex items-center justify-between px-1">
            <span className="truncate">
              {lastMarkedInfo || "Positionnez-vous avec le GPS, le viseur ou touchez l'écran pour marquer chaque borne."}
            </span>
            {locationAccuracy && (
              <span className="font-mono text-cyan-400 flex-shrink-0 ml-2">GPS: ±{Math.round(locationAccuracy)}m</span>
            )}
          </div>
        </div>
      )}

      {/* Concession Perimeter Calibration Toolbar (Admin Only) */}
      {isEditingConcession && isAdmin && (
        <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[1150] w-[96%] sm:w-auto sm:min-w-[540px] max-w-2xl bg-slate-950/95 backdrop-blur-xl border border-amber-500/70 rounded-2xl shadow-2xl p-2.5 sm:p-3 text-white animate-in slide-in-from-top-4 duration-200 select-none">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
              <span className="font-bold text-xs sm:text-sm text-amber-300">
                Édition des Bornes Périmétriques
              </span>
              <span className="text-[11px] font-mono bg-amber-950/80 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-700/60">
                {activeConcessionRing.length} bornes
              </span>
            </div>

            {editingConcessionMetrics && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-amber-300 font-bold bg-amber-950/90 border border-amber-600 px-2 py-0.5 rounded shadow-sm">
                  {editingConcessionMetrics.areaHa} ha
                </span>
                <span className="text-slate-400 hidden sm:inline">
                  Périmètre: {editingConcessionMetrics.perimeterKm} km
                </span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-300 mb-2.5 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Faites glisser les bornes orange (P1...P{activeConcessionRing.length}) sur la carte pour les calibrer, ou touchez une borne pour inspecter son altitude.</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleCancelConcessionEditing}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>Annuler</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveConcessionEditing}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer le Périmètre</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geodesic Borne Inspection Modal (Altitude, Longitude, Latitude) - Admin & Arpenteur Only */}
      {inspectedBorne && canViewAndInspectBornes && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold font-mono text-sm shadow-inner">
                  P{inspectedBorne.number}
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    Borne Périmétrique P{inspectedBorne.number}
                  </h3>
                  <p className="text-[11px] text-amber-300/80 font-medium">
                    Concession Manuel Joaquim d'Oliveira
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedBorne(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3.5">
              {/* Altitude Box (Open-Meteo DEM SRTM) */}
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-850 p-3.5 rounded-xl border border-slate-700/70 shadow-inner">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Mountain className="w-4 h-4 text-emerald-400" />
                    Altitude Topographique
                  </span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400 font-mono">
                    DEM SRTM 90m
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  {inspectedBorne.isLoadingAltitude ? (
                    <div className="flex items-center gap-2 py-1 text-emerald-400 text-xs font-mono">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mesure altimétrique en cours...</span>
                    </div>
                  ) : inspectedBorne.altitude !== null ? (
                    <>
                      <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
                        {inspectedBorne.altitude} m
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        au-dessus du niveau moyen de la mer (MSL)
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Altitude non mesurable pour ce point
                    </span>
                  )}
                </div>
              </div>

              {/* Coordinates Grid (Longitude & Latitude) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Longitude */}
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Longitude (X)</span>
                    <span className="text-[10px] text-slate-400">Est</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-white">
                    {inspectedBorne.lng.toFixed(7)}°
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {ddToDms(inspectedBorne.lng, false)}
                  </div>
                </div>

                {/* Latitude */}
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Latitude (Y)</span>
                    <span className="text-[10px] text-slate-400">Sud</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-white">
                    {inspectedBorne.lat.toFixed(7)}°
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {ddToDms(inspectedBorne.lat, true)}
                  </div>
                </div>
              </div>

              {/* Admin Calibration Controls */}
              {isAdmin && (
                <div className="bg-slate-950/60 border border-amber-500/30 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                      Calibrage Géodésique (Admin)
                    </span>
                    {!inspectedBorne.isEditingManual ? (
                      <button
                        onClick={() => setInspectedBorne((prev) => ({ ...prev, isEditingManual: true }))}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline cursor-pointer"
                      >
                        Saisie manuelle
                      </button>
                    ) : (
                      <button
                        onClick={() => setInspectedBorne((prev) => ({ ...prev, isEditingManual: false }))}
                        className="text-[11px] text-slate-400 hover:text-slate-300 cursor-pointer"
                      >
                        Annuler saisie
                      </button>
                    )}
                  </div>

                  {inspectedBorne.isEditingManual ? (
                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Latitude (° décimaux)</label>
                          <input
                            type="text"
                            value={inspectedBorne.manualLat}
                            onChange={(e) => setInspectedBorne((prev) => ({ ...prev, manualLat: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                            placeholder="-5.8988"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Longitude (° décimaux)</label>
                          <input
                            type="text"
                            value={inspectedBorne.manualLng}
                            onChange={(e) => setInspectedBorne((prev) => ({ ...prev, manualLng: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                            placeholder="12.3375"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveManualCoordinates(inspectedBorne.manualLat, inspectedBorne.manualLng)}
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Repositionner la Borne</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{isEditingConcession ? "Cette borne est glissable sur la carte." : "Pour déplacer cette borne :"}</span>
                      {!isEditingConcession ? (
                        <button
                          onClick={() => {
                            handleStartConcessionEditing();
                          }}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Activer Mode Déplacement
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-bold text-[10px]">Glisser-déposer actif</span>
                      )}
                    </div>
                  )}

                  {isEditingConcession && activeConcessionRing.length > 3 && (
                    <div className="pt-2 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => handleDeleteConcessionBorne(inspectedBorne.index)}
                        className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer cette borne du tracé</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isAdmin && (
                <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800 text-center">
                  Consultation géodésique officielle. La modification des bornes périmétriques est réservée à l'Administrateur.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-950 p-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectedBorne(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Fermer
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
            <div className="absolute top-0 left-12 w-64 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-1.5 space-y-1 z-[1010] text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                Fond de carte
              </div>
              <button
                onClick={() => { setMapType('google-pure'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 font-medium transition-all cursor-pointer ${
                  mapType === 'google-pure' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Satellite className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Google Satellite Pur (HD)</span>
              </button>
              <button
                onClick={() => { setMapType('google-hybrid'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 font-medium transition-all cursor-pointer ${
                  mapType === 'google-hybrid' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Google Hybride (Toponymes)</span>
              </button>
              <button
                onClick={() => { setMapType('sentinel-live'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 font-medium transition-all cursor-pointer ${
                  mapType === 'sentinel-live' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Radio className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Copernicus Sentinel-2 Live</span>
              </button>
              <button
                onClick={() => { setMapType('esri-clarity'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 font-medium transition-all cursor-pointer ${
                  mapType === 'esri-clarity' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Mountain className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>Esri World Imagery HD</span>
              </button>
              <button
                onClick={() => { setMapType('google-roads'); setShowBasemapMenu(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 font-medium transition-all cursor-pointer ${
                  mapType === 'google-roads' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Route className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>Google Plan des Routes</span>
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

        {/* Drawing Tool (Strictement réservé Admin & Arpenteur) */}
        {canDrawAndManageParcels && (
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

        {/* Concession Bornes Toggle */}
        {canViewAndInspectBornes && (
          <button
            onClick={() => setShowConcessionBornes(!showConcessionBornes)}
            className={`p-2 rounded-lg border shadow-sm transition-all cursor-pointer ${
              showConcessionBornes
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-400/30'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
            }`}
            title={showConcessionBornes ? "Masquer les bornes de la concession" : "Afficher les bornes de la concession (P1...P32)"}
          >
            <MapPin className="w-4 h-4" />
          </button>
        )}

        {/* Concession Edit Mode Quick Toggle (Admin Only) */}
        {isAdmin && (
          <button
            onClick={() => {
              if (isEditingConcession) {
                handleCancelConcessionEditing();
              } else {
                handleStartConcessionEditing();
              }
            }}
            className={`p-2 rounded-lg border shadow-sm transition-all cursor-pointer ${
              isEditingConcession
                ? 'bg-amber-600 text-white border-amber-700 animate-pulse'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
            title={isEditingConcession ? "Annuler le mode édition des bornes" : "Éditer et calibrer les bornes de la concession"}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

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
          aria-label="Afficher la légende cartographique"
          className={`p-2 rounded-xl border shadow-md transition-all duration-150 active:scale-95 cursor-pointer mt-2 ${
            showLegendDrawer ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-900/30' : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800'
          }`}
          title="Afficher la légende"
        >
          <Palette className="w-4 h-4 text-amber-400" />
        </button>
      </div>

      {/* Discrete Collapsible Legend Card */}
      {showLegendDrawer && (
        <div className="absolute top-3 sm:top-4 left-3 sm:left-16 right-3 sm:right-auto z-[1010] bg-slate-950/95 backdrop-blur-xl p-4 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-2.5 max-w-sm text-slate-200 select-none animate-in fade-in zoom-in-95 duration-150 max-h-[78vh] overflow-y-auto">
          <div className="font-bold text-white border-b border-slate-800 pb-2 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Légende Cadastrale</span>
            </span>
            <button onClick={() => setShowLegendDrawer(false)} aria-label="Fermer la légende" className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Parcels Status */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Statut des Parcelles</div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-emerald-500/30 border-2 border-emerald-500"></div>
              <span className="text-slate-300">Disponible / Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-rose-500/30 border-2 border-rose-500"></div>
              <span className="text-slate-300">Occupé / Attribué</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-amber-500/30 border-2 border-amber-500"></div>
              <span className="text-slate-300">Litige / Sous réserve</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <div className="w-4 h-0 border-2 border-dashed border-cyan-400"></div>
              <span className="text-cyan-300 font-medium text-[11px]">Limite Zone ISETECH (1 002 ha)</span>
            </div>
          </div>

          {/* Coastal Zoning Legend Section */}
          <div className="border-t border-slate-800 pt-2 space-y-1.5">
            <div className="font-bold text-slate-200 text-[11px] flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 font-mono">Zonage Littoral &amp; Océan</span>
              <span className="text-[10px] text-slate-400 font-mono">0 à &gt;600 m</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-rose-500/30 border-2 border-rose-500"></div>
              <span className="text-slate-300 text-[11px]"><strong className="text-rose-400">Utilité Publique</strong> : 0 à 100 m (78,65 ha - Domaine État)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-cyan-500/30 border-2 border-cyan-400"></div>
              <span className="text-slate-300 text-[11px]"><strong className="text-cyan-400">Zone A</strong> : 101 à 200 m (78,83 ha)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-amber-500/30 border-2 border-amber-400"></div>
              <span className="text-slate-300 text-[11px]"><strong className="text-amber-400">Zone B</strong> : 201 à 400 m (158,19 ha)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-purple-500/30 border-2 border-purple-400"></div>
              <span className="text-slate-300 text-[11px]"><strong className="text-purple-400">Zone C</strong> : 401 à 600 m (158,47 ha)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border-2 border-emerald-500"></div>
              <span className="text-slate-300 text-[11px]"><strong className="text-emerald-400">Zone D</strong> : 601 m et + (Zone continentale intérieure)</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[10px] text-slate-400">
              <div className="w-4 h-0 border-2 border-dashed border-red-500"></div>
              <span>Ligne 100m (Recul Concession) &bull; Lignes 200/400/600m</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Tile Loading Indicator */}
      {isTilesLoading && (
        <>
          {/* Desktop/Tablet Centered Pill */}
          <div className="hidden sm:block absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none animate-in fade-in duration-200">
            <div className="glass-pill px-3 py-1.5 rounded-full text-[11px] font-sans font-semibold text-emerald-300 flex items-center gap-2 shadow-2xl border border-emerald-500/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Chargement des tuiles satellites HD...</span>
            </div>
          </div>

          {/* Mobile Discrete Indicator (Top Right - Non overlapping) */}
          <div className="sm:hidden absolute top-3 right-3 z-[1000] pointer-events-none animate-in fade-in duration-200">
            <div className="glass-pill px-2.5 py-1.5 rounded-full text-[10px] font-sans font-semibold text-emerald-300 flex items-center gap-1.5 shadow-lg border border-emerald-500/30">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              <span>Tuiles HD...</span>
            </div>
          </div>
        </>
      )}

      {/* Main Leaflet Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        maxZoom={22}
        minZoom={5}
        zoomControl={false}
        preferCanvas={true}
        className="w-full h-full flex-1 z-0"
        scrollWheelZoom={true}
      >
        <TileLoadingWatcher onLoadingChange={setIsTilesLoading} />
        <MapBoundsController
          concessionPolygon={concessionPolygon}
          subZones={subZones}
          selectedParcel={selectedParcel}
          activeView={activeView}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <ProfessionalGisHud
          onAddPoint={handleAddDrawnPoint}
          isDrawing={isDrawing}
          mapType={mapType}
          onCenterChange={setCenterCoords}
          onZoomChange={setMapZoom}
        />

        {/* Clean Google Pure Satellite Layer */}
        {mapType === 'google-pure' && (
          <TileLayer
            attribution='&copy; Google Satellite Pure HD'
            url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={22}
            maxNativeZoom={19}
            keepBuffer={8}
            updateWhenIdle={false}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'google-hybrid' && (
          <TileLayer
            attribution='&copy; Google Satellite Hybrid'
            url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={22}
            maxNativeZoom={19}
            keepBuffer={8}
            updateWhenIdle={false}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'sentinel-live' && (
          <TileLayer
            attribution='&copy; Copernicus Sentinel-2 Live (ESA / EOX Sentinel-2 Cloudless)'
            url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg"
            maxZoom={22}
            maxNativeZoom={14}
            keepBuffer={6}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'esri-clarity' && (
          <TileLayer
            attribution='&copy; Esri World Imagery'
            url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={22}
            maxNativeZoom={19}
            keepBuffer={6}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'google-roads' && (
          <TileLayer
            attribution='&copy; Google Maps Vector'
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={22}
            maxNativeZoom={19}
            keepBuffer={8}
            updateWhenIdle={false}
            crossOrigin="anonymous"
          />
        )}
        {mapType === 'osm-roads' && (
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={22}
            maxNativeZoom={19}
            keepBuffer={6}
            crossOrigin="anonymous"
          />
        )}

        {/* Discrete Road Overlay */}
        {showRoadsOverlay && mapType !== 'google-roads' && mapType !== 'osm-roads' && (
          <TileLayer
            attribution='&copy; Google Roads Overlay'
            url="https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={22}
            maxNativeZoom={19}
            keepBuffer={8}
            updateWhenIdle={false}
            crossOrigin="anonymous"
          />
        )}

        {/* Outer Concession Polygon */}
        {showConcession && concessionCoords.length > 0 && (
          <Polygon
            positions={concessionCoords}
            interactive={!isDrawing && !isEditingConcession}
            pathOptions={{
              color: isEditingConcession ? '#EA580C' : '#D97706',
              weight: isEditingConcession ? 3.5 : 2.5,
              dashArray: isEditingConcession ? '4, 4' : '6, 6',
              fillColor: isEditingConcession ? '#EA580C' : '#D97706',
              fillOpacity: isEditingConcession ? 0.08 : 0.04
            }}
          >
            {!isDrawing && !isEditingConcession && (
              <Tooltip direction="top" className="bg-slate-900 text-white font-semibold text-[11px] px-2 py-0.5 rounded shadow-sm border border-slate-700">
                Concession Manuel Joaquim d'Oliveira (5 326,15 ha)
              </Tooltip>
            )}
          </Polygon>
        )}

        {/* Concession Perimeter Bornes (P1 to P32) */}
        {showConcession && (showConcessionBornes || isEditingConcession) && canViewAndInspectBornes && concessionBornes.map((b) => (
          <Marker
            key={`concession-borne-${b.number}`}
            position={b.position}
            icon={createConcessionBorneIcon(b.number, isEditingConcession && isAdmin, mapZoom >= 14)}
            draggable={isEditingConcession && isAdmin}
            eventHandlers={{
              click: () => handleInspectBorne(b),
              drag: (e) => {
                handleMoveConcessionBorne(b.index, e.target.getLatLng());
              },
              dragend: (e) => {
                handleMoveConcessionBorne(b.index, e.target.getLatLng());
              }
            }}
          >
            <Tooltip direction="top" offset={[0, (mapZoom >= 14 || isEditingConcession) ? -14 : -5]} opacity={0.92}>
              <div className="text-[11px] font-sans font-bold text-slate-900 text-center">
                Borne P{b.number} {isEditingConcession && isAdmin ? '(Déplaçable)' : '• Toucher pour altitude'}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Outer Delimitation Boundary of Zone ISETECH */}
        {showSubZones && (
          <Polygon
            positions={ISETECH_OUTER_BOUNDARY_COORDS}
            interactive={!isDrawing}
            pathOptions={{
              color: '#0284C7',
              weight: activeView === 'isetech' ? 3.5 : 2.5,
              dashArray: '8, 6',
              fillColor: '#0284C7',
              fillOpacity: activeView === 'isetech' ? 0.02 : 0.12
            }}
            eventHandlers={{
              click: () => {
                if (!isDrawing && activeView === 'global' && onExploreSubZone) {
                  onExploreSubZone('isetech');
                }
              }
            }}
          >
            {!isDrawing && (
              <Tooltip direction="top" className="bg-cyan-900 text-cyan-100 font-bold text-[11px] px-2.5 py-1 rounded shadow-md border border-cyan-400">
                Périmètre Zone ISETECH (1 002,61 ha) {activeView === 'global' ? '• Cliquer pour explorer' : ''}
              </Tooltip>
            )}
          </Polygon>
        )}

        {/* Coastal Ocean Zones A, B, C, D Polygons */}
        {showOceanZones && COASTAL_ZONES.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.coordinates}
            interactive={!isDrawing}
            pathOptions={{
              color: zone.strokeColor,
              weight: 1.5,
              dashArray: '4, 4',
              fillColor: zone.color,
              fillOpacity: zone.fillOpacity
            }}
          >
            {!isDrawing && (
              <>
                <Tooltip direction="center" className="bg-slate-950/95 text-white font-semibold text-[11px] px-2.5 py-1 rounded-lg shadow-md border border-slate-700 font-mono">
                  {zone.shortName} • {zone.formattedArea}
                </Tooltip>
                <Popup>
                  <div className="p-1 space-y-1.5 text-xs font-sans text-slate-100">
                    <div className="font-bold text-sm" style={{ color: zone.strokeColor }}>{zone.name}</div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">{zone.description}</div>
                    <div className="font-semibold text-slate-200">Superficie : <span className="text-emerald-400 font-bold font-mono">{zone.formattedArea}</span></div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                      <span>Distance du rivage</span>
                      <strong className="font-mono text-cyan-300">{zone.range}</strong>
                    </div>
                  </div>
                </Popup>
              </>
            )}
          </Polygon>
        ))}

        {/* Coastal Separation Lines (0m, 100m, 200m, 400m, 600m) & Midpoint Distance Markers */}
        {showOceanZones && SEPARATION_LINES.map((line) => (
          <React.Fragment key={line.id}>
            <Polyline
              positions={line.coordinates}
              interactive={!isDrawing}
              pathOptions={{
                color: line.color,
                weight: line.weight,
                dashArray: line.dashArray
              }}
            >
              {!isDrawing && (
                <Tooltip direction="top" className="bg-slate-950/95 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg shadow-md border border-slate-700">
                  {line.label}
                </Tooltip>
              )}
            </Polyline>
            {line.midpoint && mapZoom >= 14 && (
              <Marker
                position={line.midpoint}
                icon={createCoastalLabelIcon(
                  line.shortLabel,
                  line.id === 'line_0m' ? '#0369A1' : line.id === 'line_100m' ? '#B91C1C' : '#0F172A',
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
          const coords = isSingleSelected && parcelBorneDraft?.parcelId === parcel.id
            ? parcelBorneDraft.points
            : getLeafletCoords(parcel);

          if (!coords || coords.length === 0) return null;

          return (
            <Polygon
              key={parcel.id}
              positions={coords}
              interactive={!isDrawing}
              pathOptions={{
                color: isMultiSelected ? '#0284C7' : colorConfig.hex,
                weight: isMultiSelected ? 4.5 : isSingleSelected ? 4 : 2,
                dashArray: isMultiSelected ? '4, 4' : undefined,
                fillColor: colorConfig.hex,
                fillOpacity: isMultiSelected ? 0.75 : isSingleSelected ? 0.65 : 0.4
              }}
              eventHandlers={{
                click: () => {
                  if (!isDrawing) {
                    onSelectParcel(parcel);
                    if (isIsetechMain && activeView === 'global') {
                      onExploreSubZone('isetech');
                    }
                  }
                }
              }}
            >
              {!isDrawing && (
                <>
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
                </>
              )}
            </Polygon>
          );
        })}

        {/* Bornes of the selected parcel (draggable by Admin only) */}
        {!isDrawing && !isEditingConcession && displayedParcelBornes.map((pt, i) => (
          <Marker
            key={`parcel-borne-${selectedParcel.id}-${i}`}
            position={pt}
            icon={parcelBorneIcons[i]}
            draggable={canMoveParcelBornes && !pendingBorneMove}
            zIndexOffset={1000}
            eventHandlers={{
              drag: (e) => handleDragParcelBorne(i, e.target.getLatLng()),
              dragend: (e) => handleDropParcelBorne(i, e.target)
            }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.92}>
              <div className="text-[11px] font-sans text-slate-900 text-center">
                <div className="font-bold">Borne B{i + 1}{canMoveParcelBornes ? ' • Glisser pour déplacer' : ''}</div>
                <div className="font-mono">{pt[0].toFixed(6)}, {pt[1].toFixed(6)}</div>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Drawn Points with Numbered Badges & Precision Dragging (Admin & Arpenteur) */}
        {isDrawing && canDrawAndManageParcels && drawnPoints.length > 0 && (
          <>
            {drawnPoints.map((pt, i) => (
              <Marker
                key={`draw-pt-${i}`}
                position={pt}
                icon={createVertexIcon(i + 1)}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    handleMoveDrawnPoint(i, e.target.getLatLng());
                  }
                }}
              >
                <Tooltip permanent direction="top" className="text-[10px] font-bold">
                  Borne {i + 1}
                </Tooltip>
              </Marker>
            ))}
            {drawnPoints.length === 2 && (
              <Polyline
                positions={drawnPoints}
                pathOptions={{
                  color: '#10B981',
                  weight: 3.5,
                  dashArray: '6, 6'
                }}
              />
            )}
            {drawnPoints.length >= 3 && (
              <Polygon
                positions={drawnPoints}
                pathOptions={{
                  color: '#10B981',
                  weight: 3.5,
                  dashArray: '6, 6',
                  fillColor: '#10B981',
                  fillOpacity: 0.3
                }}
              />
            )}
          </>
        )}

        {/* Location FlyTo Controller */}
        <LocationFlyToController flyToTrigger={flyToTrigger} userLocation={effectiveUserLocation} />

        {/* User Real-Time GPS Location Beacon & Accuracy Circle */}
        {effectiveUserLocation && Array.isArray(effectiveUserLocation) && effectiveUserLocation.length >= 2 && (
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
                  {locationZoneInfo ? `${locationZoneInfo.shortName} (${locationZoneInfo.distanceFormatted})` : 'Position actuelle'}
                </div>
              </Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>

      <BorneMoveConfirmModal
        move={pendingBorneMove}
        onConfirm={handleConfirmBorneMove}
        onCancel={handleCancelBorneMove}
      />
    </div>
  );
}
