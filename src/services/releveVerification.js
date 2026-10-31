import { getSupabaseInstance } from './supabaseClient';

// Online verification of the relevés (supabase/migrations/20261031000000_releve_verification.sql):
// the server records each issued relevé; the QR code opens a public page that reads this registry.

const TOKEN_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const verificationUrl = (token) => `${window.location.origin}${window.location.pathname}?verifier=${token}`;

/** Records the lot's relevé; null when it cannot be done (offline, script not run yet) */
export async function issueReleve(parcelId) {
  const client = getSupabaseInstance();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('issue_releve', { p_parcel_id: parcelId });
    if (error) throw error;
    return { url: verificationUrl(data.token), fingerprint: data.fingerprint, issuedOn: data.issued_on };
  } catch (err) {
    console.warn('Relevé non inscrit au registre :', err.message);
    return null;
  }
}

/** Public check of a scanned token. status: authentic | outdated | revoked | unknown */
export async function verifyReleve(token) {
  if (!TOKEN_FORMAT.test(token || '')) return { status: 'unknown' };
  const client = getSupabaseInstance();
  if (!client) throw new Error('Service indisponible');
  const { data, error } = await client.rpc('verify_releve', { p_token: token });
  if (error) throw error;
  return data;
}
