import { getSupabaseInstance } from './supabaseClient';

// Parcel photos in the private Supabase Storage bucket "parcel-photos"
// (see supabase/migrations/20261024000000_parcel_photos_storage.sql).
// Parcels only keep the file paths (and where/when each photo was taken) in properties.photos;
// images are shown through short-lived signed URLs, so they stay out of the parcels table and its sync.

const BUCKET = 'parcel-photos';
export const MAX_PHOTOS_PER_PARCEL = 8;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('bucket not found')) {
    return 'Le stockage des photos n’est pas encore configuré (script SQL « parcel_photos_storage » à exécuter dans Supabase).';
  }
  if (msg.includes('row-level security') || msg.includes('unauthorized') || error?.statusCode === '403') {
    return 'Votre compte n’est pas autorisé à envoyer des photos.';
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Connexion Internet indisponible : la photo n’a pas pu être envoyée.';
  }
  return error?.message || 'Envoi de la photo impossible.';
}

/* ─────────────── Where and when the photo was taken ─────────────── */

/**
 * @typedef {Object} PhotoLocation
 * @property {number} lat
 * @property {number} lng
 * @property {number|null} accuracy  metres
 * @property {number|null} altitude  metres
 * @property {'exif'|'gps'} source   exif: recorded by the camera in the file; gps: phone position when the photo was taken
 */

// GPS position recorded by the camera inside the photo file (EXIF), with the shooting date
export async function readPhotoMetadata(file) {
  try {
    const { default: exifr } = await import('exifr');
    // No `pick` option: it drops the latitude / longitude that exifr computes from the raw GPS tags
    const data = await exifr.parse(file, { tiff: true, exif: true, gps: true, ifd1: false, interop: false, xmp: false, icc: false, iptc: false });
    if (!data) return { location: null, takenAt: null };
    const takenAt = data.DateTimeOriginal instanceof Date ? data.DateTimeOriginal.toISOString() : null;
    const valid = Number.isFinite(data.latitude) && Number.isFinite(data.longitude) && !(data.latitude === 0 && data.longitude === 0);
    return {
      takenAt,
      location: valid
        ? {
            lat: data.latitude,
            lng: data.longitude,
            accuracy: Number.isFinite(data.GPSHPositioningError) ? data.GPSHPositioningError : null,
            altitude: Number.isFinite(data.GPSAltitude) ? data.GPSAltitude : null,
            source: 'exif'
          }
        : null
    };
  } catch {
    return { location: null, takenAt: null };
  }
}

// Current phone position (high accuracy), or null if refused / unavailable
export function getDevicePosition(timeoutMs = 20000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          altitude: Number.isFinite(pos.coords.altitude) ? pos.coords.altitude : null,
          source: 'gps'
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/**
 * Location of one picked photo: the position recorded in the file comes first (exact spot of the
 * shot); for a photo just taken with the camera, the phone position at that moment is the fallback.
 * Gallery photos without recorded position stay without location rather than getting a wrong one.
 */
export async function locatePhoto(file, { fromCamera, devicePositionPromise }) {
  const { location, takenAt } = await readPhotoMetadata(file);
  if (location) return { location, takenAt: takenAt || new Date(file.lastModified || Date.now()).toISOString() };
  if (fromCamera && devicePositionPromise) {
    const device = await devicePositionPromise;
    return { location: device, takenAt: new Date().toISOString() };
  }
  return { location: null, takenAt: takenAt || new Date(file.lastModified || Date.now()).toISOString() };
}

export function formatPhotoLocation(location) {
  if (!location) return 'Position GPS non disponible';
  const acc = location.accuracy ? ` ±${Math.round(location.accuracy)} m` : '';
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${acc}`;
}

export function formatPhotoDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─────────────── Compression with GPS stamp ─────────────── */

// Burn a band with position, date and lot at the bottom of the image (field evidence that survives copies)
function drawStamp(ctx, width, height, lines) {
  const fontSize = Math.max(14, Math.round(width / 52));
  const lineH = Math.round(fontSize * 1.35);
  const pad = Math.round(fontSize * 0.7);
  const bandH = lines.length * lineH + pad * 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(0, height - bandH, width, bandH);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? 700 : 500} ${fontSize}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.fillText(line, pad, height - bandH + pad + i * lineH, width - pad * 2);
  });
}

// Resize to at most 1600 px, stamp, and re-encode as JPEG (a 4-8 MB phone photo becomes ~200-400 KB)
export function compressImage(file, stampLines = null) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (stampLines?.length) drawStamp(ctx, canvas.width, canvas.height, stampLines);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compression impossible.'))), 'image/jpeg', JPEG_QUALITY);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Ce fichier n’est pas une image lisible.'));
    };
    img.src = url;
  });
}

export function buildStampLines({ location, takenAt }, lotRef) {
  const where = location
    ? `GPS ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${location.accuracy ? `  ±${Math.round(location.accuracy)} m` : ''}${location.altitude != null ? `  Alt. ${Math.round(location.altitude)} m` : ''}`
    : 'Position GPS non disponible';
  const when = formatPhotoDate(takenAt);
  return [where, `${when}${lotRef ? `  ·  Lot ${lotRef}` : ''}  ·  Concession M.J. d'Oliveira`];
}

/* ─────────────── Storage ─────────────── */

/**
 * Compress (with GPS stamp) and upload one picked photo.
 * @param {string} parcelId
 * @param {{ file: File, location: PhotoLocation|null, takenAt: string }} item
 * @param {{ lotRef?: string }} [options]
 * @returns entry stored in properties.photos
 */
export async function uploadParcelPhoto(parcelId, item, { lotRef } = {}) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const blob = await compressImage(item.file, buildStampLines(item, lotRef));
  const folder = String(parcelId).replace(/[^\w-]+/g, '_');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(friendlyError(error));
  return {
    path,
    uploadedAt: new Date().toISOString(),
    takenAt: item.takenAt || null,
    location: item.location || null,
    sizeKb: Math.round(blob.size / 1024)
  };
}

// Upload several photos, keeping the ones that succeeded
export async function uploadParcelPhotos(parcelId, items, options) {
  const uploaded = [];
  const errors = [];
  for (const item of items) {
    try {
      uploaded.push(await uploadParcelPhoto(parcelId, item, options));
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { uploaded, errors };
}

// Temporary display links (1 hour) for the given photo paths
export async function getPhotoUrls(paths) {
  const client = getSupabaseInstance();
  if (!client || paths.length === 0) return {};
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw new Error(friendlyError(error));
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

export async function deleteParcelPhoto(path) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(friendlyError(error));
}
