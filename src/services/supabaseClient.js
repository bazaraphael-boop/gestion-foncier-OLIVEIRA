import { createClient } from '@supabase/supabase-js';

// Default Supabase Credentials supplied by user
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_7Ns4c6xSjJ6RtxkPtzhXgg_poq0dI1x';
export const DEFAULT_SUPABASE_URL = 'https://7Ns4c6xSjJ6RtxkPtzhXgg.supabase.co';

const STORAGE_KEY_URL = 'geocadastre_supabase_url';
const STORAGE_KEY_KEY = 'geocadastre_supabase_key';

export function getSupabaseConfig() {
  const url = localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem(STORAGE_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
  return { url, key };
}

export function saveSupabaseConfig(url, key) {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  initSupabaseClient();
}

let supabase = null;

export function initSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  if (url && key) {
    try {
      supabase = createClient(url, key);
    } catch (e) {
      console.warn('Could not initialize Supabase client:', e);
      supabase = null;
    }
  }
  return supabase;
}

// Initialise client
initSupabaseClient();

export function getSupabaseInstance() {
  if (!supabase) {
    initSupabaseClient();
  }
  return supabase;
}

// --- PARCELS SUPABASE CLOUD API SERVICES ---

// 1. Fetch all parcels from Supabase 'parcels' table
export async function fetchParcelsFromSupabase() {
  const client = getSupabaseInstance();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('parcels')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((row) => ({
        id: row.id,
        type: row.type || 'Feature',
        geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
        properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties
      }));
    }
    return [];
  } catch (err) {
    console.warn('Supabase fetchParcels fallback to local:', err.message);
    return null;
  }
}

// 2. Save/Upsert single parcel in Supabase
export async function saveParcelToSupabase(parcel) {
  const client = getSupabaseInstance();
  if (!client) return false;

  try {
    const row = {
      id: parcel.id,
      lot_number: parcel.properties?.lotNumber || parcel.id,
      status: parcel.properties?.status || 'disponible',
      occupant_name: parcel.properties?.occupantName || '',
      area_ha: parcel.properties?.areaHa || 0,
      properties: parcel.properties,
      geometry: parcel.geometry,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('parcels')
      .upsert(row, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveParcel fallback:', err.message);
    return false;
  }
}

// 3. Delete single parcel in Supabase
export async function deleteParcelFromSupabase(parcelId) {
  const client = getSupabaseInstance();
  if (!client) return false;

  try {
    const { error } = await client
      .from('parcels')
      .delete()
      .eq('id', parcelId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteParcel fallback:', err.message);
    return false;
  }
}

// 4. Bulk Upsert Parcels list in Supabase
export async function bulkSaveParcelsToSupabase(parcelsList) {
  const client = getSupabaseInstance();
  if (!client || !parcelsList || parcelsList.length === 0) return false;

  try {
    const rows = parcelsList.map((parcel) => ({
      id: parcel.id,
      lot_number: parcel.properties?.lotNumber || parcel.id,
      status: parcel.properties?.status || 'disponible',
      occupant_name: parcel.properties?.occupantName || '',
      area_ha: parcel.properties?.areaHa || 0,
      properties: parcel.properties,
      geometry: parcel.geometry,
      updated_at: new Date().toISOString()
    }));

    const { error } = await client
      .from('parcels')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase bulkSaveParcels fallback:', err.message);
    return false;
  }
}

// 5. Bulk Delete Parcels in Supabase
export async function bulkDeleteParcelsFromSupabase(parcelIdsList) {
  const client = getSupabaseInstance();
  if (!client || !parcelIdsList || parcelIdsList.length === 0) return false;

  try {
    const { error } = await client
      .from('parcels')
      .delete()
      .in('id', parcelIdsList);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase bulkDeleteParcels fallback:', err.message);
    return false;
  }
}

// 6. Real-Time WebSockets Subscription for Automatic Sync
export function subscribeToRealtimeParcels(onPayload) {
  const client = getSupabaseInstance();
  if (!client) return null;

  try {
    const channel = client
      .channel('realtime:parcels')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcels' },
        (payload) => {
          if (onPayload) onPayload(payload);
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('Realtime subscription warning:', err);
    return null;
  }
}

// --- CONCESSION SUPABASE CLOUD API SERVICES ---

export async function fetchConcessionFromSupabase() {
  const client = getSupabaseInstance();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('concession')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    if (data && data.geometry) {
      return typeof data.geometry === 'string' ? JSON.parse(data.geometry) : data.geometry;
    }
    return null;
  } catch (err) {
    console.warn('Supabase fetchConcession fallback:', err.message);
    return null;
  }
}

export async function saveConcessionToSupabase(concessionPolygon) {
  const client = getSupabaseInstance();
  if (!client || !concessionPolygon) return false;

  try {
    const row = {
      id: 'main_concession',
      name: "Concession Manuel Joaquim d'Oliveira",
      geometry: concessionPolygon,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('concession')
      .upsert(row, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveConcession fallback:', err.message);
    return false;
  }
}
