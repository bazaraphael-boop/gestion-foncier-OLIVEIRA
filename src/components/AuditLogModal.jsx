import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  Clock,
  Laptop,
  Smartphone,
  Tablet,
  FileSpreadsheet,
  AlertTriangle,
  Layers,
  MapPin,
  Printer,
  ChevronDown
} from 'lucide-react';
import {
  getAuditLogs,
  clearAuditLogs,
  syncAuditLogsFromSupabase,
  exportAuditLogsToCSV,
  exportAuditLogsToJSON
} from '../services/auditService';

export default function AuditLogModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionCategory, setActionCategory] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load and listen for new logs in real-time
  const refreshLogs = () => {
    setLogs(getAuditLogs());
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();

      const handleLogAdded = () => {
        refreshLogs();
      };

      const handleLogsCleared = () => {
        setLogs([]);
      };

      window.addEventListener('geocadastre:audit_log_added', handleLogAdded);
      window.addEventListener('geocadastre:audit_logs_cleared', handleLogsCleared);

      return () => {
        window.removeEventListener('geocadastre:audit_log_added', handleLogAdded);
        window.removeEventListener('geocadastre:audit_logs_cleared', handleLogsCleared);
      };
    }
  }, [isOpen]);

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    try {
      const merged = await syncAuditLogsFromSupabase();
      setLogs(merged);
    } catch (e) {
      console.warn('Sync cloud error:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const handleExportCSV = () => {
    const csvStr = exportAuditLogsToCSV(filteredLogs);
    if (!csvStr) return;
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Registre_Audit_Cadastre_Muanda_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportJSON = () => {
    const jsonStr = exportAuditLogsToJSON(filteredLogs);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Registre_Audit_Cadastre_Muanda_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleConfirmClear = async () => {
    await clearAuditLogs();
    setShowClearConfirm(false);
    setLogs([]);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let count24h = 0;
    let countArpenteur = 0;
    let countClient = 0;
    let countSecurity = 0;

    for (const log of logs) {
      const t = new Date(log.timestamp).getTime();
      if (t >= oneDayAgo) count24h++;
      if (log.role === 'arpenteur') countArpenteur++;
      if (log.role === 'client') countClient++;
      if (log.severity === 'danger' || log.severity === 'warning' || log.action === 'AUTH_FAILED') {
        countSecurity++;
      }
    }

    return {
      total: logs.length,
      last24h: count24h,
      arpenteur: countArpenteur,
      client: countClient,
      security: countSecurity
    };
  }, [logs]);

  // Filtering
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Role filter
      if (roleFilter !== 'all') {
        if (roleFilter === 'security') {
          if (log.severity !== 'danger' && log.severity !== 'warning' && log.action !== 'AUTH_FAILED') {
            return false;
          }
        } else if (log.role !== roleFilter) {
          return false;
        }
      }

      // Action category filter
      if (actionCategory !== 'all') {
        if (actionCategory === 'auth' && !log.action.startsWith('AUTH_')) return false;
        if (actionCategory === 'parcels' && !log.action.startsWith('PARCEL_') && log.action !== 'CONCESSION_RESET') return false;
        if (actionCategory === 'exports' && log.action !== 'PARCEL_EXPORT' && log.action !== 'PARCEL_PRINT_RELEVE') return false;
        if (actionCategory === 'security' && log.severity !== 'danger' && log.severity !== 'warning') return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inActor = (log.actor || '').toLowerCase().includes(q);
        const inLabel = (log.actionLabel || '').toLowerCase().includes(q);
        const inTarget = (log.target || '').toLowerCase().includes(q);
        const inDetails = (log.details || '').toLowerCase().includes(q);
        const inRole = (log.role || '').toLowerCase().includes(q);
        if (!inActor && !inLabel && !inTarget && !inDetails && !inRole) {
          return false;
        }
      }

      return true;
    });
  }, [logs, roleFilter, actionCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col h-[90vh] max-h-[850px] overflow-hidden border border-slate-200 text-slate-800">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-[#0f2540] text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Registre d'Audit &amp; Traçabilité des Actions</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Accès Admin
                </span>
              </h2>
              <p className="text-xs text-blue-200">
                Surveillance intégrale des connexions et des modifications cadastrales (Arpenteur, Clients, Admin)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCloud}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Synchroniser avec la base Supabase Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Cloud</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Exporter les logs affichés en format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fermer le registre"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 flex-shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Total Activités
            </div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{metrics.total}</div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-600" /> Dernières 24h
            </div>
            <div className="text-lg font-black text-cyan-700 mt-0.5">{metrics.last24h}</div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600" /> Actions Arpenteur
            </div>
            <div className="text-lg font-black text-blue-700 mt-0.5">{metrics.arpenteur}</div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Alertes / Échecs
            </div>
            <div className="text-lg font-black text-rose-600 mt-0.5">{metrics.security}</div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-3 sm:px-6 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-2.5 flex-shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par lot (RMB/...), acteur, action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white transition-all font-sans"
            />
          </div>

          {/* Filters pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Rôles :</span>
            {[
              { id: 'all', label: 'Tous' },
              { id: 'arpenteur', label: 'Arpenteur', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
              { id: 'client', label: 'Client PIN', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { id: 'admin', label: 'Admin', color: 'text-amber-800 bg-amber-50 border-amber-200' },
              { id: 'security', label: 'Alertes', color: 'text-rose-700 bg-rose-50 border-rose-200' }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setRoleFilter(pill.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  roleFilter === pill.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}

            <select
              value={actionCategory}
              onChange={(e) => setActionCategory(e.target.value)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none ml-1"
            >
              <option value="all">Toutes les actions</option>
              <option value="auth">Connexions &amp; Sessions</option>
              <option value="parcels">Parcelles &amp; Bornage</option>
              <option value="exports">Exports &amp; Relevés</option>
              <option value="security">Alertes de Sécurité</option>
            </select>
          </div>
        </div>

        {/* Logs Table / Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs">Aucun événement ne correspond à vos filtres de recherche.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Date &amp; Heure</th>
                    <th className="py-2.5 px-4">Acteur / Rôle</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Lot / Cible</th>
                    <th className="py-2.5 px-4">Détails de l'opération</th>
                    <th className="py-2.5 px-4 text-right">Terminal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => {
                    const dateObj = new Date(log.timestamp);
                    const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                    const dateFormatted = dateObj.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    // Role Badge
                    let roleBadgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                    let roleLabel = log.role;
                    if (log.role === 'admin') {
                      roleBadgeClass = 'bg-amber-500/15 text-amber-800 border-amber-400/40';
                      roleLabel = 'Admin';
                    } else if (log.role === 'arpenteur') {
                      roleBadgeClass = 'bg-cyan-500/15 text-cyan-800 border-cyan-400/40';
                      roleLabel = 'Arpenteur';
                    } else if (log.role === 'client') {
                      roleBadgeClass = 'bg-emerald-500/15 text-emerald-800 border-emerald-400/40';
                      roleLabel = 'Client';
                    } else if (log.role === 'anonymous') {
                      roleBadgeClass = 'bg-rose-500/15 text-rose-800 border-rose-400/40';
                      roleLabel = 'Public';
                    }

                    // Severity Dot
                    let dotColor = 'bg-blue-400';
                    if (log.severity === 'success') dotColor = 'bg-emerald-500';
                    else if (log.severity === 'warning') dotColor = 'bg-amber-500';
                    else if (log.severity === 'danger') dotColor = 'bg-rose-500';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-900">{timeFormatted}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{dateFormatted}</div>
                        </td>

                        {/* Actor / Role */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`}></span>
                            <span className="font-semibold text-slate-900 truncate max-w-[140px]" title={log.actor}>
                              {log.actor}
                            </span>
                          </div>
                          <span className={`inline-block mt-0.5 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${roleBadgeClass}`}>
                            {roleLabel}
                          </span>
                        </td>

                        {/* Action Label */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900">{log.actionLabel}</span>
                          <span className="block text-[10px] font-mono text-slate-400 uppercase">{log.action}</span>
                        </td>

                        {/* Target Lot */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.target && log.target !== '-' ? (
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-800 text-[11px]">
                              {log.target}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Details */}
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs break-words">
                          {log.details || '—'}
                        </td>

                        {/* Device / Terminal */}
                        <td className="py-3 px-4 text-right text-[11px] text-slate-400 whitespace-nowrap font-mono">
                          {log.device || 'Web'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>Affichage de <strong>{filteredLogs.length}</strong> événement(s) sur {logs.length} au total</span>
          </div>

          <div className="flex items-center gap-2">
            {showClearConfirm ? (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1 rounded-lg">
                <span className="text-[11px] font-bold text-rose-700 px-1">Confirmer purge ?</span>
                <button
                  onClick={handleConfirmClear}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  Oui, vider
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-medium cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2.5 py-1 text-slate-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Vider l'historique d'audit"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purger le journal</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
