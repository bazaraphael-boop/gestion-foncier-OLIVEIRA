import React, { useState } from 'react';
import { Plus, Download, Upload, RefreshCw, FileCode, FileCode2, MoreVertical, ChevronDown, Eye, ShieldCheck, Lock, Cloud, Trash2, LogOut, Key, Navigation } from 'lucide-react';
import { exportParcelsToGeoJSON, calculateArea } from '../utils/geoUtils';

export default function Navbar({
  onOpenCreateForm,
  onOpenKmlImporter,
  onOpenKmlParcelImporter,
  onOpenGeoJsonImporter,
  parcels,
  concessionPolygon,
  onResetConcession,
  onClearAllData,
  isVisitorMode,
  onToggleVisitorMode,
  onOpenSupabaseModal,
  onOpenSecurityModal,
  onLogout,
  onSync,
  isSyncing,
  onToggleLocation,
  isLocating,
  locationZoneInfo
}) {
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  const handleExportGeoJSON = () => {
    const geojsonStr = exportParcelsToGeoJSON(parcels);
    const blob = new Blob([geojsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cadastre_Concession_Manuel_Joaquim_dOliveira_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
  };

  const concessionArea = concessionPolygon ? calculateArea(concessionPolygon) : { hectares: 5404.80, formattedHa: '5 404,80 ha' };
  const totalConcessionHa = (concessionArea && concessionArea.hectares) ? concessionArea.hectares : 5404.80;

  let occupiedHa = 0;
  parcels.forEach((p) => {
    const area = p.properties.areaHa || calculateArea(p).hectares;
    if (p.properties.status === 'occupe') {
      occupiedHa += area;
    }
  });

  const availableHa = Math.max(0, totalConcessionHa - occupiedHa);
  const occupiedPct = totalConcessionHa > 0 ? ((occupiedHa / totalConcessionHa) * 100).toFixed(0) : '0';
  const availablePct = totalConcessionHa > 0 ? ((availableHa / totalConcessionHa) * 100).toFixed(0) : '0';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white h-12 sm:h-14 px-2.5 sm:px-3 flex items-center justify-between sticky top-0 z-[1100] shadow-md select-none">
      {/* Brand & Domaine Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-emerald-600 flex items-center justify-center font-bold text-white text-xs sm:text-sm flex-shrink-0 shadow-xs">
          🛡️
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-bold text-xs sm:text-sm text-slate-100 tracking-tight truncate">
              <span className="sm:hidden">Concession Oliveira</span>
              <span className="hidden sm:inline">Concession Manuel Joaquim d'Oliveira</span>
            </h1>
            <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded flex-shrink-0">
              Admin
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">
            Muanda / RDC • {concessionArea.formattedHa}
          </span>
        </div>
      </div>

      {/* Streamlined Key Metrics Bar */}
      <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60 text-xs font-sans">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-slate-400">Libre:</span>
          <strong className="text-emerald-400 font-semibold">{availableHa.toFixed(0)} ha ({availablePct}%)</strong>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          <span className="text-slate-400">Occupé:</span>
          <strong className="text-rose-400 font-semibold">{occupiedHa.toFixed(0)} ha ({occupiedPct}%)</strong>
        </div>
      </div>

      {/* Role Switcher & Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Creation/Modification Controls */}
        <button
          onClick={onOpenCreateForm}
          className="p-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          title="Ajouter une nouvelle parcelle"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle Parcelle</span>
        </button>

        {/* GPS Location Button for Admin */}
        {onToggleLocation && (
          <button
            onClick={onToggleLocation}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border ${
              isLocating
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-cyan-900/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isLocating ? 'Désactiver le suivi de localisation GPS' : 'Activer la géolocalisation GPS pour déterminer votre zone côtière'}
          >
            <div className="relative flex items-center justify-center">
              <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
              {isLocating && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              )}
            </div>
            <span className="hidden sm:inline font-sans">
              {isLocating && locationZoneInfo ? locationZoneInfo.shortName : 'Localiser'}
            </span>
          </button>
        )}

        <button
          onClick={onOpenGeoJsonImporter}
          className="hidden sm:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded text-xs font-semibold items-center gap-1.5 transition-all cursor-pointer"
          title="Importer un fichier GeoJSON"
        >
          <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Importer GeoJSON</span>
        </button>

        {/* Direct Sync Button */}
        {onSync && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              isSyncing ? 'opacity-70 cursor-wait' : ''
            }`}
            title="Synchroniser immédiatement avec la base de données Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-300' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Sync...' : 'Actualiser'}</span>
          </button>
        )}

        {/* Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowToolsDropdown(!showToolsDropdown)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            title="Options & Imports"
          >
            <span className="hidden sm:inline">Options</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showToolsDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded shadow-xl p-1 z-[1200] space-y-0.5 text-xs font-sans">
              <button
                onClick={() => { onOpenKmlParcelImporter(); setShowToolsDropdown(false); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-emerald-400 rounded flex items-center gap-2 font-medium"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" /> Importer Parcelles KML
              </button>
              <button
                onClick={() => { onOpenKmlImporter(); setShowToolsDropdown(false); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 rounded flex items-center gap-2 font-medium"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" /> Périmètre KML
              </button>
              <button
                onClick={() => { onOpenGeoJsonImporter(); setShowToolsDropdown(false); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-cyan-300 rounded flex items-center gap-2 font-medium"
              >
                <FileCode2 className="w-3.5 h-3.5 text-cyan-400" /> Importer GeoJSON
              </button>
              <button
                onClick={() => { handleExportGeoJSON(); setShowToolsDropdown(false); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 rounded flex items-center gap-2 font-medium"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" /> Exporter GeoJSON
              </button>

              <div className="border-t border-slate-800 my-1 pt-1 space-y-0.5">
                <button
                  onClick={() => { onOpenSecurityModal && onOpenSecurityModal(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-cyan-300 rounded flex items-center gap-2 font-medium"
                >
                  <Key className="w-3.5 h-3.5 text-cyan-400" /> Sécurité &amp; Mots de passe
                </button>
                <button
                  onClick={() => { onOpenSupabaseModal(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 rounded flex items-center gap-2 font-medium"
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" /> Configuration Cloud
                </button>
                <button
                  onClick={() => { onClearAllData(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-rose-950/60 text-rose-400 rounded flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Supprimer TOUTES les parcelles
                </button>
                <button
                  onClick={() => { onResetConcession && onResetConcession(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 rounded flex items-center gap-2 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> Réinitialiser Tracé Périmètre
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Déconnexion Button */}
        <button
          onClick={onLogout}
          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Fermer la session Administrateur"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}

