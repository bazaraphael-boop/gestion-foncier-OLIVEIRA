import React, { useEffect, useRef } from 'react';
import { MapPin, Move, Save, X, Info } from 'lucide-react';

const formatHaDelta = (sqMeters) => {
  const ha = sqMeters / 10000;
  const sign = ha > 0 ? '+' : ha < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(ha))} ha`;
};

export default function BorneMoveConfirmModal({ move, onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  // Keyboard: Esc cancels, Enter confirms (focused button)
  const isOpen = !!move;
  useEffect(() => {
    if (!isOpen) return;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!move) return null;

  const { borneNumber, lotRef, before, after, oldArea, newArea } = move;
  const deltaSqM = newArea.sqMeters - oldArea.sqMeters;
  const deltaPct = oldArea.sqMeters > 0 ? (deltaSqM / oldArea.sqMeters) * 100 : 0;
  const deltaColor = deltaSqM > 0 ? 'text-emerald-700' : deltaSqM < 0 ? 'text-rose-700' : 'text-slate-500';

  const rows = [
    { label: 'Latitude', before: before[0].toFixed(6), after: after[0].toFixed(6), mono: true },
    { label: 'Longitude', before: before[1].toFixed(6), after: after[1].toFixed(6), mono: true },
    { label: 'Superficie', before: oldArea.formattedHa, after: newArea.formattedHa, mono: false }
  ];

  return (
    <div
      className="fixed inset-0 z-[3500] bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 font-sans select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="borne-move-title"
    >
      <div className="bg-white text-slate-800 w-full max-w-md rounded-lg shadow-xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-orange-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Move className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h3 id="borne-move-title" className="font-bold text-sm text-slate-900 leading-tight">
                Déplacement de borne
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Lot <strong className="text-slate-700">{lotRef}</strong> • Borne{' '}
                <span className="inline-flex items-center justify-center px-1.5 rounded-full bg-orange-600 text-white font-mono font-bold text-[10px] leading-4">
                  B{borneNumber}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            aria-label="Annuler le déplacement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Before / After comparison */}
        <div className="p-5 space-y-3 text-xs">
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_1.2fr_1.2fr] bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <div className="px-3 py-2" />
              <div className="px-3 py-2">Avant</div>
              <div className="px-3 py-2 text-orange-700">Après</div>
            </div>
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_1.2fr_1.2fr] border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 text-slate-500 font-semibold">{row.label}</div>
                <div className={`px-3 py-2 text-slate-500 ${row.mono ? 'font-mono' : 'font-semibold'}`}>{row.before}</div>
                <div className={`px-3 py-2 text-slate-900 font-bold ${row.mono ? 'font-mono' : ''}`}>{row.after}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Variation de superficie
            </span>
            <span className={`font-bold ${deltaColor}`}>
              {formatHaDelta(deltaSqM)}
              <span className="font-semibold"> ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1).replace('.', ',')} %)</span>
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-[11px] text-slate-600 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>Le nouveau tracé et la superficie recalculée seront enregistrés et tracés dans le journal d&apos;audit.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 text-xs">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded transition-all cursor-pointer"
          >
            Annuler
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="px-4 py-1.5 bg-[#1a3a5c] hover:bg-[#122840] text-white font-bold rounded shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3a5c]/40 focus-visible:ring-offset-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer le déplacement</span>
          </button>
        </div>
      </div>
    </div>
  );
}
