import React, { useState } from 'react';
import { Navigation, MapPin, Waves, ShieldCheck, ShieldAlert, Crosshair, X, ChevronDown, Layers3, Tag } from 'lucide-react';

export default function AdminLocationHUD({
  userLocation,
  locationAccuracy,
  locationZoneInfo,
  isInConcession,
  isInIsetech,
  locatedParcel,
  isSimulated,
  onRecenter,
  onSimulate,
  onClose
}) {
  const [showSimMenu, setShowSimMenu] = useState(false);

  if (!userLocation) return null;

  const [lat, lng] = userLocation;

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-100 px-4 py-2.5 shadow-lg select-none z-[1050] transition-all animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-xs">
        
        {/* Left: GPS Position & Accuracy */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
            <Navigation className="w-3.5 h-3.5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <span>Position GPS Admin</span>
              {isSimulated && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                  Simulation
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Lat: <strong className="text-white">{lat.toFixed(5)}°</strong>, Lng: <strong className="text-white">{lng.toFixed(5)}°</strong>
              {locationAccuracy && (
                <span className="ml-1 text-slate-500">(±{Math.round(locationAccuracy)}m)</span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Coastal Zone & Land Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Coastal Zone Badge */}
          {locationZoneInfo ? (
            <div
              className="px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-semibold text-xs shadow-xs"
              style={{
                backgroundColor: `${locationZoneInfo.color}20`,
                borderColor: `${locationZoneInfo.color}60`,
                color: locationZoneInfo.color
              }}
            >
              <Waves className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{locationZoneInfo.zoneName}</span>
              <span className="opacity-50">•</span>
              <span className="font-mono font-bold text-white">{locationZoneInfo.distanceFormatted} de l'océan</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">
              Zone côtière indéterminée
            </div>
          )}

          {/* Concession Containment Badge */}
          {isInConcession ? (
            <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Dans Concession d'Oliveira</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Hors Concession</span>
            </div>
          )}

          {/* ISETECH Sub-cadastre Badge */}
          {isInIsetech && (
            <div className="px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1">
              <Layers3 className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <span>Zone ISETECH (1 002 ha)</span>
            </div>
          )}

          {/* Located Inside a Specific Parcel */}
          {locatedParcel && (
            <div className="px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-400 flex-shrink-0" />
              <span>Lot : {locatedParcel.properties?.lotNumber || locatedParcel.id}</span>
            </div>
          )}
        </div>

        {/* Right: Actions (Recenter, Simulator, Close) */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Recenter Button */}
          <button
            onClick={onRecenter}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Recentrer la carte sur votre position GPS"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Recentrer</span>
          </button>

          {/* Simulator Dropdown (Handy for testing zones A, B, C, D) */}
          {onSimulate && (
            <div className="relative">
              <button
                onClick={() => setShowSimMenu(!showSimMenu)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                title="Tester différentes positions dans les zones A, B, C, D"
              >
                <span>Tester Zone</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showSimMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded shadow-xl p-1 z-[1200] space-y-0.5 text-xs font-sans">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Simuler une Position
                  </div>
                  <button
                    onClick={() => { onSimulate('A'); setShowSimMenu(false); }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-800 text-cyan-300 rounded flex items-center gap-1.5 font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>Zone A (Plage • 70 m)</span>
                  </button>
                  <button
                    onClick={() => { onSimulate('B'); setShowSimMenu(false); }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-800 text-amber-300 rounded flex items-center gap-1.5 font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Zone B (270 m)</span>
                  </button>
                  <button
                    onClick={() => { onSimulate('C'); setShowSimMenu(false); }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-800 text-purple-300 rounded flex items-center gap-1.5 font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span>Zone C (510 m)</span>
                  </button>
                  <button
                    onClick={() => { onSimulate('D'); setShowSimMenu(false); }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-800 text-emerald-300 rounded flex items-center gap-1.5 font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Zone D (ISETECH • 1 775 m)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Close HUD */}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all cursor-pointer"
            title="Arrêter la géolocalisation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
