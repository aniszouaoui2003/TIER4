/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Building2, KeyRound, AlertCircle, LogOut } from 'lucide-react';
import { User } from '../types';

interface ForcePasswordChangeScreenProps {
  currentUser: User;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  onLogout: () => void;
}

export default function ForcePasswordChangeScreen({ currentUser, onChangePassword, onLogout }: ForcePasswordChangeScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const errorMessage = await onChangePassword(currentPassword, newPassword);
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
    }
    // On success the parent updates currentUser.mustChangePassword to false, which unmounts
    // this screen and reveals the app — nothing further to do here.
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white uppercase">
              Bienvenue, {currentUser.name.split(' ')[0]}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Pour votre première connexion, vous devez définir votre propre mot de passe avant de continuer.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Mot de passe actuel *</label>
            <input
              type="password"
              required
              autoFocus
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Nouveau mot de passe *</label>
            <input
              type="password"
              required
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Confirmer le nouveau mot de passe *</label>
            <input
              type="password"
              required
              minLength={4}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            {submitting ? 'Mise à jour...' : 'Définir mon mot de passe'}
          </button>
        </form>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
