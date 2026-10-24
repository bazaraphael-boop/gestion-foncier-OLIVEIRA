import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, X, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { uploadParcelPhotos, getPhotoUrls, deleteParcelPhoto, MAX_PHOTOS_PER_PARCEL } from '../services/photoService';

// Hidden file inputs: one for the gallery (several files), one opening the rear camera on phones
function PhotoInputs({ onFiles, disabled, remaining }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const handle = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    e.target.value = '';
    if (files.length) onFiles(files);
  };
  const btn =
    'h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[12px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => cameraRef.current?.click()} disabled={disabled || remaining <= 0} className={btn}>
        <Camera className="w-4 h-4 text-slate-500" /> Prendre une photo
      </button>
      <button type="button" onClick={() => galleryRef.current?.click()} disabled={disabled || remaining <= 0} className={btn}>
        <ImagePlus className="w-4 h-4 text-slate-500" /> Choisir des images
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handle} />
    </div>
  );
}

/* ─────────────── Picker used in the "Nouvelle parcelle" form ─────────────── */

export function PhotoPicker({ files, onChange, max = 4, disabled = false }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">Photos de la parcelle</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{files.length} / {max}</span>
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  aria-label={`Retirer la photo ${i + 1}`}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/95 text-slate-700 hover:text-rose-700 flex items-center justify-center shadow cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <PhotoInputs onFiles={(added) => onChange([...files, ...added].slice(0, max))} disabled={disabled} remaining={max - files.length} />
      <p className="text-[11px] text-slate-500">Les photos sont compressées automatiquement avant l’envoi. Facultatif.</p>
    </div>
  );
}

/* ─────────────── Gallery in the parcel panel ─────────────── */

export function ParcelPhotoGallery({ parcel, canAdd, canDelete, onPhotosChange }) {
  const photos = Array.isArray(parcel.properties?.photos) ? parcel.properties.photos : [];
  const [urls, setUrls] = useState({});
  const [loadedKey, setLoadedKey] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [viewer, setViewer] = useState(null); // index of the enlarged photo
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pathsKey = photos.map((p) => p.path).join('|');

  useEffect(() => {
    let cancelled = false;
    if (!pathsKey) return undefined;
    getPhotoUrls(pathsKey.split('|'))
      .then((map) => {
        if (!cancelled) {
          setUrls(map);
          setLoadError('');
          setLoadedKey(pathsKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message);
          setLoadedKey(pathsKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathsKey]);

  // Keyboard navigation in the enlarged view
  useEffect(() => {
    if (viewer === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setViewer(null);
      if (e.key === 'ArrowRight') setViewer((v) => (v + 1) % photos.length);
      if (e.key === 'ArrowLeft') setViewer((v) => (v - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, photos.length]);

  const handleAdd = async (files) => {
    setBusy(true);
    setMessage('');
    const { uploaded, errors } = await uploadParcelPhotos(parcel.id, files);
    if (uploaded.length) onPhotosChange([...photos, ...uploaded]);
    if (errors.length) setMessage(errors[0]);
    setBusy(false);
  };

  const handleDelete = async (photo) => {
    setBusy(true);
    setMessage('');
    try {
      await deleteParcelPhoto(photo.path);
      onPhotosChange(photos.filter((p) => p.path !== photo.path));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  if (!photos.length && !canAdd) return null;

  return (
    <section className="px-5 py-4 border-b border-slate-100 space-y-2.5">
      <div className="flex justify-between items-center">
        <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-slate-500" /> Photos ({photos.length})
        </h3>
        {busy && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={photo.path} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              {urls[photo.path] ? (
                <button type="button" onClick={() => setViewer(i)} className="w-full h-full cursor-zoom-in" aria-label={`Agrandir la photo ${i + 1}`}>
                  <img src={urls[photo.path]} alt={`Photo ${i + 1} du lot`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ) : loadedKey === pathsKey ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-center text-[11px] text-slate-500">Photo indisponible</div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                </div>
              )}
              {canDelete &&
                (confirmDelete === photo.path ? (
                  <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-1.5 p-1">
                    <span className="text-[11px] font-medium text-slate-800">Supprimer ?</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleDelete(photo)} className="h-7 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-semibold cursor-pointer">
                        Oui
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="h-7 px-2 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] cursor-pointer">
                        Non
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(photo.path)}
                    aria-label={`Supprimer la photo ${i + 1}`}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/95 text-slate-600 hover:text-rose-700 flex items-center justify-center shadow cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {loadError && <p className="text-[12px] text-rose-700">{loadError}</p>}
      {message && <p className="text-[12px] text-rose-700">{message}</p>}
      {!photos.length && <p className="text-[12px] text-slate-500">Aucune photo pour ce lot.</p>}

      {canAdd && <PhotoInputs onFiles={handleAdd} disabled={busy} remaining={MAX_PHOTOS_PER_PARCEL - photos.length} />}

      {viewer !== null && urls[photos[viewer]?.path] && (
        <div className="fixed inset-0 z-[3200] bg-slate-950/90 flex items-center justify-center p-4" onClick={() => setViewer(null)} role="dialog" aria-label="Photo agrandie">
          <img src={urls[photos[viewer].path]} alt={`Photo ${viewer + 1}`} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setViewer(null)} aria-label="Fermer" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setViewer((v) => (v - 1 + photos.length) % photos.length); }} aria-label="Photo précédente" className="absolute left-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setViewer((v) => (v + 1) % photos.length); }} aria-label="Photo suivante" className="absolute right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-[13px] tabular-nums">
            {viewer + 1} / {photos.length}
          </span>
        </div>
      )}
    </section>
  );
}
