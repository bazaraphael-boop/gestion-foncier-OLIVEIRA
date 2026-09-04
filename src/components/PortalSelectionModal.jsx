import React from 'react';
import { ShieldCheck, Map, Lock, ChevronRight, UserCheck, Compass } from 'lucide-react';
import OfficialHeaderBanner from './OfficialHeaderBanner';

export default function PortalSelectionModal({ onSelectAdmin, onSelectClient }) {
  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 flex flex-col justify-between p-4 overflow-y-auto font-sans select-none antialiased">
      {/* Background Subtle Grid Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between py-2 text-slate-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            🛡️
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-tight">SIG Foncier - Muanda</h1>
            <span className="text-[10px] text-slate-400">RDC • Kongo Central</span>
          </div>
        </div>

        <div className="text-[11px] font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Système d'Accès Sécurisé</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto my-auto space-y-6">
        {/* Banner Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <OfficialHeaderBanner />

          <div className="p-6 text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              CONCESSION MANUEL JOAQUIM D'OLIVEIRA
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Système d'Information Géographique (SIG) & Cadastre Digitalisé de Muanda. Veuillez choisir votre portail d'accès.
            </p>
          </div>
        </div>

        {/* Two Entry Doors (Cards Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DOOR 1: CLIENT PORTAL */}
          <div
            onClick={onSelectClient}
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/60 p-6 rounded-xl shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Map className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Accès Consultation</span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  🗺️ Portail Client
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Consultez la carte satellite de la concession, les limites cadastrales, les zones attribuées et la légende interactive.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Entrer Code PIN 6 chiffres
              </span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* DOOR 2: ADMIN PORTAL */}
          <div
            onClick={onSelectAdmin}
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/60 p-6 rounded-xl shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Accès Réservé Direction</span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  🔐 Portail Administration
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gestion cadastrale complète, création/édition de parcelles, import GeoJSON/KML, statistiques et outils SIG.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-400">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Connexion Administrateur
              </span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto text-center py-3 text-[11px] text-slate-500 border-t border-slate-900">
        © 2026 Concession Manuel Joaquim d'Oliveira • Muanda, RDC • Contact: 089 11 00 000 | Bamakakidi@gmail.com
      </footer>
    </div>
  );
}
