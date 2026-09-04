import React, { useState, useEffect, useRef } from 'react';
import { Lock, ArrowLeft, ShieldAlert, KeyRound, Check, Loader2 } from 'lucide-react';
import { loginClient, getLockoutStatus } from '../services/authService';

export default function ClientPinModal({ onSuccess, onBack }) {
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState({ isLocked: false, remainingSeconds: 0 });

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, []);

  // Lockout countdown timer loop
  useEffect(() => {
    const checkLock = () => {
      const lock = getLockoutStatus();
      setLockoutInfo(lock);
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDigitChange = (index, value) => {
    if (lockoutInfo.isLocked) return;

    // Only allow numeric digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...pinDigits];
    newDigits[index] = value;
    setPinDigits(newDigits);
    setError('');

    // Auto-advance to next input field
    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }

    // Auto-submit when all 6 digits are typed
    if (value && index === 5 && newDigits.every((d) => d !== '')) {
      submitPin(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const submitPin = async (fullPin) => {
    if (lockoutInfo.isLocked) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await loginClient(fullPin);
      if (res.success) {
        onSuccess(res.session);
      } else {
        setError(res.error);
        setPinDigits(['', '', '', '', '', '']);
        if (inputRefs[0].current) {
          inputRefs[0].current.focus();
        }
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la vérification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const fullPin = pinDigits.join('');
    if (fullPin.length === 6) {
      submitPin(fullPin);
    } else {
      setError('Veuillez entrer les 6 chiffres du code PIN.');
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
          <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
            Portail Client
          </span>
        </div>

        {/* Title */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Concession Manuel Joaquim d'Oliveira</h2>
          <p className="text-xs text-slate-400">Portail Client • Entrez votre code d'accès à 6 chiffres</p>
        </div>

        {/* Form & PIN Input Dots */}
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-3">
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                disabled={lockoutInfo.isLocked || isLoading}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-13 sm:w-12 sm:h-14 bg-slate-950 border-2 rounded-xl text-center text-xl font-bold text-white focus:outline-none transition-all ${
                  lockoutInfo.isLocked
                    ? 'border-slate-800 opacity-50 cursor-not-allowed'
                    : error
                    ? 'border-rose-500 text-rose-400 focus:border-rose-500'
                    : digit
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            ))}
          </div>

          {/* Error & Anti-Bruteforce Lockout Alert */}
          {lockoutInfo.isLocked ? (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs text-center flex items-center justify-center gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
              <span>
                Accès bloqué. Veuillez patienter <strong>{lockoutInfo.remainingSeconds}s</strong>
              </span>
            </div>
          ) : error ? (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs text-center flex items-center justify-center gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Action Button */}
          <button
            type="submit"
            disabled={lockoutInfo.isLocked || isLoading || pinDigits.join('').length !== 6}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                <span>Vérification...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-emerald-200" />
                <span>Accéder à la carte</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center">
          Sécurité cryptographique SHA-256 • Concession Manuel J. d'Oliveira
        </div>
      </div>
    </div>
  );
}
