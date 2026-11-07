/**
 * Authentication & Role-Based Session Service (Supabase Auth)
 * Features:
 * - Real accounts managed by Supabase Auth (email + password)
 * - Role read from the public.profiles table (admin | arpenteur)
 * - Rate limiting and session refresh handled server-side by Supabase
 * - Data access enforced by Row Level Security (see supabase/migrations)
 */

import { getSupabaseInstance, createTemporaryClient, isNetworkError } from './supabaseClient';
import { logActivity, flushAuditLogs } from './auditService';

const VALID_ROLES = ['admin', 'arpenteur'];

function translateAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (error?.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.';
  }
  if (msg.includes('invalid login credentials')) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (msg.includes('email not confirmed')) {
    return "Ce compte n'a pas encore été confirmé.";
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Connexion au serveur impossible. Vérifiez votre accès Internet.';
  }
  return error?.message || 'Une erreur technique est survenue lors de la connexion.';
}

// Role kept on the device for offline use (screens only: the server still checks every write)
const PROFILE_CACHE = 'geocadastre_profile_';

function cacheProfile(userId, profile) {
  try {
    localStorage.setItem(PROFILE_CACHE + userId, JSON.stringify(profile));
  } catch {
    // Storage unavailable: offline use needs the network once more
  }
}

function cachedProfile(userId) {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_CACHE + userId));
    return VALID_ROLES.includes(profile?.role) ? profile : null;
  } catch {
    return null;
  }
}

// Build the app session object from a Supabase auth session
async function buildSession(authSession) {
  if (!authSession?.user) return null;
  const client = getSupabaseInstance();
  let profile = null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('role, full_name')
      .eq('id', authSession.user.id)
      .maybeSingle();
    if (error) throw error;
    if (data && VALID_ROLES.includes(data.role)) {
      profile = { role: data.role, full_name: data.full_name };
      cacheProfile(authSession.user.id, profile);
    }
  } catch (err) {
    // No network: the role last seen on this device
    if (isNetworkError(err)) profile = cachedProfile(authSession.user.id);
  }
  if (!profile) return null;

  return {
    role: profile.role,
    name: profile.full_name || authSession.user.email,
    user: { id: authSession.user.id, email: authSession.user.email }
  };
}

// Session saved by Supabase on this device, read directly when it cannot be renewed offline.
// A session stopped before the two-step code (verified factor, level aal1) is not used.
function storedSessionOffline() {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return null;
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    const key = keys.find((k) => /^sb-.+-auth-token$/.test(k || ''));
    const stored = key && JSON.parse(localStorage.getItem(key));
    if (!stored?.user || !stored.access_token) return null;
    const payload = JSON.parse(atob(stored.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const hasFactor = (stored.user.factors || []).some((f) => f.status === 'verified');
    if (hasFactor && payload.aal !== 'aal2') return null;
    return stored;
  } catch {
    return null;
  }
}

async function signIn(email, password, allowedRoles) {
  const client = getSupabaseInstance();
  if (!client) {
    return { success: false, error: 'Service d’authentification indisponible.' };
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: translateAuthError(error) };
  }

  const session = await buildSession(data.session);
  if (!session || !allowedRoles.includes(session.role)) {
    await client.auth.signOut({ scope: 'local' });
    return { success: false, error: "Ce compte n'est pas habilité pour cet espace." };
  }
  // Two-step verification active: password alone gives no rights until the phone's code is confirmed
  if (await needsMfaCode(client)) {
    return { success: false, mfaRequired: true };
  }
  return { success: true, session };
}

async function needsMfaCode(client) {
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2';
}

function logLogin(session) {
  const isArpenteur = session.role === 'arpenteur';
  logActivity({
    role: session.role,
    actor: `${isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur'} (${session.user.email})`,
    action: 'AUTH_LOGIN',
    actionLabel: isArpenteur ? 'Connexion Espace Arpenteur Géomètre' : 'Connexion Espace Administration SIG',
    details: isArpenteur ? 'Session de terrain et bornage activée' : 'Session complète de direction cadastrale ouverte',
    severity: 'success'
  });
}

/* ─────────────────────────────────────────────────────────────
 * TWO-STEP VERIFICATION (authenticator app on the phone)
 * ───────────────────────────────────────────────────────────── */

/** The account's active factor, or null */
export async function getMfaFactor() {
  const client = getSupabaseInstance();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) return null;
  return data?.totp?.[0] || null;
}

async function verifyFactorCode(client, factorId, code) {
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (error.status === 429 || msg.includes('too many') || msg.includes('rate limit')) {
      throw new Error('Trop de tentatives. Patientez quelques minutes.');
    }
    throw new Error('Code incorrect ou expiré. Tapez le code affiché actuellement.');
  }
}

/** Second step of the login */
export async function verifyLoginCode(code) {
  const client = getSupabaseInstance();
  const factor = await getMfaFactor();
  if (!factor) return { success: false, error: 'Double vérification introuvable sur ce compte.' };
  try {
    await verifyFactorCode(client, factor.id, code);
  } catch (err) {
    return { success: false, error: err.message };
  }
  const { data } = await client.auth.getSession();
  const session = await buildSession(data.session);
  if (!session) return { success: false, error: "Ce compte n'est pas habilité pour cet espace." };
  logLogin(session);
  return { success: true, session };
}

/** Login abandoned between the password and the code */
export async function cancelLogin() {
  await getSupabaseInstance().auth.signOut({ scope: 'local' });
}

export async function startMfaEnrollment() {
  const client = getSupabaseInstance();
  // A previous attempt that was never confirmed would block a new one
  const { data: list } = await client.auth.mfa.listFactors();
  for (const f of list?.all || []) {
    if (f.status !== 'verified') await client.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Téléphone' });
  if (error) throw new Error(`Activation impossible : ${error.message}`);
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmMfaEnrollment(factorId, code) {
  await verifyFactorCode(getSupabaseInstance(), factorId, code);
}

export async function disableMfa(factorId) {
  const { error } = await getSupabaseInstance().auth.mfa.unenroll({ factorId });
  if (error) throw new Error(`Désactivation impossible : ${error.message}`);
}

/* ─────────────────────────────────────────────────────────────
 * ADMIN & ARPENTEUR AUTHENTICATION
 * ───────────────────────────────────────────────────────────── */

export async function loginAdmin(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Veuillez saisir votre email et votre mot de passe.' };
  }

  const res = await signIn(cleanEmail, password, ['admin', 'arpenteur']);
  if (res.success) logLogin(res.session);
  return res;
}

/* ─────────────────────────────────────────────────────────────
 * SESSION MANAGEMENT
 * ───────────────────────────────────────────────────────────── */

export async function getCurrentSession() {
  const client = getSupabaseInstance();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    if (!data.session) return await buildSession(storedSessionOffline());
    // A session stopped between the password and the code is not an opened session
    if (await needsMfaCode(client)) {
      await client.auth.signOut({ scope: 'local' });
      return null;
    }
    return await buildSession(data.session);
  } catch (e) {
    console.warn('Lecture de session impossible:', e);
    return await buildSession(storedSessionOffline());
  }
}

// Calls onChange(null) when the user signs out (also emitted when the refresh token expires)
export function onSessionChange(onChange) {
  const client = getSupabaseInstance();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      onChange(null);
    }
  });
  return () => data.subscription.unsubscribe();
}

export async function logout(session) {
  if (session?.role) {
    logActivity({
      role: session.role,
      actor: session.role === 'admin' ? 'Administrateur' : 'Arpenteur Géomètre',
      action: 'AUTH_LOGOUT',
      actionLabel: `Déconnexion de session (${session.role})`,
      details: 'Fermeture volontaire de session',
      severity: 'info'
    });
  }
  await flushAuditLogs();
  const client = getSupabaseInstance();
  if (client) {
    // This device only: other phones of a shared account stay connected
    await client.auth.signOut({ scope: 'local' });
  }
}

/* ─────────────────────────────────────────────────────────────
 * CREDENTIALS & SECURITY MANAGEMENT
 * ───────────────────────────────────────────────────────────── */

// Change the password of the signed-in account (admin or arpenteur)
export async function updateAdminPassword(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Veuillez remplir tous les champs de mot de passe.' };
  }
  if (newPassword.length < 10) {
    return { success: false, error: 'Le nouveau mot de passe doit comporter au moins 10 caractères.' };
  }

  const client = getSupabaseInstance();
  const { data: userData } = await client.auth.getUser();
  const email = userData?.user?.email;
  if (!email) {
    return { success: false, error: 'Session expirée. Veuillez vous reconnecter.' };
  }

  // Verify current password on a separate client: the session keeps its two-step verification
  const { error: verifyError } = await createTemporaryClient().auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) {
    return { success: false, error: 'Le mot de passe actuel est incorrect.' };
  }

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: translateAuthError(error) };
  }
  return { success: true, message: 'Mot de passe mis à jour avec succès sur tous les appareils.' };
}
