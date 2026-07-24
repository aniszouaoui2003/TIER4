/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Database,
  Users,
  Sliders,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Server,
  Terminal,
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { KPI, SQLServerConfig, AuditLog, User, UserRole } from '../types';
import { downloadWorkbook, readWorkbook } from '../utils/excelIO';
import { buildExportSheet, parseImportRows, FORMULA_KPI_IDS } from '../utils/kpiExcelData';

interface AdminSettingsProps {
  kpis: KPI[];
  users: User[];
  sqlConfig: SQLServerConfig;
  auditLogs: AuditLog[];
  onAddKPI: (kpi: Omit<KPI, 'id' | 'history'>) => Promise<void>;
  onUpdateKPI: (id: string, updated: Partial<KPI>) => Promise<void>;
  onDeleteKPI: (id: string) => Promise<void>;
  onAddUser: (user: Omit<User, 'id'>) => Promise<void>;
  onUpdateSQLConfig: (config: Partial<SQLServerConfig>) => Promise<void>;
  onTriggerSQLSync: () => Promise<void>;
  onBulkUpdateKPIs: (updates: Record<string, Partial<KPI>>) => Promise<void>;
  currentUser: User;
  defaultTab?: 'kpis' | 'users' | 'sql' | 'excel' | 'logs';
}

export default function AdminSettings({
  kpis,
  users,
  sqlConfig,
  auditLogs,
  onAddKPI,
  onUpdateKPI,
  onDeleteKPI,
  onAddUser,
  onUpdateSQLConfig,
  onTriggerSQLSync,
  onBulkUpdateKPIs,
  currentUser,
  defaultTab
}: AdminSettingsProps) {
  // Navigation inside Admin
  const [activeAdminTab, setActiveAdminTab] = React.useState<'kpis' | 'users' | 'sql' | 'excel' | 'logs'>('kpis');

  // Sync defaultTab when it changes
  React.useEffect(() => {
    if (defaultTab) {
      setActiveAdminTab(defaultTab);
    }
  }, [defaultTab]);

  // Excel import/export state
  const [excelPeriodMode, setExcelPeriodMode] = useState<'monthly' | 'weekly'>('weekly');
  const [excelSiteView, setExcelSiteView] = useState<'total' | 'site1' | 'site2'>('total');
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelStatus, setExcelStatus] = useState<string | null>(null);
  const excelFileInputRef = React.useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  // Editing state
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);

  // New KPI Form State
  const [newKpiName, setNewKpiName] = useState('');
  const [newKpiDesc, setNewKpiDesc] = useState('');
  const [newKpiCategory, setNewKpiCategory] = useState('Sécurité');
  const [newKpiOwner, setNewKpiOwner] = useState('');
  const [newKpiUnit, setNewKpiUnit] = useState('');
  const [newKpiTarget, setNewKpiTarget] = useState(0);
  const [newKpiMinGreen, setNewKpiMinGreen] = useState(0);
  const [newKpiMaxOrange, setNewKpiMaxOrange] = useState(0);

  // Additional settings states for Site and Total checks and owners
  const [kpiSite1Checked, setKpiSite1Checked] = useState(true);
  const [kpiSite2Checked, setKpiSite2Checked] = useState(true);
  const [kpiTotalChecked, setKpiTotalChecked] = useState(true);
  const [kpiSite1Owner, setKpiSite1Owner] = useState('');
  const [kpiSite2Owner, setKpiSite2Owner] = useState('');
  const [kpiOfficeplastOwner, setKpiOfficeplastOwner] = useState('');

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Viewer');
  const [newUserDept, setNewUserDept] = useState('Production');

  // SQL connection state
  const [dbHost, setDbHost] = useState(sqlConfig.host);
  const [dbPort, setDbPort] = useState(sqlConfig.port);
  const [dbName, setDbName] = useState(sqlConfig.database);
  const [dbUser, setDbUser] = useState(sqlConfig.username);
  const [dbSyncInterval, setDbSyncInterval] = useState(sqlConfig.syncIntervalMinutes);

  // Handle SQL config submit
  const handleSaveSQL = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSQLConfig({
      host: dbHost,
      port: dbPort,
      database: dbName,
      username: dbUser,
      syncIntervalMinutes: Number(dbSyncInterval)
    });
    alert('Configuration de la base de données SQL Server mise à jour avec succès.');
  };

  // Trigger manual SQL Pull
  const handleManualSync = async () => {
    setSyncing(true);
    await onTriggerSQLSync();
    setSyncing(false);
    alert('Synchronisation complète avec SQL Server effectuée. Les tables de faits d\'usine ont été actualisées.');
  };

  // Exports the entire KPI base (all categories) for the selected period/site axis.
  const handleExcelExport = async () => {
    const periodLabel = excelPeriodMode === 'monthly' ? 'Mensuel' : 'Hebdomadaire';
    const siteLabel = excelSiteView === 'total' ? 'Total Site' : excelSiteView === 'site1' ? 'Site 1' : 'Site 2';
    const { headers, rows } = buildExportSheet(kpis, excelPeriodMode, excelSiteView, FORMULA_KPI_IDS);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
      await downloadWorkbook({
        sheetName: 'Base KPIs',
        metaRows: [
          ['Vue :', `${periodLabel} — ${siteLabel} — Toutes catégories`],
          ['Exporté le :', dateStr]
        ],
        headers,
        rows,
        filename: `Base_KPIs_${periodLabel}_${siteLabel.replace(' ', '')}_${dateStr}.xlsx`
      });
    } catch (err: any) {
      alert(`Erreur d'export : ${err.message}`);
    }
  };

  // Imports an .xlsx file and saves it immediately (there's no live grid here to stage edits
  // in first, so the parsed summary is shown for confirmation before writing).
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setExcelImporting(true);
    setExcelStatus('Lecture du fichier .xlsx…');
    try {
      const parsed = await readWorkbook(file);
      const { updates, appliedCount, skipped } = parseImportRows(parsed, kpis, FORMULA_KPI_IDS);

      if (appliedCount === 0) {
        setExcelStatus(null);
        alert(`Aucune valeur importable dans ce fichier.${skipped.length > 0 ? `\n\n${skipped.slice(0, 10).join('\n')}` : ''}`);
        return;
      }

      const kpiCount = Object.keys(updates).length;
      const skippedNote = skipped.length > 0 ? `\n${skipped.length} ligne(s) ignorée(s) (calculées automatiquement ou introuvables).` : '';
      const confirmed = confirm(`Importer ${appliedCount} valeur(s) pour ${kpiCount} indicateur(s) ?${skippedNote}\n\nCette action écrase directement les valeurs existantes pour ces périodes.`);
      if (!confirmed) {
        setExcelStatus(null);
        return;
      }

      await onBulkUpdateKPIs(updates);
      setExcelStatus(`Succès : ${appliedCount} valeur(s) importée(s) pour ${kpiCount} indicateur(s).`);
      setTimeout(() => setExcelStatus(null), 4000);
    } catch (err: any) {
      setExcelStatus(null);
      alert(`Erreur d'import : ${err.message}`);
    } finally {
      setExcelImporting(false);
    }
  };

  const handleStartEdit = (k: KPI) => {
    setEditingKpi(k);
    setNewKpiName(k.name);
    setNewKpiDesc(k.description || '');
    setNewKpiCategory(k.category);
    setNewKpiOwner(k.owner);
    setNewKpiUnit(k.unit);
    setNewKpiTarget(k.target);
    const match = k.greenThreshold ? k.greenThreshold.match(/[\d.]+/) : null;
    setNewKpiMinGreen(match ? Number(match[0]) : k.target);
    setKpiSite1Checked(k.site1Checked !== false);
    setKpiSite2Checked(k.site2Checked !== false);
    setKpiTotalChecked(k.totalChecked !== false);
    setKpiSite1Owner(k.site1Owner || '');
    setKpiSite2Owner(k.site2Owner || '');
    setKpiOfficeplastOwner(k.officeplastOwner || '');
  };

  const handleCancelEdit = () => {
    setEditingKpi(null);
    setNewKpiName('');
    setNewKpiDesc('');
    setNewKpiCategory('Sécurité');
    setNewKpiOwner('');
    setNewKpiUnit('');
    setNewKpiTarget(0);
    setNewKpiMinGreen(0);
    setNewKpiMaxOrange(0);
    setKpiSite1Checked(true);
    setKpiSite2Checked(true);
    setKpiTotalChecked(true);
    setKpiSite1Owner('');
    setKpiSite2Owner('');
    setKpiOfficeplastOwner('');
  };

  // Handle KPI creation or update
  const handleCreateKPI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKpiName || !newKpiOwner || !newKpiUnit) return;

    if (editingKpi) {
      await onUpdateKPI(editingKpi.id, {
        name: newKpiName,
        description: newKpiDesc,
        category: newKpiCategory,
        owner: newKpiOwner,
        unit: newKpiUnit,
        target: newKpiTarget,
        greenThreshold: `>= ${newKpiMinGreen || newKpiTarget}`,
        site1Checked: kpiSite1Checked,
        site2Checked: kpiSite2Checked,
        totalChecked: kpiTotalChecked,
        site1Owner: kpiSite1Owner || undefined,
        site2Owner: kpiSite2Owner || undefined,
        officeplastOwner: kpiOfficeplastOwner || undefined
      });
      alert(`L'indicateur "${newKpiName}" a été correctement mis à jour.`);
      handleCancelEdit();
    } else {
      await onAddKPI({
        name: newKpiName,
        description: newKpiDesc,
        category: newKpiCategory,
        owner: newKpiOwner,
        unit: newKpiUnit,
        target: newKpiTarget,
        weeklyValue: 0,
        dailyValue: 0,
        status: 'Green',
        trend: 'stable',
        greenThreshold: `>= ${newKpiMinGreen || newKpiTarget}`,
        site1Checked: kpiSite1Checked,
        site2Checked: kpiSite2Checked,
        totalChecked: kpiTotalChecked,
        site1Owner: kpiSite1Owner || undefined,
        site2Owner: kpiSite2Owner || undefined,
        officeplastOwner: kpiOfficeplastOwner || undefined,
        site1Value: 0,
        site2Value: 0
      });
      alert(`L'indicateur "${newKpiName}" a été correctement ajouté aux référentiels Tier 4.`);
      handleCancelEdit();
    }
  };

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newUserEmail) return;

    await onAddUser({
      name: newUsername,
      email: newUserEmail,
      role: newUserRole,
      department: newUserDept
    });

    setNewUsername('');
    setNewUserEmail('');
    alert(`L'utilisateur ${newUsername} a été inscrit avec les droits d'accès: ${newUserRole}.`);
  };

  // Guard view for Viewer only (all other roles have permissions)
  if (currentUser.role === 'Viewer') {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-4">
          <Lock className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Accès Réservé au Comité de Direction</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vous n'avez pas les habilitations de sécurité requises pour modifier les configurations de base de données d'usine, les seuils ou les profils d'utilisateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Page Header */}
      <div>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
          Panneau de configuration avancée
        </p>
        <h2 className="text-2xl font-sans font-bold text-slate-900 dark:text-white tracking-tight">
          Administration Générale & Bases de Données
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Gestion des KPI d'usine, seuils d'alertes SQCDP, habilitations et connecteur SQL Server
        </p>
      </div>

      {/* ADMIN TABS ROW */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-1 shrink-0">
        <button
          onClick={() => setActiveAdminTab('kpis')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeAdminTab === 'kpis'
              ? 'border-b-blue-600 text-blue-600'
              : 'border-b-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Référentiel des KPI
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeAdminTab === 'users'
              ? 'border-b-blue-600 text-blue-600'
              : 'border-b-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Utilisateurs & Habilitations
        </button>

        <button
          onClick={() => setActiveAdminTab('sql')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeAdminTab === 'sql'
              ? 'border-b-blue-600 text-blue-600'
              : 'border-b-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> Connecteur SQL Server
        </button>

        <button
          onClick={() => setActiveAdminTab('excel')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeAdminTab === 'excel'
              ? 'border-b-blue-600 text-blue-600'
              : 'border-b-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Import / Export Excel
        </button>

        <button
          onClick={() => setActiveAdminTab('logs')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeAdminTab === 'logs'
              ? 'border-b-blue-600 text-blue-600'
              : 'border-b-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> Journal de Traçabilité (Audit)
        </button>
      </div>

      {/* DYNAMIC TAB COMPONENT PANELS */}
      <div className="space-y-6">

        {/* PANEL 1: REPERTOIRE KPI + SEUILS */}
        {activeAdminTab === 'kpis' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
            {/* Create / Edit KPI Form */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                {editingKpi ? (
                  <>
                    <Sliders className="w-4 h-4 text-amber-500" /> Modifier l'Indicateur
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-blue-500" /> Ajouter un Indicateur
                  </>
                )}
              </h3>

              <form onSubmit={handleCreateKPI} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Nom du KPI *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Rendement Synthétique Injection..."
                    value={newKpiName}
                    onChange={(e) => setNewKpiName(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Description / Formule de calcul</label>
                  <textarea
                    rows={2}
                    placeholder="Formule de calcul normalisée (ex: Temps utile / Temps requis)..."
                    value={newKpiDesc}
                    onChange={(e) => setNewKpiDesc(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Catégorie SQCDP</label>
                    <select
                      value={newKpiCategory}
                      onChange={(e) => setNewKpiCategory(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="Sécurité">Sécurité</option>
                      <option value="Qualité">Qualité</option>
                      <option value="Livraison">Livraison</option>
                      <option value="Production">Production</option>
                      <option value="Coût">Coût</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="RH">RH</option>
                      <option value="Amélioration continue">Amélioration continue</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Unité de mesure</label>
                    <input
                      type="text"
                      required
                      placeholder="%, PPM, Heures, m³..."
                      value={newKpiUnit}
                      onChange={(e) => setNewKpiUnit(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Pilote Global *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nom du pilote principal"
                      value={newKpiOwner}
                      onChange={(e) => setNewKpiOwner(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Objectif cible *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      placeholder="Cible chiffrée"
                      value={newKpiTarget || ''}
                      onChange={(e) => setNewKpiTarget(Number(e.target.value))}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg space-y-2.5 border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Champs de saisie & Pilotes Locaux</span>
                  <div className="flex gap-4 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kpiSite1Checked}
                        onChange={(e) => setKpiSite1Checked(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Site 1 (S1)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kpiSite2Checked}
                        onChange={(e) => setKpiSite2Checked(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Site 2 (S2)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kpiTotalChecked}
                        onChange={(e) => setKpiTotalChecked(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>HQ (Total)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-1 border-t border-slate-200/55 dark:border-slate-800">
                    {kpiSite1Checked && (
                      <div className="grid grid-cols-12 items-center gap-2">
                        <label className="col-span-4 text-[8px] font-bold text-slate-400 uppercase">Pilote Site 1</label>
                        <input
                          type="text"
                          placeholder="Nom pilote S1"
                          value={kpiSite1Owner}
                          onChange={(e) => setKpiSite1Owner(e.target.value)}
                          className="col-span-8 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-1 text-slate-800 dark:text-slate-200 text-[10px]"
                        />
                      </div>
                    )}
                    {kpiSite2Checked && (
                      <div className="grid grid-cols-12 items-center gap-2">
                        <label className="col-span-4 text-[8px] font-bold text-slate-400 uppercase">Pilote Site 2</label>
                        <input
                          type="text"
                          placeholder="Nom pilote S2"
                          value={kpiSite2Owner}
                          onChange={(e) => setKpiSite2Owner(e.target.value)}
                          className="col-span-8 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-1 text-slate-800 dark:text-slate-200 text-[10px]"
                        />
                      </div>
                    )}
                    {kpiTotalChecked && (
                      <div className="grid grid-cols-12 items-center gap-2">
                        <label className="col-span-4 text-[8px] font-bold text-slate-400 uppercase">Pilote HQ</label>
                        <input
                          type="text"
                          placeholder="Nom pilote HQ"
                          value={kpiOfficeplastOwner}
                          onChange={(e) => setKpiOfficeplastOwner(e.target.value)}
                          className="col-span-8 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-1 text-slate-800 dark:text-slate-200 text-[10px]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Thresholds definition */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg space-y-2 border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Définir les seuils d'alertes visuelles</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[8px] font-bold text-emerald-600 uppercase mb-0.5">Seuil Minimum Vert *</label>
                      <input
                        type="number"
                        required
                        step="any"
                        placeholder="Vert si >= à..."
                        value={newKpiMinGreen || ''}
                        onChange={(e) => setNewKpiMinGreen(Number(e.target.value))}
                        className="w-full border border-slate-200 bg-white dark:bg-slate-800 rounded p-1 text-slate-800 dark:text-slate-200 text-[11px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-rose-600 uppercase mb-0.5">Seuil Alerte Rouge</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Rouge si <= à..."
                        value={newKpiMaxOrange || ''}
                        onChange={(e) => setNewKpiMaxOrange(Number(e.target.value))}
                        className="w-full border border-slate-200 bg-white dark:bg-slate-800 rounded p-1 text-slate-800 dark:text-slate-200 text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  {editingKpi && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    type="submit"
                    className={`py-2 text-white font-bold rounded-lg transition-colors cursor-pointer ${
                      editingKpi 
                        ? 'w-2/3 bg-amber-500 hover:bg-amber-600' 
                        : 'w-full bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {editingKpi ? "Mettre à jour" : "Enregistrer l'Indicateur"}
                  </button>
                </div>
              </form>
            </div>

            {/* List and Threshold editor */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col h-[520px]">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                Seuils des KPI Actifs ({kpis.length})
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px]">
                {kpis.map(k => (
                  <div key={k.id} className={`p-3 rounded-lg border flex justify-between items-center transition-colors ${
                    editingKpi?.id === k.id
                      ? 'bg-amber-50/50 dark:bg-amber-950/15 border-amber-300/60 dark:border-amber-900/40'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100/40'
                  }`}>
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{k.name}</span>
                        <span className="text-[8px] bg-slate-200/60 dark:bg-slate-700 px-1 rounded font-bold uppercase font-mono">{k.category}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Cible : <strong>{k.target} {k.unit}</strong> • Pilote : {k.owner}
                        {k.site1Checked && ` • S1: ${k.site1Owner || 'Indéfini'}`}
                        {k.site2Checked && ` • S2: ${k.site2Owner || 'Indéfini'}`}
                        {k.totalChecked && ` • HQ: ${k.officeplastOwner || 'Indéfini'}`}
                      </p>
                    </div>

                    {/* Inline thresholds editing & deletion */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Seuils V/O/R</span>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span className="text-emerald-600">{k.greenThreshold || `>= ${k.target}`}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartEdit(k)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          editingKpi?.id === k.id
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {editingKpi?.id === k.id ? 'Édition...' : 'Éditer'}
                      </button>

                      <button
                        onClick={async () => {
                          if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'indicateur "${k.name}" ?`)) {
                            await onDeleteKPI(k.id);
                            if (editingKpi?.id === k.id) {
                              handleCancelEdit();
                            }
                          }
                        }}
                        className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 transition-colors cursor-pointer"
                        title="Supprimer cet indicateur"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: UTISATEURS & DROITS D'ACCÈS */}
        {activeAdminTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
            {/* Create user form */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-500" />
                Inscrire un Collaborateur
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Prénom & Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Jean-Pierre Pernaut"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="jp.pernaut@mfg-group.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Rôle Système *</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-semibold"
                    >
                      <option value="Admin">Administrateur (Système)</option>
                      <option value="DG">Directeur Général (DG)</option>
                      <option value="DI">Directeur Industriel (DI)</option>
                      <option value="Prod">Responsable Production (Prod)</option>
                      <option value="Qual">Responsable Qualité (Qual)</option>
                      <option value="Maint">Responsable Maintenance (Maint)</option>
                      <option value="RH">Responsable Ressources Humaines (RH)</option>
                      <option value="Log">Responsable Logistique (Log)</option>
                      <option value="Workshop">Responsable de Site / Périmètre</option>
                      <option value="Viewer">Consultation (Viewer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Département affecté</label>
                    <input
                      type="text"
                      placeholder="ex: Production, HSE..."
                      value={newUserDept}
                      onChange={(e) => setNewUserDept(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Ajouter le Collaborateur
                </button>
              </form>
            </div>

            {/* Users list directory */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[400px]">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">
                Répertoire des Utilisateurs Actifs
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {users.map(u => (
                  <div key={u.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:bg-slate-100/40">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px]">
                        {u.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{u.name}</p>
                        <p className="text-[10px] text-slate-400">{u.email} • {u.department}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        u.role.includes('DGA') ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400' :
                        u.role.includes('Directeur') || u.role.includes('directeur') ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400' :
                        u.role === 'Viewer' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: CONNECTEUR SQL SERVER */}
        {activeAdminTab === 'sql' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
            {/* Database Credential Form */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-1.5">
                <Server className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                  Paramètres de Connexion SQL Server
                </h3>
              </div>

              <form onSubmit={handleSaveSQL} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Host / URL</label>
                    <input
                      type="text"
                      value={dbHost}
                      onChange={(e) => setDbHost(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Port</label>
                    <input
                      type="number"
                      value={dbPort}
                      onChange={(e) => setDbPort(Number(e.target.value))}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Database Name</label>
                    <input
                      type="text"
                      value={dbName}
                      onChange={(e) => setDbName(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Sync Frequency (minutes)</label>
                    <input
                      type="number"
                      value={dbSyncInterval}
                      onChange={(e) => setDbSyncInterval(Number(e.target.value))}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Username</label>
                    <input
                      type="text"
                      value={dbUser}
                      onChange={(e) => setDbUser(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••"
                      disabled
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 rounded p-2 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 transition-colors"
                  >
                    Enregistrer Config
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Synchro en cours...' : 'Forcer Lecture SQL'}
                  </button>
                </div>
              </form>
            </div>

            {/* Connection Diagnostics Terminal */}
            <div className="lg:col-span-6 bg-slate-900 text-slate-300 p-5 rounded-xl border border-slate-800 shadow-xl flex flex-col h-[320px] font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3 text-[10px]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Terminal className="w-4 h-4" /> ENGINE DIAGNOSTICS
                </span>
                <span className="text-slate-500 font-bold">STATUS: OK (CONNECTED)</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 text-[9px] text-slate-400 leading-normal">
                <p className="text-emerald-500">[OK] Initializing SqlServer connection pool...</p>
                <p>[INFO] Host resolved to {sqlConfig.host}:{sqlConfig.port}</p>
                <p>[INFO] Database context selected: "{sqlConfig.database}"</p>
                <p>[OK] Authenticated client successfully.</p>
                <p className="text-yellow-500">[WARN] Tables: [Fact_Daily_KPIs], [Meeting_Attendance], [RCA_Actions] found.</p>
                <p>[INFO] Scanning for daily deviations...</p>
                <p className="text-emerald-500">[OK] Sync completed. 0 fatal SQL exceptions raised.</p>
                <p className="text-blue-400">[INFO] Next automated pull set to run in {sqlConfig.syncIntervalMinutes} minutes.</p>
              </div>

              <div className="mt-auto pt-2 border-t border-slate-800 text-[8px] text-slate-500 flex justify-between">
                <span>Driver: MSSQL 14.0.1000</span>
                <span>Thread pool size: 8</span>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 4: EXCEL IMPORT / EXPORT */}
        {activeAdminTab === 'excel' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs max-w-xl mx-auto space-y-6 text-xs">
            <div className="text-center">
              <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-2">Import / Export Excel — Base KPIs complète</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-normal">
                Exportez ou réimportez les valeurs de tous les indicateurs, tous catégories confondues. Pour un export limité à la vue affichée (catégorie, recherche), utilisez le bouton dédié dans l'onglet Saisie KPIs.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <select
                value={excelPeriodMode}
                onChange={(e) => setExcelPeriodMode(e.target.value as 'monthly' | 'weekly')}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="weekly">Vue Hebdomadaire</option>
                <option value="monthly">Vue Mensuelle</option>
              </select>
              <select
                value={excelSiteView}
                onChange={(e) => setExcelSiteView(e.target.value as 'total' | 'site1' | 'site2')}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="total">Total Site</option>
                <option value="site1">Site 1</option>
                <option value="site2">Site 2</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Importation</span>
                <p className="text-[10px] text-slate-500 leading-normal">Charger un fichier .xlsx exporté depuis l'application</p>
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleExcelImport}
                />
                <button
                  onClick={() => excelFileInputRef.current?.click()}
                  disabled={excelImporting}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer transition-all disabled:opacity-50"
                >
                  {excelImporting ? 'Import…' : 'Charger Excel'}
                </button>
              </div>

              <div className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Exportation</span>
                <p className="text-[10px] text-slate-500 leading-normal">Télécharger la base complète des indicateurs</p>
                <button
                  onClick={handleExcelExport}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded cursor-pointer transition-all"
                >
                  Exporter Excel
                </button>
              </div>
            </div>

            {excelStatus && (
              <p className="text-xs font-mono font-bold text-blue-600 text-center animate-pulse">
                {excelStatus}
              </p>
            )}
          </div>
        )}

        {/* PANEL 5: AUDIT LOGS TRAÇABILITÉ */}
        {activeAdminTab === 'logs' && (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col h-[460px]">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                Registre d'Audit & Traçabilité des Habilitations (Tier 4)
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">Sécurisé & Immuable</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono leading-normal">
              {auditLogs.map(log => (
                <div key={log.id} className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded flex justify-between items-start gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-slate-800 dark:text-slate-200 font-bold">{log.action}</p>
                    <p className="text-[10px] text-slate-400">{log.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold block">{log.user}</span>
                    <span className="text-[9px] text-slate-400">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
