/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardMain from './components/DashboardMain';
import ModuleDetail from './components/ModuleDetail';
import ActionPlan from './components/ActionPlan';
import MeetingManager from './components/MeetingManager';
import AdminSettings from './components/AdminSettings';
import KPITeamGuruEntry from './components/KPITeamGuruEntry';
import AttendanceTracker from './components/AttendanceTracker';
import GembaTracker from './components/GembaTracker';
import LoginScreen from './components/LoginScreen';
import { User, KPI, Action, Meeting, SQLServerConfig, AuditLog } from './types';
import { hasModuleAccess } from './utils/permissions';

const SESSION_STORAGE_KEY = 'tier4_current_user_id';

export default function App() {
  // Tab Routing state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('Sécurité');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Core full-stack state lists
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sqlConfig, setSqlConfig] = useState<SQLServerConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync Dark Mode Class to HTML/Body element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fetch all database states on component load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Safety net: if the tabs a user can see change (an admin edits their permissions mid-session,
  // or a stale activeTab survives a fresh login) and the current tab is no longer permitted,
  // fall back to the dashboard rather than leaving a forbidden screen rendered.
  useEffect(() => {
    if (currentUser && !hasModuleAccess(currentUser, activeTab)) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        resUsers,
        resKpis,
        resActions,
        resMeetings,
        resSql,
        resLogs
      ] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/kpis').then(r => r.json()),
        fetch('/api/actions').then(r => r.json()),
        fetch('/api/meetings').then(r => r.json()),
        fetch('/api/sql-config').then(r => r.json()),
        fetch('/api/logs').then(r => r.json())
      ]);

      setUsers(resUsers);
      setKpis(resKpis);
      setActions(resActions);
      setMeetings(resMeetings);
      setSqlConfig(resSql);
      setAuditLogs(resLogs);

      // Resume a previous session if the remembered user id still exists — otherwise the login
      // screen is shown (see the render logic below). No auto-login: access requires credentials.
      const rememberedId = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rememberedId) {
        const remembered = resUsers.find((u: User) => u.id === rememberedId);
        if (remembered) {
          setCurrentUser(remembered);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (err: any) {
      console.error('Failed to boot Tier 4 data layers:', err);
      setError('Impossible d\'établir la connexion avec la base de données d\'usine.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to trigger list refreshes
  const refreshKpisAndLogs = async () => {
    const [resKpis, resLogs] = await Promise.all([
      fetch('/api/kpis').then(r => r.json()),
      fetch('/api/logs').then(r => r.json())
    ]);
    setKpis(resKpis);
    setAuditLogs(resLogs);
  };

  const refreshActionsAndLogs = async () => {
    const [resActions, resLogs] = await Promise.all([
      fetch('/api/actions').then(r => r.json()),
      fetch('/api/logs').then(r => r.json())
    ]);
    setActions(resActions);
    setAuditLogs(resLogs);
  };

  const refreshMeetings = async () => {
    const resMeetings = await fetch('/api/meetings').then(r => r.json());
    setMeetings(resMeetings);
  };

  // 1. ADD NEW ACTION CORRECTIVE (PLAN D'ACTION)
  const handleAddAction = async (newActData: Omit<Action, 'id' | 'autoNum' | 'date' | 'comments' | 'attachments'>) => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newActData,
          createdBy: currentUser.name,
          createdByRole: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec d\'ajout d\'action');
      await refreshActionsAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 2. UPDATE ACTION STATUS, PROGRESS OR INFO
  const handleUpdateAction = async (id: string, updatedFields: Partial<Action>) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/actions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedFields,
          modifiedBy: currentUser.name,
          modifiedByRole: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec de modification d\'action');
      await refreshActionsAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 3. ADD COMMENTS ON ACTIONS
  const handleAddActionComment = async (actionId: string, text: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/actions/${actionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser.name,
          role: currentUser.role,
          text
        })
      });
      if (!response.ok) throw new Error('Échec d\'ajout de commentaire');
      await refreshActionsAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 3b. DELETE ACTION
  const handleDeleteAction = async (id: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/actions/${id}?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Échec de suppression de l\'action');
      await refreshActionsAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 4. UPDATE MEETING STEPS OR NOTES
  const handleUpdateMeeting = async (id: string, updatedFields: Partial<Meeting>) => {
    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      if (!response.ok) throw new Error('Échec de mise à jour de la réunion');
      await refreshMeetings();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 5. CREATE AND INITIALIZE A NEW MEETING WEEK REVIEW
  const handleCreateMeeting = async (opts: { facilitator: string; scribe: string }) => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilitator: opts.facilitator,
          scribe: opts.scribe,
          createdBy: currentUser.name,
          createdByRole: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec de création de la réunion');
      await refreshMeetings();
      // Fetch logs too as it produces start logs
      const resLogs = await fetch('/api/logs').then(r => r.json());
      setAuditLogs(resLogs);
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 6. ADD CUSTOM KPI REFERENTIELS
  const handleAddKPI = async (newKpiData: Omit<KPI, 'id' | 'history'>) => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newKpiData,
          modifiedBy: currentUser.name,
          modifiedByRole: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec de création de KPI');
      await refreshKpisAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 7. UPDATE KPI TARGETS OR THRESHOLDS
  const handleUpdateKPI = async (id: string, updatedFields: Partial<KPI>) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/kpis/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedFields,
          modifiedBy: currentUser.name,
          modifiedByRole: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec de modification de KPI');
      await refreshKpisAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 7a. BULK UPDATE KPIs — applies every edit in a single request/DB write cycle. Firing one
  // PUT per KPI in parallel (as the Saisie KPIs grid used to) let concurrent requests race each
  // other's read-modify-write and silently drop all but the last one to finish.
  const handleBulkUpdateKPIs = async (updates: Record<string, Partial<KPI>>) => {
    if (!currentUser) return;
    const response = await fetch('/api/kpis', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates,
        modifiedBy: currentUser.name,
        modifiedByRole: currentUser.role
      })
    });
    if (!response.ok) throw new Error('Échec de la sauvegarde groupée des KPIs');
    await refreshKpisAndLogs();
  };

  // 7b. DELETE KPI
  const handleDeleteKPI = async (id: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/kpis/${id}?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Échec de suppression du KPI');
      await refreshKpisAndLogs();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 8. REGISTER NEW COLLABORATOR (ADMIN)
  const handleAddUser = async (newUserData: Omit<User, 'id'> & { initialPassword?: string }) => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUserData,
          createdBy: currentUser.name,
          createdByRole: currentUser.role
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Échec de création d\'utilisateur');
      }
      const resUsers = await fetch('/api/users').then(r => r.json());
      const resLogs = await fetch('/api/logs').then(r => r.json());
      setUsers(resUsers);
      setAuditLogs(resLogs);
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 8a. EDIT AN EXISTING USER'S PROFILE (ADMIN)
  const handleUpdateUser = async (id: string, updated: Partial<User>) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updated,
          modifiedBy: currentUser.name,
          modifiedByRole: currentUser.role
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Échec de modification de l\'utilisateur');
      }
      const updatedUser = await response.json();
      const resUsers = await fetch('/api/users').then(r => r.json());
      setUsers(resUsers);
      // Keep the live session in sync if an admin edits their own profile.
      if (currentUser.id === id) setCurrentUser(updatedUser);
      const resLogs = await fetch('/api/logs').then(r => r.json());
      setAuditLogs(resLogs);
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 8b. DELETE A USER (ADMIN)
  const handleDeleteUser = async (id: string) => {
    if (!currentUser) return;
    try {
      const params = new URLSearchParams({
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        requesterRole: currentUser.role
      });
      const response = await fetch(`/api/users/${id}?${params.toString()}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Échec de suppression de l\'utilisateur');
      }
      const resUsers = await fetch('/api/users').then(r => r.json());
      setUsers(resUsers);
      const resLogs = await fetch('/api/logs').then(r => r.json());
      setAuditLogs(resLogs);
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 8c. CHANGE A PASSWORD — admin resetting anyone's (no currentPassword needed), or a user
  // updating their own (currentPassword required and checked server-side). Returns an error
  // string on failure, or null on success, so callers can show it inline instead of an alert().
  const handleChangePassword = async (
    targetUserId: string,
    newPassword: string,
    currentPassword?: string
  ): Promise<string | null> => {
    if (!currentUser) return 'Non connecté.';
    try {
      const response = await fetch(`/api/users/${targetUserId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, currentPassword, requesterId: currentUser.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return data.error || 'Échec de la mise à jour du mot de passe.';
      return null;
    } catch {
      return 'Impossible de contacter le serveur.';
    }
  };

  // 8d. LOGIN — returns an error string on failure, or null on success.
  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return data.error || 'Échec de connexion.';
      setCurrentUser(data);
      localStorage.setItem(SESSION_STORAGE_KEY, data.id);
      return null;
    } catch {
      return 'Impossible de contacter le serveur.';
    }
  };

  // 8e. LOGOUT
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setActiveTab('dashboard');
  };

  // 9. UPDATE DATABASE CONFIG FOR SQL SERVER
  const handleUpdateSQLConfig = async (configFields: Partial<SQLServerConfig>) => {
    try {
      const response = await fetch('/api/sql-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configFields)
      });
      if (!response.ok) throw new Error('Échec de sauvegarde configuration SQL');
      const resSql = await fetch('/api/sql-config').then(r => r.json());
      setSqlConfig(resSql);
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // 10. TRIGGER MANUAL DATA PULL SYNC FROM SQL SERVER
  const handleTriggerSQLSync = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/sql-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser.name,
          role: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec de la synchronisation SQL Server');
      const data = await response.json();
      
      // Refresh local copy of KPIs and Logs
      await refreshKpisAndLogs();
      const resSql = await fetch('/api/sql-config').then(r => r.json());
      setSqlConfig(resSql);
    } catch (err: any) {
      alert(`Erreur de synchronisation SQL Server : ${err.message}`);
    }
  };

  // LOADING STATE VISUALIZER
  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-white rounded-full animate-spin"></div>
        <p className="font-sans text-xs uppercase tracking-widest font-mono text-slate-400">
          Chargement du Système de Pilotage Tier 4...
        </p>
      </div>
    );
  }

  // ERROR STATE VISUALIZER
  if (error) {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-3 p-6 text-center">
        <div className="text-rose-500 font-extrabold text-3xl">⚠️</div>
        <h3 className="font-sans font-bold text-base uppercase">Erreur de Démarrage Usine</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-normal">{error}</p>
        <button
          onClick={fetchInitialData}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 font-bold text-xs rounded transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // LOGIN SCREEN — no remembered/valid session, credentials required.
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-800 dark:text-slate-100 font-sans">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      {currentUser && (
        <Sidebar
          activeTab={activeTab === 'db-sync' ? 'db-sync' : activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          onLogout={handleLogout}
          onChangeMyPassword={(currentPassword, newPassword) =>
            handleChangePassword(currentUser.id, newPassword, currentPassword)
          }
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
      )}

      {/* CORE WORKSPACE VIEW CONTROLLER */}
      {currentUser && sqlConfig && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          
          {activeTab === 'dashboard' && (
            <DashboardMain
              kpis={kpis}
              actions={actions}
              setActiveTab={setActiveTab}
              setSelectedModuleId={setSelectedModuleId}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'modules' && (
            <ModuleDetail
              kpis={kpis}
              actions={actions}
              selectedModuleId={selectedModuleId}
              setSelectedModuleId={setSelectedModuleId}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'kpi-entry' && (
            <KPITeamGuruEntry
              kpis={kpis}
              onBulkUpdateKPIs={handleBulkUpdateKPIs}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'presence-tracker' && (
            <AttendanceTracker
              users={users}
              currentUser={currentUser!}
              onRefreshData={fetchInitialData}
            />
          )}

          {activeTab === 'gemba-tracker' && (
            <GembaTracker
              users={users}
              currentUser={currentUser!}
              onRefreshData={fetchInitialData}
            />
          )}

          {activeTab === 'actions' && (
            <ActionPlan
              actions={actions}
              kpis={kpis}
              users={users}
              onAddAction={handleAddAction}
              onUpdateAction={handleUpdateAction}
              onDeleteAction={handleDeleteAction}
              onAddComment={handleAddActionComment}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'meetings' && (
            <MeetingManager
              meetings={meetings}
              kpis={kpis}
              actions={actions}
              onAddAction={handleAddAction}
              onUpdateMeeting={handleUpdateMeeting}
              onCreateMeeting={handleCreateMeeting}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'db-sync' && (
            <AdminSettings
              kpis={kpis}
              users={users}
              sqlConfig={sqlConfig}
              auditLogs={auditLogs}
              onAddKPI={handleAddKPI}
              onUpdateKPI={handleUpdateKPI}
              onDeleteKPI={handleDeleteKPI}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onChangePassword={handleChangePassword}
              onUpdateSQLConfig={handleUpdateSQLConfig}
              onTriggerSQLSync={handleTriggerSQLSync}
              onBulkUpdateKPIs={handleBulkUpdateKPIs}
              currentUser={currentUser}
              defaultTab="sql"
            />
          )}

          {activeTab === 'admin' && (
            <AdminSettings
              kpis={kpis}
              users={users}
              sqlConfig={sqlConfig}
              auditLogs={auditLogs}
              onAddKPI={handleAddKPI}
              onUpdateKPI={handleUpdateKPI}
              onDeleteKPI={handleDeleteKPI}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onChangePassword={handleChangePassword}
              onUpdateSQLConfig={handleUpdateSQLConfig}
              onTriggerSQLSync={handleTriggerSQLSync}
              onBulkUpdateKPIs={handleBulkUpdateKPIs}
              currentUser={currentUser}
              defaultTab="kpis"
            />
          )}

        </div>
      )}

      {/* SIGNATURE */}
      <div className="fixed bottom-2 right-3 z-50 pointer-events-none select-none">
        <span className="text-[10px] font-mono text-slate-400/70 dark:text-slate-500/60 tracking-wide">
          Designed by A.ZOUAOUI
        </span>
      </div>

    </div>
  );
}
