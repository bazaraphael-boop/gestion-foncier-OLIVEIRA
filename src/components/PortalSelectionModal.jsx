import React from 'react';

export default function PortalSelectionModal({ onSelectAdmin, onSelectClient }) {
  return (
    <div
      className="fixed inset-0 z-[4000] flex flex-col overflow-y-auto font-sans antialiased"
      style={{
        backgroundImage: 'url(/muanda_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay sombre pour lisibilite */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] pointer-events-none" />

      {/* Bande de titre institutionnelle */}
      <div className="relative z-10 w-full bg-[#0f2540]/90 text-white py-5 px-4 text-center border-b border-white/10">
        <h1 className="text-sm sm:text-base font-bold uppercase tracking-widest leading-snug">
          Système d&apos;Information Géographique &amp; Cadastre Numérique
        </h1>
        <p className="text-xs text-blue-200 mt-1 font-medium">
          Concession Manuel Joaquim d&apos;Oliveira — Muanda / Kongo Central / RDC
        </p>
      </div>


      {/* Corps principal */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <p className="text-xs sm:text-sm text-white/80 mb-6 text-center max-w-lg leading-relaxed drop-shadow">
          Consultation cartographique officielle du cadastre foncier.
          Veuillez entrer votre code d&apos;accès PIN à 6 chiffres pour consulter la concession.
        </p>

        {/* Portail Client Unique Centré */}
        <div className="w-full max-w-md">
          <button
            onClick={onSelectClient}
            className="group w-full bg-white/95 backdrop-blur-sm border border-white/60 hover:border-[#1a6e3c] hover:bg-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-200 text-left overflow-hidden cursor-pointer"
          >
            <div className="h-2 w-full bg-[#1a6e3c]" />
            <div className="p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#1a6e3c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>

              <div>
                <p className="text-[11px] font-bold text-[#1a6e3c] uppercase tracking-widest mb-1">
                  Espace Grand Public &amp; Occupants
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 group-hover:text-[#1a6e3c] transition-colors">
                  Portail Client &amp; Consultation
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed mt-2">
                  Accédez à la vue satellite et cartographique de la concession, aux limites géodésiques et à la légende cadastrale via votre code PIN à 6 chiffres.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-[#1a6e3c] flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Saisir le code PIN (6 chiffres)
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 group-hover:text-[#1a6e3c] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Pied de page */}
      <footer className="relative z-10 w-full bg-[#0f2540]/90 text-blue-100 py-4 px-4 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <span>Avenue Makakidi N°1, Quartier Océan, Muanda / Kongo Central / RDC</span>
          <div className="flex items-center gap-4">
            <span>089 11 00 000 &nbsp;|&nbsp; 089 619 55 55</span>
            <span>Bamakakidi@gmail.com</span>
            {/* Accès discret réservé Administration */}
            <button
              onClick={onSelectAdmin}
              className="text-blue-300/30 hover:text-blue-100 transition-colors p-1 cursor-pointer ml-1"
              title="Accès réservé administration"
              aria-label="Administration"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}


