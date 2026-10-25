import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, X, Trash2, ChevronLeft, ChevronRight, Loader2, MapPin, MapPinOff, ExternalLink } from 'lucide-react';
import {
  uploadParcelPhotos,
  getPhotoUrls,
  deleteParcelPhoto,
  getDevicePosition,
  locatePhoto,
  formatPhotoLocation,
  formatPhotoDate,
  MAX_PHOTOS_PER_PARCEL
} from '../services/photoService';

// Hidden file inputs: one opening the rear camera on phones, one for the gallery (several files).
// Each picked file is returned with where and when it was taken: { file, location, takenAt }.
function PhotoInputs({ onPicked, disabled, remaining }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const devicePosition = useRef(null);
  const [locating, setLocating] = useState(false);

  const openCamera = () => {
    // Start the GPS fix right away so it is ready when the shot comes back
    devicePosition.current = getDevicePosition();
    cameraRef.current?.click();
  };

  const handle = (fromCamera) => async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    e.target.value = '';
    if (!files.length) return;
    setLocating(true);
    const items = await Promise.all(
      files.map(async (file) => ({ file, ...(await locatePhoto(file, { fromCamera, devicePositionPromise: devicePosition.current })) }))
    );
    setLocating(false);
    onPicked(items);
  };

  const btn =
    'h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[12px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const blocked = disabled || locating || remaining <= 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={openCamera} disabled={blocked} className={btn}>
        <Camera className="w-4 h-4 text-slate-500" /> Prendre une photo
      </button>
      <button type="button" onClick={() => galleryRef.current?.click()} disabled={blocked} className={btn}>
        <ImagePlus className="w-4 h-4 text-slate-500" /> Choisir des images
      </button>
      {locating && (
        <span className="text-[12px] text-slate-500 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Localisation GPS…
        </span>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle(true)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handle(false)} />
    </div>
  );
}

function LocationBadge({ location }) {
  return location ? (
    <span className="absolute bottom-1 left-1 h-5 px-1.5 rounded-full bg-emerald-600/95 text-white text-[10px] font-semibold flex items-center gap-0.5 shadow" title={formatPhotoLocation(location)}>
      <MapPin className="w-3 h-3" /> GPS
    </span>
  ) : (
    <span className="absolute bottom-1 left-1 h-5 px-1.5 rounded-full bg-slate-700/85 text-white text-[10px] font-medium flex items-center gap-0.5 shadow" title="Position GPS non disponible">
      <MapPinOff className="w-3 h-3" /> sans GPS
    </span>
  );
}

/* ─────────────── Picker used in the "Nouvelle parcelle" form ─────────────── */

export function PhotoPicker({ items, onChange, max = 4, disabled = false }) {
  const previews = useMemo(() => items.map((it) => URL.createObjectURL(it.file)), [items]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">Photos de la parcelle</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{items.length} / {max}</span>
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <LocationBadge location={items[i].location} />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
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
      <PhotoInputs onPicked={(added) => onChange([...items, ...added].slice(0, max))} disabled={disabled} remaining={max - items.length} />
      <p className="text-[11px] text-slate-500">
        Chaque photo est enregistrée avec la position GPS du lieu de prise de vue, incrustée sur l’image. Autorisez la localisation quand le téléphone le demande.
      </p>
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

  const handleAdd = async (items) => {
    setBusy(true);
    setMessage('');
    const { uploaded, errors } = await uploadParcelPhotos(parcel.id, items, { lotRef: parcel.properties?.lotNumber });
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
  const current = viewer !== null ? photos[viewer] : null;

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
              <LocationBadge location={photo.location} />
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

      {canAdd && <PhotoInputs onPicked={handleAdd} disabled={busy} remaining={MAX_PHOTOS_PER_PARCEL - photos.length} />}

      {current && urls[current.path] && (
        <div className="fixed inset-0 z-[3200] bg-slate-950/90 flex flex-col items-center justify-center p-4 gap-3" onClick={() => setViewer(null)} role="dialog" aria-label="Photo agrandie">
          <img src={urls[current.path]} alt={`Photo ${viewer + 1}`} className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="bg-white/95 text-slate-800 rounded-lg px-3.5 py-2.5 text-[12px] max-w-md w-full space-y-0.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 font-semibold">
              {current.location ? <MapPin className="w-4 h-4 text-emerald-600" /> : <MapPinOff className="w-4 h-4 text-slate-400" />}
              <span className="font-mono tabular-nums">{formatPhotoLocation(current.location)}</span>
            </div>
            <div className="text-slate-500">
              {current.takenAt ? `Prise le ${formatPhotoDate(current.takenAt)}` : `Ajoutée le ${formatPhotoDate(current.uploadedAt)}`}
              {current.location && ` · ${current.location.source === 'exif' ? 'position enregistrée par l’appareil photo' : 'position GPS du téléphone à la prise de vue'}`}
            </div>
            {current.location && (
              <a
                href={`https://www.google.com/maps?q=${current.location.lat},${current.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium pt-0.5"
              >
                Voir le lieu sur la carte <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <button type="button" onClick={() => setViewer(null)} aria-label="Fermer" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setViewer((v) => (v - 1 + photos.length) % photos.length); }} aria-label="Photo précédente" className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setViewer((v) => (v + 1) % photos.length); }} aria-label="Photo suivante" className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
