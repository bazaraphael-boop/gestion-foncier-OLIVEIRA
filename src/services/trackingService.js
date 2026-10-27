import { getSupabaseInstance } from './supabaseClient';

// Live tracking of the arpenteur while his GPS is on (tables in supabase/migrations/20261027000000_surveyor_live_tracking.sql).
// The arpenteur writes his own position; RLS lets only the admin read the others'.

/** Latest position (upsert) and, when he moved, one point of the trail */
export async function publishSurveyorPosition(session, position, options) {
  try {
    return await upsertSurveyorPosition(session, position, options);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function upsertSurveyorPosition(session, { lat, lng, accuracy, heading, speed }, { addTrailPoint }) {
  const client = getSupabaseInstance();
  const userId = session?.user?.id;
  if (!client || !userId) return { ok: false, error: 'Non connecté' };

  const { error } = await client.from('surveyor_locations').upsert({
    user_id: userId,
    full_name: session.name || session.user.email,
    lat,
    lng,
    accuracy: accuracy ?? null,
    heading: Number.isFinite(heading) ? heading : null,
    speed: Number.isFinite(speed) ? speed : null,
    is_active: true,
    updated_at: new Date().toISOString()
  });
  if (error) return { ok: false, error: error.message };

  if (addTrailPoint) {
    const res = await client.from('surveyor_location_points').insert({ user_id: userId, lat, lng, accuracy: accuracy ?? null });
    if (res.error) return { ok: false, error: res.error.message };
  }
  return { ok: true };
}

/** GPS turned off: the admin sees the arpenteur as offline at his last position */
export async function setSurveyorOffline(session) {
  const client = getSupabaseInstance();
  const userId = session?.user?.id;
  if (!client || !userId) return;
  await client
    .from('surveyor_locations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

/** Admin: latest positions and today's trails */
export async function fetchLiveSurveyors() {
  const client = getSupabaseInstance();
  if (!client) return { locations: [], points: [] };
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [loc, pts] = await Promise.all([
    client.from('surveyor_locations').select('*'),
    client
      .from('surveyor_location_points')
      .select('user_id, lat, lng, recorded_at')
      .gte('recorded_at', startOfDay.toISOString())
      .order('recorded_at', { ascending: true })
      .limit(5000)
  ]);
  return { locations: loc.data || [], points: pts.data || [], error: loc.error?.message || pts.error?.message };
}

/** Admin: every new position as it arrives. Returns an unsubscribe function. */
export function subscribeLiveSurveyors({ onLocation, onPoint }) {
  const client = getSupabaseInstance();
  if (!client) return () => {};
  const channel = client
    .channel('realtime:surveyors')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'surveyor_locations' }, (payload) => {
      if (payload.new?.user_id) onLocation(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surveyor_location_points' }, (payload) => {
      if (payload.new?.user_id) onPoint(payload.new);
    })
    .subscribe();
  return () => client.removeChannel(channel);
}
