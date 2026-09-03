import React, { useState } from 'react';
import { Plus, Download, Upload, RefreshCw, FileCode, FileCode2, MoreVertical, ChevronDown, Eye, ShieldCheck, Lock, Cloud, Trash2 } from 'lucide-react';
import { exportParcelsToGeoJSON, calculateArea } from '../utils/geoUtils';

export default function Navbar({
  onOpenCreateForm,
  onOpenKmlImporter,
  onOpenKmlParcelImporter,
  onOpenGeoJsonImporter,
  parcels,
  concessionPolygon,
  onResetData,
  onClearAllData,
  isVisitorMode,
  onToggleVisitorMode,
  onOpenSupabaseModal
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
    <header className="bg-slate-900 border-b border-slate-800 text-white h-14 px-3 flex items-center justify-between sticky top-0 z-[1100] shadow-md select-none">
      {/* Brand & Domaine Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow-xs">
          🛡️
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xs sm:text-sm text-slate-100 tracking-tight truncate">
              Concession Manuel Joaquim d'Oliveira
            </h1>
            <span className="hidden lg:inline-flex text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
              SIG Foncier
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium truncate">
            Muanda / Kongo Central / RDC • {concessionArea.formattedHa}
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

      {/* Role Switcher, Supabase Cloud & Action Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Supabase Cloud Storage Badge Button */}
        <button
          onClick={onOpenSupabaseModal}
          className="px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-900/60 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          title="Stockage Cloud Supabase Actif"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-mono">Supabase</span>
        </button>

        {/* Role Access Mode Switcher Button */}
        <button
          onClick={onToggleVisitorMode}
          className={`px-2.5 py-1 rounded-md border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            isVisitorMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
          title={isVisitorMode ? "Basculer en Mode Administrateur" : "Basculer en Mode Visiteur"}
        >
          {isVisitorMode ? (
            <>
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Visiteur</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Admin</span>
            </>
          )}
        </button>

        {/* Creation/Modification Controls (Hidden in Visitor Read-Only Mode) */}
        {!isVisitorMode && (
          <>
            <button
              onClick={onOpenCreateForm}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Ajouter une nouvelle parcelle"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle Parcelle</span>
            </button>

            <button
              onClick={onOpenGeoJsonImporter}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Importer un fichier GeoJSON"
            >
              <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Importer GeoJSON</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                title="Options & Imports"
              >
                <span>Options</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showToolsDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded shadow-xl p-1 z-[1200] space-y-0.5 text-xs font-sans">
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
                    onClick={() => { handleExportGeoJSON(); setShowToolsDropdown(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 rounded flex items-center gap-2 font-medium"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" /> Exporter GeoJSON
                  </button>

                  <div className="border-t border-slate-800 my-1 pt-1 space-y-0.5">
                    <button
                      onClick={() => { onClearAllData(); setShowToolsDropdown(false); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-rose-950/60 text-rose-400 rounded flex items-center gap-2 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Supprimer TOUTES les parcelles
                    </button>
                    <button
                      onClick={() => { onResetData(); setShowToolsDropdown(false); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 rounded flex items-center gap-2 font-medium"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> Recharger Données Démo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
