import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Download,
  Upload,
  RefreshCw,
  FileCode,
  FileCode2,
  ChevronDown,
  ShieldCheck,
  Cloud,
  Trash2,
  LogOut,
  Key,
  Navigation,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
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
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showToolsDropdown) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowToolsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showToolsDropdown]);

  const handleExportGeoJSON = () => {
    const geojsonStr = exportParcelsToGeoJSON(parcels);
    const blob = new Blob([geojsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cadastre_Concession_Manuel_Joaquim_dOliveira_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
  };

  const concessionArea = concessionPolygon ? calculateArea(concessionPolygon) : { hectares: 5326.15, formattedHa: '5 326,15 ha' };
  const totalConcessionHa = (concessionArea && concessionArea.hectares) ? concessionArea.hectares : 5326.15;

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
    <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 text-white w-full sticky top-0 z-[1100] shadow-md select-none pt-[env(safe-area-inset-top,0px)]">
      <div className="h-13 sm:h-14 px-3 sm:px-5 flex items-center justify-between gap-3">
        {/* Brand & Domaine Title - Respirant et lisible */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white flex-shrink-0 shadow-sm border border-emerald-400/30">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-50" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-xs sm:text-sm text-slate-100 tracking-tight whitespace-nowrap">
                <span className="sm:hidden">Concession Oliveira</span>
                <span className="hidden sm:inline">Concession Manuel Joaquim d'Oliveira</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>Admin</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-slate-400 font-medium">
              <span className="font-mono text-slate-400">MUANDA / RDC</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-emerald-400 font-medium">{concessionArea.formattedHa}</span>
            </div>
          </div>
        </div>

        {/* Statut Concession Discret (affiché uniquement sur très grands écrans) */}
        <div className="hidden 2xl:flex items-center gap-2.5 px-3 py-1 rounded-full bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Disponible : <strong className="text-emerald-300 font-mono font-medium">{availableHa.toFixed(0)} ha ({availablePct}%)</strong></span>
          <span className="text-slate-700">•</span>
          <span>Occupé : <strong className="text-rose-300 font-mono font-medium">{occupiedHa.toFixed(0)} ha ({occupiedPct}%)</strong></span>
        </div>

        {/* Actions Hiérarchisées & Épurées */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Action Primaire Unique : Nouvelle Parcelle */}
          <button
            onClick={onOpenCreateForm}
            className="px-2.5 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-950/40 cursor-pointer"
            title="Ajouter une nouvelle parcelle au cadastre"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle Parcelle</span>
          </button>

          {/* Outil Rapide : Localiser GPS */}
          {onToggleLocation && (
            <button
              onClick={onToggleLocation}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                isLocating
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-xs shadow-cyan-900/30'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title={isLocating ? 'Désactiver le suivi GPS' : 'Activer la géolocalisation GPS en direct'}
            >
              <div className="relative flex items-center justify-center">
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                {isLocating && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                )}
              </div>
              <span className="hidden md:inline font-sans">
                {isLocating && locationZoneInfo ? locationZoneInfo.shortName : 'Localiser'}
              </span>
            </button>
          )}

          {/* Outil Rapide : Actualiser Cloud (Bouton icône compact) */}
          {onSync && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-slate-700 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50`}
              title="Synchroniser immédiatement avec la base Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-300' : 'text-emerald-400'}`} />
            </button>
          )}

          {/* Menu Outils Unifié & Structuré */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
              className={`px-2 sm:px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                showToolsDropdown ? 'border-slate-600 bg-slate-800 text-white' : ''
              }`}
              title="Outils, imports et configuration système"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Outils</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${showToolsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showToolsDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900/95 backdrop-blur-lg border border-slate-700/80 rounded-xl shadow-2xl p-1.5 z-[1200] text-xs font-sans animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Section Données & Fichiers */}
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Données &amp; Fichiers
                </div>
                <button
                  onClick={() => { onOpenGeoJsonImporter(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-cyan-300 hover:text-cyan-200 rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4 text-cyan-400" />
                  <span>Importer GeoJSON</span>
                </button>
                <button
                  onClick={() => { onOpenKmlParcelImporter(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-emerald-300 hover:text-emerald-200 rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>Importer Parcelles KML</span>
                </button>
                <button
                  onClick={() => { onOpenKmlImporter(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-slate-200 hover:text-white rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Importer Périmètre KML</span>
                </button>
                <button
                  onClick={() => { handleExportGeoJSON(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-slate-200 hover:text-white rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span>Exporter le Cadastre (GeoJSON)</span>
                </button>

                {/* Section Système & Sécurité */}
                <div className="border-t border-slate-800/80 my-1 pt-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Système &amp; Sécurité
                </div>
                <button
                  onClick={() => { onOpenSecurityModal && onOpenSecurityModal(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-slate-200 hover:text-white rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Sécurité &amp; Mot de passe</span>
                </button>
                <button
                  onClick={() => { onOpenSupabaseModal(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-slate-200 hover:text-white rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <Cloud className="w-4 h-4 text-teal-400" />
                  <span>Configuration Cloud (Supabase)</span>
                </button>

                {/* Section Maintenance Cadastrale */}
                <div className="border-t border-slate-800/80 my-1 pt-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Maintenance
                </div>
                <button
                  onClick={() => { onResetConcession && onResetConcession(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-800/80 text-slate-300 hover:text-white rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  <span>Réinitialiser Tracé Périmètre</span>
                </button>
                <button
                  onClick={() => { onClearAllData(); setShowToolsDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Vider toutes les parcelles</span>
                </button>
              </div>
            )}
          </div>

          {/* Séparateur discret */}
          <div className="h-5 w-px bg-slate-800/90 hidden sm:block mx-0.5"></div>

          {/* Déconnexion Épurée & Discrète */}
          <button
            onClick={onLogout}
            className="p-1.5 sm:px-2.5 sm:py-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Fermer la session Administrateur"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
}


