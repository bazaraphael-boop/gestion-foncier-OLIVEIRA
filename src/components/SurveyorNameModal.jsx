import React, { useState } from 'react';
import { UserRound } from 'lucide-react';

// Asked once on each phone: several surveyors may use the same account
export default function SurveyorNameModal({ initialName = '', onSubmit, onCancel }) {
  const [name, setName] = useState(initialName);

  return (
    <div className="fixed inset-0 z-[3600] bg-slate-900/60 flex items-center justify-center p-4 font-sans">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="surveyor-name-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) onSubmit(name);
        }}
        className="bg-white text-slate-800 w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
            <UserRound className="w-5 h-5" />
          </span>
          <h2 id="surveyor-name-title" className="font-semibold text-[15px] text-slate-900">Qui utilise ce téléphone ?</h2>
        </div>
        <label className="block space-y-1.5">
          <span className="block text-[13px] text-slate-600">Votre nom et prénom</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-[16px] text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <p className="text-[12px] text-slate-500">Ce nom accompagne votre position et vos actions, visibles par l’administrateur.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium cursor-pointer">
            Annuler
          </button>
          <button type="submit" disabled={name.trim().length < 2} className="h-10 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-40">
            Continuer
          </button>
        </div>
      </form>
    </div>
  );
}
