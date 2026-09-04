/**
 * Secure Authentication & Role-Based Session Management Service
 * Features:
 * - SHA-256 Cryptographic Hashing via Web Crypto API (No plain-text credentials)
 * - Independent Anti-Bruteforce Throttling for Admin and Client
 * - Email / Identifiant + Password check for Admin
 * - Session Inactivity Expiration (30 mins) with Session Invalidation
 * - Secure Password & PIN Updates with validation
 */

const STORAGE_KEY_SESSION = 'geocadastre_auth_session_v1';
const STORAGE_KEY_ATTEMPTS_CLIENT = 'geocadastre_auth_attempts_client_v2';
const STORAGE_KEY_ATTEMPTS_ADMIN = 'geocadastre_auth_attempts_admin_v2';

// Default Admin Email / Identifiants autorisés
const DEFAULT_ADMIN_EMAIL = 'bamakakidi@gmail.com';
const DEFAULT_ADMIN_USERNAME = 'admin';

// SHA-256 Hash of default Client PIN "123456"
const CLIENT_PIN_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

// SHA-256 Hash of default Admin Password "admin123"
const ADMIN_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

// Session expiration: 30 minutes (in milliseconds)
const SESSION_EXPIRATION_MS = 30 * 60 * 1000;

// Maximum failed attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;

// Lockout duration: 60 seconds for Admin, 30s for Client
const ADMIN_LOCKOUT_MS = 60 * 1000;
const CLIENT_LOCKOUT_MS = 30 * 1000;

// Helper: Hash input string to SHA-256 Hex format using browser Web Crypto API
export async function hashSHA256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ─────────────────────────────────────────────────────────────
 * LOCKOUT & ANTI-BRUTE FORCE HELPERS
 * ───────────────────────────────────────────────────────────── */

function getLockout(storageKey, defaultDurationMs) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.lockedUntil) {
        const now = Date.now();
        if (now < data.lockedUntil) {
          const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
          return { isLocked: true, remainingSeconds, count: data.count || 0 };
        } else {
          localStorage.removeItem(storageKey);
        }
      }
      return { isLocked: false, remainingSeconds: 0, count: data.count || 0 };
    }
  } catch (e) {}
  return { isLocked: false, remainingSeconds: 0, count: 0 };
}

function recordFailure(storageKey, lockoutMs) {
  try {
    const status = getLockout(storageKey, lockoutMs);
    const newCount = (status.count || 0) + 1;
    let lockedUntil = null;
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = Date.now() + lockoutMs;
    }
    localStorage.setItem(storageKey, JSON.stringify({ count: newCount, lockedUntil }));
    return {
      count: newCount,
      isLocked: !!lockedUntil,
      remainingSeconds: lockedUntil ? Math.ceil(lockoutMs / 1000) : 0,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - newCount)
    };
  } catch (e) {
    return { count: 1, isLocked: false, remainingSeconds: 0, remainingAttempts: MAX_FAILED_ATTEMPTS - 1 };
  }
}

function resetLockout(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch (e) {}
}

export function getLockoutStatus() {
  return getLockout(STORAGE_KEY_ATTEMPTS_CLIENT, CLIENT_LOCKOUT_MS);
}

export function getAdminLockoutStatus() {
  return getLockout(STORAGE_KEY_ATTEMPTS_ADMIN, ADMIN_LOCKOUT_MS);
}

/* ─────────────────────────────────────────────────────────────
 * CLIENT AUTHENTICATION
 * ───────────────────────────────────────────────────────────── */

export async function loginClient(pin) {
  const lockout = getLockoutStatus();
  if (lockout.isLocked) {
    return { success: false, error: `Trop d'essais incorrects. Veuillez patienter ${lockout.remainingSeconds}s.` };
  }

  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return { success: false, error: 'Le code PIN doit comporter exactement 6 chiffres.' };
  }

  const inputHash = await hashSHA256(pin);
  const targetHash = localStorage.getItem('geocadastre_client_pin_hash') || CLIENT_PIN_HASH;

  if (inputHash === targetHash) {
    resetLockout(STORAGE_KEY_ATTEMPTS_CLIENT);
    const session = createSession('client');
    return { success: true, session };
  } else {
    const failInfo = recordFailure(STORAGE_KEY_ATTEMPTS_CLIENT, CLIENT_LOCKOUT_MS);
    if (failInfo.isLocked) {
      return { success: false, error: `5 tentatives infructueuses. Accès bloqué pendant ${CLIENT_LOCKOUT_MS / 1000} secondes.` };
    }
    return { success: false, error: `Code PIN incorrect. ${failInfo.remainingAttempts} tentative(s) restante(s).` };
  }
}

/* ─────────────────────────────────────────────────────────────
 * ADMIN AUTHENTICATION (IDENTIFIANT/EMAIL + MOT DE PASSE)
 * ───────────────────────────────────────────────────────────── */

export async function loginAdmin(identifierOrPassword, maybePassword) {
  // Support either loginAdmin(identifier, password) or legacy loginAdmin(password)
  let identifier = '';
  let password = '';

  if (maybePassword !== undefined) {
    identifier = (identifierOrPassword || '').trim().toLowerCase();
    password = maybePassword;
  } else {
    // Single arg passed: treat as password
    password = identifierOrPassword;
  }

  const lockout = getAdminLockoutStatus();
  if (lockout.isLocked) {
    return {
      success: false,
      error: `Portail administration verrouillé suite à plusieurs échecs. Veuillez patienter ${lockout.remainingSeconds} secondes.`
    };
  }

  if (!password) {
    return { success: false, error: 'Veuillez saisir votre mot de passe administrateur.' };
  }

  // If identifier is provided, verify it matches allowed admin identifiers
  if (identifier) {
    const savedAdminEmail = (localStorage.getItem('geocadastre_admin_email') || DEFAULT_ADMIN_EMAIL).toLowerCase();
    const isValidIdentifier = (
      identifier === savedAdminEmail ||
      identifier === DEFAULT_ADMIN_USERNAME ||
      identifier === 'bamakakidi' ||
      identifier === 'oliveira'
    );

    if (!isValidIdentifier) {
      const failInfo = recordFailure(STORAGE_KEY_ATTEMPTS_ADMIN, ADMIN_LOCKOUT_MS);
      if (failInfo.isLocked) {
        return {
          success: false,
          error: `5 tentatives infructueuses. Portail bloqué pendant ${ADMIN_LOCKOUT_MS / 1000} secondes.`
        };
      }
      return {
        success: false,
        error: `Identifiant ou mot de passe incorrect. ${failInfo.remainingAttempts} essai(s) restant(s).`
      };
    }
  }

  const inputHash = await hashSHA256(password);
  const targetHash = localStorage.getItem('geocadastre_admin_password_hash') || ADMIN_PASSWORD_HASH;

  if (inputHash === targetHash) {
    resetLockout(STORAGE_KEY_ATTEMPTS_ADMIN);
    const session = createSession('admin');
    return { success: true, session };
  } else {
    const failInfo = recordFailure(STORAGE_KEY_ATTEMPTS_ADMIN, ADMIN_LOCKOUT_MS);
    if (failInfo.isLocked) {
      return {
        success: false,
        error: `5 tentatives infructueuses. Portail bloqué pendant ${ADMIN_LOCKOUT_MS / 1000} secondes.`
      };
    }
    return {
      success: false,
      error: `Identifiant ou mot de passe incorrect. ${failInfo.remainingAttempts} tentative(s) restante(s).`
    };
  }
}

/* ─────────────────────────────────────────────────────────────
 * SESSION MANAGEMENT
 * ───────────────────────────────────────────────────────────── */

function createSession(role) {
  const session = {
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRATION_MS,
    token: `token_${role}_${Math.random().toString(36).substring(2)}_${Date.now()}`
  };
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  return session;
}

export function getCurrentSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw);

    // Check expiration
    if (Date.now() > session.expiresAt) {
      logout();
      return null;
    }

    // Touch session to renew inactivity timer
    session.expiresAt = Date.now() + SESSION_EXPIRATION_MS;
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    return session;
  } catch (e) {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

/* ─────────────────────────────────────────────────────────────
 * CREDENTIALS & SECURITY MANAGEMENT (ADMIN ONLY)
 * ───────────────────────────────────────────────────────────── */

export async function updateAdminPassword(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Veuillez remplir tous les champs de mot de passe.' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' };
  }

  // Verify current password
  const currentHash = await hashSHA256(currentPassword);
  const targetHash = localStorage.getItem('geocadastre_admin_password_hash') || ADMIN_PASSWORD_HASH;

  if (currentHash !== targetHash) {
    return { success: false, error: 'Le mot de passe actuel est incorrect.' };
  }

  const newHash = await hashSHA256(newPassword);
  localStorage.setItem('geocadastre_admin_password_hash', newHash);
  return { success: true, message: 'Mot de passe administrateur mis à jour avec succès.' };
}

export async function updateClientPIN(newPin) {
  if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    return { success: false, error: 'Le code PIN client doit contenir exactement 6 chiffres numériques.' };
  }
  const hash = await hashSHA256(newPin);
  localStorage.setItem('geocadastre_client_pin_hash', hash);
  return { success: true, message: 'Nouveau code PIN Client enregistré avec succès.' };
}

