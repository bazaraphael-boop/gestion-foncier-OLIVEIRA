import React, { useState } from 'react';
import { ShieldCheck, Key, Lock, CheckCircle2, AlertCircle, X, LogOut, Eye, EyeOff } from 'lucide-react';
import { updateAdminPassword, updateClientPIN, logout } from '../services/authService';

export default function AdminSecurityModal({ isOpen, onClose, onLogout }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('admin_pwd'); // 'admin_pwd' | 'client_pin' | 'session'

  // Admin Password state
  const [currentAdminPwd, setCurrentAdminPwd] = useState('');
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [confirmAdminPwd, setConfirmAdminPwd] = useState('');
  const [showAdminPwds, setShowAdminPwds] = useState(false);
  const [adminPwdMsg, setAdminPwdMsg] = useState({ type: '', text: '' });
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  // Client PIN state
  const [newClientPin, setNewClientPin] = useState('');
  const [confirmClientPin, setConfirmClientPin] = useState('');
  const [clientPinMsg, setClientPinMsg] = useState({ type: '', text: '' });
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);

  // Handle Admin Password Change
  const handleUpdateAdminPassword = async (e) => {
    e.preventDefault();
    setAdminPwdMsg({ type: '', text: '' });

    if (newAdminPwd !== confirmAdminPwd) {
      setAdminPwdMsg({ type: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    if (newAdminPwd.length < 6) {
      setAdminPwdMsg({ type: 'error', text: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
      return;
    }

    setIsAdminSubmitting(true);
    try {
      const res = await updateAdminPassword(currentAdminPwd, newAdminPwd);
      if (res.success) {
        setAdminPwdMsg({ type: 'success', text: 'Mot de passe administrateur modifié avec succès.' });
        setCurrentAdminPwd('');
        setNewAdminPwd('');
        setConfirmAdminPwd('');
      } else {
        setAdminPwdMsg({ type: 'error', text: res.error || 'Erreur lors de la mise à jour.' });
      }
    } catch (err) {
      setAdminPwdMsg({ type: 'error', text: 'Erreur inattendue lors de la mise à jour.' });
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  // Handle Client PIN Change
  const handleUpdateClientPIN = async (e) => {
    e.preventDefault();
    setClientPinMsg({ type: '', text: '' });

    if (!/^\d{6}$/.test(newClientPin)) {
      setClientPinMsg({ type: 'error', text: 'Le code PIN client doit comporter exactement 6 chiffres.' });
      return;
    }

    if (newClientPin !== confirmClientPin) {
      setClientPinMsg({ type: 'error', text: 'Les deux codes PIN ne correspondent pas.' });
      return;
    }

    setIsClientSubmitting(true);
    try {
      const res = await updateClientPIN(newClientPin);
      if (res.success) {
        setClientPinMsg({ type: 'success', text: 'Nouveau code PIN Client (6 chiffres) enregistré avec succès.' });
        setNewClientPin('');
        setConfirmClientPin('');
      } else {
        setClientPinMsg({ type: 'error', text: res.error || 'Erreur lors de la modification du PIN.' });
      }
    } catch (err) {
      setClientPinMsg({ type: 'error', text: 'Erreur inattendue lors de la mise à jour du PIN.' });
    } finally {
      setIsClientSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-white text-slate-800 w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1a3a5c] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Sécurité & Contrôle des Accès</h3>
              <p className="text-[11px] text-blue-200">Gestion des identifiants, codes PIN et sessions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('admin_pwd')}
            className={`flex-1 py-3 px-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'admin_pwd'
                ? 'border-[#1a3a5c] text-[#1a3a5c] bg-white font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Mot de Passe Admin
          </button>
          <button
            onClick={() => setActiveTab('client_pin')}
            className={`flex-1 py-3 px-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'client_pin'
                ? 'border-[#1a6e3c] text-[#1a6e3c] bg-white font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Code PIN Client
          </button>
          <button
            onClick={() => setActiveTab('session')}
            className={`flex-1 py-3 px-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'session'
                ? 'border-gray-700 text-gray-800 bg-white font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Session Active
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* TAB 1: ADMIN PASSWORD */}
          {activeTab === 'admin_pwd' && (
            <form onSubmit={handleUpdateAdminPassword} className="space-y-4">
              <div className="text-xs text-gray-600 mb-2">
                Modifiez le mot de passe d'accès administrateur de la Concession Manuel Joaquim d'Oliveira.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <input
                    type={showAdminPwds ? 'text' : 'password'}
                    required
                    value={currentAdminPwd}
                    onChange={(e) => setCurrentAdminPwd(e.target.value)}
                    placeholder="Entrez votre mot de passe actuel..."
                    className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#1a3a5c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPwds(!showAdminPwds)}
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                  >
                    {showAdminPwds ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nouveau mot de passe (min. 6 caractères)
                </label>
                <input
                  type={showAdminPwds ? 'text' : 'password'}
                  required
                  value={newAdminPwd}
                  onChange={(e) => setNewAdminPwd(e.target.value)}
                  placeholder="Nouveau mot de passe sécurisé..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#1a3a5c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  type={showAdminPwds ? 'text' : 'password'}
                  required
                  value={confirmAdminPwd}
                  onChange={(e) => setConfirmAdminPwd(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#1a3a5c]"
                />
              </div>

              {adminPwdMsg.text && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    adminPwdMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {adminPwdMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{adminPwdMsg.text}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isAdminSubmitting || !currentAdminPwd || !newAdminPwd || !confirmAdminPwd}
                  className="px-4 py-2 bg-[#1a3a5c] hover:bg-[#122840] disabled:bg-gray-300 text-white font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isAdminSubmitting ? 'Mise à jour...' : 'Enregistrer le nouveau mot de passe'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CLIENT PIN */}
          {activeTab === 'client_pin' && (
            <form onSubmit={handleUpdateClientPIN} className="space-y-4">
              <div className="text-xs text-gray-600 mb-2">
                Définissez le code PIN à 6 chiffres permettant aux clients et occupants de consulter la carte cadastrale sans droits d'édition.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nouveau code PIN Client (6 chiffres numériques)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={newClientPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setNewClientPin(val);
                  }}
                  placeholder="Ex: 123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs tracking-widest font-mono text-center text-base focus:outline-none focus:border-[#1a6e3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Confirmer le code PIN Client
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={confirmClientPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setConfirmClientPin(val);
                  }}
                  placeholder="Répétez les 6 chiffres..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs tracking-widest font-mono text-center text-base focus:outline-none focus:border-[#1a6e3c]"
                />
              </div>

              {clientPinMsg.text && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    clientPinMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {clientPinMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{clientPinMsg.text}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isClientSubmitting || newClientPin.length !== 6 || confirmClientPin.length !== 6}
                  className="px-4 py-2 bg-[#1a6e3c] hover:bg-[#145730] disabled:bg-gray-300 text-white font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{isClientSubmitting ? 'Enregistrement...' : 'Mettre à jour le code PIN Client'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SESSION INFO & IMMEDIATE LOGOUT */}
          {activeTab === 'session' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-slate-700">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-gray-500">Niveau de privilèges :</span>
                  <span className="font-bold text-[#1a3a5c] uppercase">Administrateur Cadastral (Accès Total)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-gray-500">Email officiel associé :</span>
                  <span className="font-medium text-slate-900">Bamakakidi@gmail.com</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-gray-500">Expiration automatique :</span>
                  <span className="font-medium text-slate-900">30 minutes d'inactivité</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Protection brute-force :</span>
                  <span className="text-emerald-700 font-medium">Active (Verrouillage 60s après 5 échecs)</span>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-gray-400 text-[11px]">
                  Fermer la session sur cet appareil
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion Immédiate</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
