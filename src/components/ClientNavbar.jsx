import React from 'react';
import { LogOut, RefreshCw } from 'lucide-react';

export default function ClientNavbar({ onLogout, onSync, isSyncing }) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white w-full sticky top-0 z-[1100] shadow-md select-none pt-[env(safe-area-inset-top,0px)]">
      <div className="h-12 sm:h-14 px-2.5 sm:px-3 flex items-center justify-between">
        {/* Brand & Title */}
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
            <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded flex-shrink-0">
              <span className="sm:hidden">Client</span>
              <span className="hidden sm:inline">Portail Client</span>
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">
            <span className="sm:hidden">Muanda / RDC • Consultation</span>
            <span className="hidden sm:inline">Muanda / Kongo Central / RDC • Consultation Carte &amp; Cadastre</span>
          </span>
        </div>
      </div>

      {/* Sync and Logout Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {onSync && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Rafraîchir les données en direct depuis la base Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        )}
        <button
          onClick={onLogout}
          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Se déconnecter de la session client"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
      </div>
    </header>
  );
}
