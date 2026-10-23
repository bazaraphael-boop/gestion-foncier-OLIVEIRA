import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Marker, Polygon, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Ruler, X, Undo2, Trash2, Printer, Plus, Info, FileDown, Loader2 } from 'lucide-react';
import { measurePoints, formatArea, formatMeters, ddToDms } from '../utils/geoUtils';
import { useMeasureResults } from '../hooks/useMeasure';
import { logActivity } from '../services/auditService';
import OfficialHeaderBanner from './OfficialHeaderBanner';
import { SituationPlan, BornagePlan, SatelliteFigure } from './ParcelPlans';
import { buildMeasurePdf, computeFingerprint, svgToPng } from '../utils/officialPdf';

// "Latte" measuring tool: the surveyor taps points on the map, gets side lengths, perimeter
// and area, then a lot quota (lotissement) and a price estimate, printable as a PDF sheet.

const MEASURE_COLOR = '#24507d'; // brand-600

const nf = (n, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);

const formatMoney = (amount, currency) => `${nf(amount, currency === 'CDF' ? 0 : 2)} ${currency === 'CDF' ? 'FC' : '$'}`;

// One icon per point number, created once: a new icon on each render would cancel an ongoing drag
const pointIcons = new Map();
const getPointIcon = (n) => {
  if (!pointIcons.has(n)) {
    pointIcons.set(
      n,
      L.divIcon({
        className: 'measure-point-marker',
        html: `<div style="background:${MEASURE_COLOR};color:#fff;border:2px solid #fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font:800 10px ui-monospace,monospace;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:grab">M${n}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    );
  }
  return pointIcons.get(n);
};

const lengthLabelIcon = (text) =>
  L.divIcon({
    className: 'measure-length-label',
    html: `<div style="transform:translate(-50%,-50%);display:inline-block;white-space:nowrap;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:1px 6px;font:600 11px ui-monospace,monospace;box-shadow:0 2px 6px rgba(0,0,0,.25)">${text}</div>`,
    iconSize: [0, 0]
  });

/* ─────────────── Map layer (inside MapContainer) ─────────────── */

export function MeasureLayer({ points, onChange }) {
  useMapEvents({
    click(e) {
      onChange([...points, [e.latlng.lat, e.latlng.lng]]);
    }
  });

  const { sides } = measurePoints(points);
  const closed = points.length >= 3;

  return (
    <>
      {closed ? (
        <Polygon
          positions={points}
          interactive={false}
          pathOptions={{ color: MEASURE_COLOR, weight: 2.5, dashArray: '6, 5', fillColor: MEASURE_COLOR, fillOpacity: 0.18 }}
        />
      ) : points.length === 2 ? (
        <Polyline positions={points} interactive={false} pathOptions={{ color: MEASURE_COLOR, weight: 2.5, dashArray: '6, 5' }} />
      ) : null}

      {sides.map((m, i) => {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        return (
          <Marker
            key={`len-${i}-${m.toFixed(2)}`}
            position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]}
            icon={lengthLabelIcon(formatMeters(m))}
            interactive={false}
            keyboard={false}
          />
        );
      })}

      {points.map((pt, i) => (
        <Marker
          key={`pt-${i}`}
          position={pt}
          icon={getPointIcon(i + 1)}
          draggable
          zIndexOffset={1200}
          eventHandlers={{
            drag: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onChange(points.map((p, j) => (j === i ? [lat, lng] : p)));
            }
          }}
        >
          <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
            <span className="text-[11px] font-mono">
              M{i + 1} • {pt[0].toFixed(6)}, {pt[1].toFixed(6)}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

/* ─────────────── Side panel (outside the map) ─────────────── */

function NumberField({ label, suffix, value, onChange, step = 1, min = 0 }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-500 mb-1">{label}</span>
      <span className="flex items-center h-9 bg-white border border-slate-300 rounded-lg focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 h-full px-2.5 bg-transparent text-[13px] text-slate-900 tabular-nums focus:outline-none"
        />
        {suffix && <span className="pr-2.5 text-[12px] text-slate-500 flex-shrink-0">{suffix}</span>}
      </span>
    </label>
  );
}

function ResultRow({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className={`tabular-nums text-right ${strong ? 'text-[13px] font-semibold text-slate-900' : 'text-[12px] text-slate-800'}`}>{value}</span>
    </div>
  );
}

export function MeasurePanel({ points, settings, onSettingsChange, onUndo, onClear, onClose, onPrint, onCreateParcel, canCreateParcel }) {
  const { measure, quota, pricing } = useMeasureResults(points, settings);
  const closed = points.length >= 3;
  const area = formatArea(measure.areaM2);
  const set = (key) => (value) => onSettingsChange({ ...settings, [key]: value });

  return (
    <div
      role="region"
      aria-label="Mesure et quota"
      className="fixed md:absolute inset-x-0 bottom-0 md:inset-x-auto md:bottom-auto md:top-3 md:right-3 z-[1150] md:w-[360px] max-h-[58vh] md:max-h-[calc(100%-24px)] flex flex-col bg-white text-slate-800 border border-slate-200 rounded-t-2xl md:rounded-xl shadow-[0_12px_32px_-8px_rgba(15,37,64,0.35)] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Ruler className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span className="font-semibold text-[14px] text-slate-900">Mesure &amp; quota</span>
          <span className="text-[12px] text-slate-500 tabular-nums">{points.length} point{points.length > 1 ? 's' : ''}</span>
        </div>
        <button onClick={onClose} aria-label="Fermer la mesure" className="p-1.5 -mr-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!closed && (
          <p className="text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            Touchez la carte pour poser les points M1, M2, M3… aux coins de la zone. Il faut 3 points pour obtenir une surface.
            Faites glisser un point pour l&apos;ajuster.
          </p>
        )}

        {/* Measurements */}
        <section>
          {closed && (
            <div className="flex items-baseline gap-2.5 mb-1">
              <span className="text-[24px] font-semibold text-slate-900 tabular-nums leading-tight">{area.ha}</span>
              <span className="text-[13px] text-slate-500 tabular-nums">{area.m2}</span>
            </div>
          )}
          {measure.sides.length > 0 && (
            <>
              <ResultRow label={closed ? 'Périmètre' : 'Longueur'} value={formatMeters(measure.perimeterM)} strong />
              <details className="group">
                <summary className="text-[12px] text-brand-600 hover:text-brand-800 cursor-pointer select-none py-1">
                  Longueur de chaque côté
                </summary>
                <div className="pl-1">
                  {measure.sides.map((m, i) => (
                    <ResultRow key={i} label={`M${i + 1} → M${((i + 1) % points.length) + 1}`} value={formatMeters(m)} />
                  ))}
                </div>
              </details>
            </>
          )}
        </section>

        {closed && (
          <>
            {/* Lot quota */}
            <section className="pt-3 border-t border-slate-100 space-y-2.5">
              <h3 className="text-[13px] font-semibold text-slate-900">Quota de lots</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="Largeur lot" suffix="m" value={settings.lotWidthM} onChange={set('lotWidthM')} />
                <NumberField label="Longueur lot" suffix="m" value={settings.lotLengthM} onChange={set('lotLengthM')} />
                <NumberField label="Voirie" suffix="%" value={settings.reservePct} onChange={set('reservePct')} />
              </div>
              <div className="rounded-lg bg-brand-50 px-3 py-2.5 flex items-baseline justify-between">
                <span className="text-[13px] text-brand-900">Lots possibles</span>
                <span className="text-[22px] font-semibold text-brand-900 tabular-nums leading-none">{nf(quota.lots)}</span>
              </div>
              <div>
                <ResultRow label="Surface d'un lot" value={formatArea(quota.lotAreaM2).m2} />
                <ResultRow label={`Réservé voirie (${nf(Number(settings.reservePct) || 0)} %)`} value={formatArea(quota.reservedM2).m2} />
                <ResultRow label="Surface lotissable" value={formatArea(quota.usableM2).m2} />
                <ResultRow label="Reste non loti" value={formatArea(Math.max(0, quota.leftoverM2)).m2} />
              </div>
              <p className="text-[11px] text-slate-500 flex gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                Estimation par surface : la forme du terrain peut réduire le nombre réel de lots.
              </p>
            </section>

            {/* Price estimate */}
            <section className="pt-3 border-t border-slate-100 space-y-2.5">
              <h3 className="text-[13px] font-semibold text-slate-900">Estimation de prix</h3>
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <NumberField label="Prix au m²" value={settings.pricePerM2} onChange={set('pricePerM2')} step={0.5} />
                <label className="block">
                  <span className="block text-[11px] text-slate-500 mb-1">Devise</span>
                  <select
                    value={settings.currency}
                    onChange={(e) => set('currency')(e.target.value)}
                    className="h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CDF">CDF (FC)</option>
                  </select>
                </label>
              </div>
              {pricing.price > 0 ? (
                <div>
                  <ResultRow label="Valeur de la zone" value={formatMoney(pricing.total, settings.currency)} strong />
                  <ResultRow label="Prix d'un lot" value={formatMoney(pricing.perLot, settings.currency)} />
                  <ResultRow label={`Valeur des ${nf(quota.lots)} lots`} value={formatMoney(pricing.sellable, settings.currency)} />
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">Saisissez un prix au m² pour obtenir l&apos;estimation.</p>
              )}
            </section>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={points.length === 0}
            className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4 text-slate-500" /> Dernier point
          </button>
          <button
            onClick={onClear}
            disabled={points.length === 0}
            className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4 text-slate-500" /> Effacer
          </button>
        </div>
        {closed && (
          <div className="flex gap-2">
            <button
              onClick={onPrint}
              className="flex-1 h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" /> Fiche PDF
            </button>
            {canCreateParcel && (
              <button
                onClick={onCreateParcel}
                className="flex-1 h-10 px-3 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Créer une parcelle
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Printable sheet ─────────────── */

export function MeasureSheet({ points, settings, concessionPolygon, authorLabel, onClose }) {
  const { measure, quota, pricing } = useMeasureResults(points, settings);
  const area = formatArea(measure.areaM2);
  const ring = points.map(([lat, lng]) => [lng, lat]);
  const zone = {
    id: 'measure_zone',
    type: 'Feature',
    properties: { lotNumber: 'Zone mesurée', formattedHa: area.ha },
    geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
  };
  const today = new Date().toLocaleDateString('fr-FR');
  const sheetRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const logSheet = (action, actionLabel) =>
    logActivity({
      role: authorLabel === 'Administrateur' ? 'admin' : 'arpenteur',
      actor: authorLabel,
      action,
      actionLabel,
      target: area.ha,
      details: `${points.length} points, ${area.m2}, ${quota.lots} lot(s) de ${nf(Number(settings.lotWidthM) || 0)} × ${nf(Number(settings.lotLengthM) || 0)} m`,
      severity: 'info'
    });

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    setIsDownloading(true);
    try {
      const issuedOn = new Date().toLocaleDateString('fr-FR');
      const fingerprint = await computeFingerprint({
        type: 'mesure',
        areaM2: Math.round(measure.areaM2),
        points: points.map(([lat, lng]) => [lat.toFixed(6), lng.toFixed(6)]),
        lots: quota.lots,
        settings,
        issuedOn
      });
      const reference = `RMB-MES-${fingerprint.slice(0, 4)}${fingerprint.slice(5, 9)}`;
      const svgs = sheetRef.current.querySelectorAll('.releve-plans svg');
      const satelliteImg = sheetRef.current.querySelector('figure img');
      const [situationPlan, zonePlan] = await Promise.all([svgToPng(svgs[0]), svgToPng(svgs[1])]);
      const satellite = satelliteImg && satelliteImg.complete && satelliteImg.naturalWidth
        ? { dataUrl: satelliteImg.src, width: satelliteImg.naturalWidth, height: satelliteImg.naturalHeight }
        : null;
      const qrText = [
        "FICHE DE MESURE – CONCESSION M.J. D'OLIVEIRA, MUANDA",
        `Superficie : ${area.ha} (${area.m2})`,
        `Périmètre : ${formatMeters(measure.perimeterM)}`,
        `Lots possibles : ${nf(quota.lots)} (${nf(Number(settings.lotWidthM) || 0)} × ${nf(Number(settings.lotLengthM) || 0)} m)`,
        `Émis le ${issuedOn} – Réf. ${reference}`,
        `Empreinte : ${fingerprint}`,
        'ANTI-FRAUDE / ANTI-IA : si les valeurs imprimées diffèrent de ce message, le document a été modifié et est NUL.'
      ].join('\n');

      const doc = await buildMeasurePdf({
        areaHa: area.ha,
        areaM2: area.m2,
        perimeter: formatMeters(measure.perimeterM),
        pointsCount: points.length,
        lots: nf(quota.lots),
        usable: formatArea(quota.usableM2).m2,
        author: authorLabel,
        results: rows,
        points: points.map(([lat, lng], i) => ({
          name: `M${i + 1}`,
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          latDms: ddToDms(lat, true),
          lngDms: ddToDms(lng, false),
          side: `M${i + 1}-M${(i + 1) % points.length + 1} : ${formatMeters(measure.sides[i] || 0)}`
        })),
        qrText,
        reference,
        issuedOn,
        fingerprint,
        situationPlan,
        zonePlan,
        satellite
      });
      doc.save(`Fiche_mesure_${new Date().toISOString().split('T')[0]}.pdf`);
      logSheet('MEASURE_SHEET_DOWNLOAD', 'Téléchargement d\'une fiche de mesure & quota (PDF)');
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      alert('Le PDF n’a pas pu être généré. Vérifiez la connexion Internet puis réessayez, ou utilisez « Imprimer ».');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    logSheet('MEASURE_SHEET', 'Impression d\'une fiche de mesure & quota');
    window.print();
  };

  const rows = [
    ['Superficie mesurée', `${area.ha} (${area.m2})`],
    ['Périmètre', formatMeters(measure.perimeterM)],
    ['Dimensions d\'un lot', `${nf(Number(settings.lotWidthM) || 0, 1)} × ${nf(Number(settings.lotLengthM) || 0, 1)} m (${formatArea(quota.lotAreaM2).m2})`],
    [`Réserve voirie & espaces communs (${nf(Number(settings.reservePct) || 0)} %)`, formatArea(quota.reservedM2).m2],
    ['Surface lotissable', formatArea(quota.usableM2).m2],
    ['Nombre de lots possibles', nf(quota.lots)],
    ['Reste non loti', formatArea(Math.max(0, quota.leftoverM2)).m2]
  ];
  if (pricing.price > 0) {
    rows.push(
      ['Prix au m²', formatMoney(pricing.price, settings.currency)],
      ['Valeur estimée de la zone', formatMoney(pricing.total, settings.currency)],
      ['Prix estimé d\'un lot', formatMoney(pricing.perLot, settings.currency)],
      [`Valeur estimée des ${nf(quota.lots)} lots`, formatMoney(pricing.sellable, settings.currency)]
    );
  }

  return createPortal(
    <div className="releve-print-overlay fixed inset-0 z-[3000] bg-slate-900/60 flex justify-center p-4 overflow-y-auto font-sans">
      <div ref={sheetRef} className="bg-white text-slate-900 w-full max-w-3xl rounded-lg shadow-xl my-auto overflow-hidden border border-slate-200 print:shadow-none print:border-0 print:rounded-none">
        <div data-pdf-ignore className="flex justify-between items-center px-6 py-3 border-b border-slate-200 bg-slate-50 print:hidden">
          <span className="font-semibold text-slate-800 text-[13px]">Fiche de mesure &amp; quota</span>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-9 px-3.5 bg-brand-700 hover:bg-brand-800 text-white text-[13px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {isDownloading ? 'Préparation…' : 'Télécharger PDF'}
            </button>
            <button onClick={handlePrint} className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-medium rounded-lg flex items-center gap-1.5 cursor-pointer">
              <Printer className="w-4 h-4 text-slate-500" /> Imprimer
            </button>
            <button onClick={onClose} className="h-9 px-3.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-medium rounded-lg cursor-pointer">
              Fermer
            </button>
          </div>
        </div>

        <div data-pdf-block>
          <OfficialHeaderBanner />
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div data-pdf-block className="text-center space-y-1">
            <h1 className="text-base font-black uppercase tracking-tight">Fiche de mesure &amp; quota de lotissement</h1>
            <div className="text-[11px] text-slate-600">Établie le {today}{authorLabel ? ` • ${authorLabel}` : ''}</div>
          </div>

          <div data-pdf-block className="releve-plans grid grid-cols-[1fr_2fr] items-start gap-3">
            <figure className="border border-slate-300 rounded overflow-hidden bg-white">
              <figcaption className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800">Plan de situation</figcaption>
              <SituationPlan parcel={zone} concessionPolygon={concessionPolygon} />
            </figure>
            <figure className="border border-slate-300 rounded overflow-hidden bg-white">
              <figcaption className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800">Plan de la zone mesurée</figcaption>
              <BornagePlan parcel={zone} pointPrefix="M" color={MEASURE_COLOR} />
            </figure>
          </div>

          <SatelliteFigure
            title="Vue satellite de la zone mesurée"
            points={ring}
            color="#ffffff"
            pointPrefix="M"
            pointColor={MEASURE_COLOR}
          />

          <div data-pdf-block className="grid grid-cols-2 gap-4 items-start">
            <div>
              <h2 className="font-bold text-[11px] uppercase tracking-wider mb-1.5">Résultats</h2>
              <table className="w-full text-left text-[11px] border border-slate-300">
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label} className="border-b border-slate-200">
                      <td className="p-1.5 border border-slate-300 text-slate-600">{label}</td>
                      <td className="p-1.5 border border-slate-300 font-semibold text-right tabular-nums">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2 className="font-bold text-[11px] uppercase tracking-wider mb-1.5">Points mesurés (WGS84)</h2>
              <table className="w-full text-left text-[10.5px] border border-slate-300 font-mono">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-1.5 border border-slate-300">Point</th>
                    <th className="p-1.5 border border-slate-300">Latitude / Longitude</th>
                    <th className="p-1.5 border border-slate-300 text-right">Côté suivant</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map(([lat, lng], i) => (
                    <tr key={i}>
                      <td className="p-1.5 border border-slate-300 font-bold">M{i + 1}</td>
                      <td className="p-1.5 border border-slate-300">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                        <div className="text-[9px] text-slate-500">{ddToDms(lat, true)} | {ddToDms(lng, false)}</div>
                      </td>
                      <td className="p-1.5 border border-slate-300 text-right whitespace-nowrap">{formatMeters(measure.sides[i] || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p data-pdf-block className="text-[10px] text-slate-500 italic">
            Estimation indicative calculée sur la superficie : la forme du terrain, les servitudes et le tracé définitif des voies
            peuvent modifier le nombre réel de lots. Ce document ne vaut pas titre foncier.
          </p>

          <div data-pdf-block className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8">
            <div className="text-center space-y-12">
              <span className="text-[11px] font-bold uppercase block">Le Géomètre-Arpenteur</span>
              <div className="text-[10px] text-slate-400 italic">Signature &amp; visa</div>
            </div>
            <div className="text-center space-y-12">
              <span className="text-[11px] font-bold uppercase block">La Direction de la Concession</span>
              <div className="text-[10px] text-slate-400 italic">Signature &amp; sceau</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
