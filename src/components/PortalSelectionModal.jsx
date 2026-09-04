import React from 'react';
import { ShieldCheck, Map, Lock, ChevronRight, UserCheck, Compass, Phone, Mail, MapPin } from 'lucide-react';
import OfficialHeaderBanner from './OfficialHeaderBanner';

export default function PortalSelectionModal({ onSelectAdmin, onSelectClient }) {
  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto font-sans select-none antialiased">
      {/* Background Subtle Grid Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none"></div>

      {/* Top Bar Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between py-2 text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-emerald-950/50">
            🛡️
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-tight">SIG Foncier Cadastral</h1>
            <span className="text-[11px] text-slate-400 font-medium">République Démocratique du Congo • Kongo Central</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-[11px] font-mono text-slate-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Accès Sécurisé SSL / WGS84</span>
        </div>
      </header>

      {/* Main Center Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto my-auto py-6 space-y-6">
        {/* Official Header Banner Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Integrated Clean Official Banner */}
          <div className="bg-white overflow-hidden border-b border-slate-800">
            <OfficialHeaderBanner />
          </div>

          {/* Subheader Title */}
          <div className="p-5 sm:p-6 text-center space-y-2 bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" /> Portail d'Accès Officiel
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              CONCESSION MANUEL JOAQUIM D'OLIVEIRA
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto font-sans leading-relaxed">
              Système d'Information Géographique (SIG) & Cadastre Numérique de Muanda. Veuillez sélectionner votre portail d'accès.
            </p>
          </div>
        </div>

        {/* Two Entry Doors (Cards Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* DOOR 1: CLIENT PORTAL */}
          <div
            onClick={onSelectClient}
            className="group relative bg-gradient-to-b from-slate-900 to-slate-950 hover:from-slate-900 hover:to-slate-900 border border-slate-800 hover:border-emerald-500/60 p-6 sm:p-8 rounded-2xl shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:-translate-y-1 hover:shadow-emerald-950/20"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all shadow-inner">
                <Map className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                  <span>Espace Grand Public & Occupants</span>
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                  🗺️ Portail Client (Consultation)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Accès sécurisé par code PIN à 6 chiffres pour consulter la carte satellite HD, les limites de concession, les parcelles attribuées et la légende cadastrale.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Lock className="w-3.5 h-3.5" /> Entrer Code PIN (6 chiffres)
              </span>
              <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* DOOR 2: ADMIN PORTAL */}
          <div
            onClick={onSelectAdmin}
            className="group relative bg-gradient-to-b from-slate-900 to-slate-950 hover:from-slate-900 hover:to-slate-900 border border-slate-800 hover:border-cyan-500/60 p-6 sm:p-8 rounded-2xl shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:-translate-y-1 hover:shadow-cyan-950/20"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                  <span>Direction Cadastrale & Arpenteurs</span>
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                  🔐 Portail Administration
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Gestion intégrale du cadastre, numérisation de parcelles, modification des sommets GPS, imports GeoJSON/KML et administration Cloud Supabase.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-400">
              <span className="flex items-center gap-2 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                <UserCheck className="w-3.5 h-3.5" /> Connexion Administrateur
              </span>
              <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer with Contact Card */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto pt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          <span>Avenue Makakidi N°1, Quartier Océan, Ville de Muanda / Kongo Central / RDC</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-emerald-500" /> 089 11 00 000</span>
          <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-emerald-500" /> Bamakakidi@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}
