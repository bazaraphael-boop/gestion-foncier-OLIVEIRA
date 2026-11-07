import { createClient } from '@supabase/supabase-js';
import { sanitizeParcels } from '../utils/parcelSafety';

// Official Supabase Credentials supplied by user
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_7Ns4c6xSjJ6RtxkPtzhXgg_poq0dI1x';
export const DEFAULT_SUPABASE_URL = 'https://oliofshztausxckzmfce.supabase.co';

const STORAGE_KEY_URL = 'geocadastre_supabase_url';
const STORAGE_KEY_KEY = 'geocadastre_supabase_key';

// Passwords are sent to this server: only an https Supabase host is accepted
function isSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

// A secret / service_role key bypasses every RLS rule and must never reach a browser
function isSecretKey(key) {
  if (String(key).startsWith('sb_secret_')) return true;
  try {
    return JSON.parse(atob(String(key).split('.')[1])).role === 'service_role';
  } catch {
    return false;
  }
}

export function getSupabaseConfig() {
  const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const storedKey = localStorage.getItem(STORAGE_KEY_KEY);
  // A stored server only counts together with its own key, both valid; otherwise the official project
  const useStored = isSupabaseUrl(storedUrl) && storedKey && !isSecretKey(storedKey);
  return {
    url: useStored ? storedUrl : import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: useStored ? storedKey : import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY
  };
}

export function saveSupabaseConfig(url, key) {
  if (!isSupabaseUrl(url)) throw new Error('Adresse refusée : elle doit être de la forme https://xxxx.supabase.co');
  if (isSecretKey(key)) throw new Error('Clé refusée : utilisez la clé « publishable », jamais une clé secrète.');
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

// Separate client without saved session: checks a password without touching the current session
export function createTemporaryClient() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'geocadastre_temp_auth' } });
}

export function getSupabaseInstance() {
  if (!supabase) {
    initSupabaseClient();
  }
  return supabase;
}

// --- OFFLINE: changes made without network are kept on the device and sent when it returns ---

const OUTBOX_KEY = 'geocadastre_outbox_v1';

export const isNetworkError = (err) =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) ||
  /fetch|network|load failed|timed? ?out|internet/i.test(err?.message || String(err || ''));

function readOutbox() {
  try {
    const ops = JSON.parse(localStorage.getItem(OUTBOX_KEY));
    return Array.isArray(ops) ? ops : [];
  } catch {
    return [];
  }
}

function writeOutbox(ops) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch {
    // Storage full or unavailable: the change stays on screen only
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('geocadastre:outbox', { detail: ops.length }));
}

// One pending operation per parcel: the latest change wins
function queueOps(newOps) {
  const byId = new Map(readOutbox().map((op) => [op.id, op]));
  newOps.forEach((op) => {
    byId.delete(op.id);
    byId.set(op.id, { ...op, at: Date.now() });
  });
  writeOutbox([...byId.values()]);
}

export const getPendingCount = () => readOutbox().length;

/** Server parcels with the changes still waiting on this device on top */
export function applyPendingChanges(parcels) {
  const ops = readOutbox();
  if (!ops.length) return parcels;
  const pending = new Set(ops.map((op) => op.id));
  const upserts = ops.filter((op) => op.type === 'upsert').map((op) => op.parcel);
  return [...upserts, ...parcels.filter((p) => !pending.has(p.id))];
}

let flushing = null;
let flushAgain = false; // a send was asked while another was running: run once more at the end
const REQUEST_TIMEOUT_MS = 20000;
const withTimeout = (promise) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('network timeout')), REQUEST_TIMEOUT_MS))]);

/**
 * Sends the waiting changes, oldest first. Stops at the first network failure (tried again later);
 * a change refused by the server is dropped and reported through the 'geocadastre:outbox-refused' event.
 */
export function flushOutbox() {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  flushing = (async () => {
    do {
      flushAgain = false;
      await flushOnce();
    } while (flushAgain);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function flushOnce() {
  {
    const refused = [];
    // The list is read again after each send: changes made meanwhile are sent in the same round
    for (let guard = readOutbox().length + 100; guard > 0; guard--) {
      const op = readOutbox()[0];
      if (!op) break;
      const result = op.type === 'delete' ? await deleteRows([op.id]) : await upsertRows([op.parcel]);
      if (result.network) break;
      writeOutbox(readOutbox().filter((o) => !(o.id === op.id && o.at === op.at)));
      if (!result.ok) refused.push({ lot: op.parcel?.properties?.lotNumber || op.id, reason: result.message });
    }
    if (refused.length && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('geocadastre:outbox-refused', { detail: refused }));
    }
  }
}

const toRow = (parcel) => ({
  id: parcel.id,
  lot_number: parcel.properties?.lotNumber || parcel.id,
  status: parcel.properties?.status || 'disponible',
  occupant_name: parcel.properties?.occupantName || '',
  area_ha: parcel.properties?.areaHa || 0,
  properties: parcel.properties,
  geometry: parcel.geometry,
  updated_at: new Date().toISOString()
});

async function upsertRows(parcels) {
  const client = getSupabaseInstance();
  if (!client) return { ok: false, network: true };
  try {
    const { error } = await withTimeout(client.from('parcels').upsert(parcels.map(toRow), { onConflict: 'id' }));
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, network: isNetworkError(err), message: err.message || String(err) };
  }
}

async function deleteRows(ids) {
  const client = getSupabaseInstance();
  if (!client) return { ok: false, network: true };
  try {
    const { error } = await withTimeout(client.from('parcels').delete().in('id', ids));
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, network: isNetworkError(err), message: err.message || String(err) };
  }
}

/**
 * Saves parcels: true when saved, 'queued' when kept for later (no network), false when refused.
 * Waiting changes go first so that the order of the changes is kept.
 */
async function saveOrQueue(parcels) {
  if (readOutbox().length) {
    queueOps(parcels.map((parcel) => ({ type: 'upsert', id: parcel.id, parcel })));
    flushOutbox();
    return 'queued';
  }
  const result = await upsertRows(parcels);
  if (result.ok) return true;
  if (result.network) {
    queueOps(parcels.map((parcel) => ({ type: 'upsert', id: parcel.id, parcel })));
    return 'queued';
  }
  lastCloudError = result.message;
  return false;
}

async function deleteOrQueue(ids) {
  if (readOutbox().length) {
    queueOps(ids.map((id) => ({ type: 'delete', id })));
    flushOutbox();
    return 'queued';
  }
  const result = await deleteRows(ids);
  if (result.ok) return true;
  if (result.network) {
    queueOps(ids.map((id) => ({ type: 'delete', id })));
    return 'queued';
  }
  lastCloudError = result.message;
  return false;
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
      const parseJson = (value) => {
        if (typeof value !== 'string') return value;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };
      return sanitizeParcels(applyPendingChanges(
        data
          .filter((row) => !row.id || !row.id.startsWith('__'))
          .map((row) => ({
            id: row.id,
            type: row.type || 'Feature',
            geometry: parseJson(row.geometry),
            properties: parseJson(row.properties)
          }))
      ));
    }
    return [];
  } catch (err) {
    console.warn('Supabase fetchParcels fallback to local:', err.message);
    return null;
  }
}

// 2. Save/Upsert single parcel in Supabase
export async function saveParcelToSupabase(parcel) {
  return saveOrQueue([parcel]);
}

// 3. Delete single parcel in Supabase
export async function deleteParcelFromSupabase(parcelId) {
  return deleteOrQueue([parcelId]);
}

// 4. Bulk Upsert Parcels list in Supabase
export async function bulkSaveParcelsToSupabase(parcelsList) {
  if (!parcelsList || parcelsList.length === 0) return false;
  return saveOrQueue(parcelsList);
}

// 5. Bulk Delete Parcels in Supabase
export async function bulkDeleteParcelsFromSupabase(parcelIdsList) {
  if (!parcelIdsList || parcelIdsList.length === 0) return false;
  return deleteOrQueue(parcelIdsList);
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

