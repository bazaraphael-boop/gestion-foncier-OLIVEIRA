import React from 'react';

export default function PortalSelectionModal({ onSelectAdmin, onSelectClient }) {
  return (
    <div className="fixed inset-0 z-[4000] bg-gray-100 flex flex-col overflow-y-auto font-sans antialiased">


      {/* ─── Bande de titre institutionnelle ─── */}
      <div className="w-full bg-[#1a3a5c] text-white py-4 px-4 text-center">
        <h1 className="text-sm sm:text-base font-bold uppercase tracking-widest leading-snug">
          Système d'Information Géographique &amp; Cadastre Numérique
        </h1>
        <p className="text-xs text-blue-200 mt-1 font-medium">
          Concession Manuel Joaquim d'Oliveira — Muanda / Kongo Central / RDC
        </p>
      </div>

      {/* ─── Corps principal ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        <p className="text-sm text-gray-600 mb-8 text-center max-w-xl leading-relaxed">
          Veuillez sélectionner votre portail d'accès. Un code PIN est requis pour l'espace client,
          et des identifiants administrateur pour la gestion complète du système.
        </p>

        {/* ── Deux cartes d'accès ── */}
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Portail Client */}
          <button
            onClick={onSelectClient}
            className="group w-full bg-white border border-gray-300 hover:border-[#1a6e3c] rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-left overflow-hidden"
          >
            <div className="h-1.5 w-full bg-[#1a6e3c]" />
            <div className="p-6 space-y-4">
              <div className="w-11 h-11 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#1a6e3c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#1a6e3c] uppercase tracking-widest mb-1">
                  Espace Grand Public &amp; Occupants
                </p>
                <h2 className="text-base font-bold text-gray-800 group-hover:text-[#1a6e3c] transition-colors">
                  Portail Client
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed mt-1.5">
                  Consultation de la carte cadastrale, limites de concession et parcelles attribuées.
                  Accès sécurisé par code PIN à 6 chiffres.
                </p>
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1a6e3c] flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Saisir le code PIN
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 group-hover:text-[#1a6e3c] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Portail Administration */}
          <button
            onClick={onSelectAdmin}
            className="group w-full bg-white border border-gray-300 hover:border-[#1a3a5c] rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-left overflow-hidden"
          >
            <div className="h-1.5 w-full bg-[#1a3a5c]" />
            <div className="p-6 space-y-4">
              <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#1a3a5c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#1a3a5c] uppercase tracking-widest mb-1">
                  Direction Cadastrale &amp; Arpenteurs
                </p>
                <h2 className="text-base font-bold text-gray-800 group-hover:text-[#1a3a5c] transition-colors">
                  Portail Administration
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed mt-1.5">
                  Gestion complète du cadastre : numérisation des parcelles, imports GeoJSON,
                  modifications GPS et administration des données Cloud.
                </p>
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1a3a5c] flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Connexion Administrateur
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 group-hover:text-[#1a3a5c] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

        </div>
      </div>

      {/* ─── Pied de page institutionnel ─── */}
      <footer className="w-full bg-[#1a3a5c] text-blue-100 py-4 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <span>Avenue Makakidi N°1, Quartier Océan, Muanda / Kongo Central / RDC</span>
          <span className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4">
            <span>089 11 00 000 &nbsp;|&nbsp; 089 619 55 55</span>
            <span>Bamakakidi@gmail.com</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
