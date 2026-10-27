import { getSupabaseInstance } from './supabaseClient';

// Parcel documents of the Concession Manuel Joaquim d'Oliveira (title, contract, cadastral plan…)
// in the private Supabase Storage bucket "parcel-documents"
// (see supabase/migrations/20261028000000_parcel_documents_storage.sql).
// Parcels only keep the list of files in properties.documents; files open through short-lived signed URLs.

const BUCKET = 'parcel-documents';
export const MAX_DOCUMENTS_PER_PARCEL = 12;
export const MAX_DOCUMENT_MB = 15;

export const DOCUMENT_TYPES = [
  { id: 'titre', label: 'Titre de la concession' },
  { id: 'contrat', label: 'Contrat de vente / cession' },
  { id: 'plan', label: 'Plan cadastral' },
  { id: 'pv_bornage', label: 'Procès-verbal de bornage' },
  { id: 'fiche', label: 'Fiche parcellaire' },
  { id: 'identite', label: 'Pièce d’identité de l’acquéreur' },
  { id: 'paiement', label: 'Reçu de paiement' },
  { id: 'autre', label: 'Autre document' }
];

export const documentTypeLabel = (id) => DOCUMENT_TYPES.find((t) => t.id === id)?.label || 'Document';

// Accepted by the bucket; the file picker uses the same list
export const ACCEPTED_DOCUMENTS = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';
const MIME_BY_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

const extensionOf = (name) => (String(name).split('.').pop() || '').toLowerCase();

/** Reason the file cannot be added, or null */
export function checkDocumentFile(file) {
  if (!MIME_BY_EXT[extensionOf(file.name)]) return `« ${file.name} » : format non accepté (PDF, image, Word ou Excel).`;
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) return `« ${file.name} » dépasse ${MAX_DOCUMENT_MB} Mo.`;
  return null;
}

function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('bucket not found')) {
    return 'Le stockage des documents n’est pas encore configuré : lancez le script « parcel_documents_storage » dans Supabase (SQL Editor).';
  }
  if (msg.includes('row-level security') || msg.includes('unauthorized') || error?.statusCode === '403') {
    return `Envoi refusé par les règles du stockage (${error?.message || 'accès refusé'}). Vérifiez que votre compte a un rôle admin ou arpenteur.`;
  }
  if (msg.includes('mime') || msg.includes('not supported')) return 'Format de fichier non accepté par le stockage.';
  if (msg.includes('size') || msg.includes('too large')) return `Fichier trop lourd (${MAX_DOCUMENT_MB} Mo au maximum).`;
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'Connexion Internet indisponible : le document n’a pas pu être envoyé.';
  }
  return error?.message || 'Envoi du document impossible.';
}

/**
 * @param {string} parcelId
 * @param {{ file: File, type: string }} item
 * @returns entry stored in properties.documents
 */
export async function uploadParcelDocument(parcelId, item) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const reason = checkDocumentFile(item.file);
  if (reason) throw new Error(reason);
  const ext = extensionOf(item.file.name);
  const folder = String(parcelId).replace(/[^\w-]+/g, '_');
  // Storage keys stay ASCII; the original file name is kept in the entry
  const path = `${folder}/${item.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, item.file, { contentType: MIME_BY_EXT[ext], upsert: false });
  if (error) throw new Error(friendlyError(error));
  return {
    path,
    name: item.file.name,
    type: item.type,
    sizeKb: Math.round(item.file.size / 1024),
    uploadedAt: new Date().toISOString()
  };
}

// Upload several documents, keeping the ones that succeeded
export async function uploadParcelDocuments(parcelId, items) {
  const uploaded = [];
  const errors = [];
  for (const item of items) {
    try {
      uploaded.push(await uploadParcelDocument(parcelId, item));
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { uploaded, errors };
}

/** Temporary link (10 minutes); with `download` the browser saves the file under its original name */
export async function getDocumentUrl(doc, { download = false } = {}) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, 600, download ? { download: doc.name || true } : undefined);
  if (error) throw new Error(friendlyError(error));
  return data.signedUrl;
}

export async function deleteParcelDocument(path) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(friendlyError(error));
}

export function formatDocumentSize(sizeKb) {
  return sizeKb >= 1024
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(sizeKb / 1024)} Mo`
    : `${sizeKb} Ko`;
}
