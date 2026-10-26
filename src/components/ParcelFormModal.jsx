import React, { useState, useEffect } from 'react';
import { validateParcelGeometry, dmsToDd, ddToDms, getNextRmbLotNumber, parseDecimal } from '../utils/geoUtils';
import { utmToLatLng, latLngToUtm, parseUtmList, DEFAULT_UTM_ZONE } from '../utils/utm';
import { getOceanZoneInfo } from '../utils/coastalZones';
import { X, Plus, Trash2, MapPin, Compass, CheckCircle2, ShieldAlert, Hexagon, Square, Waves, Pencil, Loader2 } from 'lucide-react';
import { PhotoPicker } from './ParcelPhotos';
import { uploadParcelPhotos } from '../services/photoService';

export default function ParcelFormModal({
  isOpen,
  onClose,
  onAddParcel,
  concessionPolygon,
  existingParcels,
  initialPoints,
  onStartDrawing,
  onOpenCadastreBatch
}) {
  const [lotNumber, setLotNumber] = useState('');
  const [status, setStatus] = useState('disponible');
  const [occupantName, setOccupantName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoItems, setPhotoItems] = useState([]); // { file, location, takenAt }
  const [isSaving, setIsSaving] = useState(false);
  // 'dd' | 'dms' | 'utm' (UTM WGS84 X,Y, zone to choose) | 'cadastre' (UTM WGS84 zone 33S, as written by the Cadastre)
  const [coordFormat, setCoordFormat] = useState('dd');
  const [utmZoneKey, setUtmZoneKey] = useState(`${DEFAULT_UTM_ZONE.zone}${DEFAULT_UTM_ZONE.hemisphere}`);
  const [utmPaste, setUtmPaste] = useState('');
  const [utmPasteErrors, setUtmPasteErrors] = useState([]);

  // Default 4 GPS vertex points (P1 to P4)
  const [points, setPoints] = useState([
    { latStr: '', lngStr: '' },
    { latStr: '', lngStr: '' },
    { latStr: '', lngStr: '' },
    { latStr: '', lngStr: '' }
  ]);

  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    const nextRmb = getNextRmbLotNumber(existingParcels);
    if (initialPoints && initialPoints.length >= 3) {
      setPoints(initialPoints);
      setLotNumber(nextRmb);
    } else {
      setLotNumber(nextRmb);
      setPoints([
        { latStr: '', lngStr: '' },
        { latStr: '', lngStr: '' },
        { latStr: '', lngStr: '' },
        { latStr: '', lngStr: '' }
      ]);
    }
    setValidationResult(null);
    setPhotoItems([]);
    setIsSaving(false);
  }, [isOpen, initialPoints, existingParcels]);

  if (!isOpen) return null;

  const setPointsPreset = (count) => {
    const newPts = [];
    for (let i = 0; i < count; i++) {
      newPts.push(points[i] || { latStr: '', lngStr: '' });
    }
    setPoints(newPts);
  };

  const handlePointChange = (index, field, value) => {
    const newPts = [...points];
    newPts[index][field] = value;
    setPoints(newPts);
  };

  const handleAddPointField = () => {
    setPoints([...points, { latStr: '', lngStr: '' }]);
  };

  const handleRemovePointField = (index) => {
    if (points.length <= 3) {
      alert('Un polygone doit comporter au moins 3 sommets GPS.');
      return;
    }
    setPoints(points.filter((_, i) => i !== index));
  };

  const isUtmFormat = (format) => format === 'utm' || format === 'cadastre';
  const utmZoneOf = (format) => {
    if (format === 'cadastre') return DEFAULT_UTM_ZONE;
    return { zone: parseInt(utmZoneKey, 10), hemisphere: utmZoneKey.slice(-1) };
  };

  // In UTM formats the two fields hold X (Easting) then Y (Northing), kept as typed (leading zeros)
  const pointToLatLng = (p, format = coordFormat) => {
    if (!p.latStr || !p.lngStr) return null;
    let lat;
    let lng;
    if (isUtmFormat(format)) {
      const x = parseDecimal(p.latStr);
      const y = parseDecimal(p.lngStr);
      if (isNaN(x) || isNaN(y)) return null;
      ({ lat, lng } = utmToLatLng(x, y, utmZoneOf(format)));
    } else if (format === 'dms') {
      lat = dmsToDd(p.latStr);
      lng = dmsToDd(p.lngStr);
    } else {
      lat = parseDecimal(p.latStr);
      lng = parseDecimal(p.lngStr);
    }
    return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
  };

  const latLngToPoint = (lat, lng, format) => {
    if (isUtmFormat(format)) {
      const { easting, northing } = latLngToUtm(lat, lng, utmZoneOf(format));
      return { latStr: String(Math.round(easting)).padStart(7, '0'), lngStr: String(Math.round(northing)) };
    }
    if (format === 'dms') return { latStr: ddToDms(lat, true), lngStr: ddToDms(lng, false) };
    return { latStr: lat.toFixed(6), lngStr: lng.toFixed(6) };
  };

  // Switching format converts the bornes already typed
  const changeFormat = (format) => {
    if (format === coordFormat) return;
    setPoints(
      points.map((p) => {
        const ll = pointToLatLng(p);
        return ll ? latLngToPoint(ll.lat, ll.lng, format) : { latStr: '', lngStr: '' };
      })
    );
    setCoordFormat(format);
    setValidationResult(null);
  };

  // Paste of the Cadastre list: "0203417,9346432: 0203434,9346394 ..." (":" ";" or new lines)
  const handleFillFromUtmList = () => {
    const { points: parsed, errors } = parseUtmList(utmPaste);
    setUtmPasteErrors(errors);
    if (parsed.length >= 3) {
      setPoints(parsed.map((pt) => ({ latStr: pt.xStr, lngStr: pt.yStr })));
      setValidationResult(null);
    } else if (!errors.length) {
      setUtmPasteErrors(['Il faut au moins 3 couples X,Y pour former une parcelle.']);
    }
  };

  const parseRingCoordinates = () =>
    points.map((p) => pointToLatLng(p)).filter(Boolean).map(({ lat, lng }) => [lng, lat]);

  const handleValidateGeometry = () => {
    const ringCoords = parseRingCoordinates();

    if (ringCoords.length < 3) {
      setValidationResult({
        isValid: false,
        areaInfo: null,
        errors: ['Veuillez renseigner au moins 3 sommets GPS valides pour former un polygone.'],
        warnings: []
      });
      return { isValid: false, errors: ['Au moins 3 sommets requis'] };
    }

    const result = validateParcelGeometry(ringCoords, concessionPolygon, existingParcels);
    setValidationResult(result);
    return result;
  };

  const handleAddCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pt = latLngToPoint(pos.coords.latitude, pos.coords.longitude, coordFormat);
          const emptyIdx = points.findIndex((p) => !p.latStr || !p.lngStr);
          if (emptyIdx !== -1) {
            handlePointChange(emptyIdx, 'latStr', pt.latStr);
            handlePointChange(emptyIdx, 'lngStr', pt.lngStr);
          } else {
            setPoints([...points, pt]);
          }
        },
        (err) => {
          alert('Erreur GPS : ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const val = handleValidateGeometry();

    if (!val.isValid) {
      alert('Veuillez corriger les erreurs de géométrie avant d\'enregistrer.');
      return;
    }

    const ringCoords = parseRingCoordinates();
    if (
      ringCoords[0][0] !== ringCoords[ringCoords.length - 1][0] ||
      ringCoords[0][1] !== ringCoords[ringCoords.length - 1][1]
    ) {
      ringCoords.push([ringCoords[0][0], ringCoords[0][1]]);
    }

    const area = val.areaInfo;
    const parcelId = `parcelle_${Date.now()}`;

    // Photos are uploaded first so the parcel is saved with their storage paths
    let photos = [];
    if (photoItems.length > 0) {
      setIsSaving(true);
      const { uploaded, errors } = await uploadParcelPhotos(parcelId, photoItems, { lotRef: lotNumber });
      photos = uploaded;
      setIsSaving(false);
      if (errors.length > 0) {
        alert(`${errors.length} photo(s) n'ont pas pu être envoyées : ${errors[0]}\nLa parcelle est enregistrée${uploaded.length ? ` avec ${uploaded.length} photo(s)` : ' sans photo'} ; vous pourrez en ajouter depuis sa fiche.`);
      }
    }

    const newParcel = {
      type: 'Feature',
      id: parcelId,
      properties: {
        lotNumber: lotNumber || `LOT-${Date.now()}`,
        status,
        occupantName,
        notes,
        ...(photos.length ? { photos } : {}),
        ...(isUtmFormat(coordFormat)
          ? {
              sourceCoordinates: {
                system: `UTM WGS84 zone ${utmZoneOf(coordFormat).zone}${utmZoneOf(coordFormat).hemisphere}`,
                order: 'X (Easting), Y (Northing)',
                points: points.filter((pt) => pointToLatLng(pt)).map((pt) => `${String(pt.latStr).trim()},${String(pt.lngStr).trim()}`)
              }
            }
          : {}),
        createdAt: new Date().toISOString().split('T')[0],
        areaSqM: area.sqMeters,
        areaHa: area.hectares,
        formattedSqM: area.formattedSqM,
        formattedHa: area.formattedHa
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ringCoords]
      }
    };

    onAddParcel(newParcel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white text-slate-800 w-full max-w-xl rounded-lg shadow-xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <h2 className="font-bold text-base text-slate-900">
              Saisie de Parcelle (Forme Libre / Hexagonale)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Quick Tracing Action Button */}
          {onStartDrawing && (
            <div className="bg-brand-50 border border-brand-100 rounded-lg p-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-brand-900 font-medium">
                <Pencil className="w-4 h-4 text-brand-700 flex-shrink-0" />
                <span>Tracer et marquer les bornes sur le terrain (GPS / Viseur) ?</span>
              </div>
              <button
                type="button"
                onClick={onStartDrawing}
                className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer flex-shrink-0"
              >
                <span>Tracer sur la Carte</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Identifiant / N° Lot *</label>
              <input
                type="text"
                required
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Ex: RMB/001"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Statut d'Occupation *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
              >
                <option value="disponible">Disponible / Libre (Vert)</option>
                <option value="occupe">Occupé / Attribué (Rouge)</option>
                <option value="litige">Litige / Réclamé (Orange)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nom de l'Occupant / Exploitant</label>
            <input
              type="text"
              value={occupantName}
              onChange={(e) => setOccupantName(e.target.value)}
              placeholder="Ex: Nom du concessionnaire"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400"
            />
          </div>

          <PhotoPicker items={photoItems} onChange={setPhotoItems} disabled={isSaving} />

          {/* Preset Buttons for Geometry (4 sommets / 6 sommets Hexagone / Custom) */}
          <div className="flex items-center justify-between bg-slate-100 p-2 rounded border border-slate-200">
            <span className="font-bold text-slate-700 text-[11px]">Format de Géométrie :</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPointsPreset(4)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  points.length === 4 ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Square className="w-3 h-3 text-slate-500" /> 4 bornes (standard)
              </button>
              <button
                type="button"
                onClick={() => setPointsPreset(6)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  points.length === 6 ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Hexagon className="w-3 h-3 text-slate-500" /> 6 bornes (hexagone)
              </button>
            </div>
          </div>

          {/* GPS Coordinates Input Section */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-slate-500" /> Bornes GPS ({points.length})
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={coordFormat}
                  onChange={(e) => changeFormat(e.target.value)}
                  aria-label="Format des coordonnées"
                  className="h-7 px-2 bg-white border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800 cursor-pointer focus:outline-none focus:border-brand-500"
                >
                  <option value="dd">GPS décimal (DD) : -5.914, 12.341</option>
                  <option value="dms">GPS degrés-minutes-secondes (DMS)</option>
                  <option value="utm">UTM WGS84 (X, Y)</option>
                  <option value="cadastre">Cadastre local : 0203xxx, 9346xxx</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddCurrentLocation}
                  className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-semibold text-[11px] flex items-center gap-1 hover:bg-indigo-100"
                >
                  <Compass className="w-3 h-3" /> Point GPS Live
                </button>
              </div>
            </div>

            {isUtmFormat(coordFormat) && (
              <div className="space-y-2 bg-white border border-slate-200 rounded-lg p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-600">
                    Premier nombre = <strong>X (Easting)</strong>, second = <strong>Y (Northing)</strong>. Datum WGS84.
                  </span>
                  {coordFormat === 'utm' ? (
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      Zone
                      <select
                        value={utmZoneKey}
                        onChange={(e) => { setUtmZoneKey(e.target.value); setValidationResult(null); }}
                        className="h-7 px-1.5 bg-white border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800 cursor-pointer"
                      >
                        {['32S', '33S', '34S', '35S', '32N', '33N', '34N', '35N'].map((z) => (
                          <option key={z} value={z}>{z}{z === '33S' ? ' (Muanda)' : ''}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-700">Zone 33S (Muanda)</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={utmPaste}
                  onChange={(e) => setUtmPaste(e.target.value)}
                  placeholder={'Collez la liste du Cadastre, ex :\n0203417,9346432: 0203434,9346394: 0203453,9346417: 0203436,9346427'}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] text-slate-900 focus:outline-none focus:border-brand-500"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    Séparateurs : « : », « ; » ou retour à la ligne.
                    {onOpenCadastreBatch && (
                      <>
                        {' '}
                        <button type="button" onClick={onOpenCadastreBatch} className="text-brand-600 hover:text-brand-800 font-semibold underline underline-offset-2 cursor-pointer">
                          Plusieurs parcelles d’un coup ?
                        </button>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleFillFromUtmList}
                    disabled={!utmPaste.trim()}
                    className="h-7 px-3 bg-brand-700 hover:bg-brand-800 text-white rounded-md text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                  >
                    Remplir les bornes
                  </button>
                </div>
                {utmPasteErrors.map((err, i) => (
                  <div key={i} className="text-[11px] text-rose-700">• {err}</div>
                ))}
              </div>
            )}

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {points.map((pt, idx) => (
                <div key={idx} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 w-7 text-right font-mono">B{idx + 1}</span>
                  <input
                    type="text"
                    inputMode={isUtmFormat(coordFormat) ? 'numeric' : undefined}
                    placeholder={isUtmFormat(coordFormat) ? 'X Easting (ex: 0203417)' : coordFormat === 'dd' ? 'Latitude (ex: -5.914822)' : 'Lat DMS'}
                    value={pt.latStr}
                    onChange={(e) => handlePointChange(idx, 'latStr', e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                  <input
                    type="text"
                    inputMode={isUtmFormat(coordFormat) ? 'numeric' : undefined}
                    placeholder={isUtmFormat(coordFormat) ? 'Y Northing (ex: 9346432)' : coordFormat === 'dd' ? 'Longitude (ex: 12.341789)' : 'Lng DMS'}
                    value={pt.lngStr}
                    onChange={(e) => handlePointChange(idx, 'lngStr', e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePointField(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Retirer cette borne"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isUtmFormat(coordFormat) && pointToLatLng(pt) && (
                  <div className="pl-9 text-[10.5px] font-mono text-slate-500 tabular-nums">
                    = GPS {pointToLatLng(pt).lat.toFixed(7)}, {pointToLatLng(pt).lng.toFixed(7)}
                  </div>
                )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={handleAddPointField}
                className="text-brand-600 hover:text-brand-800 font-semibold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter la borne B{points.length + 1}
              </button>
              <button
                type="button"
                onClick={handleValidateGeometry}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 cursor-pointer"
              >
                Vérifier Géométrie (Turf.js)
              </button>
            </div>
          </div>

          {/* Real-time Coastal Ocean Situation Badge */}
          {(() => {
            const validPts = parseRingCoordinates();
            if (validPts.length === 0) return null;
            const oceanInfo = getOceanZoneInfo(validPts);
            if (!oceanInfo) return null;

            return (
              <div
                className="p-2.5 rounded border flex items-center justify-between text-xs"
                style={{
                  backgroundColor: `${oceanInfo.color}12`,
                  borderColor: `${oceanInfo.color}45`
                }}
              >
                <div className="flex items-center gap-1.5 font-bold" style={{ color: oceanInfo.color }}>
                  <Waves className="w-4 h-4" />
                  <span>Situation Littorale : {oceanInfo.zoneName}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-700">
                  <span>Distance :</span>
                  <strong className="text-slate-900">{oceanInfo.distanceFormatted}</strong>
                </div>
              </div>
            );
          })()}

          {/* Turf Validation Results Box */}
          {validationResult && (
            <div className={`p-3 rounded border text-xs space-y-1 ${validationResult.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              <div className="font-bold flex items-center gap-1.5">
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                )}
                <span>{validationResult.isValid ? `Tracé valide (${points.length} bornes)` : 'Erreurs de Géométrie'}</span>
              </div>
              {validationResult.areaInfo && (
                <div className="font-medium">
                  Surface calculée : <strong>{validationResult.areaInfo.formattedHa}</strong> ({validationResult.areaInfo.formattedSqM})
                </div>
              )}
              {validationResult.errors && validationResult.errors.map((err, i) => (
                <div key={i} className="text-rose-700">• {err}</div>
              ))}
              {validationResult.warnings && validationResult.warnings.map((warn, i) => (
                <div key={i} className="text-amber-700">• {warn}</div>
              ))}
            </div>
          )}

          {/* Footer Form Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSaving ? 'Envoi des photos…' : 'Enregistrer la parcelle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
