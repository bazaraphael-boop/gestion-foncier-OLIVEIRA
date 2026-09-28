/**
 * Audit Trail & Activity Logging Service
 * Système de Journalisation et de Traçabilité des Actions Tiers
 * Concession Manuel Joaquim d'Oliveira - Cadastre Numérique
 */

import { getSupabaseInstance } from './supabaseClient';

const STORAGE_KEY_AUDIT_LOGS = 'geocadastre_audit_logs_v1';
const MAX_LOCAL_LOGS = 1000;

// Device and platform detection helper
function getDeviceSummary() {
  try {
    if (typeof navigator === 'undefined') return 'Système';
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua);
    let os = 'Inconnu';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
    else if (/Mac/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    return `${isTablet ? 'Tablette' : isMobile ? 'Mobile' : 'Ordinateur'} (${os})`;
  } catch (e) {
    return 'Web';
  }
}

/**
 * Retrieve all local audit logs
 * @returns {Array} List of audit logs sorted newest first
 */
export function getAuditLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erreur lecture audit logs:', e);
  }
  return [];
}

/**
 * Log an activity event
 * @param {Object} entry 
 * @param {string} entry.role - 'admin' | 'arpenteur' | 'client' | 'anonymous'
 * @param {string} entry.actor - Name/identifier of the user (e.g. "Arpenteur Géomètre")
 * @param {string} entry.action - Action code (e.g. "AUTH_LOGIN", "PARCEL_CREATE")
 * @param {string} entry.actionLabel - Human readable action title
 * @param {string} [entry.target] - Target parcel lot number or identifier
 * @param {string} [entry.details] - Technical details/description
 * @param {string} [entry.severity] - 'success' | 'info' | 'warning' | 'danger'
 * @returns {Object} The created log entry
 */
export function logActivity({
  role = 'anonymous',
  actor = 'Utilisateur',
  action = 'ACTION',
  actionLabel = 'Action effectuée',
  target = '-',
  details = '',
  severity = 'info'
}) {
  const timestamp = new Date().toISOString();
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const device = getDeviceSummary();

  const newLog = {
    id,
    timestamp,
    role,
    actor,
    action,
    actionLabel,
    target: target || '-',
    details: details || '',
    severity,
    device
  };

  // 1. Save to LocalStorage (Circular buffer up to MAX_LOCAL_LOGS)
  try {
    const existing = getAuditLogs();
    const updated = [newLog, ...existing].slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(updated));

    // Dispatch custom browser event for real-time reactive UI update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('geocadastre:audit_log_added', { detail: newLog }));
    }
  } catch (err) {
    console.warn('Erreur écriture audit log local:', err);
  }

  // 2. Asynchronous Cloud Persistence to Supabase (Non-blocking)
  saveAuditLogToSupabase(newLog).catch(() => {});

  return newLog;
}

/**
 * Asynchronously save a single log to Supabase 'audit_logs' table
 */
export async function saveAuditLogToSupabase(log) {
  try {
    const supabase = getSupabaseInstance();
    if (!supabase) return false;

    const row = {
      id: log.id,
      timestamp: log.timestamp,
      role: log.role,
      actor: log.actor,
      action: log.action,
      action_label: log.actionLabel,
      target: log.target,
      details: log.details,
      severity: log.severity,
      device: log.device
    };

    const { error } = await supabase.from('audit_logs').insert([row]);
    if (error) {
      // Table might not exist yet or offline, silent fallback
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Fetch logs from Supabase and merge with local logs
 */
export async function syncAuditLogsFromSupabase() {
  try {
    const supabase = getSupabaseInstance();
    if (!supabase) return getAuditLogs();

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error || !data) return getAuditLogs();

    const cloudLogs = data.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      role: row.role,
      actor: row.actor,
      action: row.action,
      actionLabel: row.action_label || row.actionLabel,
      target: row.target,
      details: row.details,
      severity: row.severity,
      device: row.device
    }));

    // Merge without duplicates
    const localLogs = getAuditLogs();
    const existingIds = new Set(localLogs.map((l) => l.id));
    const merged = [...localLogs];

    for (const cLog of cloudLogs) {
      if (!existingIds.has(cLog.id)) {
        merged.push(cLog);
        existingIds.add(cLog.id);
      }
    }

    // Sort newest first
    merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const trimmed = merged.slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.warn('Sync audit logs fallback local:', err);
    return getAuditLogs();
  }
}

/**
 * Clear all audit logs (Admin only)
 */
export async function clearAuditLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY_AUDIT_LOGS);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('geocadastre:audit_logs_cleared'));
    }

    const supabase = getSupabaseInstance();
    if (supabase) {
      await supabase.from('audit_logs').delete().neq('id', 'keep_table_alive_nil');
    }
    return true;
  } catch (err) {
    console.warn('Erreur purge audit logs:', err);
    return false;
  }
}

/**
 * Export audit logs to formatted CSV file
 */
export function exportAuditLogsToCSV(logs) {
  if (!logs || logs.length === 0) return '';

  const headers = [
    'Date & Heure',
    'Rôle',
    'Utilisateur / Acteur',
    'Code Action',
    'Libellé Action',
    'Lot / Cible',
    'Détails Techniques',
    'Niveau',
    'Appareil'
  ];

  const rows = logs.map((log) => {
    const dateFormatted = new Date(log.timestamp).toLocaleString('fr-FR');
    return [
      `"${dateFormatted}"`,
      `"${(log.role || '').toUpperCase()}"`,
      `"${(log.actor || '').replace(/"/g, '""')}"`,
      `"${log.action || ''}"`,
      `"${(log.actionLabel || '').replace(/"/g, '""')}"`,
      `"${log.target || '-'}"`,
      `"${(log.details || '').replace(/"/g, '""')}"`,
      `"${log.severity || 'info'}"`,
      `"${(log.device || '').replace(/"/g, '""')}"`
    ].join(';');
  });

  return [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Export audit logs to JSON string
 */
export function exportAuditLogsToJSON(logs) {
  return JSON.stringify(logs, null, 2);
}
