import React, { useState, useEffect } from 'react';
import { X, Cloud, Key, Globe, Check, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL } from '../services/supabaseClient';

export default function SupabaseModal({ isOpen, onClose, onSyncCloud }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setKey(config.key);
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    saveSupabaseConfig(url.trim(), key.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    if (onSyncCloud) {
      await onSyncCloud();
    }
    setIsSyncing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-white text-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-100">Base de Données Supabase Cloud</h2>
              <p className="text-[11px] text-slate-400">Stockage et synchronisation cloud temps réel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-start gap-2.5 text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-xs">Clef Publishable Clôturée :</span>
              <p className="text-[11px] text-emerald-800 font-mono break-all">
                {DEFAULT_SUPABASE_KEY}
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              URL du Projet Supabase
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              Clé Publishable / Anon Key (Supabase)
            </label>
            <textarea
              rows={2}
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sb_publishable_..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-slate-400"
            ></textarea>
          </div>

          {/* SQL Script Instruction Box */}
          <div className="bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-800 space-y-1.5 font-mono text-[10px]">
            <div className="font-bold text-emerald-400 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Script SQL de création de Table (Supabase SQL Editor) :
            </div>
            <pre className="overflow-x-auto text-[10px] text-slate-300 p-1 bg-slate-950 rounded">
{`create table if not exists parcels (
  id text primary key,
  lot_number text,
  status text,
  occupant_name text,
  area_ha numeric,
  properties jsonb,
  geometry jsonb,
  updated_at timestamp default now()
);`}
            </pre>
          </div>

          {saved && (
            <div className="p-2.5 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Configuration Supabase enregistrée !
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" /> Enregistrer la Clef
            </button>

            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Synchroniser Cloud</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
