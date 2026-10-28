import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { logActivity } from '../services/auditService';
import { STATUS_COLORS, ddToDms, exportParcelToCSV, calculateArea, getParcelBornes, getSideLengths, formatMeters, buildVerificationText, getReleveReference, parseDecimal, hasCrossingSides } from '../utils/geoUtils';
import { getOceanZoneInfo } from '../utils/coastalZones';
import { utmToLatLng, parseUtmList, lngLatToCadastreXY, buildSourceCoordinates } from '../utils/utm';
import OfficialHeaderBanner from './OfficialHeaderBanner';
import DeleteConfirmModal from './DeleteConfirmModal';
import { SituationPlan, BornagePlan, SatelliteFigure } from './ParcelPlans';
import { ParcelPhotoGallery } from './ParcelPhotos';
import { ParcelDocumentList } from './ParcelDocuments';
import { buildRelevePdf, computeFingerprint, svgToPng } from '../utils/officialPdf';
import { loadParcelAnnexes, appendPdfAnnexes } from '../utils/pdfAnnexes';
import {
  X,
  User,
  Copy,
  Download,
  Trash2,
  Edit3,
  MapPin,
  Check,
  Printer,
  FileDown,
  Loader2,
  ShieldCheck,
  Plus,
  Waves,
} from 'lucide-react';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Issue date printed on the relevé: the one set by the Admin (properties.releveIssuedOn, yyyy-mm-dd), else today
function releveIssuedOnText(parcel) {
  const iso = parcel.properties?.releveIssuedOn;
  if (!iso) return new Date().toLocaleDateString('fr-FR');
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function ParcelModal({ parcel, onClose, onUpdateParcel, onDeleteParcel, isVisitorMode, isArpenteur, concessionPolygon }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showReleve, setShowReleve] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const releveRef = useRef(null);
  const shownParcelIdRef = useRef(null);

  const [formData, setFormData] = useState({
    lotNumber: '',
    status: 'disponible',
    occupantName: '',
    notes: ''
  });

  const [editVertices, setEditVertices] = useState([]);
  // Bornes are edited in GPS decimal degrees or in the Cadastre's UTM 33S X,Y (the parcel's original format)
  const [vertexFormat, setVertexFormat] = useState('dd');
  const [utmPaste, setUtmPaste] = useState('');

  useEffect(() => {
    if (parcel) {
      setFormData({
        lotNumber: parcel.properties.lotNumber || '',
        status: parcel.properties.status || 'disponible',
        occupantName: parcel.properties.occupantName || '',
        notes: parcel.properties.notes || ''
      });

      const initialVerts = parcel.geometry?.coordinates?.[0] || [];
      const uniqueVerts = initialVerts.slice(0, initialVerts.length > 3 && initialVerts[0][0] === initialVerts[initialVerts.length - 1][0] && initialVerts[0][1] === initialVerts[initialVerts.length - 1][1] ? -1 : initialVerts.length);

      // Parcels entered from the Cadastre are edited with their original X,Y (typed text, leading zeros kept)
      const source = parcel.properties.sourceCoordinates?.points;
      if (Array.isArray(source) && source.length > 0) {
        setVertexFormat('utm');
        setEditVertices(
          source.length === uniqueVerts.length
            ? source.map((xy) => {
                const [xStr = '', yStr = ''] = String(xy).split(',');
                return { latStr: xStr.trim(), lngStr: yStr.trim() };
              })
            : uniqueVerts.map((pt) => {
                const { xStr, yStr } = lngLatToCadastreXY(pt);
                return { latStr: xStr, lngStr: yStr };
              })
        );
      } else {
        setVertexFormat('dd');
        setEditVertices(
          uniqueVerts.map(([lng, lat]) => ({
            latStr: lat.toFixed(6),
            lngStr: lng.toFixed(6)
          }))
        );
      }
      setUtmPaste('');

      // Anti-fraud QR code holding the lot's key facts (see buildVerificationText)
      QRCode.toDataURL(buildVerificationText(parcel, releveIssuedOnText(parcel)), {
        width: 420,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Erreur génération QR Code:', err));

      // Another lot opened: back to its sheet. The same lot updated (e.g. its issue date) keeps the view.
      if (shownParcelIdRef.current !== parcel.id) {
        shownParcelIdRef.current = parcel.id;
        setIsEditing(false);
        setShowReleve(false);
        setShowDeleteConfirm(false);
      }
    }
  }, [parcel]);

  if (!parcel) return null;

  const colorConfig = STATUS_COLORS[parcel.properties.status] || STATUS_COLORS.disponible;
  const areaInfo = calculateArea(parcel);
  const oceanInfo = getOceanZoneInfo(parcel);
  // Bornes without the closing vertex (which repeats B1)
  const bornes = getParcelBornes(parcel);
  const sideLengths = getSideLengths(parcel);
  const perimeter = sideLengths.reduce((sum, m) => sum + m, 0);

  // A borne field pair -> [lng, lat], or null when it cannot be read. In UTM, latStr holds X and lngStr Y.
  const vertexToLngLat = (v, format = vertexFormat) => {
    const a = parseDecimal(v.latStr);
    const b = parseDecimal(v.lngStr);
    if (isNaN(a) || isNaN(b)) return null;
    if (format === 'utm') {
      if (a < 100000 || a > 900000 || b < 100000 || b > 10000000) return null;
      const { lat, lng } = utmToLatLng(a, b);
      return [lng, lat];
    }
    return Math.abs(a) > 90 || Math.abs(b) > 180 ? null : [b, a];
  };

  // Switching format converts the bornes already typed
  const handleVertexFormatChange = (format) => {
    if (format === vertexFormat) return;
    setEditVertices(
      editVertices.map((v) => {
        const pt = vertexToLngLat(v);
        if (!pt) return { latStr: '', lngStr: '' };
        if (format === 'utm') {
          const { xStr, yStr } = lngLatToCadastreXY(pt);
          return { latStr: xStr, lngStr: yStr };
        }
        return { latStr: pt[1].toFixed(7), lngStr: pt[0].toFixed(7) };
      })
    );
    setVertexFormat(format);
  };

  // Pasted Cadastre list "0203417,9346432: 0203434,9346394: …" replaces the bornes
  const handleFillFromUtmPaste = () => {
    const { points, errors } = parseUtmList(utmPaste);
    if (errors.length) {
      alert(errors[0]);
      return;
    }
    if (points.length < 3) {
      alert('Collez au moins 3 bornes X,Y.');
      return;
    }
    setVertexFormat('utm');
    setEditVertices(points.map((p) => ({ latStr: p.xStr, lngStr: p.yStr })));
    setUtmPaste('');
  };

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

    // Arpenteur: attributes only, the boundary points (bornes) stay unchanged (Admin only)
    if (isArpenteur) {
      onUpdateParcel({
        ...parcel,
        properties: {
          ...parcel.properties,
          lotNumber: formData.lotNumber,
          status: formData.status,
          occupantName: formData.occupantName,
          notes: formData.notes,
          updatedAt: new Date().toISOString().split('T')[0]
        }
      });
      setIsEditing(false);
      return;
    }

    const ringCoords = [];
    for (let i = 0; i < editVertices.length; i++) {
      const v = editVertices[i];
      const pt = vertexToLngLat(v);
      // A mistyped borne is reported, never silently dropped (that would change the surface)
      if (!pt) {
        alert(`Borne B${i + 1} : coordonnées invalides (« ${v.latStr} », « ${v.lngStr} »). Corrigez-la ou supprimez-la.`);
        return;
      }
      ringCoords.push(pt);
    }

    if (hasCrossingSides(ringCoords)) {
      alert('Des côtés du tracé se croisent : les bornes ne sont pas dans l’ordre. Remettez-les en faisant le tour de la parcelle.');
      return;
    }

    if (ringCoords.length < 3) {
      alert('Veuillez spécifier au moins 3 sommets GPS valides.');
      return;
    }

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

    // The Cadastre coordinates follow the bornes: typed X,Y in UTM, recomputed when edited in GPS
    if (vertexFormat === 'utm') {
      updated.properties.sourceCoordinates = buildSourceCoordinates(
        editVertices.map((v) => `${String(v.latStr).trim()},${String(v.lngStr).trim()}`)
      );
    } else if (parcel.properties.sourceCoordinates && JSON.stringify(ringCoords) !== JSON.stringify(parcel.geometry?.coordinates?.[0])) {
      updated.properties.sourceCoordinates = buildSourceCoordinates(
        ringCoords.slice(0, -1).map((pt) => {
          const { xStr, yStr } = lngLatToCadastreXY(pt);
          return `${xStr},${yStr}`;
        })
      );
    }

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
    const lotRef = parcel.properties.lotNumber || parcel.id;
    link.download = `Sommets_Parcelle_${lotRef}.csv`;
    link.click();

    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_EXPORT',
      actionLabel: `Export CSV des sommets du lot ${lotRef}`,
      target: lotRef,
      details: `${bornes.length} bornes géodésiques exportées en format CSV`,
      severity: 'info'
    });
  };

  const handleDownloadGeoJSON = () => {
    const jsonStr = JSON.stringify(parcel, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const lotRef = parcel.properties.lotNumber || parcel.id;
    link.href = url;
    link.download = `Parcelle_${lotRef}.geojson`;
    link.click();

    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_EXPORT',
      actionLabel: `Export GeoJSON du lot ${lotRef}`,
      target: lotRef,
      details: `Fichier GeoJSON généré avec polygone et attributs`,
      severity: 'info'
    });
  };

  const handlePrintReleve = () => {
    const lotRef = parcel.properties.lotNumber || parcel.id;
    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_PRINT_RELEVE',
      actionLabel: `Impression Relevé Parcellaire du lot ${lotRef}`,
      target: lotRef,
      details: `Fiche officielle imprimée / exportée en PDF avec QR Code anti-fraude`,
      severity: 'info'
    });
    window.print();
  };

  const handleDownloadReleve = async () => {
    if (!releveRef.current) return;
    const lotRef = parcel.properties.lotNumber || parcel.id;
    setIsDownloadingPdf(true);
    try {
      const issuedOn = releveIssuedOnText(parcel);
      const reference = getReleveReference(parcel);
      const owner = parcel.properties.occupantName || 'Aucun (domaine libre)';
      const fingerprint = await computeFingerprint({
        type: 'releve',
        reference,
        lot: lotRef,
        owner,
        areaM2: Math.round(areaInfo.sqMeters),
        sides: sideLengths.map((m) => Math.round(m * 10) / 10),
        bornes: bornes.map(([lng, lat]) => [lat.toFixed(6), lng.toFixed(6)]),
        issuedOn
      });

      // Plans (on-screen SVG) and satellite view (already rendered image) of the sheet
      const svgs = releveRef.current.querySelectorAll('.releve-plans svg');
      const satelliteImg = releveRef.current.querySelector('figure img');
      const [situationPlan, bornagePlan] = await Promise.all([svgToPng(svgs[0]), svgToPng(svgs[1])]);
      const satellite = satelliteImg && satelliteImg.complete && satelliteImg.naturalWidth
        ? { dataUrl: satelliteImg.src, width: satelliteImg.naturalWidth, height: satelliteImg.naturalHeight }
        : null;

      // Acte de cession attached to the lot, added as annexes
      const annexes = await loadParcelAnnexes(parcel);

      const hex = colorConfig.hex.replace('#', '');
      const doc = await buildRelevePdf({
        lotRef,
        owner,
        statusLabel: colorConfig.label,
        statusColor: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)),
        areaHa: areaInfo.formattedHa,
        areaM2: areaInfo.formattedSqM,
        perimeter: formatMeters(perimeter),
        coastal: oceanInfo ? `${oceanInfo.shortName} - ${oceanInfo.distanceFormatted} de l'océan` : 'Non déterminé',
        bornes: bornes.map(([lng, lat], i) => ({
          name: `B${i + 1}`,
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          latDms: ddToDms(lat, true),
          lngDms: ddToDms(lng, false),
          side: `B${i + 1}-B${(i + 1) % bornes.length + 1} : ${formatMeters(sideLengths[i])}`
        })),
        qrText: buildVerificationText(parcel, issuedOn, fingerprint),
        reference,
        issuedOn,
        fingerprint,
        situationPlan,
        bornagePlan,
        satellite,
        notes: parcel.properties.notes || '',
        annexes
      });
      const fileName = `Releve_${String(lotRef).replace(/[^\w-]+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      if (annexes.some((a) => a.pdfBytes)) {
        const bytes = await appendPdfAnnexes(doc.output('arraybuffer'), annexes, { reference });
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        doc.save(fileName);
      }
      logActivity({
        role: isArpenteur ? 'arpenteur' : 'admin',
        actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
        action: 'PARCEL_PDF_DOWNLOAD',
        actionLabel: `Téléchargement du relevé PDF du lot ${lotRef}`,
        target: lotRef,
        details: 'Relevé parcellaire avec plans et vue satellite',
        severity: 'info'
      });
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      alert('Le PDF n’a pas pu être généré. Vérifiez la connexion Internet puis réessayez, ou utilisez « Imprimer ».');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleConfirmDelete = () => {
    onDeleteParcel(parcel.id);
    onClose();
  };

  return (
    <>
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        lotNumber={parcel.properties.lotNumber}
      />

      {/* Official Printable Land Relevé Parcellaire Overlay (rendered at body level so it prints alone) */}
      {showReleve && createPortal(
        <div className="releve-print-overlay fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex justify-center p-4 overflow-y-auto font-sans">
          <div ref={releveRef} className="bg-white text-slate-900 w-full max-w-3xl rounded-lg shadow-xl my-auto print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none overflow-hidden border border-slate-200">
            <div data-pdf-ignore className="flex justify-between items-center px-6 py-3 border-b border-slate-200 bg-slate-50 print:hidden">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Fiche Officielle de Relevé Parcellaire Cadastral</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Issue date of the relevé: chosen by the Admin, kept with the lot */}
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  Date d&apos;émission
                  {isArpenteur || isVisitorMode ? (
                    <span className="font-semibold text-slate-900 tabular-nums">{releveIssuedOnText(parcel)}</span>
                  ) : (
                    <input
                      type="date"
                      value={parcel.properties.releveIssuedOn || todayIso()}
                      onChange={(e) => {
                        const { releveIssuedOn: _previous, ...rest } = parcel.properties;
                        onUpdateParcel({
                          ...parcel,
                          properties: e.target.value && e.target.value !== todayIso() ? { ...rest, releveIssuedOn: e.target.value } : rest
                        });
                      }}
                      className="h-9 px-2 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-900 cursor-pointer"
                    />
                  )}
                </label>
                <button
                  onClick={handleDownloadReleve}
                  disabled={isDownloadingPdf}
                  className="h-9 px-3.5 bg-brand-700 hover:bg-brand-800 text-white text-[13px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  {isDownloadingPdf ? 'Préparation…' : 'Télécharger PDF'}
                </button>
                <button
                  onClick={handlePrintReleve}
                  className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" /> Imprimer
                </button>
                <button
                  onClick={() => setShowReleve(false)}
                  className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-medium rounded-lg cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Letterhead across the full width, QR card over the green band at the top right
                (sized as a share of the banner so it never covers the name) */}
            <div data-pdf-block className="relative bg-white">
              <OfficialHeaderBanner className="rounded-none shadow-none" />
              <div className="absolute top-[3%] right-[1.5%] w-[13%] bg-white rounded-lg border border-slate-200 p-[0.8%] shadow-sm">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt={`QR code de vérification du lot ${parcel.properties.lotNumber || ''}`} className="w-full h-auto block" />
                ) : (
                  <div className="w-full aspect-square bg-slate-100" />
                )}
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              <div data-pdf-block className="text-center my-2 space-y-1">
                <h1 className="text-base font-black uppercase text-slate-900 tracking-tight">
                  RELEVÉ PARCELLAIRE &amp; FICHE D&apos;OCCUPATION DU SOL
                </h1>
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                  IDENTIFIANT CADASTRAL OFFICIEL : {parcel.properties.lotNumber || parcel.id}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Établi le {releveIssuedOnText(parcel)} • Réf. {getReleveReference(parcel)}
                </div>
              </div>

              <div data-pdf-block className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded border border-slate-200">
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
                  <span className="text-[10px] font-semibold text-slate-500 block uppercase">SUPERFICIE CALCULÉE</span>
                  <span className="text-sm font-black text-emerald-700">{areaInfo.formattedHa}</span>
                  <span className="text-[11px] text-slate-600 ml-1">({areaInfo.formattedSqM})</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase">ZONAGE LITTORAL & SITUATION OCÉAN</span>
                    <span className="text-xs font-bold text-cyan-800">
                      {oceanInfo ? `${oceanInfo.zoneName} • ${oceanInfo.distanceFormatted} de l'océan` : 'Non déterminé'}
                    </span>
                  </div>
                  {oceanInfo && (
                    <span className="text-[10px] font-medium text-slate-500 italic">
                      {oceanInfo.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Plans: situation in the concession + bornage / morcellement */}
              <div data-pdf-block className="releve-plans grid grid-cols-[1fr_2fr] items-start gap-3">
                <figure className="border border-slate-300 rounded overflow-hidden bg-white">
                  <figcaption className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                    Plan de situation
                  </figcaption>
                  <SituationPlan parcel={parcel} concessionPolygon={concessionPolygon} />
                  <div className="px-2.5 py-1.5 border-t border-slate-200 text-[9.5px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 bg-red-600" /> Lot {parcel.properties.lotNumber}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 bg-amber-100 border border-dashed border-amber-600" /> Concession</span>
                  </div>
                </figure>
                <figure className="border border-slate-300 rounded overflow-hidden bg-white">
                  <figcaption className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                    Plan de bornage
                  </figcaption>
                  <BornagePlan parcel={parcel} />
                  <div className="px-2.5 py-1.5 border-t border-slate-200 text-[9.5px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-600" /> Bornes B1–B{bornes.length}</span>
                    <span>Périmètre : <strong className="text-slate-800">{formatMeters(perimeter)}</strong></span>
                  </div>
                </figure>
              </div>

              {/* Satellite view of the lot */}
              <SatelliteFigure title="Vue satellite du lot" points={bornes} color={colorConfig.hex} />

              <div data-pdf-block>
                <h3 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1.5">
                  Coordonnées Géodésiques des Bornes (WGS84)
                </h3>
                <table className="w-full text-left text-[11px] border border-slate-300 font-mono">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-1.5 border border-slate-300">Borne</th>
                      <th className="p-1.5 border border-slate-300">Latitude (DD)</th>
                      <th className="p-1.5 border border-slate-300">Longitude (DD)</th>
                      <th className="p-1.5 border border-slate-300">Format DMS</th>
                      <th className="p-1.5 border border-slate-300 text-right">Côté vers borne suivante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bornes.map((pt, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-1.5 border border-slate-300 font-bold">B{i + 1}</td>
                        <td className="p-1.5 border border-slate-300">{pt[1].toFixed(6)}</td>
                        <td className="p-1.5 border border-slate-300">{pt[0].toFixed(6)}</td>
                        <td className="p-1.5 border border-slate-300 text-[10px]">
                          {ddToDms(pt[1], true)} | {ddToDms(pt[0], false)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right whitespace-nowrap">
                          B{i + 1} → B{(i + 1) % bornes.length + 1} : <strong>{formatMeters(sideLengths[i])}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={4} className="p-1.5 border border-slate-300 font-bold text-right uppercase text-[10px]">Périmètre total</td>
                      <td className="p-1.5 border border-slate-300 text-right font-bold">{formatMeters(perimeter)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {parcel.properties.notes && (
                <div data-pdf-block className="text-[11px] italic bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="font-bold not-italic">Observations Concession : </span>
                  {parcel.properties.notes}
                </div>
              )}

              <div data-pdf-block className="pt-6 border-t border-slate-300 mt-6">
                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="text-center space-y-12">
                    <span className="text-[11px] font-bold text-slate-800 uppercase block">
                      Le Géomètre-Arpenteur Agréé
                    </span>
                    <div className="text-[10px] text-slate-400 italic">Signature, Visa &amp; Bornage Technique</div>
                  </div>
                  <div className="text-center space-y-12">
                    <span className="text-[11px] font-bold text-slate-800 uppercase block">
                      La Direction Concession Manuel Joaquim d&apos;Oliveira
                    </span>
                    <div className="text-[10px] text-slate-400 italic">Signature &amp; Sceau Officiel de Concession</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main Sidebar Modal */}
      <aside
        aria-label={`Lot ${parcel.properties.lotNumber || ''}`}
        className="fixed right-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[1050] w-full max-w-md bg-white border-l border-slate-200 shadow-[-12px_0_32px_-16px_rgba(15,37,64,0.3)] flex flex-col text-slate-800 select-none animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="px-5 h-14 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 leading-tight">Lot</div>
            <h2 className="font-semibold text-[16px] text-slate-900 leading-tight truncate">
              {parcel.properties.lotNumber || 'Lot sans numéro'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="p-1.5 -mr-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto font-sans">
          {/* Summary */}
          <section className="px-5 py-4 space-y-3 border-b border-slate-100">
            <span
              className="inline-flex items-center gap-1.5 h-6 px-2.5 text-[12px] font-semibold rounded-full"
              style={{ backgroundColor: `${colorConfig.hex}1a`, color: colorConfig.hex }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorConfig.hex }} />
              {colorConfig.label}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-[26px] font-semibold text-slate-900 tabular-nums leading-none">{areaInfo.formattedHa}</span>
              <span className="text-[13px] text-slate-500 tabular-nums">{areaInfo.formattedSqM}</span>
            </div>
            {oceanInfo && (
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <Waves className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  {oceanInfo.shortName} <span className="text-slate-400">•</span>{' '}
                  <span className="tabular-nums">{oceanInfo.distanceFormatted}</span> de l&apos;océan
                </span>
              </div>
            )}
          </section>

          {!isEditing ? (
            <>
              <section className="px-5 py-4 border-b border-slate-100 space-y-3">
                <div>
                  <div className="text-[12px] text-slate-500 flex items-center gap-1.5 mb-0.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Affectataire / occupant
                  </div>
                  <div className="text-[14px] font-medium text-slate-900">
                    {parcel.properties.occupantName || <span className="text-slate-400 font-normal">Aucun occupant</span>}
                  </div>
                </div>
                {parcel.properties.notes && (
                  <div>
                    <div className="text-[12px] text-slate-500 mb-0.5">Observations</div>
                    <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{parcel.properties.notes}</p>
                  </div>
                )}
              </section>

              {parcel.properties.sourceCoordinates?.points?.length > 0 && (
                <section className="px-5 py-4 border-b border-slate-100 space-y-1.5">
                  <h3 className="text-[13px] font-semibold text-slate-900">Coordonnées d’origine (Cadastre)</h3>
                  <p className="text-[11px] text-slate-500">
                    {parcel.properties.sourceCoordinates.system} · {parcel.properties.sourceCoordinates.order}
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 font-mono text-[12px] tabular-nums">
                    {parcel.properties.sourceCoordinates.points.map((xy, i) => (
                      <div key={i} className="px-3 py-1.5 flex gap-3">
                        <span className="font-sans font-semibold text-orange-700 w-6">B{i + 1}</span>
                        <span className="text-slate-800">{xy}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <ParcelPhotoGallery
                parcel={parcel}
                canAdd={!isVisitorMode}
                canDelete={!isVisitorMode && !isArpenteur}
                onPhotosChange={(photos) => onUpdateParcel({ ...parcel, properties: { ...parcel.properties, photos } })}
              />

              <ParcelDocumentList
                parcel={parcel}
                canAdd={!isVisitorMode}
                canDelete={!isVisitorMode && !isArpenteur}
                onDocumentsChange={(documents) => onUpdateParcel({ ...parcel, properties: { ...parcel.properties, documents } })}
              />

              {/* Bornes */}
              <section className="px-5 py-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-orange-600" /> Bornes GPS ({bornes.length})
                  </h3>
                  <div className="flex gap-1">
                    <button
                      onClick={handleCopyCSV}
                      className="h-7 px-2 text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md flex items-center gap-1 font-medium cursor-pointer"
                      title="Copier les coordonnées au format CSV"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copié' : 'CSV'}</span>
                    </button>
                    <button
                      onClick={handleDownloadGeoJSON}
                      className="h-7 px-2 text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md flex items-center gap-1 font-medium cursor-pointer"
                      title="Télécharger la parcelle au format GeoJSON"
                    >
                      <Download className="w-3.5 h-3.5" /> GeoJSON
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Borne</th>
                        <th className="px-3 py-2 font-medium">Latitude</th>
                        <th className="px-3 py-2 font-medium">Longitude</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-mono tabular-nums">
                      {bornes.map((pt, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-sans font-semibold text-orange-700">B{i + 1}</td>
                          <td className="px-3 py-1.5">{pt[1].toFixed(6)}</td>
                          <td className="px-3 py-1.5">{pt[0].toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            /* Edit Form */
            <form onSubmit={handleSave} className="px-5 py-4 space-y-3.5 text-[13px]">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Numéro du Lot / Identifiant
                </label>
                <input
                  type="text"
                  required
                  value={formData.lotNumber}
                  onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Statut d'Occupation
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="disponible">Disponible / Libre (Vert)</option>
                  <option value="occupe">Occupé / Attribué (Rouge)</option>
                  <option value="litige">En Litige / Sous Réserve (Orange)</option>
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
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                ></textarea>
              </div>

              {isArpenteur ? (
                <div className="bg-amber-50 p-3 rounded border border-amber-200 text-amber-800 text-[11px] font-medium">
                  Les bornes (sommets GPS) de la parcelle ne peuvent être modifiées que par l&apos;Administrateur.
                </div>
              ) : (
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs">
                    Édition des Bornes ({editVertices.length} bornes)
                  </span>
                  <select
                    value={vertexFormat}
                    onChange={(e) => handleVertexFormatChange(e.target.value)}
                    aria-label="Format des coordonnées des bornes"
                    className="h-7 px-1.5 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="utm">Cadastre UTM 33S (X, Y)</option>
                    <option value="dd">GPS décimal (lat, lng)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddVertexField}
                    className="text-emerald-700 text-[11px] font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Borne B{editVertices.length + 1}
                  </button>
                </div>

                {vertexFormat === 'utm' && (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={utmPaste}
                      onChange={(e) => setUtmPaste(e.target.value)}
                      placeholder="Coller la liste : 0203417,9346432: 0203434,9346394: …"
                      aria-label="Coller la liste des bornes du Cadastre"
                      className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleFillFromUtmPaste}
                      disabled={!utmPaste.trim()}
                      className="px-2 py-1 bg-brand-700 hover:bg-brand-800 text-white rounded text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                    >
                      Remplir
                    </button>
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {editVertices.map((vt, idx) => {
                    const pt = vertexFormat === 'utm' ? vertexToLngLat(vt) : null;
                    return (
                    <div key={idx}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-500 w-6 text-right font-mono text-[11px]">
                        B{idx + 1}.
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={vertexFormat === 'utm' ? 'X (Easting)' : 'Latitude'}
                        aria-label={`Borne B${idx + 1} : ${vertexFormat === 'utm' ? 'X (Easting)' : 'latitude'}`}
                        value={vt.latStr}
                        onChange={(e) => handleVertexChange(idx, 'latStr', e.target.value)}
                        className="flex-1 px-2 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-900"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={vertexFormat === 'utm' ? 'Y (Northing)' : 'Longitude'}
                        aria-label={`Borne B${idx + 1} : ${vertexFormat === 'utm' ? 'Y (Northing)' : 'longitude'}`}
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
                    {vertexFormat === 'utm' && (
                      <div className={`pl-8 text-[10px] font-mono tabular-nums ${pt ? 'text-slate-500' : 'text-rose-600'}`}>
                        {pt ? `= GPS ${pt[1].toFixed(7)}, ${pt[0].toFixed(7)}` : vt.latStr || vt.lngStr ? 'X,Y non valides' : ''}
                      </div>
                    )}
                    </div>
                    );
                  })}
                </div>
              </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 px-4 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg text-[13px] cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions (Hidden in Visitor Read-Only Mode and restricted for Arpenteur) */}
        {!isVisitorMode && !isEditing && (
          <div className="px-5 py-3 border-t border-slate-200 flex gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 h-10 px-4 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" /> Modifier
            </button>
            <button
              onClick={() => setShowReleve(true)}
              className="h-10 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-medium rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Relevé parcellaire officiel (PDF, QR code, plans)"
            >
              <Printer className="w-4 h-4 text-slate-500" /> Relevé PDF
            </button>
            {!isArpenteur && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                aria-label="Supprimer la parcelle"
                className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Supprimer la parcelle"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
