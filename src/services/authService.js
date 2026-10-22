/**
 * Authentication & Role-Based Session Service (Supabase Auth)
 * Features:
 * - Real accounts managed by Supabase Auth (email + password)
 * - Role read from the public.profiles table (admin | arpenteur | client)
 * - Client portal: shared Supabase account whose password is the 6-digit PIN
 * - Rate limiting and session refresh handled server-side by Supabase
 * - Data access enforced by Row Level Security (see supabase/migrations)
 */

import { getSupabaseInstance } from './supabaseClient';
import { logActivity, flushAuditLogs } from './auditService';

// Shared account used by the client PIN portal
export const CLIENT_ACCOUNT_EMAIL = import.meta.env.VITE_CLIENT_ACCOUNT_EMAIL || 'client@oliveira.cd';

const VALID_ROLES = ['admin', 'arpenteur', 'client'];

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

// Build the app session object from a Supabase auth session
async function buildSession(authSession) {
  if (!authSession?.user) return null;
  const client = getSupabaseInstance();
  const { data, error } = await client
    .from('profiles')
    .select('role, full_name')
    .eq('id', authSession.user.id)
    .maybeSingle();

  if (error || !data || !VALID_ROLES.includes(data.role)) return null;

  return {
    role: data.role,
    name: data.full_name || authSession.user.email,
    user: { id: authSession.user.id, email: authSession.user.email }
  };
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
    await client.auth.signOut();
    return { success: false, error: "Ce compte n'est pas habilité pour cet espace." };
  }
  return { success: true, session };
}

/* ─────────────────────────────────────────────────────────────
 * CLIENT AUTHENTICATION
 * ───────────────────────────────────────────────────────────── */

export async function loginClient(pin) {
  if (!pin || !/^\d{6}$/.test(pin)) {
    return { success: false, error: 'Le code PIN doit comporter exactement 6 chiffres.' };
  }

  const res = await signIn(CLIENT_ACCOUNT_EMAIL, pin, ['client']);
  if (res.success) {
    logActivity({
      role: 'client',
      actor: 'Consultant Foncier (Code PIN)',
      action: 'AUTH_LOGIN',
      actionLabel: 'Connexion Espace Grand Public / Client',
      details: 'Accès consultation publique par code PIN validé',
      severity: 'info'
    });
  } else if (res.error === 'Identifiant ou mot de passe incorrect.') {
    res.error = 'Code PIN incorrect.';
  }
  return res;
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
  if (res.success) {
    const isArpenteur = res.session.role === 'arpenteur';
    logActivity({
      role: res.session.role,
      actor: `${isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur'} (${cleanEmail})`,
      action: 'AUTH_LOGIN',
      actionLabel: isArpenteur ? 'Connexion Espace Arpenteur Géomètre' : 'Connexion Espace Administration SIG',
      details: isArpenteur ? 'Session de terrain et bornage activée' : 'Session complète de direction cadastrale ouverte',
      severity: 'success'
    });
  }
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
    return await buildSession(data.session);
  } catch (e) {
    console.warn('Lecture de session impossible:', e);
    return null;
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
      actor: session.role === 'admin'
        ? 'Administrateur'
        : session.role === 'arpenteur'
        ? 'Arpenteur Géomètre'
        : 'Client / Consultant',
      action: 'AUTH_LOGOUT',
      actionLabel: `Déconnexion de session (${session.role})`,
      details: 'Fermeture volontaire de session',
      severity: 'info'
    });
  }
  await flushAuditLogs();
  const client = getSupabaseInstance();
  if (client) {
    await client.auth.signOut();
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

  // Verify current password before changing it
  const { error: verifyError } = await client.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) {
    return { success: false, error: 'Le mot de passe actuel est incorrect.' };
  }

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: translateAuthError(error) };
  }
  return { success: true, message: 'Mot de passe mis à jour avec succès sur tous les appareils.' };
}

// Change the shared client PIN (admin only, enforced by the database function)
export async function updateClientPIN(newPin) {
  if (!newPin || !/^\d{6}$/.test(newPin)) {
    return { success: false, error: 'Le code PIN client doit contenir exactement 6 chiffres numériques.' };
  }
  const client = getSupabaseInstance();
  const { error } = await client.rpc('admin_set_client_pin', {
    client_email: CLIENT_ACCOUNT_EMAIL,
    new_pin: newPin
  });
  if (error) {
    return { success: false, error: error.message || 'Mise à jour du code PIN impossible.' };
  }
  return { success: true, message: 'Nouveau code PIN Client enregistré avec succès.' };
}
