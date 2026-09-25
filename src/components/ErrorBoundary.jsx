import React, { Component } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Erreur capturée par ErrorBoundary:', error, errorInfo);
  }

  handleHardReset = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn('Erreur reset cache:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans select-none">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-slate-100 mb-2">
            Système Cadastral — Récupération
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            Une mise à jour récente de l'application ou un problème de mise en cache temporaire a été détecté sur votre appareil.
          </p>

          <button
            onClick={this.handleHardReset}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Nettoyer le cache &amp; Recharger</span>
          </button>

          {this.state.error?.message && (
            <div className="mt-8 p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-500 font-mono max-w-sm overflow-hidden text-ellipsis">
              {this.state.error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
