import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, WifiOff } from 'lucide-react';
import { verifyReleve } from '../services/releveVerification';

// Public page opened by the QR code of a relevé: no sign-in, shows what the server's registry holds

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nfHa = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS = {
  authentic: {
    Icon: ShieldCheck,
    box: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    icon: 'text-emerald-700',
    title: 'Relevé authentique',
    text: 'Ce relevé est inscrit au registre de la Concession et reste à jour.'
  },
  outdated: {
    Icon: ShieldAlert,
    box: 'bg-amber-50 border-amber-300 text-amber-900',
    icon: 'text-amber-700',
    title: 'Relevé plus à jour',
    text: 'Ce relevé a bien été émis, mais le lot a changé depuis (propriétaire, numéro ou bornes). Demandez un relevé récent à la Concession.'
  },
  revoked: {
    Icon: ShieldX,
    box: 'bg-rose-50 border-rose-300 text-rose-900',
    icon: 'text-rose-700',
    title: 'Relevé annulé',
    text: 'La Concession a annulé ce relevé : il n’est plus valable.'
  },
  unknown: {
    Icon: ShieldX,
    box: 'bg-rose-50 border-rose-300 text-rose-900',
    icon: 'text-rose-700',
    title: 'Relevé introuvable',
    text: 'Ce code ne correspond à aucun relevé du registre. Le document n’est pas authentique.'
  }
};

export default function VerifyRelevePage({ token }) {
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setResult(null);
    verifyReleve(token).then(setResult).catch(() => setFailed(true));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    verifyReleve(token)
      .then((data) => !cancelled && setResult(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const status = result && (STATUS[result.status] || STATUS.unknown);
  const rows = result?.lot
    ? [
        ['Lot', result.lot],
        ['Propriétaire', result.owner],
        ['Superficie', `${nfHa.format(result.area_m2 / 10000)} ha (${nf.format(result.area_m2)} m²)`],
        ['Côtés', `${result.sides.map((m) => nf.format(m)).join(' × ')} m`],
        ['Émis le', result.issued_on],
        ['Référence', result.reference],
        ['Empreinte', result.fingerprint]
      ]
    : [];

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900 font-sans flex justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="w-full max-w-xl space-y-4 my-auto">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <img src="./header_banner.jpg" alt="Concession Manuel Joaquim d’Oliveira" className="w-full block" />
        </div>

        <h1 className="text-[15px] font-semibold text-slate-700 text-center">Vérification d’un relevé parcellaire</h1>

        {!result && !failed && (
          <div role="status" className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center gap-2.5 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Interrogation du registre…
          </div>
        )}

        {failed && (
          <div role="alert" className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-3">
            <WifiOff className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold">Vérification impossible pour le moment</p>
            <p className="text-sm text-slate-600">Vérifiez la connexion Internet. Ce message ne dit rien sur l’authenticité du document.</p>
            <button onClick={load} className="h-10 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold cursor-pointer">
              Réessayer
            </button>
          </div>
        )}

        {status && (
          <div role="status" className={`rounded-xl border-2 p-5 flex gap-4 ${status.box}`}>
            <status.Icon className={`w-10 h-10 flex-shrink-0 ${status.icon}`} />
            <div>
              <p className="text-xl font-bold">{status.title}</p>
              <p className="text-sm mt-1">{status.text}</p>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <dl className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {rows.map(([label, value]) => (
                <div key={label} className="px-4 py-2.5 flex justify-between gap-4 text-sm">
                  <dt className="text-slate-500 flex-shrink-0">{label}</dt>
                  <dd className="font-semibold text-right break-words min-w-0">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-slate-700 bg-white rounded-xl border border-slate-200 p-4">
              <strong>Anti-fraude / anti-IA :</strong> comparez ces informations avec le document papier. Si le nom, la superficie ou les
              côtés diffèrent, le document a été modifié (retouche ou IA) et il est <strong>nul</strong>.
            </p>
          </>
        )}

        {(status || failed) && (
          <p className="text-xs text-slate-500 text-center">
            Page officielle : vérifiez que l’adresse affichée par votre téléphone est bien <strong>{window.location.host}</strong> et correspond à celle
            communiquée par la Concession.
          </p>
        )}
      </div>
    </main>
  );
}
