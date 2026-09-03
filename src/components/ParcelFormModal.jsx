import React, { useState, useEffect } from 'react';
import { validateParcelGeometry, dmsToDd } from '../utils/geoUtils';
import { X, Plus, Trash2, MapPin, Compass, CheckCircle2, ShieldAlert, Hexagon, Square } from 'lucide-react';

export default function ParcelFormModal({
  isOpen,
  onClose,
  onAddParcel,
  concessionPolygon,
  existingParcels,
  initialPoints
}) {
  const [lotNumber, setLotNumber] = useState('');
  const [status, setStatus] = useState('disponible');
  const [occupantName, setOccupantName] = useState('');
  const [notes, setNotes] = useState('');
  const [coordFormat, setCoordFormat] = useState('dd'); // 'dd' | 'dms'

  // Default 4 GPS vertex points (P1 to P4)
  const [points, setPoints] = useState([
    { latStr: '', lngStr: '' },
    { latStr: '', lngStr: '' },
    { latStr: '', lngStr: '' },
    { latStr: '', lngStr: '' }
  ]);

  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    if (initialPoints && initialPoints.length >= 3) {
      setPoints(initialPoints);
      setLotNumber(`LOT-${Math.floor(100 + Math.random() * 900)}`);
    } else {
      setLotNumber(`LOT-${Math.floor(100 + Math.random() * 900)}`);
      setPoints([
        { latStr: '', lngStr: '' },
        { latStr: '', lngStr: '' },
        { latStr: '', lngStr: '' },
        { latStr: '', lngStr: '' }
      ]);
    }
    setValidationResult(null);
  }, [isOpen, initialPoints]);

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

  const parseRingCoordinates = () => {
    const ring = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.latStr || !p.lngStr) continue;

      const lat = coordFormat === 'dms' ? dmsToDd(p.latStr) : parseFloat(p.latStr);
      const lng = coordFormat === 'dms' ? dmsToDd(p.lngStr) : parseFloat(p.lngStr);

      if (!isNaN(lat) && !isNaN(lng)) {
        ring.push([lng, lat]);
      }
    }
    return ring;
  };

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
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);

          const emptyIdx = points.findIndex((p) => !p.latStr || !p.lngStr);
          if (emptyIdx !== -1) {
            handlePointChange(emptyIdx, 'latStr', lat);
            handlePointChange(emptyIdx, 'lngStr', lng);
          } else {
            setPoints([...points, { latStr: lat, lngStr: lng }]);
          }
        },
        (err) => {
          alert('Erreur GPS : ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
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
    const newParcel = {
      type: 'Feature',
      id: `parcelle_${Date.now()}`,
      properties: {
        lotNumber: lotNumber || `LOT-${Date.now()}`,
        status,
        occupantName,
        notes,
        createdAt: new Date().toISOString().split('T')[0],
        areaSqM: area ? area.sqMeters : 600,
        areaHa: area ? area.hectares : 0.06,
        formattedSqM: area ? area.formattedSqM : '600 m²',
        formattedHa: area ? area.formattedHa : '0,06 ha'
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
            <MapPin className="w-4 h-4 text-emerald-600" />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Identifiant / N° Lot *</label>
              <input
                type="text"
                required
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Ex: LOT-C402"
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
                <option value="disponible">🟢 Vert - Disponible / Libre</option>
                <option value="occupe">🔴 Rouge - Occupé / Attribué</option>
                <option value="litige">🟠 Orange - Litige / Réclamé</option>
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
                <Square className="w-3 h-3 text-emerald-600" /> 4 Sommets (Standard)
              </button>
              <button
                type="button"
                onClick={() => setPointsPreset(6)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  points.length === 6 ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Hexagon className="w-3 h-3 text-cyan-600" /> 6 Sommets (Hexagone)
              </button>
            </div>
          </div>

          {/* GPS Coordinates Input Section */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-600" /> Sommets GPS ({points.length} points)
              </span>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200 p-0.5 rounded text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCoordFormat('dd')}
                    className={`px-2 py-0.5 rounded ${coordFormat === 'dd' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                  >
                    DD (ex: -5.914)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoordFormat('dms')}
                    className={`px-2 py-0.5 rounded ${coordFormat === 'dms' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                  >
                    DMS
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddCurrentLocation}
                  className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-semibold text-[11px] flex items-center gap-1 hover:bg-indigo-100"
                >
                  <Compass className="w-3 h-3" /> Point GPS Live
                </button>
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {points.map((pt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 w-7 text-right font-mono">P{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder={coordFormat === 'dd' ? 'Latitude (ex: -5.914822)' : 'Lat DMS'}
                    value={pt.latStr}
                    onChange={(e) => handlePointChange(idx, 'latStr', e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                  <input
                    type="text"
                    placeholder={coordFormat === 'dd' ? 'Longitude (ex: 12.341789)' : 'Lng DMS'}
                    value={pt.lngStr}
                    onChange={(e) => handlePointChange(idx, 'lngStr', e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePointField(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Supprimer ce sommet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={handleAddPointField}
                className="text-emerald-700 font-semibold text-xs flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter un sommet (P{points.length + 1})
              </button>
              <button
                type="button"
                onClick={handleValidateGeometry}
                className="px-3 py-1 bg-slate-800 text-white rounded font-medium text-xs hover:bg-slate-700 cursor-pointer"
              >
                Vérifier Géométrie (Turf.js)
              </button>
            </div>
          </div>

          {/* Turf Validation Results Box */}
          {validationResult && (
            <div className={`p-3 rounded border text-xs space-y-1 ${validationResult.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              <div className="font-bold flex items-center gap-1.5">
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                )}
                <span>{validationResult.isValid ? `Polygone Conforme (${points.length} Sommets)` : 'Erreurs de Géométrie'}</span>
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
              className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs shadow-xs cursor-pointer"
            >
              Enregistrer la Parcelle ({points.length} Sommets)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
