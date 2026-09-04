import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, Lock, KeyRound, User, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { loginAdmin, getAdminLockoutStatus } from '../services/authService';

export default function AdminLoginModal({ onSuccess, onBack }) {
  const [identifier, setIdentifier] = useState('Bamakakidi@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState({ isLocked: false, remainingSeconds: 0 });

  // Real-time lockout countdown loop
  useEffect(() => {
    const checkLock = () => {
      const lock = getAdminLockoutStatus();
      setLockoutInfo(lock);
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutInfo.isLocked) return;
    if (!password) {
      setError('Veuillez renseigner le mot de passe.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await loginAdmin(identifier, password);
      if (res.success) {
        onSuccess(res.session);
      } else {
        setError(res.error);
        const lock = getAdminLockoutStatus();
        setLockoutInfo(lock);
      }
    } catch (err) {
      setError('Une erreur technique est survenue lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[4000] flex items-center justify-center p-4 font-sans antialiased"
      style={{
        backgroundImage: 'url(/muanda_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Background Dimmer */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in duration-200">
        {/* Top Institutional Header */}
        <div className="bg-[#1a3a5c] text-white px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            <span>Direction Cadastrale</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Connexion Administration SIG
            </h2>
            <p className="text-xs text-gray-500">
              Concession Manuel Joaquim d'Oliveira — Muanda / Kongo Central
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifiant ou Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Identifiant ou Email officiel
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={identifier}
                  disabled={lockoutInfo.isLocked || isLoading}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError('');
                  }}
                  placeholder="Ex: Bamakakidi@gmail.com ou admin"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-xs font-medium focus:outline-none focus:border-[#1a3a5c] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Mot de passe Administrateur
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  disabled={lockoutInfo.isLocked || isLoading}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Entrez votre mot de passe..."
                  className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-xs font-medium focus:outline-none focus:border-[#1a3a5c] focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Lockout Countdown Alert */}
            {lockoutInfo.isLocked ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 animate-bounce" />
                <span>
                  Sécurité activée : portail verrouillé pendant <strong>{lockoutInfo.remainingSeconds}s</strong>
                </span>
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || lockoutInfo.isLocked || !password}
              className="w-full py-3 bg-[#1a3a5c] hover:bg-[#122840] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
                  <span>Vérification des accès...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-blue-200" />
                  <span>Accéder à l'Administration SIG</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-2 text-[11px] text-gray-400 text-center">
            <Lock className="w-3.5 h-3.5 text-gray-400" />
            <span>Sécurité cryptographique SHA-256 • Accès réservé aux gestionnaires habilités</span>
          </div>
        </div>
      </div>
    </div>
  );
}

