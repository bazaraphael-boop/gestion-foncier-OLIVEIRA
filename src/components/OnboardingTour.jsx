import React, { useState } from 'react';
import {
  Map as MapIcon,
  PenTool,
  FileText,
  Radio,
  ShieldCheck,
  MapPin,
  Camera,
  Ruler,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  WifiOff
} from 'lucide-react';
import { markOnboardingDone } from '../utils/onboarding';

// Guide shown at the first sign-in on a device (per account), and from Outils > Guide d'utilisation.
// The location step asks the phone's permission once, explaining what the position is used for.

const ADMIN_STEPS = [
  {
    Icon: Sparkles,
    title: 'Bienvenue dans le cadastre numérique',
    text: 'Ce guide présente les principaux outils en une minute. Vous pourrez le revoir à tout moment dans Outils → Guide d’utilisation.'
  },
  {
    Icon: MapIcon,
    title: 'La carte et les zones',
    text: 'Les onglets en haut passent de la concession entière à chaque zone (ISETECH…). Touchez une parcelle pour ouvrir sa fiche. Les zones se gèrent dans Outils → Zones de la concession.'
  },
  {
    Icon: PenTool,
    title: 'Créer une parcelle',
    text: '« Nouvelle parcelle » pour saisir les bornes (GPS ou coordonnées UTM du Cadastre), « Tracer » pour les poser sur la carte. Plusieurs parcelles d’un coup : Outils → Saisie Cadastre UTM.'
  },
  {
    Icon: FileText,
    title: 'Fiche et relevé officiel',
    text: 'Dans la fiche : photos, documents (titre, acte de cession…), modification des bornes. « Relevé PDF » produit le relevé avec son code VERIF et son QR code, vérifiables en ligne.'
  },
  {
    Icon: Radio,
    title: 'Les arpenteurs en direct',
    text: 'L’encadré « Arpenteurs » en bas à gauche montre la position et le trajet de chaque arpenteur dont le GPS est activé.'
  },
  {
    Icon: ShieldCheck,
    title: 'Protégez votre compte',
    text: 'Activez la double vérification (Outils → Sécurité) : sans elle, votre mot de passe seul donne tous les droits.'
  },
  { location: true, Icon: MapPin, title: 'Localisation', text: 'Votre position peut s’afficher sur la carte (bouton « Localiser »). Elle reste sur cet appareil.' }
];

const ARPENTEUR_STEPS = [
  {
    Icon: Sparkles,
    title: 'Bienvenue, arpenteur',
    text: 'Ce guide présente vos outils de terrain en une minute. Vous pourrez le revoir dans Outils → Guide d’utilisation.'
  },
  {
    Icon: PenTool,
    title: 'Poser les bornes',
    text: '« Tracer » puis posez chaque borne au GPS, au viseur ou en touchant la carte. Vous pouvez aussi saisir les coordonnées UTM du Cadastre dans « Nouvelle parcelle ».'
  },
  {
    Icon: Camera,
    title: 'Photos et documents',
    text: 'Dans la fiche d’une parcelle, ajoutez des photos (le lieu de prise de vue est enregistré) et les documents du lot.'
  },
  {
    Icon: Ruler,
    title: 'La latte',
    text: 'L’outil de mesure calcule une surface, un périmètre et le nombre de lots possibles dans une zone.'
  },
  {
    Icon: WifiOff,
    title: 'Sur le terrain sans réseau',
    text: 'Parcourez votre zone avec Internet avant de partir : les images satellite vues restent disponibles hors connexion.'
  },
  {
    location: true,
    Icon: MapPin,
    title: 'Localisation',
    text: 'Quand vous activez le GPS, votre position est affichée sur votre carte et partagée en direct avec l’administrateur, tant que le GPS reste activé. Désactivez-le pour arrêter le partage.'
  }
];

function requestPermission() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve('unsupported');
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (err) => resolve(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  });
}

const PERMISSION_TEXT = {
  granted: { ok: true, text: 'Localisation autorisée.' },
  denied: { ok: false, text: 'Localisation refusée. Vous pourrez l’autoriser plus tard dans les réglages du navigateur.' },
  unavailable: { ok: false, text: 'Position introuvable pour le moment (signal faible). L’autorisation pourra être redemandée à l’activation du GPS.' },
  unsupported: { ok: false, text: 'Cet appareil ne propose pas la localisation.' }
};

export default function OnboardingTour({ role, userId, onClose }) {
  const steps = role === 'arpenteur' ? ARPENTEUR_STEPS : ADMIN_STEPS;
  const [index, setIndex] = useState(0);
  const [permission, setPermission] = useState(null); // null | 'asking' | key of PERMISSION_TEXT
  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = () => {
    markOnboardingDone(userId);
    onClose();
  };

  const askPermission = async () => {
    setPermission('asking');
    setPermission(await requestPermission());
  };

  const result = permission && permission !== 'asking' ? PERMISSION_TEXT[permission] : null;

  return (
    <div className="fixed inset-0 z-[4500] bg-slate-900/60 flex items-center justify-center p-4 font-sans">
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="bg-white text-slate-800 w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <step.Icon className="w-6 h-6" />
            </span>
            <span className="text-[12px] text-slate-500 tabular-nums">
              {index + 1} / {steps.length}
            </span>
          </div>
          <h2 id="onboarding-title" className="text-[18px] font-bold text-slate-900">{step.title}</h2>
          <p className="text-[14px] leading-relaxed text-slate-700">{step.text}</p>

          {step.location && (
            <div className="space-y-2">
              {!result && (
                <button
                  type="button"
                  onClick={askPermission}
                  disabled={permission === 'asking'}
                  className="w-full h-11 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {permission === 'asking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Autoriser la localisation
                </button>
              )}
              {result && (
                <p role="status" className={`flex items-start gap-2 text-[13px] ${result.ok ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {result.text}
                </p>
              )}
              <p className="text-[12px] text-slate-500">Le téléphone affichera sa propre demande d’autorisation.</p>
            </div>
          )}

          <div className="flex gap-1.5 justify-center pt-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-brand-700' : 'w-1.5 bg-slate-300'}`} />
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="h-10 px-2 text-[13px] text-slate-500 hover:text-slate-800 cursor-pointer">
            {last ? '' : 'Passer'}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="h-10 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[13px] font-medium cursor-pointer">
                Précédent
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setIndex(index + 1))}
              className="h-10 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold cursor-pointer"
            >
              {last ? 'Commencer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
