import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  KeyRound,
  User,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import {
  loginAdmin,
  getAdminLockoutStatus,
  recoverAdminPassword,
  getDefaultCredentials
} from '../services/authService';

export default function AdminLoginModal({ onSuccess, onBack }) {
  const [identifier, setIdentifier] = useState('Bamakakidi@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState({ isLocked: false, remainingSeconds: 0 });

  // Recovery Mode States
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('Bamakakidi@gmail.com');
  const [recoveryTab, setRecoveryTab] = useState('restore'); // 'restore' | 'custom'
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryShowPwd, setRecoveryShowPwd] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState({ type: '', text: '', password: '' });

  const defaults = getDefaultCredentials();

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

  // Handle Recovery Submit (Restore default OR Set custom)
  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setRecoveryMessage({ type: '', text: '', password: '' });

    if (!recoveryEmail.trim()) {
      setRecoveryMessage({ type: 'error', text: 'Veuillez saisir votre email ou identifiant officiel.' });
      return;
    }

    if (recoveryTab === 'custom') {
      if (!recoveryNewPassword || recoveryNewPassword.length < 6) {
        setRecoveryMessage({
          type: 'error',
          text: 'Le nouveau mot de passe doit comporter au moins 6 caractères.'
        });
        return;
      }
      if (recoveryNewPassword !== recoveryConfirmPassword) {
        setRecoveryMessage({
          type: 'error',
          text: 'Les deux mots de passe saisis ne sont pas identiques.'
        });
        return;
      }
    }

    setIsRecovering(true);

    try {
      const newPwdToApply = recoveryTab === 'custom' ? recoveryNewPassword : null;
      const res = await recoverAdminPassword(recoveryEmail, newPwdToApply);

      if (res.success) {
        setRecoveryMessage({
          type: 'success',
          text: res.message,
          password: res.password
        });
        // Immediately sync lockout state
        setLockoutInfo(getAdminLockoutStatus());
      } else {
        setRecoveryMessage({
          type: 'error',
          text: res.error || 'Erreur lors de la récupération.'
        });
      }
    } catch (err) {
      setRecoveryMessage({
        type: 'error',
        text: 'Erreur inattendue lors de la réinitialisation du mot de passe.'
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleUseRecoveredPassword = () => {
    if (recoveryMessage.password) {
      setPassword(recoveryMessage.password);
      setIdentifier(recoveryEmail);
    }
    setShowRecovery(false);
    setError('');
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
            onClick={showRecovery ? () => setShowRecovery(false) : onBack}
            className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{showRecovery ? 'Retour connexion' : 'Retour'}</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            <span>Direction Cadastrale</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {!showRecovery ? (
            /* ─────────────────────────────────────────────────────────────
             * STANDARD LOGIN VIEW
             * ───────────────────────────────────────────────────────────── */
            <>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                  Espace Professionnel SIG
                </h2>
                <p className="text-xs text-gray-500">
                  Concession Manuel Joaquim d'Oliveira — Accès Admin &amp; Arpenteur Géomètre
                </p>
              </div>

              {/* Quick Profile Selectors */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('Bamakakidi@gmail.com');
                    setPassword('');
                    setError('');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    identifier === 'Bamakakidi@gmail.com' || identifier === 'admin'
                      ? 'bg-[#1a3a5c] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Administrateur</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('arpenteur');
                    setPassword('');
                    setError('');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    identifier === 'arpenteur' || identifier === 'geometre'
                      ? 'bg-cyan-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Arpenteur Géomètre</span>
                </button>
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
                      placeholder="Ex: admin ou arpenteur"
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-xs font-medium focus:outline-none focus:border-[#1a3a5c] focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Mot de passe {identifier === 'arpenteur' ? 'Arpenteur' : 'Administrateur'}
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
                      placeholder={
                        identifier === 'arpenteur'
                          ? 'Mot de passe arpenteur...'
                          : 'Mot de passe administrateur...'
                      }
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

                  {/* Password Info & Forgot Password Trigger */}
                  <div className="flex items-center justify-between text-[11px] mt-1.5 px-0.5">
                    <span className="text-gray-500 font-medium">
                      Par défaut :{' '}
                      <strong className="text-slate-700 select-all font-mono">
                        {identifier === 'arpenteur' ? defaults.arpenteurDefaultPassword : defaults.adminDefaultPassword}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecovery(true);
                        setRecoveryEmail(identifier);
                        setRecoveryMessage({ type: '', text: '', password: '' });
                      }}
                      className="font-bold text-[#1a3a5c] hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                      <span>Mot de passe oublié ?</span>
                    </button>
                  </div>
                </div>

                {/* Lockout Countdown Alert */}
                {lockoutInfo.isLocked ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 animate-bounce" />
                      <span>
                        Sécurité activée : portail verrouillé pendant <strong>{lockoutInfo.remainingSeconds}s</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecovery(true);
                        setRecoveryEmail(identifier);
                        setRecoveryMessage({ type: '', text: '', password: '' });
                      }}
                      className="text-[11px] font-bold text-red-800 underline hover:text-red-950 cursor-pointer pt-0.5"
                    >
                      Récupérer / Réinitialiser immédiatement l'accès
                    </button>
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
                      <span>
                        {identifier === 'arpenteur' || identifier === 'geometre'
                          ? "Accéder à l'Espace Arpenteur Géomètre"
                          : "Accéder à l'Administration SIG"}
                      </span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ─────────────────────────────────────────────────────────────
             * RECOVERY & PASSWORD RESET VIEW
             * ───────────────────────────────────────────────────────────── */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-[#1a3a5c] mb-1">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  Récupération &amp; Réinitialisation
                </h2>
                <p className="text-xs text-gray-500">
                  Restaurez l'accès en validant votre identifiant ou email officiel
                </p>
              </div>

              {/* Recovery Method Tabs */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTab('restore');
                    setRecoveryMessage({ type: '', text: '', password: '' });
                  }}
                  className={`py-2 px-2 rounded-md font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    recoveryTab === 'restore'
                      ? 'bg-white text-[#1a3a5c] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Défaut d'origine</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTab('custom');
                    setRecoveryMessage({ type: '', text: '', password: '' });
                  }}
                  className={`py-2 px-2 rounded-md font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    recoveryTab === 'custom'
                      ? 'bg-white text-[#1a3a5c] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  <span>Nouveau mot de passe</span>
                </button>
              </div>

              {/* Recovery Form */}
              <form onSubmit={handleRecoverySubmit} className="space-y-3.5">
                {/* Identifiant de vérification */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Email officiel ou Identifiant
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="Ex: bamakakidi@gmail.com ou admin"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-xs font-medium focus:outline-none focus:border-[#1a3a5c] focus:bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Acceptés : <code className="font-mono text-slate-600">bamakakidi@gmail.com</code>, <code className="font-mono text-slate-600">admin</code>, ou <code className="font-mono text-slate-600">arpenteur</code>
                  </p>
                </div>

                {/* Option 1: Restauration par défaut */}
                {recoveryTab === 'restore' && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-lg text-xs space-y-1.5">
                    <p className="text-blue-900 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Restauration instantanée garantie</span>
                    </p>
                    <p className="text-blue-800 text-[11px] leading-relaxed">
                      Cette action réactive immédiatement les mots de passe d'usine (<code className="font-mono font-bold bg-white px-1 py-0.5 rounded border border-blue-200">admin123</code> pour l'admin, <code className="font-mono font-bold bg-white px-1 py-0.5 rounded border border-blue-200">arpenteur123</code> pour l'arpenteur) et annule tout blocage de sécurité.
                    </p>
                  </div>
                )}

                {/* Option 2: Nouveau mot de passe personnalisé */}
                {recoveryTab === 'custom' && (
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Nouveau mot de passe (min 6 car.)
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type={recoveryShowPwd ? 'text' : 'password'}
                          required
                          value={recoveryNewPassword}
                          onChange={(e) => setRecoveryNewPassword(e.target.value)}
                          placeholder="Au moins 6 caractères..."
                          className="w-full pl-9 pr-10 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-xs font-medium focus:outline-none focus:border-[#1a3a5c] focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setRecoveryShowPwd(!recoveryShowPwd)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          {recoveryShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Confirmer le mot de passe
                      </label>
                      <input
                        type={recoveryShowPwd ? 'text' : 'password'}
                        required
                        value={recoveryConfirmPassword}
                        onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                        placeholder="Répétez le mot de passe..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-xs font-medium focus:outline-none focus:border-[#1a3a5c] focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Status Messages */}
                {recoveryMessage.type === 'error' && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{recoveryMessage.text}</span>
                  </div>
                )}

                {recoveryMessage.type === 'success' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{recoveryMessage.text}</span>
                    </div>
                    {recoveryMessage.password && (
                      <div className="p-2 bg-white rounded border border-emerald-200 text-center font-mono font-bold text-emerald-900 text-sm select-all">
                        {recoveryMessage.password}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleUseRecoveredPassword}
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Se connecter avec ce mot de passe</span>
                      <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>
                )}

                {/* Recovery Submit Button */}
                {recoveryMessage.type !== 'success' && (
                  <button
                    type="submit"
                    disabled={isRecovering}
                    className="w-full py-2.5 bg-[#1a3a5c] hover:bg-[#122840] disabled:bg-gray-300 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    {isRecovering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
                        <span>Réinitialisation en cours...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 text-cyan-300" />
                        <span>
                          {recoveryTab === 'restore'
                            ? "Restaurer le mot de passe d'origine"
                            : "Appliquer le nouveau mot de passe"}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </form>

              {/* Back to Login link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="text-xs text-gray-500 hover:text-[#1a3a5c] underline font-medium cursor-pointer"
                >
                  Annuler et revenir à la page de connexion
                </button>
              </div>
            </div>
          )}

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
