import { getSupabaseInstance } from './supabaseClient';

// Zones of the concession in the Supabase table "concession_zones"
// (see supabase/migrations/20261029000000_concession_zones.sql). Admin only for writes (RLS).

const toFeature = (row) => ({
  type: 'Feature',
  id: row.id,
  properties: { name: row.name, color: row.color },
  geometry: row.geometry
});

/** All rows, deleted ones included (so a deleted default zone is not created again); null when unavailable */
export async function fetchZoneRows() {
  const client = getSupabaseInstance();
  if (!client) return null;
  const { data, error } = await client.from('concession_zones').select('*').order('created_at', { ascending: true });
  if (error) {
    console.warn('Zones indisponibles :', error.message);
    return null;
  }
  return data;
}

export const activeZones = (rows) => rows.filter((r) => !r.deleted).map(toFeature);

function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('schema cache')) {
    return 'Les zones ne sont pas encore configurées : lancez le script « concession_zones » dans Supabase (SQL Editor).';
  }
  if (msg.includes('row-level security') || error?.code === '42501') return 'Seul l’administrateur peut modifier les zones.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('load failed')) return 'Connexion Internet indisponible.';
  return error?.message || 'Enregistrement de la zone impossible.';
}

export async function saveZone(zone) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const { error } = await client.from('concession_zones').upsert({
    id: zone.id,
    name: zone.properties.name,
    color: zone.properties.color,
    geometry: zone.geometry,
    deleted: false,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(friendlyError(error));
}

/** Hidden, not erased: it can be restored in the Supabase Table Editor (deleted = false) */
export async function deleteZone(id) {
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service cloud indisponible.');
  const { error } = await client
    .from('concession_zones')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(friendlyError(error));
}

/** Calls onChange on any zone change. Returns an unsubscribe function. */
export function subscribeZones(onChange) {
  const client = getSupabaseInstance();
  if (!client) return () => {};
  const channel = client
    .channel('realtime:concession_zones')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'concession_zones' }, () => onChange())
    .subscribe();
  return () => client.removeChannel(channel);
}
