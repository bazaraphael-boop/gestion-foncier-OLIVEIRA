import React, { useState } from 'react';
import { X, Upload, FileCode2, AlertCircle, Plus, CheckCircle2 } from 'lucide-react';
import { calculateArea } from '../utils/geoUtils';

export default function GeoJsonImporterModal({
  isOpen,
  onClose,
  onAddParcels
}) {
  const [file, setFile] = useState(null);
  const [defaultStatus, setDefaultStatus] = useState('disponible');
  const [parsedParcels, setParsedParcels] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      processGeoJsonText(evt.target.result);
    };
    reader.readAsText(selectedFile);
  };

  const processGeoJsonText = (text) => {
    setErrorMsg(null);
    try {
      const parsedData = JSON.parse(text);

      let features = [];
      if (parsedData.type === 'FeatureCollection' && Array.isArray(parsedData.features)) {
        features = parsedData.features;
      } else if (parsedData.type === 'Feature') {
        features = [parsedData];
      } else if (parsedData.type === 'Polygon' || parsedData.type === 'MultiPolygon') {
        features = [{ type: 'Feature', geometry: parsedData, properties: {} }];
      } else if (Array.isArray(parsedData)) {
        features = parsedData;
      }

      const polygonFeatures = features.filter(
        (f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      );

      if (polygonFeatures.length === 0) {
        setErrorMsg('Le fichier GeoJSON ne contient aucun polygone de parcelle valide.');
        setParsedParcels([]);
        return;
      }

      const parcels = polygonFeatures.map((feat, index) => {
        const areaInfo = calculateArea(feat);
        const props = feat.properties || {};
        const lotNumber = props.lotNumber || props.name || props.id || `LOT-GEOJSON-${index + 1}`;
        const occupantName = props.occupantName || props.occupant || props.description || '';

        return {
          type: 'Feature',
          id: `geojson_parcel_${Date.now()}_${index}`,
          properties: {
            lotNumber: lotNumber.startsWith('LOT') ? lotNumber : `LOT-${lotNumber}`,
            status: props.status || defaultStatus,
            occupantName: occupantName,
            notes: props.notes || `Importé depuis fichier GeoJSON ${file ? file.name : ''}`,
            createdAt: new Date().toISOString().split('T')[0],
            areaSqM: areaInfo.sqMeters,
            areaHa: areaInfo.hectares,
            formattedSqM: areaInfo.formattedSqM,
            formattedHa: areaInfo.formattedHa
          },
          geometry: feat.geometry
        };
      });

      setParsedParcels(parcels);
    } catch (err) {
      setErrorMsg('Erreur lors du décodage du fichier GeoJSON : ' + err.message);
      setParsedParcels([]);
    }
  };

  const handleConfirmImport = () => {
    if (parsedParcels.length === 0) return;
    onAddParcels(parsedParcels);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 overflow-y-auto font-sans select-none animate-in fade-in duration-200">
      <div className="bg-white text-slate-800 w-full max-w-xl rounded-lg shadow-xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <FileCode2 className="w-4 h-4 text-emerald-600" />
            <span>Importer un Fichier GeoJSON (.geojson / .json)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Sélectionnez ou glissez-déposez un fichier **GeoJSON**. Les entités géométriques, attributs d'occupation et superficies géodésiques seront extraits et enregistrés dans le cadastre.
          </p>

          {/* Drag & Drop File Zone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 p-6 rounded-lg text-center cursor-pointer transition-all relative">
            <input
              type="file"
              accept=".geojson,.json"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-2">
              <FileCode2 className="w-8 h-8 text-emerald-600" />
              <span className="font-bold text-slate-800">
                {file ? file.name : 'Cliquez ou glissez-déposez votre fichier GeoJSON ici'}
              </span>
              <span className="text-[11px] text-slate-400">
                Formats acceptés : `.geojson` ou `.json`
              </span>
            </div>
          </div>

          {/* Status Selection */}
          {parsedParcels.length > 0 && (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Statut par Défaut des Parcelles
                </label>
                <select
                  value={defaultStatus}
                  onChange={(e) => {
                    setDefaultStatus(e.target.value);
                    setParsedParcels(
                      parsedParcels.map((p) => ({
                        ...p,
                        properties: { ...p.properties, status: e.target.value }
                      }))
                    );
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-900 font-medium"
                >
                  <option value="disponible">🟢 Vert - Disponible / Libre</option>
                  <option value="occupe">🔴 Rouge - Occupé / Attribué</option>
                  <option value="litige">🟠 Orange - En Litige</option>
                </select>
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[11px] text-slate-500 font-medium">Lots GeoJSON Détectés</span>
                <span className="text-base font-black text-emerald-700">{parsedParcels.length} Parcelles</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Parsed Parcels List */}
          {parsedParcels.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-bold text-slate-800 text-xs block">Aperçu des Parcelles GeoJSON :</span>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded bg-white divide-y divide-slate-100 text-xs">
                {parsedParcels.map((p, i) => (
                  <div key={i} className="p-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{p.properties.lotNumber}</span>
                      {p.properties.occupantName && (
                        <span className="text-slate-500 text-[11px] ml-2 font-normal">
                          ({p.properties.occupantName})
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-emerald-700 font-mono">
                      {p.properties.formattedHa}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedParcels.length === 0}
            className={`px-4 py-1.5 text-white font-bold rounded shadow-2xs flex items-center gap-1.5 transition-all ${
              parsedParcels.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer' : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Importer {parsedParcels.length} Parcelles GeoJSON</span>
          </button>
        </div>
      </div>
    </div>
  );
}
