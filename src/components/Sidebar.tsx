/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Database,
  Sliders,
  TrendingUp,
  Users,
  LogOut,
  Moon,
  Sun,
  Grid,
  Footprints,
  KeyRound,
  X,
  ShieldCheck
} from 'lucide-react';
import { User, UserRole } from '../types';
import { hasModuleAccess } from '../utils/permissions';
import officeplastLogo from '../../assets/officeplast-logo.png';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  onChangeMyPassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onChangeMyPassword,
  isDarkMode,
  setIsDarkMode
}: SidebarProps) {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'modules', label: 'Indicateurs Métiers', icon: TrendingUp },
    { id: 'kpi-entry', label: 'Saisie KPIs', icon: Grid },
    { id: 'presence-tracker', label: 'Suivi Présence', icon: Users },
    { id: 'gemba-tracker', label: 'Suivi Gemba HSE', icon: Footprints },
    { id: 'actions', label: 'Plan d\'Actions', icon: ClipboardList },
    { id: 'meetings', label: 'Réunion Tier 4', icon: CalendarDays },
    { id: 'db-sync', label: 'Connecteur SQL', icon: Database },
    { id: 'admin', label: 'Configuration', icon: Sliders }
  ].filter(item => hasModuleAccess(currentUser, item.id));

  const getRoleLabel = (role: UserRole) => role;

  const getRoleColor = (role: UserRole) => {
    if (role.includes('DGA')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
    if (role.includes('Directeur') || role.includes('directeur')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
    if (role.includes('Responsable')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  const resetPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleSubmitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const errorMessage = await onChangeMyPassword(currentPassword, newPassword);
    setSubmitting(false);
    if (errorMessage) {
      setPasswordError(errorMessage);
      return;
    }
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <aside className="w-68 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen shrink-0 transition-colors duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <img src={officeplastLogo} alt="OfficePlast" className="w-9 h-9 object-contain shrink-0" id="sidebar-logo-icon" />
        <div>
          <h1 className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-white uppercase">
            Officeplast
          </h1>
          <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
            TIER4 Meeting
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
          Menu Principal
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Block */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Changer de thème"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {/* Current User Card */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase shrink-0">
            {currentUser.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
              {currentUser.name}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {currentUser.email}
            </p>
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getRoleColor(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
              {currentUser.accessLevel === 'admin' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { resetPasswordModal(); setIsPasswordModalOpen(true); }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" /> Mot de passe
          </button>
          <button
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-500" /> Changer mon mot de passe
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordSuccess ? (
              <div className="p-5 space-y-4 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Mot de passe mis à jour avec succès.
                </p>
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitPasswordChange} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mot de passe actuel *</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nouveau mot de passe *</label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Confirmer le nouveau mot de passe *</label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {passwordError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{passwordError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
