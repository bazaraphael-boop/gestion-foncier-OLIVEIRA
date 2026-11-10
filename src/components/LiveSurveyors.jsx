import React, { useEffect, useState } from 'react';
import { Polyline, Marker, Popup, Tooltip, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Radio, ChevronDown, ChevronUp, LocateFixed, Route, EyeOff, Users } from 'lucide-react';
import { formatMeters, gridDistance } from '../utils/geoUtils';

// Admin view of the arpenteurs' live positions (data from hooks/useSurveyorTracking.js)

const OFFLINE = '#94a3b8';

// Initials; a trailing number stays visible for accounts sharing a name ("Arpenteur Géomètre 2" -> A2)
const initialsOf = (name) => {
  const number = String(name || '').match(/\s(\d+)$/);
  if (number) return `${String(name).trim()[0].toUpperCase()}${number[1]}`.replace(/[^\p{L}\p{N}]/gu, '') || '?';
  return baseInitials(name);
};

const baseInitials = (name) =>
  String(name || '?')
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
    .replace(/[^\p{L}\p{N}]/gu, '') || '?';

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function sinceText(date) {
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s >= 86400) return `le ${date.toLocaleDateString('fr-FR')}`;
  return `à ${timeFmt.format(date)}`;
}

// Icons are cached: a new divIcon on every render makes Leaflet rebuild the marker
const iconCache = new Map();
function surveyorIcon(initials, online, onlineColor) {
  const key = `${initials}|${online}|${onlineColor}`;
  if (!iconCache.has(key)) {
    const color = online ? onlineColor : OFFLINE;
    iconCache.set(
      key,
      L.divIcon({
        className: 'live-surveyor-icon',
        html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
          ${online ? `<div style="position:absolute;inset:0;border-radius:9999px;background:${color}55;animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
          <div style="position:relative;width:18px;height:18px;border-radius:9999px;background:${color};border:1.5px solid #fff;box-shadow:0 1px 4px rgba(15,37,64,.45);color:#fff;font:700 8px/15px system-ui,sans-serif;text-align:center;">${initials}</div>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    );
  }
  return iconCache.get(key);
}

const trailLength = (trail) =>
  trail.reduce((sum, p, i) => (i === 0 ? 0 : sum + gridDistance([trail[i - 1][1], trail[i - 1][0]], [p[1], p[0]])), 0);

/** Inside <MapContainer>: today's trail and live marker of each arpenteur */
export function LiveSurveyorsLayer({ surveyors, focus, showTrails = true }) {
  const map = useMap();

  useEffect(() => {
    if (focus?.bounds) map.flyToBounds(focus.bounds, { padding: [70, 70], maxZoom: 17, duration: 0.8 });
    else if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
  }, [focus, map]);

  return surveyors.map((s) => (
    <React.Fragment key={s.userId}>
      {showTrails && s.trail.length > 1 && (
        <Polyline
          positions={s.trail}
          pathOptions={{ color: s.online ? s.color : OFFLINE, weight: 3, opacity: 0.85, dashArray: s.online ? null : '6 6' }}
        />
      )}
      {s.online && s.accuracy > 5 && (
        <Circle center={[s.lat, s.lng]} radius={s.accuracy} pathOptions={{ color: s.color, fillColor: s.color, fillOpacity: 0.1, weight: 1 }} />
      )}
      <Marker position={[s.lat, s.lng]} icon={surveyorIcon(initialsOf(s.name), s.online, s.color)} zIndexOffset={1000}>
        <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
          <span className="text-[11px] font-semibold">{s.name}</span>
        </Tooltip>
        <Popup>
          <div className="text-xs font-sans text-slate-900 min-w-[210px] space-y-1">
            <div className="font-semibold text-[13px]">{s.name}</div>
            <div className={s.online ? 'font-medium' : 'text-slate-500'} style={s.online ? { color: s.color } : undefined}>
              {s.online ? '● En direct' : '○ Hors ligne'} · mis à jour {sinceText(s.updatedAt)}
            </div>
            <div className="font-mono text-[11px] text-slate-600">
              {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
              {s.accuracy ? ` (±${Math.round(s.accuracy)} m)` : ''}
            </div>
            {s.trail.length > 1 && <div className="text-slate-600">Parcouru aujourd’hui : {formatMeters(trailLength(s.trail))}</div>}
          </div>
        </Popup>
      </Marker>
    </React.Fragment>
  ));
}

/** Floating list of the arpenteurs, outside the map */
export function LiveSurveyorsPanel({ surveyors, onFocus, showTrails = true, onToggleTrails }) {
  // Folded by default on a phone: the open list would hide half the map
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches);
  const [, setTick] = useState(0);

  // Refreshes the "il y a 12 s" texts
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  if (!surveyors.length) return null;
  const onlineCount = surveyors.filter((s) => s.online).length;

  return (
    <div className="absolute bottom-14 left-3 z-[1000] w-64 max-w-[calc(100%-24px)] bg-white border border-slate-200 rounded-xl shadow-[0_8px_24px_-8px_rgba(15,37,64,0.35)] text-[12.5px] text-slate-800 select-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full h-9 px-3 flex items-center gap-2 cursor-pointer"
      >
        <Radio className={`w-4 h-4 ${onlineCount ? 'text-orange-600' : 'text-slate-400'}`} />
        <span className="font-semibold">Arpenteurs</span>
        <span className="text-slate-500">{onlineCount} en direct</span>
        {open ? <ChevronDown className="w-4 h-4 ml-auto text-slate-400" /> : <ChevronUp className="w-4 h-4 ml-auto text-slate-400" />}
      </button>
      {open && (
        <ul className="border-t border-slate-100 max-h-32 md:max-h-48 overflow-y-auto overscroll-contain py-1">
          {surveyors.map((s) => (
            <li key={s.userId}>
              <button
                type="button"
                onClick={() => onFocus({ lat: s.lat, lng: s.lng, at: Date.now() })}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-slate-50 cursor-pointer"
                title="Centrer la carte sur l’arpenteur"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.online ? s.color : OFFLINE }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {s.online ? 'En direct' : 'Hors ligne'} · {sinceText(s.updatedAt)}
                  </span>
                </span>
                <LocateFixed className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && surveyors.length > 1 && (
        <button
          type="button"
          onClick={() => onFocus({ bounds: surveyors.map((s) => [s.lat, s.lng]), at: Date.now() })}
          className="w-full h-9 px-3 border-t border-slate-100 flex items-center gap-2 text-left text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <Users className="w-4 h-4 text-slate-500" /> Voir tous les arpenteurs
        </button>
      )}
      {open && onToggleTrails && (
        <button
          type="button"
          onClick={onToggleTrails}
          aria-pressed={showTrails}
          className="w-full h-9 px-3 border-t border-slate-100 flex items-center gap-2 text-left text-slate-700 hover:bg-slate-50 rounded-b-xl cursor-pointer"
        >
          {showTrails ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Route className="w-4 h-4 text-orange-600" />}
          {showTrails ? 'Masquer les trajets' : 'Afficher les trajets'}
        </button>
      )}
    </div>
  );
}
