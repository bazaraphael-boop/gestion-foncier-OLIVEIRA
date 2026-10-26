import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, ShieldAlert, Layers3 } from 'lucide-react';
import { validateParcelGeometry, getNextRmbLotNumber } from '../utils/geoUtils';
import { parseUtmParcels, utmToLatLng, DEFAULT_UTM_ZONE } from '../utils/utm';

// Several parcels at once from the Cadastre's UTM lists, e.g.
// Parcelle 1 = 0203417,9346432: 0203434,9346394: 0203453,9346417: 0203436,9346427
// Each parcel is converted to GPS, checked (Turf: shape, concession perimeter, overlaps), then saved together.

const EXAMPLE = `Parcelle 1 = 0203417,9346432: 0203434,9346394: 0203453,9346417: 0203436,9346427
Parcelle 2 = ...`;

export default function CadastreBatchModal({ isOpen, onClose, onAddParcels, concessionPolygon, existingParcels = [] }) {
  const [text, setText] = useState('');
  const [zoneKey, setZoneKey] = useState(`${DEFAULT_UTM_ZONE.zone}${DEFAULT_UTM_ZONE.hemisphere}`);
  const [analysed, setAnalysed] = useState(null); // parsed parcels with validation
  const [edits, setEdits] = useState({}); // per row: { lotNumber, occupantName, status, include }

  const zone = { zone: parseInt(zoneKey, 10), hemisphere: zoneKey.slice(-1) };

  const handleAnalyse = () => {
    const groups = parseUtmParcels(text);
    const accepted = [];
    const rows = groups.map((g) => {
      const ring = g.points.map((pt) => {
        const { lat, lng } = utmToLatLng(pt.easting, pt.northing, zone);
        return [lng, lat];
      });
      // Each parcel is also checked against the ones above it in the list (no overlap between them)
      const validation =
        ring.length >= 3
          ? validateParcelGeometry(ring, concessionPolygon, [...existingParcels, ...accepted])
          : { isValid: false, errors: ['Moins de 3 bornes reconnues.'], warnings: [], areaInfo: null };
      if (validation.isValid) {
        accepted.push({ type: 'Feature', id: `pending_${accepted.length}`, properties: { lotNumber: g.label }, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
      }
      return { ...g, ring, validation };
    });

    // Consecutive RMB numbers after the existing ones
    const numbered = [...existingParcels];
    const nextEdits = {};
    rows.forEach((row, i) => {
      const lotNumber = getNextRmbLotNumber(numbered);
      numbered.push({ properties: { lotNumber } });
      // An overlapping parcel (often the same one pasted twice) is left unticked until the user checks it
      const overlaps = (row.validation.warnings || []).some((w) => w.startsWith('Chevauchement'));
      nextEdits[i] = { lotNumber, occupantName: '', status: 'disponible', include: row.validation.isValid && !overlaps };
    });
    setEdits(nextEdits);
    setAnalysed(rows);
  };

  const setEdit = (i, key, value) => setEdits((prev) => ({ ...prev, [i]: { ...prev[i], [key]: value } }));
  const selected = useMemo(() => (analysed || []).filter((row, i) => edits[i]?.include && row.validation.isValid), [analysed, edits]);

  const handleSave = () => {
    const now = Date.now();
    const parcels = (analysed || [])
      .map((row, i) => ({ row, edit: edits[i], i }))
      .filter(({ row, edit }) => edit?.include && row.validation.isValid)
      .map(({ row, edit, i }) => {
        const area = row.validation.areaInfo;
        return {
          type: 'Feature',
          id: `parcelle_${now}_${i + 1}`,
          properties: {
            lotNumber: edit.lotNumber || row.label,
            status: edit.status,
            occupantName: edit.occupantName,
            notes: `Saisie Cadastre UTM (${row.label})`,
            createdAt: new Date().toISOString().split('T')[0],
            areaSqM: area.sqMeters,
            areaHa: area.hectares,
            formattedSqM: area.formattedSqM,
            formattedHa: area.formattedHa,
            sourceCoordinates: {
              system: `UTM WGS84 zone ${zone.zone}${zone.hemisphere}`,
              order: 'X (Easting), Y (Northing)',
              points: row.points.map((pt) => `${pt.xStr},${pt.yStr}`)
            }
          },
          geometry: { type: 'Polygon', coordinates: [[...row.ring, row.ring[0]]] }
        };
      });
    if (parcels.length) {
      onAddParcels(parcels);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-900/60 flex justify-center items-center p-4 overflow-y-auto font-sans">
      <div className="bg-white text-slate-800 w-full max-w-3xl rounded-xl shadow-[0_20px_48px_-12px_rgba(15,37,64,0.45)] border border-slate-200 overflow-hidden my-auto">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Layers3 className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-semibold text-[15px] text-slate-900">Saisie Cadastre : plusieurs parcelles</h2>
              <p className="text-[12px] text-slate-500">Coordonnées UTM WGS84 (X, Y) converties automatiquement en GPS</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-[13px]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="cadastre-batch" className="font-semibold text-slate-800">Une parcelle par ligne</label>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                Zone UTM
                <select value={zoneKey} onChange={(e) => { setZoneKey(e.target.value); setAnalysed(null); }} className="h-8 px-2 bg-white border border-slate-300 rounded-md text-[12px] font-semibold cursor-pointer">
                  {['32S', '33S', '34S', '35S', '32N', '33N', '34N', '35N'].map((z) => (
                    <option key={z} value={z}>{z}{z === '33S' ? ' (Muanda)' : ''}</option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              id="cadastre-batch"
              rows={6}
              value={text}
              onChange={(e) => { setText(e.target.value); setAnalysed(null); }}
              placeholder={EXAMPLE}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[12px] text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="text-[12px] text-slate-500">
              Premier nombre = X (Easting), second = Y (Northing). Bornes séparées par « : », « ; » ou un retour à la ligne ;
              une ligne vide sépare deux parcelles. Les zéros devant (0203417) sont conservés.
            </p>
          </div>

          <div className="flex justify-end">
            <button onClick={handleAnalyse} disabled={!text.trim()} className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-medium cursor-pointer disabled:opacity-40">
              Convertir et vérifier
            </button>
          </div>

          {analysed && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2 font-medium w-8"></th>
                    <th className="px-2.5 py-2 font-medium">Parcelle</th>
                    <th className="px-2.5 py-2 font-medium">N° de lot</th>
                    <th className="px-2.5 py-2 font-medium">Occupant</th>
                    <th className="px-2.5 py-2 font-medium">Superficie</th>
                    <th className="px-2.5 py-2 font-medium">Vérification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysed.map((row, i) => {
                    const ok = row.validation.isValid;
                    const first = row.ring[0];
                    return (
                      <tr key={i} className={ok ? '' : 'bg-rose-50/40'}>
                        <td className="px-2.5 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={!!edits[i]?.include && ok}
                            disabled={!ok}
                            onChange={(e) => setEdit(i, 'include', e.target.checked)}
                            aria-label={`Enregistrer ${row.label}`}
                            className="w-4 h-4 accent-[#1a3a5c] cursor-pointer"
                          />
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          <div className="font-semibold text-slate-900">{row.label}</div>
                          <div className="text-[11px] text-slate-500">{row.points.length} bornes</div>
                          {first && <div className="text-[10.5px] font-mono text-slate-500 tabular-nums">B1 = {first[1].toFixed(7)}, {first[0].toFixed(7)}</div>}
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          <input value={edits[i]?.lotNumber || ''} onChange={(e) => setEdit(i, 'lotNumber', e.target.value)} disabled={!ok} className="w-24 h-8 px-2 bg-white border border-slate-300 rounded-md font-mono text-[12px] disabled:bg-slate-100" />
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          <input value={edits[i]?.occupantName || ''} onChange={(e) => setEdit(i, 'occupantName', e.target.value)} disabled={!ok} placeholder="Facultatif" className="w-36 h-8 px-2 bg-white border border-slate-300 rounded-md text-[12px] disabled:bg-slate-100" />
                        </td>
                        <td className="px-2.5 py-2 align-top tabular-nums whitespace-nowrap">
                          {row.validation.areaInfo ? (
                            <>
                              <div className="font-semibold text-slate-900">{row.validation.areaInfo.formattedHa}</div>
                              <div className="text-[11px] text-slate-500">{row.validation.areaInfo.formattedSqM}</div>
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          {ok ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Valide</span>
                          ) : (
                            <span className="text-rose-700 flex items-start gap-1"><ShieldAlert className="w-4 h-4 flex-shrink-0 mt-px" /> {[...row.errors, ...(row.validation.errors || [])][0]}</span>
                          )}
                          {ok && row.validation.warnings?.[0] && <div className="text-[11px] text-amber-700 mt-0.5">{row.validation.warnings[0]}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[13px] font-medium cursor-pointer">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!selected.length} className="h-9 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-40">
            Enregistrer {selected.length || ''} parcelle{selected.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
