import { createClient } from '@supabase/supabase-js';

// Official Supabase Credentials supplied by user
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_7Ns4c6xSjJ6RtxkPtzhXgg_poq0dI1x';
export const DEFAULT_SUPABASE_URL = 'https://oliofshztausxckzmfce.supabase.co';

const STORAGE_KEY_URL = 'geocadastre_supabase_url';
const STORAGE_KEY_KEY = 'geocadastre_supabase_key';

export function getSupabaseConfig() {
  let url = localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  // Auto-migrate if legacy invalid URL is stored
  if (!url || url.includes('7Ns4c6xSjJ6RtxkPtzhXgg')) {
    url = DEFAULT_SUPABASE_URL;
    try {
      localStorage.setItem(STORAGE_KEY_URL, DEFAULT_SUPABASE_URL);
    } catch (e) {}
  }
  const key = localStorage.getItem(STORAGE_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
  return { url, key };
}

export function saveSupabaseConfig(url, key) {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  initSupabaseClient();
}


let supabase = null;

// Reason of the last refused write, shown to the user (e.g. permission rule or database error)
let lastCloudError = '';
export const getLastCloudError = () => lastCloudError;

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
    if (data) {
      return data
        .filter((row) => !row.id || !row.id.startsWith('__'))
        .map((row) => ({
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
    lastCloudError = err.message || String(err);
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
    lastCloudError = err.message || String(err);
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

// 6. Delete ALL parcels in Supabase Cloud
export async function deleteAllParcelsInSupabase() {
  const client = getSupabaseInstance();
  if (!client) return false;

  try {
    const { error } = await client
      .from('parcels')
      .delete()
      .neq('id', 'non_existent_id');

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteAllParcels fallback:', err.message);
    return false;
  }
}

// 7. Real-Time WebSockets Subscription for Automatic Sync
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
    // 1. Primary: load from 'parcels' table with special id '__concession_boundary__'
    const { data, error } = await client
      .from('parcels')
      .select('*')
      .eq('id', '__concession_boundary__')
      .maybeSingle();

    if (!error && data && data.geometry) {
      const geom = typeof data.geometry === 'string' ? JSON.parse(data.geometry) : data.geometry;
      const ring = geom?.coordinates?.[0];
      if (Array.isArray(ring) && ring.length >= 20) {
        const props = typeof data.properties === 'string' ? JSON.parse(data.properties) : (data.properties || {});
        return {
          type: 'Feature',
          id: 'main_concession',
          properties: {
            name: "Concession Manuel Joaquim d'Oliveira",
            areaHa: data.area_ha || props.areaHa || 5310.21,
            ...props
          },
          geometry: geom
        };
      }
    }

    // 2. Secondary fallback: check dedicated 'concession' table if it exists
    const { data: cData, error: cErr } = await client
      .from('concession')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!cErr && cData && cData.geometry) {
      return typeof cData.geometry === 'string' ? JSON.parse(cData.geometry) : cData.geometry;
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
    const geometry = concessionPolygon.geometry || concessionPolygon;
    const properties = concessionPolygon.properties || {};
    const areaHa = properties.areaHa || 5310.21;

    const row = {
      id: '__concession_boundary__',
      lot_number: 'CONCESSION_OFFICIELLE',
      status: 'concession',
      occupant_name: "Concession Manuel Joaquim d'Oliveira",
      area_ha: areaHa,
      properties: {
        ...properties,
        type: 'concession_boundary',
        name: "Concession Manuel Joaquim d'Oliveira",
        synced_at: new Date().toISOString()
      },
      geometry: geometry,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('parcels')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase saveConcession parcels table warning:', error.message);
      // Optional fallback attempt to 'concession' table
      await client.from('concession').upsert({
        id: 'main_concession',
        name: "Concession Manuel Joaquim d'Oliveira",
        geometry: concessionPolygon,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).catch(() => {});
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase saveConcession fallback:', err.message);
    return false;
  }
}

