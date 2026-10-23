import React, { useState } from 'react';
import { parseKMLToGeoJSON, extractMainConcessionPolygon } from '../utils/kmlParser';
import { X, Upload, FileCode, CheckCircle, AlertTriangle, Layers } from 'lucide-react';
import { DEFAULT_KML_DATA } from '../data/defaultConcession';

export default function KmlImporter({ isOpen, onClose, onSetConcession }) {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileContent(evt.target.result);
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (!fileContent) {
      setError('Veuillez d\'abord sélectionner un fichier KML ou GeoJSON.');
      return;
    }

    try {
      let geojson;
      if (fileContent.trim().startsWith('{')) {
        geojson = JSON.parse(fileContent);
      } else {
        geojson = parseKMLToGeoJSON(fileContent);
      }

      const mainPoly = extractMainConcessionPolygon(geojson);
      if (!mainPoly) {
        setError('Aucun polygone valide trouvé dans le fichier importé.');
        return;
      }

      onSetConcession(mainPoly);
      setSuccessMsg('Nouveau périmètre de concession chargé avec succès !');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError('Erreur lors de l\'analyse du fichier : ' + err.message);
    }
  };

  const handleResetDefault = () => {
    const geojson = parseKMLToGeoJSON(DEFAULT_KML_DATA);
    const mainPoly = extractMainConcessionPolygon(geojson);
    onSetConcession(mainPoly);
    setSuccessMsg('Revenu aux limites de la Concession D\'oliveira par défaut.');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-[0_20px_48px_-12px_rgba(15,37,64,0.45)] overflow-hidden text-slate-800">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-slate-500" />
            Importer un Fichier KML / GeoJSON (Périmètre Concession)
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Sélectionnez votre fichier KML (exporté de Google Earth ou QGIS) contenant la limite extérieure de votre concession.
          </p>

          <label className="border-2 border-dashed border-slate-300 hover:border-brand-500 bg-slate-50 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all">
            <FileCode className="w-10 h-10 text-slate-400 mb-2" />
            <span className="text-xs font-semibold text-slate-800">
              {fileName ? fileName : 'Cliquez ou glissez votre fichier KML / GeoJSON ici'}
            </span>
            <span className="text-[11px] text-slate-500 mt-1">Formats acceptés : .kml, .geojson, .json</span>
            <input type="file" accept=".kml,.geojson,.json,.xml" onChange={handleFileUpload} className="hidden" />
          </label>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={handleApplyImport}
              className="flex-1 py-2.5 px-4 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> Appliquer le Périmètre
            </button>
            <button
              onClick={handleResetDefault}
              className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
            >
              Recharger Concession D'oliveira
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
