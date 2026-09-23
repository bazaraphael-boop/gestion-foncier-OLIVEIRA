import React from 'react';
import { LogOut, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ClientNavbar({ onLogout, onSync, isSyncing }) {
  return (
    <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 text-white w-full sticky top-0 z-[1100] shadow-lg select-none pt-[env(safe-area-inset-top,0px)]">
      <div className="h-12 sm:h-14 px-3 sm:px-4 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-emerald-950/50 border border-emerald-400/30">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-50" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xs sm:text-sm text-slate-100 tracking-tight truncate">
                <span className="sm:hidden">Concession Oliveira</span>
                <span className="hidden sm:inline">Concession Manuel Joaquim d'Oliveira</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Portail Client</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">
              <span className="font-mono text-slate-400">MUANDA / RDC</span>
              <span className="text-slate-600">•</span>
              <span className="truncate">Consultation &amp; Cadastre Officiel</span>
            </div>
          </div>
        </div>

        {/* Sync and Logout Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {onSync && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              aria-label="Actualiser les données"
              className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-900/80 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer shadow-sm disabled:opacity-50"
              title="Rafraîchir les données en direct depuis la base Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-300' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          )}
          <button
            onClick={onLogout}
            aria-label="Se déconnecter"
            className="p-1.5 sm:px-3 sm:py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 hover:border-rose-600/60 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer shadow-sm"
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
