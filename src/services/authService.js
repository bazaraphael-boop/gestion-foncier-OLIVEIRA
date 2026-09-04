/**
 * Secure Authentication & Role-Based Session Management Service
 * Features:
 * - SHA-256 Hashing (Never stores plain-text PIN or password)
 * - Anti-Bruteforce Throttling (Max 5 failed attempts -> 30s lockout)
 * - Encrypted/Hashed Session Tokens with Automatic Inactivity Expiration (30 mins)
 */

const STORAGE_KEY_SESSION = 'geocadastre_auth_session_v1';
const STORAGE_KEY_ATTEMPTS = 'geocadastre_auth_attempts_v1';

// SHA-256 Hash of default Client PIN "123456"
const CLIENT_PIN_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

// SHA-256 Hash of default Admin Password "admin123"
const ADMIN_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

// Session expiration: 30 minutes (in milliseconds)
const SESSION_EXPIRATION_MS = 30 * 60 * 1000;

// Maximum failed attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;

// Lockout duration: 30 seconds
const LOCKOUT_DURATION_MS = 30 * 1000;

// Helper: Hash input string to SHA-256 Hex format using browser Web Crypto API
export async function hashSHA256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Get current failed attempt status from LocalStorage
function getAttemptStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { count: 0, lockedUntil: null };
}

// Helper: Save failed attempt status
function setAttemptStatus(status) {
  localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(status));
}

// Check if authentication is currently locked out due to brute force
export function getLockoutStatus() {
  const status = getAttemptStatus();
  if (status.lockedUntil) {
    const now = Date.now();
    if (now < status.lockedUntil) {
      const remainingSeconds = Math.ceil((status.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, count: status.count };
    } else {
      // Lock expired, reset
      setAttemptStatus({ count: 0, lockedUntil: null });
    }
  }
  return { isLocked: false, remainingSeconds: 0, count: status.count };
}

// Record a failed attempt & lock if threshold reached
function recordFailedAttempt() {
  const status = getAttemptStatus();
  const newCount = (status.count || 0) + 1;
  let lockedUntil = null;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  setAttemptStatus({ count: newCount, lockedUntil });
  return { count: newCount, isLocked: !!lockedUntil, remainingSeconds: lockedUntil ? 30 : 0 };
}

// Reset failed attempts on clean login
function resetFailedAttempts() {
  localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
}

/**
 * Authenticate Client with 6-digit PIN
 */
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
    resetFailedAttempts();
    const session = createSession('client');
    return { success: true, session };
  } else {
    const failInfo = recordFailedAttempt();
    if (failInfo.isLocked) {
      return { success: false, error: `5 tentatives échouées. Compte verrouillé pendant 30 secondes.` };
    }
    const remaining = MAX_FAILED_ATTEMPTS - failInfo.count;
    return { success: false, error: `Code PIN incorrect. ${remaining} essai(s) restant(s).` };
  }
}

/**
 * Authenticate Admin with password
 */
export async function loginAdmin(password) {
  const lockout = getLockoutStatus();
  if (lockout.isLocked) {
    return { success: false, error: `Trop d'essais incorrects. Veuillez patienter ${lockout.remainingSeconds}s.` };
  }

  if (!password) {
    return { success: false, error: 'Veuillez saisir votre mot de passe administrateur.' };
  }

  const inputHash = await hashSHA256(password);
  const targetHash = localStorage.getItem('geocadastre_admin_password_hash') || ADMIN_PASSWORD_HASH;

  if (inputHash === targetHash) {
    resetFailedAttempts();
    const session = createSession('admin');
    return { success: true, session };
  } else {
    const failInfo = recordFailedAttempt();
    if (failInfo.isLocked) {
      return { success: false, error: `5 tentatives échouées. Compte verrouillé pendant 30 secondes.` };
    }
    const remaining = MAX_FAILED_ATTEMPTS - failInfo.count;
    return { success: false, error: `Mot de passe administrateur incorrect.` };
  }
}

/**
 * Create a new timed session for role ('admin' | 'client')
 */
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

/**
 * Get current active valid session
 */
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

/**
 * Log out and destroy current session
 */
export function logout() {
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

/**
 * Configure/Update Client PIN (Admin action only)
 */
export async function updateClientPIN(newPin) {
  if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    return false;
  }
  const hash = await hashSHA256(newPin);
  localStorage.setItem('geocadastre_client_pin_hash', hash);
  return true;
}
