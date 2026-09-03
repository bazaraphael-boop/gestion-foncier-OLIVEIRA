import React, { useState, useEffect } from 'react';
import { STATUS_COLORS, ddToDms, exportParcelToCSV, calculateArea } from '../utils/geoUtils';
import OfficialHeaderBanner from './OfficialHeaderBanner';
import DeleteConfirmModal from './DeleteConfirmModal';
import {
  X,
  User,
  Tag,
  Maximize,
  Copy,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  FileText,
  MapPin,
  Save,
  Check,
  Printer,
  ShieldCheck,
  Plus
} from 'lucide-react';

export default function ParcelModal({ parcel, onClose, onUpdateParcel, onDeleteParcel }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    lotNumber: '',
    status: 'disponible',
    occupantName: '',
    notes: ''
  });

  const [editVertices, setEditVertices] = useState([]);

  useEffect(() => {
    if (parcel) {
      setFormData({
        lotNumber: parcel.properties.lotNumber || '',
        status: parcel.properties.status || 'disponible',
        occupantName: parcel.properties.occupantName || '',
        notes: parcel.properties.notes || ''
      });

      const initialVerts = parcel.geometry?.coordinates?.[0] || [];
      // Remove duplicate closing point if present
      const uniqueVerts = initialVerts.slice(0, initialVerts.length > 3 && initialVerts[0][0] === initialVerts[initialVerts.length - 1][0] && initialVerts[0][1] === initialVerts[initialVerts.length - 1][1] ? -1 : initialVerts.length);

      setEditVertices(
        uniqueVerts.map(([lng, lat]) => ({
          latStr: lat.toFixed(6),
          lngStr: lng.toFixed(6)
        }))
      );

      setIsEditing(false);
      setShowCertificate(false);
      setShowDeleteConfirm(false);
    }
  }, [parcel]);

  if (!parcel) return null;

  const colorConfig = STATUS_COLORS[parcel.properties.status] || STATUS_COLORS.disponible;
  const areaInfo = calculateArea(parcel);
  const vertices = parcel.geometry.coordinates[0];

  const handleVertexChange = (index, field, value) => {
    const newVerts = [...editVertices];
    newVerts[index][field] = value;
    setEditVertices(newVerts);
  };

  const handleAddVertexField = () => {
    setEditVertices([...editVertices, { latStr: '', lngStr: '' }]);
  };

  const handleRemoveVertexField = (index) => {
    if (editVertices.length <= 3) {
      alert('Une parcelle doit comporter au moins 3 sommets GPS.');
      return;
    }
    setEditVertices(editVertices.filter((_, i) => i !== index));
  };

  const handleSave = (e) => {
    e.preventDefault();

    // Parse vertices
    const ringCoords = [];
    for (let i = 0; i < editVertices.length; i++) {
      const v = editVertices[i];
      const lat = parseFloat(v.latStr);
      const lng = parseFloat(v.lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        ringCoords.push([lng, lat]);
      }
    }

    if (ringCoords.length < 3) {
      alert('Veuillez spécifier au moins 3 sommets GPS valides.');
      return;
    }

    // Ensure closed ring
    if (
      ringCoords[0][0] !== ringCoords[ringCoords.length - 1][0] ||
      ringCoords[0][1] !== ringCoords[ringCoords.length - 1][1]
    ) {
      ringCoords.push([ringCoords[0][0], ringCoords[0][1]]);
    }

    const updated = {
      ...parcel,
      properties: {
        ...parcel.properties,
        lotNumber: formData.lotNumber,
        status: formData.status,
        occupantName: formData.occupantName,
        notes: formData.notes,
        updatedAt: new Date().toISOString().split('T')[0]
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ringCoords]
      }
    };

    // Recompute area
    const newArea = calculateArea(updated);
    updated.properties.areaSqM = newArea.sqMeters;
    updated.properties.areaHa = newArea.hectares;
    updated.properties.formattedSqM = newArea.formattedSqM;
    updated.properties.formattedHa = newArea.formattedHa;

    onUpdateParcel(updated);
    setIsEditing(false);
  };

  const handleCopyCSV = () => {
    const csvData = exportParcelToCSV(parcel);
    navigator.clipboard.writeText(csvData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    const csvData = exportParcelToCSV(parcel);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sommets_Parcelle_${parcel.properties.lotNumber || parcel.id}.csv`;
    link.click();
  };

  const handleDownloadGeoJSON = () => {
    const jsonStr = JSON.stringify(parcel, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Parcelle_${parcel.properties.lotNumber || parcel.id}.geojson`;
    link.click();
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  const handleConfirmDelete = () => {
    onDeleteParcel(parcel.id);
    onClose();
  };

  return (
    <>
      {/* Custom Professional Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        lotNumber={parcel.properties.lotNumber}
      />

      {/* Official Printable Land Certificate Overlay */}
      {showCertificate && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-white text-slate-900 w-full max-w-3xl rounded-lg shadow-xl my-auto print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none overflow-hidden border border-slate-200">
            {/* Action Bar (hidden when printing) */}
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-200 bg-slate-50 print:hidden">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Fiche Officielle d'Attribution Cadastrale</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintCertificate}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
                </button>
                <button
                  onClick={() => setShowCertificate(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Original Image Header Banner Full Width */}
            <OfficialHeaderBanner />

            {/* Document Content */}
            <div className="p-6 space-y-4 text-xs font-sans">
              {/* Document Title */}
              <div className="text-center my-2 space-y-1">
                <h1 className="text-base font-black uppercase text-slate-900 tracking-tight">
                  CERTIFICAT DE RELEVÉ PARCELLAIRE & D'OCCUPATION
                </h1>
                <div className="text-xs font-bold text-emerald-800 uppercase">
                  RÉFÉRENCE PARCELLE : {parcel.properties.lotNumber || parcel.id}
                </div>
              </div>

              {/* Certificate Details */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded border border-slate-200">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block uppercase">IDENTIFIANT DU LOT</span>
                  <span className="text-sm font-bold text-slate-900">{parcel.properties.lotNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block uppercase">STATUT D'OCCUPATION</span>
                  <span className="text-xs font-bold uppercase" style={{ color: colorConfig.hex }}>
                    {colorConfig.label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block uppercase">AFFECTATAIRE / BENEFICIAIRE</span>
                  <span className="text-xs font-bold text-slate-900">
                    {parcel.properties.occupantName || 'Aucun occupant (Domaine Libre)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block uppercase">SUPERFICIE CALCULÉE (TURF.JS)</span>
                  <span className="text-sm font-black text-emerald-700">{areaInfo.formattedHa}</span>
                  <span className="text-[11px] text-slate-600 ml-1">({areaInfo.formattedSqM})</span>
                </div>
              </div>

              {/* Vertices GPS Table */}
              <div>
                <h3 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1.5">
                  Coordonnées Géodésiques des Sommets GPS (WGS84)
                </h3>
                <table className="w-full text-left text-[11px] border border-slate-300 font-mono">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-1.5 border border-slate-300">Sommet #</th>
                      <th className="p-1.5 border border-slate-300">Latitude (DD)</th>
                      <th className="p-1.5 border border-slate-300">Longitude (DD)</th>
                      <th className="p-1.5 border border-slate-300">Format DMS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vertices.map((pt, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-1.5 border border-slate-300 font-bold">P{i + 1}</td>
                        <td className="p-1.5 border border-slate-300">{pt[1].toFixed(6)}</td>
                        <td className="p-1.5 border border-slate-300">{pt[0].toFixed(6)}</td>
                        <td className="p-1.5 border border-slate-300 text-[10px]">
                          {ddToDms(pt[1], true)} | {ddToDms(pt[0], false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {parcel.properties.notes && (
                <div className="text-[11px] italic bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="font-bold not-italic">Observations Concession : </span>
                  {parcel.properties.notes}
                </div>
              )}

              {/* Official Signatures */}
              <div className="pt-6 border-t border-slate-300 mt-6">
                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="text-center space-y-12">
                    <span className="text-[11px] font-bold text-slate-800 uppercase block">
                      Le Géomètre-Expert Arpenteur
                    </span>
                    <div className="text-[10px] text-slate-400 italic">Signature & Visa</div>
                  </div>
                  <div className="text-center space-y-12">
                    <span className="text-[11px] font-bold text-slate-800 uppercase block">
                      La Direction Concession Manuel J. d'Oliveira
                    </span>
                    <div className="text-[10px] text-slate-400 italic">Signature & Sceau Officiel</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Sidebar Modal (Corporate Light Theme) */}
      <div className="fixed inset-y-0 right-0 z-[2000] w-full max-w-md bg-white border-l border-slate-200 shadow-xl flex flex-col text-slate-800 select-none animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full border border-slate-300"
              style={{ backgroundColor: colorConfig.hex }}
            ></div>
            <h2 className="font-bold text-base text-slate-900">
              Détail Lot : {parcel.properties.lotNumber || 'Lot Sans Nom'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
          {/* Status & Surface Banner */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">Statut d'Occupation</span>
              <span
                className="px-2.5 py-0.5 text-xs font-semibold rounded border"
                style={{
                  backgroundColor: `${colorConfig.hex}15`,
                  color: colorConfig.hex,
                  borderColor: `${colorConfig.hex}40`
                }}
              >
                {colorConfig.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Superficie (Hectares)</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{areaInfo.formattedHa}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Superficie (m²)</div>
                <div className="text-base font-bold text-slate-700 mt-0.5">{areaInfo.formattedSqM}</div>
              </div>
            </div>
          </div>

          {!isEditing ? (
            <div className="space-y-4">
              {/* Occupant Details */}
              <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Affectataire / Occupant
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {parcel.properties.occupantName || (
                    <span className="italic text-slate-400 font-normal">Aucun occupant (Zone disponible)</span>
                  )}
                </div>
              </div>

              {/* Official Certificate Action Button */}
              <button
                onClick={() => setShowCertificate(true)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" /> Imprimer Certificat d'Attribution (PDF)
              </button>

              {/* Notes */}
              {parcel.properties.notes && (
                <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500 font-medium">Observations</div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{parcel.properties.notes}</p>
                </div>
              )}

              {/* GPS Vertices Table */}
              <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-900 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Sommets GPS ({vertices.length})
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={handleCopyCSV}
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1 font-medium"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={handleDownloadGeoJSON}
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1 font-medium"
                    >
                      <Download className="w-3 h-3" /> GeoJSON
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded text-xs bg-white">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0">
                      <tr>
                        <th className="p-1.5 border-b border-slate-200">#</th>
                        <th className="p-1.5 border-b border-slate-200">Lat (DD)</th>
                        <th className="p-1.5 border-b border-slate-200">Lng (DD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {vertices.map((pt, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-1.5 font-bold text-slate-500">P{i + 1}</td>
                          <td className="p-1.5">{pt[1].toFixed(6)}</td>
                          <td className="p-1.5">{pt[0].toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Edit Form (Including Full Vertex Editing) */
            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Numéro du Lot / Identifiant
                </label>
                <input
                  type="text"
                  required
                  value={formData.lotNumber}
                  onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Statut d'Occupation
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
                >
                  <option value="disponible">🟢 Vert - Disponible / Libre</option>
                  <option value="occupe">🔴 Rouge - Occupé / Attribué</option>
                  <option value="litige">🟠 Orange - En Litige / Sous Réserve</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nom de l'Occupant / Affectataire
                </label>
                <input
                  type="text"
                  value={formData.occupantName}
                  placeholder="Ex: Nom de l'exploitant"
                  onChange={(e) => setFormData({ ...formData, occupantName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes & Remarques
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 font-medium"
                ></textarea>
              </div>

              {/* Vertex Coordinates Editor (Supports Hexagons / Any Polygon Shape) */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-xs">
                    Édition des Sommets GPS ({editVertices.length} Sommets)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVertexField}
                    className="text-emerald-700 text-[11px] font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Sommet P{editVertices.length + 1}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {editVertices.map((vt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-500 w-6 text-right font-mono text-[11px]">
                        P{idx + 1}.
                      </span>
                      <input
                        type="text"
                        placeholder="Latitude"
                        value={vt.latStr}
                        onChange={(e) => handleVertexChange(idx, 'latStr', e.target.value)}
                        className="flex-1 px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-900"
                      />
                      <input
                        type="text"
                        placeholder="Longitude"
                        value={vt.lngStr}
                        onChange={(e) => handleVertexChange(idx, 'lngStr', e.target.value)}
                        className="flex-1 px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveVertexField(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Supprimer ce sommet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                >
                  Enregistrer les Modifs
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {!isEditing && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5" /> Éditer la Parcelle & Sommets
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded text-xs font-bold transition-all cursor-pointer"
              title="Supprimer la parcelle"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
