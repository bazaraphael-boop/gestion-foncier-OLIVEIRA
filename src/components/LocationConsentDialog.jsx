import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { registerLocationConsentHost } from '../services/locationConsent';

// Asks before each use of the GPS (see services/locationConsent.js)

const PURPOSES = {
  tracking: 'Votre position sera affichée sur votre carte et partagée en direct avec l’administrateur tant que le GPS reste activé.',
  locate: 'Votre position sera affichée sur la carte, sur cet appareil uniquement.',
  borne: 'Votre position servira à placer une borne de la parcelle.',
  form: 'Votre position servira à remplir une borne de la parcelle.',
  photo: 'Le lieu de la prise de vue sera enregistré avec la photo.'
};

export default function LocationConsentDialog() {
  const [purpose, setPurpose] = useState(null);
  const waiting = useRef([]); // resolvers of the requests answered by this dialog

  useEffect(
    () =>
      registerLocationConsentHost(
        (next) =>
          new Promise((resolve) => {
            waiting.current.push(resolve);
            setPurpose((current) => current || next);
          })
      ),
    []
  );

  const answer = (allowed) => {
    waiting.current.splice(0).forEach((resolve) => resolve(allowed));
    setPurpose(null);
  };

  if (!purpose) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-900/60 flex items-center justify-center p-4 font-sans">
      <div role="alertdialog" aria-modal="true" aria-labelledby="location-consent-title" aria-describedby="location-consent-text" className="bg-white text-slate-800 w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </span>
          <h2 id="location-consent-title" className="font-semibold text-[15px] text-slate-900">Autoriser la localisation ?</h2>
        </div>
        <p id="location-consent-text" className="text-[13px] text-slate-600">
          {PURPOSES[purpose] || PURPOSES.locate}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => answer(false)} className="h-10 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium cursor-pointer">
            Refuser
          </button>
          <button type="button" autoFocus onClick={() => answer(true)} className="h-10 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold cursor-pointer">
            Autoriser
          </button>
        </div>
      </div>
    </div>
  );
}
