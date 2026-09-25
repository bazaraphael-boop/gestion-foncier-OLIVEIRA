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
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  if (!userLocation || !Array.isArray(userLocation) || userLocation.length < 2 || typeof userLocation[0] !== 'number' || typeof userLocation[1] !== 'number') {
    return null;
  }

  const [lat, lng] = userLocation;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg select-none z-[1050] transition-all animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-7xl mx-auto">
        {/* Mobile View: Ultra-Compact One-Liner (36px) */}
        <div className="flex md:hidden items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex-shrink-0">
              <Navigation className="w-3 h-3 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            </div>

            {locationZoneInfo ? (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold border truncate"
                style={{
                  backgroundColor: `${locationZoneInfo.color}25`,
                  borderColor: `${locationZoneInfo.color}60`,
                  color: locationZoneInfo.color
                }}
              >
                {locationZoneInfo.shortName || locationZoneInfo.zoneName} ({locationZoneInfo.distanceFormatted})
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">
                {lat.toFixed(4)}°, {lng.toFixed(4)}°
              </span>
            )}

            {locationAccuracy && (
              <span className="text-[10px] font-mono text-cyan-400/80 flex-shrink-0">
                ±{Math.round(locationAccuracy)}m
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onRecenter}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg border border-slate-700 active:scale-90 transition-transform cursor-pointer"
              title="Recentrer la carte sur ma position"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/80 rounded-lg border border-slate-700 active:scale-90 transition-transform cursor-pointer"
              title={isMobileExpanded ? 'Réduire' : 'Détails GPS'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileExpanded ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Fermer le suivi GPS"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Accordion Details (Expanded) */}
        {isMobileExpanded && (
          <div className="md:hidden mt-2 pt-2 border-t border-slate-800 flex flex-col gap-2 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Coordonnées : <strong className="text-white">{lat.toFixed(5)}°, {lng.toFixed(5)}°</strong></span>
              {isSimulated && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold">
                  Simulation
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {isInConcession ? (
                <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Dans Concession
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <ShieldAlert className="w-3 h-3" /> Hors Concession
                </span>
              )}
              {isInIsetech && (
                <span className="text-[10px] bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <Layers3 className="w-3 h-3" /> Zone ISETECH
                </span>
              )}
              {locatedParcel && (
                <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                  <Tag className="w-3 h-3" /> Lot : {locatedParcel.properties?.lotNumber || locatedParcel.id}
                </span>
              )}
            </div>

            {onSimulate && (
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                <span className="text-[10px] text-slate-400 font-medium">Test Zone :</span>
                {['UP', 'A', 'B', 'C', 'D'].map((z) => (
                  <button
                    key={z}
                    onClick={() => { onSimulate(z); }}
                    className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-200 hover:bg-slate-700 active:scale-95"
                  >
                    {z}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Desktop View (Full Spacious Row) */}
        <div className="hidden md:flex items-center justify-between gap-3 text-xs">
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

            {isInIsetech && (
              <div className="px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1">
                <Layers3 className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span>Zone ISETECH (1 002 ha)</span>
              </div>
            )}

            {locatedParcel && (
              <div className="px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span>Lot : {locatedParcel.properties?.lotNumber || locatedParcel.id}</span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRecenter}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Recentrer la carte sur votre position GPS"
            >
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Recentrer</span>
            </button>

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
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                      Simuler une Position
                    </div>
                    <button
                      onClick={() => { onSimulate('UP'); setShowSimMenu(false); }}
                      className="w-full text-left px-2 py-1 hover:bg-slate-800 text-rose-300 rounded flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Utilité Publique (50 m)</span>
                    </button>
                    <button
                      onClick={() => { onSimulate('A'); setShowSimMenu(false); }}
                      className="w-full text-left px-2 py-1 hover:bg-slate-800 text-cyan-300 rounded flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span>Zone A (150 m)</span>
                    </button>
                    <button
                      onClick={() => { onSimulate('B'); setShowSimMenu(false); }}
                      className="w-full text-left px-2 py-1 hover:bg-slate-800 text-amber-300 rounded flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>Zone B (270 m)</span>
                    </button>
                    <button
                      onClick={() => { onSimulate('C'); setShowSimMenu(false); }}
                      className="w-full text-left px-2 py-1 hover:bg-slate-800 text-purple-300 rounded flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span>Zone C (510 m)</span>
                    </button>
                    <button
                      onClick={() => { onSimulate('D'); setShowSimMenu(false); }}
                      className="w-full text-left px-2 py-1 hover:bg-slate-800 text-emerald-300 rounded flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Zone D (ISETECH)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

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
    </div>
  );
}
