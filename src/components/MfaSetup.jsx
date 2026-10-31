import React, { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, Loader2, AlertCircle } from 'lucide-react';
import { getMfaFactor, startMfaEnrollment, confirmMfaEnrollment, disableMfa } from '../services/authService';

// Two-step verification of the signed-in account: authenticator app on the phone (TOTP)
export default function MfaSetup({ onChange }) {
  const [factor, setFactor] = useState(undefined); // undefined: loading, null: not active
  const [enrollment, setEnrollment] = useState(null); // { factorId, qr, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMfaFactor().then((f) => !cancelled && setFactor(f));
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (action) => {
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      await action();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => run(async () => setEnrollment(await startMfaEnrollment()));

  const handleConfirm = (e) => {
    e.preventDefault();
    run(async () => {
      await confirmMfaEnrollment(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      setFactor(await getMfaFactor());
      setMessage({ type: 'success', text: 'Double vérification activée : le mot de passe seul ne suffit plus.' });
      onChange?.(true);
    });
  };

  const handleDisable = () =>
    run(async () => {
      await disableMfa(factor.id);
      setFactor(null);
      setConfirmingDisable(false);
      setMessage({ type: 'success', text: 'Double vérification désactivée.' });
      onChange?.(false);
    });

  if (factor === undefined) {
    return <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4 text-xs text-slate-700">
      {factor ? (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold text-[13px]">Double vérification active</p>
            <p className="mt-0.5">Le serveur exige le code du téléphone à chaque connexion : un mot de passe volé ne donne aucun droit.</p>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold text-[13px]">Non activée</p>
            <p className="mt-0.5">Aujourd’hui, le mot de passe seul donne tous les droits. Activez-la avant tout.</p>
          </div>
        </div>
      )}

      {!factor && !enrollment && (
        <button type="button" onClick={handleStart} disabled={busy} className="w-full h-10 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg text-[13px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} Activer avec mon téléphone
        </button>
      )}

      {enrollment && (
        <form onSubmit={handleConfirm} className="space-y-3">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Installez une application d’authentification (Google Authenticator, Microsoft Authenticator…).</li>
            <li>Scannez ce QR code avec elle.</li>
            <li>Tapez le code à 6 chiffres qu’elle affiche.</li>
          </ol>
          <img src={enrollment.qr} alt="QR code à scanner avec l’application d’authentification" className="w-44 h-44 mx-auto border border-slate-200 rounded-lg bg-white p-1" />
          <p className="text-center text-[11px] text-slate-500">
            Ou saisissez cette clé : <code className="font-mono text-slate-800 break-all select-all">{enrollment.secret}</code>
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Code à 6 chiffres"
            className="w-full h-11 text-center font-mono text-lg tracking-[0.4em] bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500"
          />
          <button type="submit" disabled={busy || code.length !== 6} className="w-full h-10 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg text-[13px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirmer
          </button>
        </form>
      )}

      {factor &&
        (confirmingDisable ? (
          <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 space-y-2">
            <p className="text-rose-900">Désactiver ? Le mot de passe seul donnera de nouveau tous les droits.</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDisable} disabled={busy} className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold cursor-pointer disabled:opacity-50">Désactiver</button>
              <button type="button" onClick={() => setConfirmingDisable(false)} className="h-8 px-3 bg-white border border-slate-200 rounded-md cursor-pointer">Annuler</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingDisable(true)} className="text-[11px] text-slate-500 hover:text-rose-700 underline underline-offset-2 cursor-pointer">
            Désactiver (changement de téléphone)
          </button>
        ))}

      {message.text && (
        <p role="status" className={`text-[12px] ${message.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{message.text}</p>
      )}
    </div>
  );
}
