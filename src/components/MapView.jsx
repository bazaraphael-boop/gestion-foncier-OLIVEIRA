import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Popup, Tooltip, useMap, Marker, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_COLORS, ddToDms, fetchElevation, calculateArea, measurePoints, parseDecimal } from '../utils/geoUtils';
import { COASTAL_ZONES, SEPARATION_LINES, getOceanZoneInfo } from '../utils/coastalZones';
import BorneMoveConfirmModal from './BorneMoveConfirmModal';
import { MeasureLayer, MeasurePanel, MeasureSheet } from './MeasureTool';
import { useMeasureSettings } from '../hooks/useMeasure';
import { LiveSurveyorsLayer, LiveSurveyorsPanel } from './LiveSurveyors';
import {
  Layers,
  MapPin,
  Waves,
  Pencil,
  Check,
  X,
  Loader2,
  Navigation,
  ChevronDown,
  Globe,
  ZoomIn,
  ZoomOut,
  Route,
  PanelRightOpen,
  Sparkles,
  Radio,
  Download,
  Palette,
  Satellite,
  Mountain,
  RotateCcw,
  Crosshair,
  Trash2,
  Save,
  Map as MapIcon,
  PenTool,
  LocateFixed,
  Hexagon,
  Ruler
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

  return (
    <>
      {/* Bottom bar: cursor coordinates + zoom */}
      <div className="absolute bottom-[76px] md:bottom-3 left-3 z-[1000] h-9 bg-white px-1 rounded-lg border border-slate-200 text-[12px] text-slate-600 flex items-center shadow-[0_4px_14px_-4px_rgba(15,37,64,0.3)] select-none pointer-events-auto">
        <div ref={coordsRef} className="hidden sm:flex items-center gap-3 px-2 font-mono tabular-nums">
          <span>Lat: <strong className="text-slate-900">-5.89880°</strong></span>
          <span>Lng: <strong className="text-slate-900">12.33750°</strong></span>
        </div>
        <div className="hidden sm:block h-5 w-px bg-slate-200 mx-1" />
        <div className="flex items-center gap-0.5">
          <button onClick={handleZoomOut} className="w-7 h-7 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center cursor-pointer" aria-label="Dézoomer" title="Dézoomer">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowZoomMenu(!showZoomMenu)}
              aria-expanded={showZoomMenu}
              className="h-7 px-2 rounded-md hover:bg-slate-100 text-slate-800 font-medium tabular-nums flex items-center gap-1 cursor-pointer"
            >
              <span>{zoomPct}%</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showZoomMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white text-slate-800 border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,37,64,0.35)] p-1.5 z-[1200] text-[13px]">
                <div className="px-2.5 pt-1 pb-1 text-[11px] font-semibold text-slate-400">Niveau de zoom</div>
                {PRESET_PERCENTAGES.map((preset) => (
                  <button
                    key={preset.level}
                    onClick={() => handleSetZoomLevel(preset.level)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer ${
                      currentZoom === preset.level ? 'bg-brand-50 text-brand-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className="tabular-nums text-[11px] text-slate-400">{preset.pct}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleZoomIn} className="w-7 h-7 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center cursor-pointer" aria-label="Zoomer" title="Zoomer">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* North arrow */}
      <div className="absolute bottom-[76px] md:bottom-8 right-3 z-[1000] w-9 h-9 bg-white rounded-lg border border-slate-200 shadow-[0_4px_14px_-4px_rgba(15,37,64,0.3)] flex flex-col items-center justify-center select-none" aria-label="Nord en haut">
        <Navigation className="w-3.5 h-3.5 text-slate-800 -rotate-45" />
        <span className="text-[9px] font-bold leading-none text-slate-700">N</span>
      </div>
    </>
  );
}

// ── Map chrome building blocks: one light surface, one icon colour, brand navy for "on" ──

const BASEMAPS = [
  { id: 'google-pure', label: 'Satellite', detail: 'Google, haute définition', icon: Satellite },
  { id: 'google-hybrid', label: 'Satellite + noms', detail: 'Google hybride', icon: Globe },
  { id: 'esri-clarity', label: 'Satellite Esri', detail: 'Esri World Imagery', icon: Mountain },
  { id: 'sentinel-live', label: 'Sentinel-2', detail: 'Copernicus, image récente', icon: Radio },
  { id: 'google-roads', label: 'Plan des routes', detail: 'Google Maps', icon: Route }
];

function ToolButton({ icon: Icon, label, onClick, active = false, disabled = false, busy = false }) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          active ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Icon className="w-[18px] h-[18px]" />}
      </button>
      {!active && (
        <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity delay-150 z-[1020]">
          {label}
        </span>
      )}
    </div>
  );
}

function LayerSwitch({ icon: Icon, label, detail, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left cursor-pointer"
    >
      <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-slate-800">{label}</span>
        {detail && <span className="block text-[11px] text-slate-500">{detail}</span>}
      </span>
      <span className={`w-9 h-5 rounded-full p-0.5 flex-shrink-0 transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

function BasemapList({ value, onChange }) {
  return (
    <div className="space-y-0.5">
      {BASEMAPS.map((b) => {
        const isActive = value === b.id;
        const Icon = b.icon;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(b.id)}
            aria-pressed={isActive}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-colors ${
              isActive ? 'bg-brand-50' : 'hover:bg-slate-50'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-700' : 'text-slate-500'}`} />
            <span className="flex-1 min-w-0">
              <span className={`block text-[13px] font-medium ${isActive ? 'text-brand-800' : 'text-slate-800'}`}>{b.label}</span>
              <span className="block text-[11px] text-slate-500">{b.detail}</span>
            </span>
            {isActive && <Check className="w-4 h-4 text-brand-700 flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function LegendSwatch({ fill, stroke, dashed = false, line = false }) {
  if (line) {
    return <span className="w-4 h-0 flex-shrink-0 border-t-2" style={{ borderColor: stroke, borderStyle: dashed ? 'dashed' : 'solid' }} />;
  }
  return <span className="w-3.5 h-3.5 rounded-[3px] flex-shrink-0 border-2" style={{ backgroundColor: fill, borderColor: stroke }} />;
}

function MapLegend() {
  const statuses = [
    { label: 'Disponible', fill: 'rgba(16,185,129,0.3)', stroke: '#10b981' },
    { label: 'Occupé / attribué', fill: 'rgba(244,63,94,0.3)', stroke: '#f43f5e' },
    { label: 'Litige / sous réserve', fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b' }
  ];
  const zones = [
    { label: 'Utilité publique', detail: '0 – 100 m', fill: 'rgba(244,63,94,0.3)', stroke: '#f43f5e' },
    { label: 'Zone A', detail: '101 – 200 m', fill: 'rgba(6,182,212,0.3)', stroke: '#22d3ee' },
    { label: 'Zone B', detail: '201 – 400 m', fill: 'rgba(245,158,11,0.3)', stroke: '#fbbf24' },
    { label: 'Zone C', detail: '401 – 600 m', fill: 'rgba(168,85,247,0.3)', stroke: '#c084fc' },
    { label: 'Zone D', detail: 'au-delà de 600 m', fill: 'rgba(16,185,129,0.2)', stroke: '#10b981' }
  ];
  return (
    <div className="space-y-3 px-2.5 pb-1 text-[12px] text-slate-700">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400">Parcelles</div>
        {statuses.map((st) => (
          <div key={st.label} className="flex items-center gap-2">
            <LegendSwatch fill={st.fill} stroke={st.stroke} />
            <span>{st.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <LegendSwatch line dashed stroke="#22d3ee" />
          <span>Limite de la zone ISETECH</span>
        </div>
        <div className="flex items-center gap-2">
          <LegendSwatch line dashed stroke="#d97706" />
          <span>Périmètre de la concession</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400">Distance à l&apos;océan</div>
        {zones.map((z) => (
          <div key={z.label} className="flex items-center gap-2">
            <LegendSwatch fill={z.fill} stroke={z.stroke} />
            <span className="flex-1">{z.label}</span>
            <span className="text-slate-500 tabular-nums">{z.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapPanel({ title, onClose, children, className = '' }) {
  return (
    <div className={`bg-white text-slate-800 border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,37,64,0.35)] p-1.5 animate-in fade-in zoom-in-95 duration-150 ${className}`}>
      <div className="flex items-center justify-between px-2.5 pt-1 pb-1.5">
        <span className="text-[13px] font-semibold text-slate-900">{title}</span>
        <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
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
  liveSurveyors = [],
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
  const [openMapPanel, setOpenMapPanel] = useState(null); // 'basemap' | 'layers' | null

  // "Latte" measuring tool (Admin & Arpenteur)
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [showMeasureSheet, setShowMeasureSheet] = useState(false);
  const [measureSettings, setMeasureSettings] = useMeasureSettings();
  const toolbarRef = useRef(null);
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
  const [surveyorFocus, setSurveyorFocus] = useState(null);

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

  // Close the toolbar panels on outside click or Escape
  useEffect(() => {
    if (!openMapPanel) return;
    const onPointer = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) setOpenMapPanel(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenMapPanel(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMapPanel]);

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
      const { areaM2, perimeterM } = measurePoints(activeConcessionRing.map(([lng, lat]) => [lat, lng]));
      const areaHa = areaM2 / 10000;
      const lengthKm = perimeterM / 1000;
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
    const latNum = parseDecimal(newLat);
    const lngNum = parseDecimal(newLng);
    if (isNaN(latNum) || isNaN(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
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
    setIsMeasuring(false);
    setMeasurePoints([]);
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
      // From 3 bornes the perimeter includes the closing side back to B1
      const { perimeterM, areaM2, areaHa } = measurePoints(drawnPoints);
      return {
        perimeterM: perimeterM.toFixed(1),
        areaHa: areaHa.toFixed(3),
        areaM2: areaM2.toFixed(1)
      };
    } catch (e) {
      return null;
    }
  }, [drawnPoints]);

  const handleToggleMeasuring = () => {
    if (isMeasuring) {
      setIsMeasuring(false);
      setMeasurePoints([]);
      return;
    }
    setIsDrawing(false);
    setDrawnPoints([]);
    setOpenMapPanel(null);
    if (onSelectParcel) onSelectParcel(null);
    setMeasurePoints([]);
    setIsMeasuring(true);
  };

  const handleMeasureToParcel = () => {
    if (measurePoints.length < 3 || !onOpenCreateFormWithPoints) return;
    const pointsList = measurePoints.map(([lat, lng]) => ({ latStr: lat.toFixed(6), lngStr: lng.toFixed(6) }));
    setIsMeasuring(false);
    setMeasurePoints([]);
    onOpenCreateFormWithPoints(pointsList);
  };

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
          className="hidden md:flex absolute top-3 right-3 z-[1010] h-10 bg-white text-slate-800 border border-slate-200 px-3 rounded-xl shadow-[0_4px_14px_-4px_rgba(15,37,64,0.3)] font-medium text-[13px] items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Afficher le registre des parcelles"
        >
          <PanelRightOpen className="w-4 h-4 text-slate-500" />
          <span>Registre des parcelles</span>
        </button>
      )}

      {/* Mobile: map & layers button */}
      <div className="md:hidden absolute top-3 left-3 z-[1000]">
        <button
          onClick={() => setShowMobileGisMenu(true)}
          className="h-10 px-3.5 bg-white text-slate-800 border border-slate-200 rounded-full shadow-[0_4px_14px_-4px_rgba(15,37,64,0.3)] text-[13px] font-medium flex items-center gap-2 cursor-pointer active:bg-slate-50"
        >
          <Layers className="w-4 h-4 text-slate-500" />
          <span>Carte &amp; calques</span>
        </button>
      </div>

      {/* Mobile: map & layers bottom sheet */}
      {showMobileGisMenu && (
        <div className="md:hidden fixed inset-0 z-[1300] bg-slate-900/50 flex flex-col justify-end animate-in fade-in duration-150" onClick={() => setShowMobileGisMenu(false)}>
          <div
            role="dialog"
            aria-label="Carte et calques"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-2xl px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-slate-800 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between px-2.5 pb-2">
              <span className="text-[15px] font-semibold text-slate-900">Carte &amp; calques</span>
              <button
                onClick={() => setShowMobileGisMenu(false)}
                aria-label="Fermer"
                className="p-1.5 -mr-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-2.5 pt-1 pb-1 text-[11px] font-semibold text-slate-400">Fond de carte</div>
            <BasemapList value={mapType} onChange={setMapType} />

            <div className="h-px bg-slate-100 my-2" />
            <div className="px-2.5 pt-1 pb-1 text-[11px] font-semibold text-slate-400">Calques</div>
            <LayerSwitch icon={Waves} label="Zonage littoral" detail="Bandes de distance à l'océan" checked={showOceanZones} onChange={setShowOceanZones} />
            <LayerSwitch icon={Hexagon} label="Périmètre de la concession" detail="5 310 ha" checked={showConcession} onChange={setShowConcession} />
            {canViewAndInspectBornes && (
              <LayerSwitch icon={MapPin} label="Bornes du périmètre" detail="P1 à P32, avec altitude" checked={showConcessionBornes} onChange={setShowConcessionBornes} />
            )}
            <LayerSwitch icon={Route} label="Routes" checked={showRoadsOverlay} onChange={setShowRoadsOverlay} />
            <LayerSwitch icon={Sparkles} label="Netteté renforcée" detail="Contraste de l'imagerie" checked={sharpnessHD} onChange={setSharpnessHD} />

            <div className="grid grid-cols-2 gap-2 pt-3 px-1">
              {canDrawAndManageParcels && (
                <button
                  onClick={() => { handleToggleMeasuring(); setShowMobileGisMenu(false); }}
                  className="col-span-2 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Ruler className="w-4 h-4 text-slate-500" />
                  <span>{isMeasuring ? 'Quitter la mesure' : 'Mesurer une zone (latte)'}</span>
                </button>
              )}
              <button
                onClick={() => { setShowLegendDrawer(true); setShowMobileGisMenu(false); }}
                className="h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <Palette className="w-4 h-4 text-slate-500" />
                <span>Légende</span>
              </button>
              <button
                onClick={() => { handleLocateMe(); setShowMobileGisMenu(false); }}
                className="h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <LocateFixed className="w-4 h-4 text-slate-500" />
                <span>Ma position</span>
              </button>
              <button
                onClick={() => { handleExportMapHD(); setShowMobileGisMenu(false); }}
                disabled={isExporting}
                className="col-span-2 h-10 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Exporter la carte (image HD)</span>
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

      {/* GPS / on-map parcel tracing bar */}
      {isDrawing && canDrawAndManageParcels && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1150] w-[calc(100%-24px)] sm:w-auto sm:min-w-[520px] max-w-2xl bg-white text-slate-800 border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,37,64,0.35)] p-3 animate-in fade-in slide-in-from-top-2 duration-200 select-none" role="region" aria-label="Tracé d'une parcelle">
          <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="font-semibold text-[14px] text-slate-900 truncate">Tracé d&apos;une parcelle</span>
              <span className="text-[12px] text-slate-500 tabular-nums flex-shrink-0">
                {drawnPoints.length} borne{drawnPoints.length > 1 ? 's' : ''}
              </span>
            </div>
            {drawnMetrics && drawnPoints.length >= 3 && (
              <div className="flex items-center gap-3 text-[12px] tabular-nums flex-shrink-0">
                <span className="font-semibold text-slate-900">{drawnMetrics.areaHa} ha</span>
                <span className="text-slate-500 hidden sm:inline">Périmètre {Math.round(drawnMetrics.perimeterM)} m</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <button
              onClick={handleAddCurrentGpsPoint}
              disabled={isGpsAcquiring}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-1"
              title="Poser une borne à votre position GPS actuelle"
            >
              {isGpsAcquiring ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <LocateFixed className="w-4 h-4 text-slate-500" />}
              <span className="truncate">
                {isGpsAcquiring ? 'Recherche GPS…' : effectiveUserLocation ? `Borne ${drawnPoints.length + 1} au GPS` : 'Activer le GPS'}
              </span>
            </button>

            <button
              onClick={handleAddCenterPoint}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-1"
              title="Poser une borne au centre du viseur"
            >
              <Crosshair className="w-4 h-4 text-slate-500" />
              <span className="truncate">Borne {drawnPoints.length + 1} au viseur</span>
            </button>

            <button
              onClick={handleUndoDrawnPoint}
              disabled={drawnPoints.length === 0}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Retirer la dernière borne posée"
              aria-label="Retirer la dernière borne"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={handleCancelDrawing}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Quitter le tracé sans enregistrer"
            >
              Annuler
            </button>

            <button
              onClick={handleFinishDrawing}
              disabled={drawnPoints.length < 3}
              className="h-9 px-3.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              title="Terminer le tracé et créer la parcelle"
            >
              <Check className="w-4 h-4" />
              <span>Valider</span>
            </button>
          </div>

          <div className="mt-2 text-[12px] text-slate-500 flex items-center justify-between gap-2">
            <span className="truncate">
              {lastMarkedInfo || 'Posez les bornes au GPS, au viseur, ou en touchant la carte.'}
            </span>
            {locationAccuracy && (
              <span className="tabular-nums text-slate-600 flex-shrink-0">GPS ±{Math.round(locationAccuracy)} m</span>
            )}
          </div>
        </div>
      )}

      {/* Concession perimeter editing bar (Admin only) */}
      {isEditingConcession && isAdmin && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1150] w-[calc(100%-24px)] sm:w-auto sm:min-w-[520px] max-w-2xl bg-white text-slate-800 border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,37,64,0.35)] p-3 animate-in fade-in slide-in-from-top-2 duration-200 select-none" role="region" aria-label="Édition du périmètre de la concession">
          <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="font-semibold text-[14px] text-slate-900 truncate">Édition du périmètre</span>
              <span className="text-[12px] text-slate-500 tabular-nums flex-shrink-0">{activeConcessionRing.length} bornes</span>
            </div>
            {editingConcessionMetrics && (
              <div className="flex items-center gap-3 text-[12px] tabular-nums flex-shrink-0">
                <span className="font-semibold text-slate-900">{editingConcessionMetrics.areaHa} ha</span>
                <span className="text-slate-500 hidden sm:inline">Périmètre {editingConcessionMetrics.perimeterKm} km</span>
              </div>
            )}
          </div>

          <p className="text-[12px] text-slate-600 mb-3">
            Faites glisser les bornes orange P1 à P{activeConcessionRing.length} pour les ajuster, ou touchez une borne pour voir son altitude.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button onClick={handleCancelConcessionEditing} className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              Annuler
            </button>
            <button onClick={handleSaveConcessionEditing} className="h-9 px-3.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
              <Save className="w-4 h-4" />
              <span>Enregistrer le périmètre</span>
            </button>
          </div>
        </div>
      )}

      {/* Perimeter borne details: altitude, coordinates, admin calibration */}
      {inspectedBorne && canViewAndInspectBornes && (
        <div
          className="fixed inset-0 z-[1200] bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInspectedBorne(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="borne-inspect-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-slate-800 w-full max-w-md rounded-xl border border-slate-200 shadow-[0_20px_48px_-12px_rgba(15,37,64,0.45)] overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-[13px] tabular-nums">
                  P{inspectedBorne.number}
                </span>
                <div>
                  <h3 id="borne-inspect-title" className="font-semibold text-[15px] text-slate-900">Borne du périmètre P{inspectedBorne.number}</h3>
                  <p className="text-[12px] text-slate-500">Concession Manuel Joaquim d&apos;Oliveira</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedBorne(null)}
                className="p-1.5 -mr-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-[12px] text-slate-500 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Mountain className="w-4 h-4 text-slate-400" />
                    Altitude
                  </span>
                  <span>Modèle SRTM 90 m</span>
                </div>
                {inspectedBorne.isLoadingAltitude ? (
                  <div className="flex items-center gap-2 py-1 text-slate-500 text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mesure en cours…</span>
                  </div>
                ) : inspectedBorne.altitude !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-slate-900 tabular-nums">{inspectedBorne.altitude} m</span>
                    <span className="text-[12px] text-slate-500">au-dessus du niveau de la mer</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-slate-500">Altitude indisponible pour ce point.</span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200 text-[12px]">
                <div className="bg-white p-3">
                  <dt className="text-slate-500 mb-0.5">Latitude</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900">{inspectedBorne.lat.toFixed(7)}°</dd>
                  <dd className="font-mono text-[11px] text-slate-500 mt-0.5">{ddToDms(inspectedBorne.lat, true)}</dd>
                </div>
                <div className="bg-white p-3">
                  <dt className="text-slate-500 mb-0.5">Longitude</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900">{inspectedBorne.lng.toFixed(7)}°</dd>
                  <dd className="font-mono text-[11px] text-slate-500 mt-0.5">{ddToDms(inspectedBorne.lng, false)}</dd>
                </div>
              </dl>

              {isAdmin ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-900">Repositionner la borne</span>
                    <button
                      onClick={() => setInspectedBorne((prev) => ({ ...prev, isEditingManual: !prev.isEditingManual }))}
                      className="text-[12px] font-medium text-brand-600 hover:text-brand-800 cursor-pointer"
                    >
                      {inspectedBorne.isEditingManual ? 'Annuler la saisie' : 'Saisir les coordonnées'}
                    </button>
                  </div>

                  {inspectedBorne.isEditingManual ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[11px] text-slate-500 mb-1">Latitude (degrés décimaux)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={inspectedBorne.manualLat}
                            onChange={(e) => setInspectedBorne((prev) => ({ ...prev, manualLat: e.target.value }))}
                            className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-[13px] font-mono text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            placeholder="-5.8988"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[11px] text-slate-500 mb-1">Longitude (degrés décimaux)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={inspectedBorne.manualLng}
                            onChange={(e) => setInspectedBorne((prev) => ({ ...prev, manualLng: e.target.value }))}
                            className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-[13px] font-mono text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            placeholder="12.3375"
                          />
                        </label>
                      </div>
                      <button
                        onClick={() => handleSaveManualCoordinates(inspectedBorne.manualLat, inspectedBorne.manualLng)}
                        className="w-full h-9 bg-brand-700 hover:bg-brand-800 text-white font-semibold text-[13px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Repositionner la borne</span>
                      </button>
                    </div>
                  ) : isEditingConcession ? (
                    <p className="text-[12px] text-slate-600">Le mode édition est actif : faites glisser la borne sur la carte.</p>
                  ) : (
                    <button
                      onClick={handleStartConcessionEditing}
                      className="w-full h-9 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PenTool className="w-4 h-4 text-slate-500" />
                      <span>Déplacer sur la carte</span>
                    </button>
                  )}

                  {isEditingConcession && activeConcessionRing.length > 3 && (
                    <button
                      onClick={() => handleDeleteConcessionBorne(inspectedBorne.index)}
                      className="text-rose-700 hover:text-rose-800 text-[12px] font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Retirer cette borne du tracé</span>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">Seul l&apos;administrateur peut déplacer les bornes du périmètre.</p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setInspectedBorne(null)}
                className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg text-[13px] font-medium cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop map toolbar: Carte / Édition / Outils */}
      <div ref={toolbarRef} className="hidden md:block absolute top-3 left-3 z-[1000] select-none">
        <div className="flex flex-col gap-0.5 p-1 bg-white rounded-xl border border-slate-200 shadow-[0_4px_14px_-4px_rgba(15,37,64,0.3)]">
          <ToolButton
            icon={MapIcon}
            label="Fond de carte"
            active={openMapPanel === 'basemap'}
            onClick={() => setOpenMapPanel(openMapPanel === 'basemap' ? null : 'basemap')}
          />
          <ToolButton
            icon={Layers}
            label="Calques & légende"
            active={openMapPanel === 'layers'}
            onClick={() => setOpenMapPanel(openMapPanel === 'layers' ? null : 'layers')}
          />

          {canDrawAndManageParcels && (
            <>
              <div className="h-px bg-slate-200 mx-1.5 my-1" />
              {!isDrawing ? (
                <ToolButton icon={Pencil} label="Tracer une parcelle" onClick={handleStartDrawing} />
              ) : (
                <>
                  <ToolButton icon={Check} label="Valider le tracé" onClick={handleFinishDrawing} disabled={drawnPoints.length < 3} active={drawnPoints.length >= 3} />
                  <ToolButton icon={X} label="Annuler le tracé" onClick={handleCancelDrawing} />
                </>
              )}
              <ToolButton icon={Ruler} label={isMeasuring ? 'Quitter la mesure' : 'Mesurer une zone (latte)'} active={isMeasuring} onClick={handleToggleMeasuring} />
              {isAdmin && (
                <ToolButton
                  icon={PenTool}
                  label={isEditingConcession ? 'Quitter l’édition du périmètre' : 'Éditer le périmètre'}
                  active={isEditingConcession}
                  onClick={() => (isEditingConcession ? handleCancelConcessionEditing() : handleStartConcessionEditing())}
                />
              )}
            </>
          )}

          <div className="h-px bg-slate-200 mx-1.5 my-1" />
          <ToolButton icon={LocateFixed} label="Ma position GPS" onClick={handleLocateMe} />
          <ToolButton icon={Download} label="Exporter la carte (image HD)" onClick={handleExportMapHD} disabled={isExporting} busy={isExporting} />
        </div>

        {openMapPanel === 'basemap' && (
          <MapPanel title="Fond de carte" onClose={() => setOpenMapPanel(null)} className="absolute top-0 left-full ml-2 w-64">
            <BasemapList value={mapType} onChange={(id) => { setMapType(id); setOpenMapPanel(null); }} />
          </MapPanel>
        )}

        {openMapPanel === 'layers' && (
          <MapPanel title="Calques & légende" onClose={() => setOpenMapPanel(null)} className="absolute top-0 left-full ml-2 w-72 max-h-[calc(100vh-160px)] overflow-y-auto">
            <LayerSwitch icon={Waves} label="Zonage littoral" detail="Bandes de distance à l'océan" checked={showOceanZones} onChange={setShowOceanZones} />
            <LayerSwitch icon={Hexagon} label="Périmètre de la concession" detail="5 310 ha" checked={showConcession} onChange={setShowConcession} />
            {canViewAndInspectBornes && (
              <LayerSwitch icon={MapPin} label="Bornes du périmètre" detail="P1 à P32, avec altitude" checked={showConcessionBornes} onChange={setShowConcessionBornes} />
            )}
            <LayerSwitch icon={Route} label="Routes" checked={showRoadsOverlay} onChange={setShowRoadsOverlay} />
            <LayerSwitch icon={Sparkles} label="Netteté renforcée" detail="Contraste de l'imagerie" checked={sharpnessHD} onChange={setSharpnessHD} />
            <div className="h-px bg-slate-100 my-2" />
            <MapLegend />
          </MapPanel>
        )}
      </div>

      {/* Mobile legend card (opened from the bottom sheet) */}
      {showLegendDrawer && (
        <div className="md:hidden absolute top-3 inset-x-3 z-[1010]">
          <MapPanel title="Légende" onClose={() => setShowLegendDrawer(false)} className="max-h-[70vh] overflow-y-auto">
            <MapLegend />
          </MapPanel>
        </div>
      )}

      {/* Imagery loading indicator */}
      {isTilesLoading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none animate-in fade-in duration-200 hidden sm:block">
          <div className="glass-pill h-8 px-3 rounded-full text-xs font-medium text-slate-600 flex items-center gap-2 shadow-[0_4px_14px_-4px_rgba(15,37,64,0.3)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            <span>Chargement de l&apos;imagerie…</span>
          </div>
        </div>
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
            interactive={!isDrawing && !isEditingConcession && !isMeasuring}
            pathOptions={{
              color: isEditingConcession ? '#EA580C' : '#D97706',
              weight: isEditingConcession ? 3.5 : 2.5,
              dashArray: isEditingConcession ? '4, 4' : '6, 6',
              fillColor: isEditingConcession ? '#EA580C' : '#D97706',
              fillOpacity: isEditingConcession ? 0.08 : 0.04
            }}
          >
            {!isDrawing && !isEditingConcession && (
              <Tooltip direction="top" className="text-[11px] font-medium">
                Concession Manuel Joaquim d'Oliveira (5 310,21 ha)
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
            interactive={!isDrawing && !isMeasuring}
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
            interactive={!isDrawing && !isMeasuring}
            pathOptions={{
              color: zone.strokeColor,
              weight: 1.5,
              dashArray: '4, 4',
              fillColor: zone.color,
              // Background context: kept light so parcels stay the subject
              fillOpacity: zone.fillOpacity * 0.45
            }}
          >
            {!isDrawing && (
              <>
                <Tooltip direction="center" className="text-[11px] font-medium">
                  {zone.shortName} • {zone.formattedArea}
                </Tooltip>
                <Popup>
                  <div className="space-y-1.5 text-[12px] font-sans text-slate-700 min-w-[200px]">
                    <div className="flex items-center gap-2 font-semibold text-[13px] text-slate-900">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.strokeColor }} />
                      {zone.name}
                    </div>
                    <div className="text-slate-600 leading-relaxed">{zone.description}</div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500">Superficie</span>
                      <strong className="tabular-nums text-slate-900">{zone.formattedArea}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Distance du rivage</span>
                      <strong className="tabular-nums text-slate-900">{zone.range}</strong>
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
              interactive={!isDrawing && !isMeasuring}
              pathOptions={{
                color: line.color,
                weight: line.weight,
                dashArray: line.dashArray
              }}
            >
              {!isDrawing && (
                <Tooltip direction="top" className="text-[11px] font-medium">
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
              interactive={!isDrawing && !isMeasuring}
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
                  {isIsetechMain && activeView === 'global' && (
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
                  )}

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

        {isMeasuring && <MeasureLayer points={measurePoints} onChange={setMeasurePoints} />}

        {/* Bornes of the selected parcel (draggable by Admin only) */}
        {!isDrawing && !isEditingConcession && !isMeasuring && displayedParcelBornes.map((pt, i) => (
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

        {/* Admin: live position and trail of the arpenteurs */}
        {isAdmin && liveSurveyors.length > 0 && <LiveSurveyorsLayer surveyors={liveSurveyors} focus={surveyorFocus} />}
      </MapContainer>

      {isAdmin && <LiveSurveyorsPanel surveyors={liveSurveyors} onFocus={setSurveyorFocus} />}

      {isMeasuring && (
        <MeasurePanel
          points={measurePoints}
          settings={measureSettings}
          onSettingsChange={setMeasureSettings}
          onUndo={() => setMeasurePoints((prev) => prev.slice(0, -1))}
          onClear={() => setMeasurePoints([])}
          onClose={handleToggleMeasuring}
          onPrint={() => setShowMeasureSheet(true)}
          onCreateParcel={handleMeasureToParcel}
          canCreateParcel={!!onOpenCreateFormWithPoints}
        />
      )}

      {showMeasureSheet && measurePoints.length >= 3 && (
        <MeasureSheet
          points={measurePoints}
          settings={measureSettings}
          concessionPolygon={concessionPolygon}
          authorLabel={isAdmin ? 'Administrateur' : 'Arpenteur Géomètre'}
          onClose={() => setShowMeasureSheet(false)}
        />
      )}

      <BorneMoveConfirmModal
        move={pendingBorneMove}
        onConfirm={handleConfirmBorneMove}
        onCancel={handleCancelBorneMove}
      />
    </div>
  );
}
