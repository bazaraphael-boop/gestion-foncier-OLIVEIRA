import React, { useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import { X, Layers3, Trash2, PenTool, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { calculateArea, hasCrossingSides } from '../utils/geoUtils';
import { parseUtmList, utmToLatLng } from '../utils/utm';
import { ZONE_COLORS } from '../data/defaultZones';

// Admin only: list, add and delete the zones of the concession (Zone ISETECH…).
// A new zone comes from a trace on the map (initialPoints) or from pasted Cadastre UTM coordinates.

const inputClass =
  'w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

export default function ZoneManagerModal({ isOpen, onClose, zones, concessionPolygon, initialPoints, onAddZone, onRemoveZone, onStartDrawing }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(ZONE_COLORS[1]);
  const [utmText, setUtmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error' | 'ok', text }
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Ring as [lng, lat]: from the trace on the map, else from the pasted UTM list
  const draft = useMemo(() => {
    if (initialPoints?.length) {
      return { ring: initialPoints.map(([lat, lng]) => [lng, lat]), errors: [], source: 'trace' };
    }
    const { points, errors } = parseUtmList(utmText);
    return {
      ring: points.map((p) => {
        const { lat, lng } = utmToLatLng(p.easting, p.northing);
        return [lng, lat];
      }),
      errors,
      source: 'utm'
    };
  }, [initialPoints, utmText]);

  const check = useMemo(() => {
    const { ring } = draft;
    if (ring.length < 3) return { ok: false, text: 'Au moins 3 bornes sont nécessaires.' };
    if (hasCrossingSides(ring)) return { ok: false, text: 'Des côtés se croisent : les bornes ne sont pas dans l’ordre.' };
    const polygon = turf.polygon([[...ring, ring[0]]]);
    const area = calculateArea(polygon);
    let warning = '';
    try {
      if (concessionPolygon && !turf.booleanWithin(polygon, concessionPolygon)) warning = 'La zone dépasse le périmètre de la concession.';
    } catch {
      // Concession check is a hint only
    }
    return { ok: true, area, warning, polygon };
  }, [draft, concessionPolygon]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !check.ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await onAddZone({
        type: 'Feature',
        id: `zone_${Date.now()}`,
        properties: { name: name.trim(), color },
        geometry: check.polygon.geometry
      });
      setMessage({ tone: 'ok', text: `« ${name.trim()} » ajoutée (${check.area.formattedHa}).` });
      setName('');
      setUtmText('');
      if (draft.source === 'trace') onClose();
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (zone) => {
    setBusy(true);
    setMessage(null);
    try {
      await onRemoveZone(zone.id);
      setMessage({ tone: 'ok', text: `« ${zone.properties.name} » supprimée.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-900/60 flex justify-center items-center p-4 overflow-y-auto font-sans">
      <div role="dialog" aria-modal="true" aria-labelledby="zone-manager-title" className="bg-white text-slate-800 w-full max-w-xl rounded-xl shadow-[0_20px_48px_-12px_rgba(15,37,64,0.45)] border border-slate-200 overflow-hidden my-auto">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Layers3 className="w-4 h-4" />
            </span>
            <div>
              <h2 id="zone-manager-title" className="font-semibold text-[15px] text-slate-900">Zones de la concession</h2>
              <p className="text-[12px] text-slate-500">Réservé à l’administrateur</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-[13px]">
          {/* Existing zones */}
          <section className="space-y-2">
            <h3 className="font-semibold text-slate-900">Zones existantes ({zones.length})</h3>
            {zones.length === 0 ? (
              <p className="text-slate-500">Aucune zone.</p>
            ) : (
              <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {zones.map((zone) => (
                  <li key={zone.id} className="px-3 py-2">
                    {confirmDelete === zone.id ? (
                      <div className="space-y-2">
                        <p className="text-slate-800">
                          Supprimer <strong>{zone.properties.name}</strong> ? Les parcelles qui s’y trouvent restent enregistrées.
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(zone)} disabled={busy} className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[12px] font-semibold cursor-pointer disabled:opacity-50">
                            Supprimer la zone
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-[12px] cursor-pointer">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: zone.properties.color }} />
                        <span className="flex-1 min-w-0 truncate font-medium text-slate-900">{zone.properties.name}</span>
                        <span className="text-[12px] text-slate-500 tabular-nums">{calculateArea(zone).formattedHa}</span>
                        <button onClick={() => setConfirmDelete(zone.id)} title="Supprimer la zone" aria-label={`Supprimer ${zone.properties.name}`} className="w-8 h-8 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* New zone */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="font-semibold text-slate-900">Nouvelle zone</h3>
            <div className="grid sm:grid-cols-[1fr_auto] gap-3">
              <label className="space-y-1">
                <span className="block text-[12px] text-slate-600">Nom de la zone</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Zone Bakumba" className={inputClass} />
              </label>
              <fieldset className="space-y-1">
                <legend className="block text-[12px] text-slate-600 mb-1">Couleur</legend>
                <div className="flex gap-1.5 h-9 items-center">
                  {ZONE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={`Couleur ${c}`}
                      aria-pressed={color === c}
                      className={`w-7 h-7 rounded-md cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </fieldset>
            </div>

            {draft.source === 'trace' ? (
              <p className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                Limites tracées sur la carte : <strong>{draft.ring.length} bornes</strong>.
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] text-slate-600">Bornes de la zone en UTM 33S (X,Y), séparées par « : », « ; » ou une ligne</span>
                  {onStartDrawing && (
                    <button type="button" onClick={onStartDrawing} className="h-8 px-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-md text-[12px] font-medium flex items-center gap-1.5 cursor-pointer">
                      <PenTool className="w-3.5 h-3.5 text-slate-500" /> Tracer sur la carte
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={utmText}
                  onChange={(e) => setUtmText(e.target.value)}
                  placeholder="0203417,9346432: 0203434,9346394: 0203453,9346417"
                  aria-label="Coordonnées UTM des bornes de la zone"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[12px] text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                {draft.errors[0] && <p className="text-[12px] text-rose-700">{draft.errors[0]}</p>}
              </div>
            )}

            {(draft.ring.length > 0 || draft.source === 'trace') &&
              (check.ok ? (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Surface : {check.area.formattedHa} ({check.area.formattedSqM})
                  </div>
                  {check.warning && <div className="text-amber-700 text-[12px]">{check.warning}</div>}
                </div>
              ) : (
                <p className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {check.text}
                </p>
              ))}
          </section>

          {message && (
            <p role="status" className={`text-[12.5px] ${message.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
              {message.text}
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[13px] font-medium cursor-pointer">
            Fermer
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !name.trim() || !check.ok}
            className="h-9 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ajouter la zone
          </button>
        </div>
      </div>
    </div>
  );
}
