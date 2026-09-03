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
    <div className="fixed inset-0 z-[2500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            Importer un Fichier KML / GeoJSON (Périmètre Concession)
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300">
            Sélectionnez votre fichier KML (exporté de Google Earth ou QGIS) contenant la limite extérieure de votre concession.
          </p>

          <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all">
            <FileCode className="w-10 h-10 text-indigo-400 mb-2" />
            <span className="text-xs font-bold text-slate-200">
              {fileName ? fileName : 'Cliquez ou glissez votre fichier KML / GeoJSON ici'}
            </span>
            <span className="text-[10px] text-slate-400 mt-1">Formats acceptés : .kml, .geojson, .json</span>
            <input type="file" accept=".kml,.geojson,.json,.xml" onChange={handleFileUpload} className="hidden" />
          </label>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={handleApplyImport}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg"
            >
              <Upload className="w-4 h-4" /> Appliquer le Périmètre
            </button>
            <button
              onClick={handleResetDefault}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700"
            >
              Recharger Concession D'oliveira
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
