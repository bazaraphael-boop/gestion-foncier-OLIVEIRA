import { getSupabaseInstance } from './supabaseClient';

// Parcel photos in the private Supabase Storage bucket "parcel-photos"
// (see supabase/migrations/20261024000000_parcel_photos_storage.sql).
// Parcels only keep the file paths in properties.photos; images are shown through
// short-lived signed URLs, so they stay out of the parcels table and its frequent sync.

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

// Resize to at most 1600 px and re-encode as JPEG (a phone photo of 4-8 MB becomes ~200-400 KB)
export function compressImage(file) {
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

// Compress and upload one photo; returns the entry to store in properties.photos
export async function uploadParcelPhoto(parcelId, file) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const blob = await compressImage(file);
  const folder = String(parcelId).replace(/[^\w-]+/g, '_');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(friendlyError(error));
  return { path, uploadedAt: new Date().toISOString(), sizeKb: Math.round(blob.size / 1024) };
}

// Upload several photos, keeping the ones that succeeded
export async function uploadParcelPhotos(parcelId, files) {
  const uploaded = [];
  const errors = [];
  for (const file of files) {
    try {
      uploaded.push(await uploadParcelPhoto(parcelId, file));
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
