import React, { useState } from 'react';
import { ShieldCheck, ArrowLeft, Lock, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { loginAdmin } from '../services/authService';

export default function AdminLoginModal({ onSuccess, onBack }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await loginAdmin(password);
      if (res.success) {
        onSuccess(res.session);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-800 p-6 space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour au choix</span>
          </button>
          <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
            Administration
          </span>
        </div>

        {/* Title */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Accès Administrateur SIG</h2>
          <p className="text-xs text-slate-400">Entrez votre mot de passe pour gérer la concession</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mot de passe Administrateur
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs text-center flex items-center justify-center gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                <span>Vérification...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-cyan-200" />
                <span>Se connecter en Admin</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center">
          Concession Manuel Joaquim d'Oliveira • Muanda, RDC
        </div>
      </div>
    </div>
  );
}
