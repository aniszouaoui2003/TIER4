/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Check,
  X,
  Award,
  AlertCircle,
  TrendingUp,
  Save,
  RotateCcw,
  Sparkles,
  Copy,
  Info
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { User, WeeklyAttendance, AttendanceRecord, AttendanceStatus } from '../types';

interface AttendanceTrackerProps {
  users: User[];
  currentUser: User;
  onRefreshData: () => Promise<void>;
}

// Standard ISO-8601 week number for a given date (week containing that date's Thursday).
const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// The app's single modeled exercise year, and its 52-week axis grouped into 12 months
// (4 or 5 weeks each, summing to 52) — same convention used across the KPI grid. The
// "current" week/month is today's real date, not a value frozen at the demo's seed data.
const CURRENT_YEAR = 2026;
const CURRENT_WEEK = getISOWeek(new Date());
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const WEEKS_PER_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5];
const MONTH_WEEK_RANGES: { name: string; weeks: number[] }[] = (() => {
  let start = 1;
  return MONTH_NAMES.map((name, i) => {
    const count = WEEKS_PER_MONTH[i];
    const weeks = Array.from({ length: count }, (_, k) => start + k);
    start += count;
    return { name, weeks };
  });
})();
const getWeekNum = (label: string) => parseInt(label.replace(/\D/g, ''), 10) || 0;

export default function AttendanceTracker({
  users,
  currentUser,
  onRefreshData
}: AttendanceTrackerProps) {
  const [selectedWeek, setSelectedWeek] = useState<string>(`Semaine ${CURRENT_WEEK}`);
  const selectedMonthIndex = MONTH_WEEK_RANGES.findIndex(m => m.weeks.includes(getWeekNum(selectedWeek)));

  // All weekly attendance data fetched from API
  const [attendanceData, setAttendanceData] = useState<WeeklyAttendance[]>([]);
  // Local edited records for the selected week
  const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Switching month jumps to that month's first week
  const handleMonthChange = (monthIndex: number) => {
    setSelectedWeek(`Semaine ${MONTH_WEEK_RANGES[monthIndex].weeks[0]}`);
  };

  // Load attendance data on mount
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/attendance');
      if (response.ok) {
        const data: WeeklyAttendance[] = await response.json();
        setAttendanceData(data);
      }
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // Sync localRecords when selectedWeek or attendanceData changes
  useEffect(() => {
    const existing = attendanceData.find(a => a.week === selectedWeek);
    if (existing) {
      setLocalRecords(existing.records);
    } else {
      // Build fallback default list from users
      // Exclude Admin from standard attendance tracking if you like, but let's include all standard participants
      const defaultRecords: AttendanceRecord[] = users
        .filter(u => u.role !== 'Viewer' && u.role !== 'Admin') // Only tracking active roles
        .map(u => {
          let shortRole = u.role as string;
          if (u.role === 'DGA (Administrateur)') shortRole = 'DGA';
          else if (u.role === 'directeur QHSE') shortRole = 'QHSE';
          else if (u.role === 'DRH') shortRole = 'DRH';
          else if (u.role === 'Responsable de production') shortRole = 'Prod';
          else if (u.role === 'Directeur Export') shortRole = 'Export';
          else if (u.role === 'Directeur Compta&contrôle de gestion') shortRole = 'CG';
          else if (u.role === 'Directeur technique') shortRole = 'Tech';
          else if (u.role === 'DAF') shortRole = 'DAF';

          return {
            userId: u.id,
            userName: u.name,
            userRole: shortRole,
            userDepartment: u.department || 'Usine Officeplast',
            status: 'Présent' as AttendanceStatus
          };
        });
      setLocalRecords(defaultRecords);
    }
  }, [selectedWeek, attendanceData, users]);

  // Handle status toggle for a user
  const handleStatusChange = (userId: string, newStatus: AttendanceStatus) => {
    setLocalRecords(prev =>
      prev.map(rec => (rec.userId === userId ? { ...rec, status: newStatus } : rec))
    );
  };

  // Quick Action: Mark all present
  const handleMarkAllPresent = () => {
    setLocalRecords(prev => prev.map(rec => ({ ...rec, status: 'Présent' })));
  };

  // Quick Action: Copy from previous week
  const handleCopyPreviousWeek = () => {
    const currentWeekNum = getWeekNum(selectedWeek);
    if (currentWeekNum <= 1) return;

    const prevWeekName = `Semaine ${currentWeekNum - 1}`;
    const previous = attendanceData.find(a => a.week === prevWeekName);
    
    if (previous) {
      // Copy statuses from previous week records
      const updated = localRecords.map(rec => {
        const prevRec = previous.records.find(p => p.userId === rec.userId);
        return prevRec ? { ...rec, status: prevRec.status } : rec;
      });
      setLocalRecords(updated);
      setSuccessMsg(`Modèle copié avec succès de la ${prevWeekName}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(`Aucune donnée trouvée pour la semaine précédente (${prevWeekName}).`);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Quick Action: Simulate randomly near targets
  const handleSimulateRandom = () => {
    const statuses: AttendanceStatus[] = ['Présent', 'Absent', 'Délégué'];
    const updated = localRecords.map(rec => {
      // 80% chance Present, 10% Absent, 10% Delegate
      const rand = Math.random();
      let status: AttendanceStatus = 'Présent';
      if (rand > 0.9) {
        status = 'Absent';
      } else if (rand > 0.8) {
        status = 'Délégué';
      }
      return { ...rec, status };
    });
    setLocalRecords(updated);
  };

  // Save changes to backend
  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: selectedWeek,
          records: localRecords
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMsg(`Taux de présence calculé à ${result.calculatedRate}% et injecté automatiquement dans l'indicateur SQCDP !`);
        
        // Refresh full data context in App.tsx
        await onRefreshData();
        // Refresh local attendance data
        await fetchAttendance();

        setTimeout(() => {
          setSuccessMsg(null);
        }, 5000);
      } else {
        const errData = await response.json();
        setErrorMsg(errData.error || "Erreur lors de l'enregistrement.");
      }
    } catch (err) {
      console.error('Failed to save attendance:', err);
      setErrorMsg("Impossible de se connecter au serveur pour enregistrer les présences.");
    } finally {
      setSaving(false);
    }
  };

  // Discard local changes
  const handleDiscard = () => {
    if (confirm('Voulez-vous annuler vos modifications non enregistrées ?')) {
      const existing = attendanceData.find(a => a.week === selectedWeek);
      if (existing) {
        setLocalRecords(existing.records);
      } else {
        setLocalRecords(localRecords.map(r => ({ ...r, status: 'Présent' })));
      }
    }
  };

  // Calculate stats for current local records
  const totalUsers = localRecords.length;
  const presentCount = localRecords.filter(r => r.status === 'Présent').length;
  const absentCount = localRecords.filter(r => r.status === 'Absent').length;
  const delegateCount = localRecords.filter(r => r.status === 'Délégué').length;
  
  // Present + Delegate count as 100% presence representation for the department
  const representedCount = presentCount + delegateCount;
  const presenceRate = totalUsers > 0 ? Math.round((representedCount / totalUsers) * 100) : 100;

  // Prepare chart data for the recorded weeks that fall within the selected month only,
  // so the trend follows the Année/Mois/Semaine filter instead of always showing everything.
  const monthWeekSet = new Set(MONTH_WEEK_RANGES[selectedMonthIndex].weeks);
  const chartData = attendanceData
    .filter(dataForWeek => monthWeekSet.has(getWeekNum(dataForWeek.week)))
    .map(dataForWeek => {
      const recs = dataForWeek.records;
      const tot = recs.length;
      const rep = recs.filter(r => r.status === 'Présent' || r.status === 'Délégué').length;
      const rate = tot > 0 ? Math.round((rep / tot) * 100) : 100;
      return { name: dataForWeek.week, 'Taux de Présence': rate };
    })
    .sort((a, b) => getWeekNum(a.name) - getWeekNum(b.name));

  // Check if anything has been modified compared to saved state
  const isModified = () => {
    const saved = attendanceData.find(a => a.week === selectedWeek);
    if (!saved) return localRecords.some(r => r.status !== 'Présent'); // True if we altered defaults
    return JSON.stringify(saved.records) !== JSON.stringify(localRecords);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden" id="presence-tracker-root">
      
      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-md">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white uppercase tracking-tight">
              Matrice de Présence & Assiduité
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez le suivi d'assiduité hebdomadaire au rituel Tier 4 par fonction et injectez automatiquement le taux calculé dans les KPI SQCDP.
          </p>
        </div>

        {/* Action Panel */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year / Month / Week filter — any week of the exercise year is selectable */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5 shrink-0" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1 font-mono">{CURRENT_YEAR}</span>
            <span className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
            <select
              value={selectedMonthIndex}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none py-0.5 pr-1 cursor-pointer"
            >
              {MONTH_WEEK_RANGES.map((m, idx) => (
                <option key={m.name} value={idx} className="bg-white dark:bg-slate-900 font-sans font-medium">
                  {m.name}
                </option>
              ))}
            </select>
            <span className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none pr-6 py-0.5 cursor-pointer"
            >
              {MONTH_WEEK_RANGES[selectedMonthIndex].weeks.map(w => (
                <option key={w} value={`Semaine ${w}`} className="bg-white dark:bg-slate-900 font-sans font-medium">
                  Semaine {w}{w === CURRENT_WEEK ? ' (actuelle)' : ''}
                </option>
              ))}
            </select>
          </div>

          {isModified() && (
            <>
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Annuler</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Enregistrer & Calculer</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-150 dark:border-emerald-900/50 px-6 py-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 shrink-0">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-150 dark:border-rose-900/50 px-6 py-3 flex items-center gap-2 text-rose-800 dark:text-rose-300 shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <p className="text-xs font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Main Grid Scroll Area */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Dashboard Stats Panel & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Metrics Cards */}
          <div className="space-y-4">
            
            {/* calculated presence rate */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Taux de Présence - {selectedWeek}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-display font-extrabold text-slate-900 dark:text-white">
                    {presenceRate}%
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">/ 100% Cible</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  {presenceRate >= 100 ? (
                    <span className="text-emerald-600 font-bold">● Objectif Atteint (100%)</span>
                  ) : presenceRate >= 90 ? (
                    <span className="text-amber-600 font-bold">● Vigilance (90-99%)</span>
                  ) : (
                    <span className="text-rose-600 font-bold">● Alerte (&lt;90%)</span>
                  )}
                </div>
              </div>

              {/* Minimalist Gauge Circle */}
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={
                      presenceRate >= 100
                        ? 'text-emerald-500'
                        : presenceRate >= 90
                        ? 'text-amber-500'
                        : 'text-rose-500'
                    }
                    strokeDasharray={`${presenceRate}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-extrabold text-slate-850 dark:text-slate-200">
                  {presenceRate}%
                </div>
              </div>
            </div>

            {/* Attendance breakdown counters */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                Répartition des Statuts
              </span>
              <div className="grid grid-cols-3 gap-2">
                
                {/* Present card */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block">Présents</span>
                  <span className="text-xl font-display font-black text-emerald-900 dark:text-emerald-300 mt-1 block">
                    {presentCount}
                  </span>
                </div>

                {/* Delegated card */}
                <div className="bg-sky-50/50 dark:bg-sky-950/15 border border-sky-100 dark:border-sky-900/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 block">Délégués</span>
                  <span className="text-xl font-display font-black text-sky-900 dark:text-sky-300 mt-1 block">
                    {delegateCount}
                  </span>
                </div>

                {/* Absent card */}
                <div className="bg-rose-50/50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block">Absents</span>
                  <span className="text-xl font-display font-black text-rose-900 dark:text-rose-300 mt-1 block">
                    {absentCount}
                  </span>
                </div>

              </div>
            </div>

          </div>

          {/* Historical trend charts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs lg:col-span-2 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tendance Historique - Assiduité Tier 4 ({MONTH_WEEK_RANGES[selectedMonthIndex].name} {CURRENT_YEAR})
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Évolution du taux d'assiduité calculé à partir de la matrice d'ateliers pour le mois sélectionné.
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="h-28 w-full mt-2 font-mono text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="presenceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
                  <YAxis domain={[60, 100]} stroke="#94a3b8" tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Taux de Présence"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#presenceGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Matrix List Control Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Règles métier : Tout délégué envoyé pour représenter une fonction garantit l'assiduité (100%).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllPresent}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tous Présents</span>
            </button>

            <button
              onClick={handleCopyPreviousWeek}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
              title="Copier les présences du modèle précédent"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copier Précédente</span>
            </button>

            <button
              onClick={handleSimulateRandom}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Saisie Démo</span>
            </button>
          </div>
        </div>

        {/* Attendance Matrix Grid Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse" id="attendance-matrix-table">
            
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-6">Participant</th>
                <th className="py-3 px-4">Fonction / Rôle</th>
                <th className="py-3 px-4">Département</th>
                <th className="py-3 px-6 text-center w-80">Statut Hebdomadaire</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs">
              {localRecords.map(rec => {
                const user = users.find(u => u.id === rec.userId);
                const initial = rec.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                // Role long-names mapping
                const roleLabels: Record<string, string> = {
                  'DGA': 'Directeur Général Adjoint',
                  'QHSE': 'Directeur QHSE',
                  'DRH': 'Directeur Ressources Humaines',
                  'Prod': 'Responsable Production',
                  'Export': 'Directeur Export',
                  'CG': 'Dir. Compta & Contrôle de Gestion',
                  'Tech': 'Directeur Technique',
                  'DAF': 'Directeur Administratif & Financier',
                  'Admin': 'Administrateur S.I.'
                };

                return (
                  <tr key={rec.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all">
                    
                    {/* Participant Avatar & Name */}
                    <td className="py-3 px-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs shrink-0">
                        {initial}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {rec.userName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {user?.email || 'officeplast@usine.com'}
                        </span>
                      </div>
                    </td>

                    {/* Function / Role */}
                    <td className="py-3 px-4 font-medium text-slate-750 dark:text-slate-350">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold text-[10px]">
                        {rec.userRole}
                      </span>
                      <span className="ml-2 text-slate-500 text-xs">
                        {roleLabels[rec.userRole] || rec.userRole}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4 text-slate-450 dark:text-slate-500 font-medium">
                      {rec.userDepartment}
                    </td>

                    {/* Weekly Status (Present, Absent, Delegated) */}
                    <td className="py-2.5 px-6">
                      <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 max-w-xs mx-auto">
                        
                        {/* Present option */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(rec.userId, 'Présent')}
                          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            rec.status === 'Présent'
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Présent</span>
                        </button>

                        {/* Delegated option */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(rec.userId, 'Délégué')}
                          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            rec.status === 'Délégué'
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                          title="Présent via un remplaçant"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Délégué</span>
                        </button>

                        {/* Absent option */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(rec.userId, 'Absent')}
                          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            rec.status === 'Absent'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>

      </div>

      {/* Grid footer instructions */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 shrink-0 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <span>L'assiduité hebdomadaire alimente directement le KPI "présence Hebdomadaire au Tier4 par fonction".</span>
        </div>
        <div className="font-mono text-[10px]">
          Fait à Sousse, Tunisie - Officeplast Quality System
        </div>
      </div>

    </div>
  );
}
