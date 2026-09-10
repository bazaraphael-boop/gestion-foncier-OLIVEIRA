import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // 2. Check if user already dismissed recently
    const dismissedAt = localStorage.getItem('geocadastre_pwa_dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 24 * 60 * 60 * 1000) {
      return;
    }

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 4. Android / Chrome beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // On iOS Safari, show prompt after a short delay if on mobile
    if (isAppleDevice && !isStandaloneMode) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('geocadastre_pwa_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-14 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[1250] animate-in slide-in-from-bottom-3 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-xl p-3 sm:p-3.5 shadow-2xl text-white select-none">
        <div className="flex items-start justify-between gap-3">
          {/* App Icon */}
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-sm border border-emerald-400/40">
            🛡️
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-100">
              <span>Installer l'application Cadastre</span>
              <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 py-0.2 rounded">
                App Mobile
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Ajoutez la Concession Manuel Joaquim d'Oliveira sur votre écran d'accueil pour un accès instantané et plein écran.
            </p>

            {/* iOS Instructions */}
            {isIOS && (
              <div className="mt-2 bg-slate-800/90 border border-slate-700/80 rounded p-2 text-[10px] text-slate-200 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <Share className="w-3.5 h-3.5" />
                  <span>Sur iPhone / iPad :</span>
                </div>
                <div>
                  1. Appuyez sur le bouton <strong>Partager</strong> (<Share className="w-3 h-3 inline text-cyan-400" /> au bas de Safari).
                </div>
                <div>
                  2. Faites défiler et appuyez sur <strong>« Sur l'écran d'accueil »</strong> (<PlusSquare className="w-3 h-3 inline text-emerald-400" />).
                </div>
              </div>
            )}

            {/* Android / Desktop Install Action */}
            {!isIOS && deferredPrompt && (
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ajouter à l'écran d'accueil</span>
                </button>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-all cursor-pointer flex-shrink-0"
            title="Ignorer pour le moment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
