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
  RotateCcw,
  History,
  Pencil,
  PenTool,
  Menu
} from 'lucide-react';
import { exportParcelsToGeoJSON, calculateArea } from '../utils/geoUtils';

// Shared button vocabulary for the navy top bar
const GHOST_BTN =
  'h-9 px-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50';
const MENU_ITEM =
  'w-full text-left px-2.5 py-2 rounded-md flex items-center gap-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer';
const MENU_ICON = 'w-4 h-4 text-slate-400 flex-shrink-0';

export default function Navbar({
  onOpenCreateForm,
  onOpenKmlImporter,
  onOpenKmlParcelImporter,
  onOpenGeoJsonImporter,
  parcels,
  concessionPolygon,
  onResetConcession,
  onClearAllData,
  onOpenSupabaseModal,
  onOpenSecurityModal,
  onOpenAuditModal,
  onLogout,
  onSync,
  isSyncing,
  onToggleLocation,
  isLocating,
  locationZoneInfo,
  isArpenteur,
  onStartDrawing,
  onStartEditConcession,
  activeView,
  onSelectView
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
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowToolsDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
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

  const runAndClose = (fn) => () => {
    if (fn) fn();
    setShowToolsDropdown(false);
  };

  const views = [
    { id: 'global', label: 'Concession', short: 'Concession', detail: concessionArea.formattedHa },
    { id: 'isetech', label: 'Zone ISETECH', short: 'ISETECH', detail: '1 002,61 ha' }
  ];

  return (
    <header className="bg-brand-900 text-white w-full sticky top-0 z-[1100] select-none pt-[env(safe-area-inset-top,0px)] border-b border-white/10">
      <div className="h-14 px-3 sm:px-4 flex items-center gap-3">
        {/* Identity */}
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="font-semibold text-sm leading-tight truncate">
              <span className="lg:hidden">Concession Oliveira</span>
              <span className="hidden lg:inline">Concession Manuel Joaquim d&apos;Oliveira</span>
            </h1>
            <p className="text-[11px] leading-tight text-brand-200 truncate">
              Cadastre numérique • {isArpenteur ? 'Arpenteur géomètre' : 'Administrateur'}
            </p>
          </div>
        </div>

        {/* View switcher: whole concession or ISETECH sub-cadastre */}
        {onSelectView && (
          <div role="tablist" aria-label="Zone affichée" className="flex items-center p-0.5 rounded-lg bg-white/10 sm:ml-2 flex-shrink-0">
            {views.map((v) => {
              const isActive = activeView === v.id;
              return (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => !isActive && onSelectView(v.id)}
                  className={`h-8 px-3 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isActive ? 'bg-white text-brand-900 shadow-sm' : 'text-white/80 hover:text-white'
                  }`}
                  title={`${v.label} (${v.detail})`}
                >
                  <span className="md:hidden">{v.short}</span>
                  <span className="hidden md:inline">{v.label}</span>
                  <span className={`hidden xl:inline text-[11px] ${isActive ? 'text-slate-500' : 'text-white/55'}`}>{v.detail}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onOpenCreateForm}
            className="hidden sm:flex h-9 px-3.5 rounded-lg bg-white text-brand-900 hover:bg-brand-50 text-[13px] font-semibold items-center gap-1.5 transition-colors cursor-pointer mr-1"
            title="Ajouter une nouvelle parcelle au cadastre"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle parcelle</span>
          </button>

          {onStartDrawing && (
            <button onClick={onStartDrawing} className={`hidden sm:flex ${GHOST_BTN}`} title="Tracer une parcelle sur la carte ou au GPS">
              <Pencil className="w-4 h-4" />
              <span className="hidden lg:inline">Tracer</span>
            </button>
          )}

          {onToggleLocation && (
            <button
              onClick={onToggleLocation}
              className={`hidden sm:flex ${GHOST_BTN} ${isLocating ? 'bg-white/15 text-white' : ''}`}
              aria-pressed={!!isLocating}
              title={isLocating ? 'Désactiver le suivi GPS' : 'Activer la géolocalisation GPS en direct'}
            >
              <Navigation className="w-4 h-4" />
              <span className="hidden lg:inline">
                {isLocating && locationZoneInfo ? locationZoneInfo.shortName : 'Localiser'}
              </span>
            </button>
          )}

          {onSync && (
            <button onClick={onSync} disabled={isSyncing} className={GHOST_BTN} title="Synchroniser avec la base Cloud" aria-label="Synchroniser">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Tools menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
              className={`${GHOST_BTN} ${showToolsDropdown ? 'bg-white/15 text-white' : ''}`}
              aria-expanded={showToolsDropdown}
              aria-haspopup="menu"
              title="Imports, exports et administration"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Outils</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showToolsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showToolsDropdown && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-72 bg-white text-slate-800 border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,37,64,0.35)] p-1.5 z-[1200] animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-slate-400">Données</div>
                <button role="menuitem" onClick={runAndClose(onOpenGeoJsonImporter)} className={MENU_ITEM}>
                  <FileCode2 className={MENU_ICON} />
                  <span>Importer des parcelles (GeoJSON)</span>
                </button>
                <button role="menuitem" onClick={runAndClose(onOpenKmlParcelImporter)} className={MENU_ITEM}>
                  <FileCode className={MENU_ICON} />
                  <span>Importer des parcelles (KML)</span>
                </button>
                {!isArpenteur && (
                  <button role="menuitem" onClick={runAndClose(onOpenKmlImporter)} className={MENU_ITEM}>
                    <Upload className={MENU_ICON} />
                    <span>Importer le périmètre (KML)</span>
                  </button>
                )}
                <button role="menuitem" onClick={runAndClose(handleExportGeoJSON)} className={MENU_ITEM}>
                  <Download className={MENU_ICON} />
                  <span>Exporter le cadastre (GeoJSON)</span>
                </button>

                {!isArpenteur && (
                  <>
                    <div className="h-px bg-slate-100 my-1.5" />
                    <div className="px-2.5 pt-0.5 pb-1 text-[11px] font-semibold text-slate-400">Administration</div>
                    <button role="menuitem" onClick={runAndClose(onOpenAuditModal)} className={MENU_ITEM}>
                      <History className={MENU_ICON} />
                      <span>Journal d&apos;audit</span>
                    </button>
                    <button role="menuitem" onClick={runAndClose(onOpenSecurityModal)} className={MENU_ITEM}>
                      <Key className={MENU_ICON} />
                      <span>Mot de passe &amp; session</span>
                    </button>
                    <button role="menuitem" onClick={runAndClose(onOpenSupabaseModal)} className={MENU_ITEM}>
                      <Cloud className={MENU_ICON} />
                      <span>Configuration Cloud</span>
                    </button>

                    <div className="h-px bg-slate-100 my-1.5" />
                    <div className="px-2.5 pt-0.5 pb-1 text-[11px] font-semibold text-slate-400">Périmètre de la concession</div>
                    <button role="menuitem" onClick={runAndClose(onStartEditConcession)} className={MENU_ITEM}>
                      <PenTool className={MENU_ICON} />
                      <span>Éditer les bornes du périmètre</span>
                    </button>
                    <button role="menuitem" onClick={runAndClose(onResetConcession)} className={MENU_ITEM}>
                      <RotateCcw className={MENU_ICON} />
                      <span>Rétablir le tracé officiel</span>
                    </button>

                    <div className="h-px bg-slate-100 my-1.5" />
                    <button
                      role="menuitem"
                      onClick={runAndClose(onClearAllData)}
                      className="w-full text-left px-2.5 py-2 rounded-md flex items-center gap-2.5 text-[13px] font-medium text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span>Vider toutes les parcelles…</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-white/15 mx-1 hidden sm:block" />

          <button onClick={onLogout} className={GHOST_BTN} title="Se déconnecter" aria-label="Se déconnecter">
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
}
