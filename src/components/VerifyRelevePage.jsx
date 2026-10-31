import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, WifiOff, ScanLine, Search } from 'lucide-react';
import { verifyReleve, verifyReleveCode, parseOfficialQr } from '../services/releveVerification';

const QrScanner = lazy(() => import('./QrScanner'));

// Official verification page, public. Checking from here (typed code or the scanner below) does not
// depend on any link printed on the paper, so a forged QR code leading to a fake site is useless.

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
  },
  foreign: {
    Icon: ShieldX,
    box: 'bg-rose-50 border-rose-300 text-rose-900',
    icon: 'text-rose-700',
    title: 'Ce QR code n’est pas officiel',
    text: 'Il ne provient pas du registre de la Concession. N’ouvrez pas son lien et ne vous fiez pas à ce document. Contactez la Concession.'
  }
};

export default function VerifyRelevePage({ token }) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(!!token);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const check = useCallback((request) => {
    setLastCheck(() => request);
    setFailed(false);
    setResult(null);
    setIsLoading(true);
    return request()
      .then(setResult)
      .catch(() => setFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    verifyReleve(token)
      .then((data) => !cancelled && setResult(data))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleScan = useCallback(
    (text) => {
      setScanning(false);
      const scanned = parseOfficialQr(text);
      if (scanned) check(() => verifyReleve(scanned));
      else {
        setFailed(false);
        setResult({ status: 'foreign' });
      }
    },
    [check]
  );

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

        {isLoading && (
          <div role="status" className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center gap-2.5 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Interrogation du registre…
          </div>
        )}

        {failed && (
          <div role="alert" className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-3">
            <WifiOff className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold">Vérification impossible pour le moment</p>
            <p className="text-sm text-slate-600">Vérifiez la connexion Internet. Ce message ne dit rien sur l’authenticité du document.</p>
            <button type="button" onClick={() => (lastCheck ? check(lastCheck) : check(() => verifyReleve(token)))} className="h-10 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold cursor-pointer">
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

        {/* Official entry: typed code or scanner */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3" aria-labelledby="verify-other">
          <h2 id="verify-other" className="font-semibold text-sm">{status || failed ? 'Vérifier un autre relevé' : 'Entrez le code imprimé sur le relevé'}</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const typed = code;
              if (typed.trim()) check(() => verifyReleveCode(typed));
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VERIF-XXXXX-XXXXX"
              aria-label="Code de vérification du relevé"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 h-11 px-3 bg-white border border-slate-300 rounded-lg font-mono text-[16px] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button type="submit" disabled={!code.trim() || isLoading} aria-label="Vérifier le code" className="h-11 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-semibold text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40">
              <Search className="w-4 h-4" /> Vérifier
            </button>
          </form>
          {scanning ? (
            <Suspense fallback={<div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}>
              <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />
            </Suspense>
          ) : (
            <button type="button" onClick={() => setScanning(true)} className="w-full h-11 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-pointer">
              <ScanLine className="w-4 h-4 text-slate-500" /> Scanner le QR code du relevé
            </button>
          )}
          <p className="text-xs text-slate-500">
            Pour une vérification sûre, ouvrez vous-même cette page à l’adresse <strong>{window.location.host}</strong> : ne suivez pas un lien reçu ou imprimé sur un document douteux.
          </p>
        </section>
      </div>
    </main>
  );
}
