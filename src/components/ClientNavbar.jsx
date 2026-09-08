import React from 'react';
import { LogOut, RefreshCw } from 'lucide-react';

export default function ClientNavbar({ onLogout, onSync, isSyncing }) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white h-14 px-3 flex items-center justify-between sticky top-0 z-[1100] shadow-md select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow-xs">
          🛡️
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xs sm:text-sm text-slate-100 tracking-tight truncate">
              Concession Manuel Joaquim d'Oliveira
            </h1>
            <span className="inline-flex text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
              Portail Client
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium truncate">
            Muanda / Kongo Central / RDC • Consultation Carte & Cadastre
          </span>
        </div>
      </div>

      {/* Sync and Logout Actions */}
      <div className="flex items-center gap-2">
        {onSync && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Rafraîchir les données en direct depuis la base Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        )}
        <button
          onClick={onLogout}
          className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Se déconnecter de la session client"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
