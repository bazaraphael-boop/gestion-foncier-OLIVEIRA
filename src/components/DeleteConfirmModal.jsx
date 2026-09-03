import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, lotNumber, count = 1 }) {
  if (!isOpen) return null;

  const isBulk = count > 1;

  return (
    <div className="fixed inset-0 z-[3500] bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-white text-slate-800 w-full max-w-md rounded-lg shadow-xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <span>
              {isBulk ? `Suppression Grouper (${count} Parcelles)` : 'Confirmation de Suppression'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 text-xs text-slate-600">
          {isBulk ? (
            <p className="text-slate-700 text-xs leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement les <strong className="text-slate-900 font-bold">{count} parcelles sélectionnées</strong> du registre foncier de la Concession Manuel Joaquim d'Oliveira ?
            </p>
          ) : (
            <p className="text-slate-700 text-xs leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le lot <strong className="text-slate-900 font-bold">{lotNumber || 'sélectionné'}</strong> du registre foncier de la Concession Manuel Joaquim d'Oliveira ?
            </p>
          )}

          <div className="bg-amber-50 border border-amber-200/80 p-2.5 rounded text-[11px] text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Cette action retirera les polygones ainsi que l'ensemble des coordonnées géodésiques et des droits d'occupation associés.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded transition-all"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isBulk ? `Supprimer les ${count} parcelles` : 'Supprimer définitivement'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
