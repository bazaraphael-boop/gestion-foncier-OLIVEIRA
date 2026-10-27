import React, { useRef, useState } from 'react';
import { FileText, FilePlus2, Download, ExternalLink, Trash2, X, Loader2 } from 'lucide-react';
import {
  DOCUMENT_TYPES,
  ACCEPTED_DOCUMENTS,
  MAX_DOCUMENTS_PER_PARCEL,
  MAX_DOCUMENT_MB,
  checkDocumentFile,
  documentTypeLabel,
  formatDocumentSize,
  uploadParcelDocuments,
  getDocumentUrl,
  deleteParcelDocument
} from '../services/documentService';

// Documents of the Concession Manuel Joaquim d'Oliveira attached to a parcel (see services/documentService.js)

const selectClass =
  'h-9 px-2 bg-white border border-slate-300 rounded-md text-[12.5px] text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 cursor-pointer';

/** Type selector + file button; calls onPicked([{ file, type }]) */
function DocumentInputs({ onPicked, disabled, remaining }) {
  const [type, setType] = useState(DOCUMENT_TYPES[0].id);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const problems = files.map(checkDocumentFile).filter(Boolean);
    const ok = files.filter((f) => !checkDocumentFile(f)).slice(0, remaining);
    setError(problems[0] || (files.length > remaining ? `${remaining} document(s) de plus au maximum.` : ''));
    if (ok.length) onPicked(ok.map((file) => ({ file, type })));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={disabled} aria-label="Type de document" className={`${selectClass} flex-1 min-w-[180px]`}>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || remaining <= 0}
          className="h-9 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <FilePlus2 className="w-4 h-4 text-slate-500" /> Ajouter un fichier
        </button>
        <input ref={inputRef} type="file" accept={ACCEPTED_DOCUMENTS} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {error && <p className="text-[12px] text-rose-700">{error}</p>}
    </div>
  );
}

function DocumentRow({ name, type, sizeKb, children }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <FileText className="w-4 h-4 text-brand-700 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-slate-900">{documentTypeLabel(type)}</div>
        <div className="text-[11px] text-slate-500 truncate">
          {name} · {formatDocumentSize(sizeKb)}
        </div>
      </div>
      {children}
    </li>
  );
}

/* ─────────────── New parcel form ─────────────── */

export function DocumentPicker({ items, onChange, disabled = false }) {
  const setType = (i, type) => onChange(items.map((it, j) => (j === i ? { ...it, type } : it)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">Documents de la concession</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{items.length} / {MAX_DOCUMENTS_PER_PARCEL}</span>
      </div>
      {items.length > 0 && (
        <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {items.map((it, i) => (
            <li key={`${it.file.name}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5">
              <FileText className="w-4 h-4 text-brand-700 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <select value={it.type} onChange={(e) => setType(i, e.target.value)} disabled={disabled} aria-label={`Type du document ${it.file.name}`} className="w-full bg-transparent text-[12.5px] font-medium text-slate-900 cursor-pointer focus:outline-none">
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-500 truncate">
                  {it.file.name} · {formatDocumentSize(Math.round(it.file.size / 1024))}
                </div>
              </div>
              {!disabled && (
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Retirer ${it.file.name}`} className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <DocumentInputs onPicked={(added) => onChange([...items, ...added])} disabled={disabled} remaining={MAX_DOCUMENTS_PER_PARCEL - items.length} />
      <p className="text-[11px] text-slate-500">
        Titre, contrat, plan cadastral, PV de bornage… PDF, image, Word ou Excel, {MAX_DOCUMENT_MB} Mo au maximum par fichier.
      </p>
    </div>
  );
}

/* ─────────────── Parcel panel ─────────────── */

export function ParcelDocumentList({ parcel, canAdd, canDelete, onDocumentsChange }) {
  const documents = Array.isArray(parcel.properties?.documents) ? parcel.properties.documents : [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (!documents.length && !canAdd) return null;

  const handleAdd = async (items) => {
    setBusy(true);
    setMessage('');
    const { uploaded, errors } = await uploadParcelDocuments(parcel.id, items);
    if (uploaded.length) onDocumentsChange([...documents, ...uploaded]);
    if (errors.length) setMessage(errors[0]);
    setBusy(false);
  };

  // The tab is opened right away, before the link is ready, so phones do not block it as a pop-up
  const handleOpen = async (doc, download) => {
    setMessage('');
    const tab = download ? null : window.open('', '_blank');
    try {
      const url = await getDocumentUrl(doc, { download });
      if (tab) tab.location.assign(url);
      else window.location.assign(url);
    } catch (err) {
      if (tab) tab.close();
      setMessage(err.message);
    }
  };

  const handleDelete = async (doc) => {
    setBusy(true);
    setMessage('');
    try {
      await deleteParcelDocument(doc.path);
      onDocumentsChange(documents.filter((d) => d.path !== doc.path));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  const iconButton = 'w-8 h-8 rounded-md text-slate-500 hover:text-brand-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer';

  return (
    <section className="px-5 py-4 border-b border-slate-100 space-y-2.5">
      <div className="flex justify-between items-center">
        <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-slate-500" /> Documents de la concession ({documents.length})
        </h3>
        {busy && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
      </div>

      {documents.length > 0 ? (
        <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {documents.map((doc) => (
            <DocumentRow key={doc.path} name={doc.name} type={doc.type} sizeKb={doc.sizeKb}>
              {confirmDelete === doc.path ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-700 mr-1">Supprimer ?</span>
                  <button type="button" onClick={() => handleDelete(doc)} className="h-7 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-semibold cursor-pointer">Oui</button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="h-7 px-2 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] cursor-pointer">Non</button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button type="button" onClick={() => handleOpen(doc, false)} title="Ouvrir" aria-label={`Ouvrir ${doc.name}`} className={iconButton}>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => handleOpen(doc, true)} title="Télécharger" aria-label={`Télécharger ${doc.name}`} className={iconButton}>
                    <Download className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button type="button" onClick={() => setConfirmDelete(doc.path)} title="Supprimer" aria-label={`Supprimer ${doc.name}`} className="w-8 h-8 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </DocumentRow>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-slate-500">Aucun document pour ce lot.</p>
      )}

      {message && <p className="text-[12px] text-rose-700">{message}</p>}
      {canAdd && <DocumentInputs onPicked={handleAdd} disabled={busy} remaining={MAX_DOCUMENTS_PER_PARCEL - documents.length} />}
    </section>
  );
}
