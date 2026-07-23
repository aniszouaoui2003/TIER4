/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Footprints,
  Calendar,
  Target,
  AlertCircle,
  TrendingUp,
  Save,
  RotateCcw,
  Sparkles,
  Copy,
  Info,
  UserPlus,
  Trash2,
  Check,
  Pencil
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
import { User, WeeklyGemba, GembaRecord } from '../types';
import { CURRENT_YEAR, CURRENT_WEEK, MONTH_WEEK_RANGES, getWeekNum } from '../utils/weekCalendar';

interface GembaTrackerProps {
  users: User[];
  currentUser: User;
  onRefreshData: () => Promise<void>;
}

const shortRoleFor = (role: string): string => {
  if (role === 'DGA (Administrateur)') return 'DGA';
  if (role === 'directeur QHSE') return 'QHSE';
  if (role === 'DRH') return 'DRH';
  if (role === 'Responsable de production') return 'Prod';
  if (role === 'Directeur Export') return 'Export';
  if (role === 'Directeur Compta&contrôle de gestion') return 'CG';
  if (role === 'Directeur technique') return 'Tech';
  if (role === 'DAF') return 'DAF';
  return role;
};

export default function GembaTracker({
  users,
  currentUser,
  onRefreshData
}: GembaTrackerProps) {
  const [selectedWeek, setSelectedWeek] = useState<string>(`Semaine ${CURRENT_WEEK}`);
  const selectedWeekNum = getWeekNum(selectedWeek);
  const selectedMonthIndex = MONTH_WEEK_RANGES.findIndex(m => m.weeks.includes(selectedWeekNum));
  const monthRange = MONTH_WEEK_RANGES[selectedMonthIndex];

  // All weekly Gemba data fetched from API, plus the configurable monthly objective per person
  const [gembaData, setGembaData] = useState<WeeklyGemba[]>([]);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(2);
  const [targetInput, setTargetInput] = useState<string>('2');

  // Local edited records for the selected week
  const [localRecords, setLocalRecords] = useState<GembaRecord[]>([]);
  const [baselineRecords, setBaselineRecords] = useState<GembaRecord[]>([]);

  const [saving, setSaving] = useState<boolean>(false);
  const [savingTarget, setSavingTarget] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Switching month jumps to that month's first week
  const handleMonthChange = (monthIndex: number) => {
    setSelectedWeek(`Semaine ${MONTH_WEEK_RANGES[monthIndex].weeks[0]}`);
  };

  // Load Gemba data + objective on mount
  const fetchGemba = async () => {
    try {
      const response = await fetch('/api/gemba');
      if (response.ok) {
        const data: { records: WeeklyGemba[]; monthlyTarget: number } = await response.json();
        setGembaData(data.records);
        setMonthlyTarget(data.monthlyTarget);
        setTargetInput(String(data.monthlyTarget));
      }
    } catch (err) {
      console.error('Failed to fetch Gemba data:', err);
    }
  };

  useEffect(() => {
    fetchGemba();
  }, []);

  // Default roster for a week that has never been saved: every non-Viewer/Admin user, at 0
  const buildDefaultRecords = (): GembaRecord[] =>
    users
      .filter(u => u.role !== 'Viewer' && u.role !== 'Admin')
      .map(u => ({
        userId: u.id,
        userName: u.name,
        userRole: shortRoleFor(u.role as string),
        userDepartment: u.department || 'Usine Officeplast',
        count: 0
      }));

  // Sync localRecords when selectedWeek or gembaData changes
  useEffect(() => {
    const existing = gembaData.find(g => g.week === selectedWeek);
    const records = existing ? existing.records : buildDefaultRecords();
    setLocalRecords(records);
    setBaselineRecords(records);
  }, [selectedWeek, gembaData, users]);

  // Update this week's Gemba count for one person
  const handleCountChange = (userId: string, valStr: string) => {
    const count = valStr === '' ? 0 : Math.max(0, Math.round(Number(valStr)));
    if (isNaN(count)) return;
    setLocalRecords(prev => prev.map(rec => (rec.userId === userId ? { ...rec, count } : rec)));
  };

  // Add a participant to this week's roster only
  const handleAddParticipant = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setLocalRecords(prev => [
      ...prev,
      {
        userId: user.id,
        userName: user.name,
        userRole: shortRoleFor(user.role as string),
        userDepartment: user.department || 'Usine Officeplast',
        count: 0
      }
    ]);
  };

  // Remove a participant from this week's roster only
  const handleRemoveParticipant = (userId: string) => {
    setLocalRecords(prev => prev.filter(rec => rec.userId !== userId));
  };

  // Quick Action: reset every count this week to 0
  const handleResetToZero = () => {
    setLocalRecords(prev => prev.map(rec => ({ ...rec, count: 0 })));
  };

  // Quick Action: copy counts from the previous week
  const handleCopyPreviousWeek = () => {
    if (selectedWeekNum <= 1) return;
    const prevWeekName = `Semaine ${selectedWeekNum - 1}`;
    const previous = gembaData.find(g => g.week === prevWeekName);

    if (previous) {
      const updated = localRecords.map(rec => {
        const prevRec = previous.records.find(p => p.userId === rec.userId);
        return prevRec ? { ...rec, count: prevRec.count } : rec;
      });
      setLocalRecords(updated);
      setSuccessMsg(`Modèle copié avec succès de la ${prevWeekName}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(`Aucune donnée trouvée pour la semaine précédente (${prevWeekName}).`);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Quick Action: simulate realistic-looking demo counts (mostly 0-1, occasionally 2)
  const handleSimulateRandom = () => {
    const updated = localRecords.map(rec => {
      const rand = Math.random();
      const count = rand > 0.85 ? 2 : rand > 0.4 ? 1 : 0;
      return { ...rec, count };
    });
    setLocalRecords(updated);
  };

  // Save this week's counts to backend — the server recomputes the cumulative-vs-objective
  // rate for the whole month and injects it into the "Suivi de Gemba HSE" KPI.
  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/gemba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: selectedWeek, records: localRecords })
      });

      if (response.ok) {
        setSuccessMsg('Gemba de la semaine enregistrés — taux cumulé recalculé et injecté dans le KPI SQCDP !');
        await onRefreshData();
        await fetchGemba();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        const errData = await response.json();
        setErrorMsg(errData.error || "Erreur lors de l'enregistrement.");
      }
    } catch (err) {
      console.error('Failed to save Gemba data:', err);
      setErrorMsg('Impossible de se connecter au serveur pour enregistrer les Gemba.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (confirm('Voulez-vous annuler vos modifications non enregistrées ?')) {
      setLocalRecords(baselineRecords);
    }
  };

  // Save the monthly objective per person
  const handleSaveTarget = async () => {
    const target = Number(targetInput);
    if (isNaN(target) || target <= 0) {
      setErrorMsg('Objectif mensuel invalide.');
      return;
    }
    setSavingTarget(true);
    try {
      const response = await fetch('/api/gemba-target', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      if (response.ok) {
        setMonthlyTarget(target);
        setSuccessMsg(`Objectif mensuel mis à jour : ${target} Gemba par personne.`);
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        const errData = await response.json();
        setErrorMsg(errData.error || "Erreur lors de la mise à jour de l'objectif.");
      }
    } catch (err) {
      console.error('Failed to update Gemba target:', err);
      setErrorMsg("Impossible de se connecter au serveur pour modifier l'objectif.");
    } finally {
      setSavingTarget(false);
    }
  };

  // Cumulative count per person, from the start of the selected month through the selected
  // week (inclusive) — saved data for other weeks, live local edits for the selected week.
  const cumulativePerPerson = new Map<string, number>();
  for (const w of monthRange.weeks) {
    if (w > selectedWeekNum) break;
    const label = `Semaine ${w}`;
    const recs = label === selectedWeek ? localRecords : gembaData.find(g => g.week === label)?.records;
    if (!recs) continue;
    recs.forEach(r => {
      cumulativePerPerson.set(r.userId, (cumulativePerPerson.get(r.userId) || 0) + (Number(r.count) || 0));
    });
  }

  const totalPeople = localRecords.length;
  const achievedPoints = localRecords.reduce(
    (sum, r) => sum + Math.min(cumulativePerPerson.get(r.userId) || 0, monthlyTarget),
    0
  );
  const cumulativeRate = totalPeople > 0 ? Math.round((achievedPoints / (monthlyTarget * totalPeople)) * 100) : 100;
  const peopleAtTarget = localRecords.filter(r => (cumulativePerPerson.get(r.userId) || 0) >= monthlyTarget).length;
  const peopleBehind = totalPeople - peopleAtTarget;
  const totalGembaThisMonth = Array.from(cumulativePerPerson.values()).reduce((a, b) => a + b, 0);

  // Trend chart: cumulative rate at each recorded week of the selected month
  const chartData = (() => {
    const cum = new Map<string, number>();
    const points: { name: string; 'Cumul Gemba (%)': number }[] = [];
    for (const w of monthRange.weeks) {
      const label = `Semaine ${w}`;
      const saved = gembaData.find(g => g.week === label);
      if (!saved) continue;
      saved.records.forEach(r => cum.set(r.userId, (cum.get(r.userId) || 0) + (Number(r.count) || 0)));
      const total = saved.records.length;
      const achieved = saved.records.reduce((sum, r) => sum + Math.min(cum.get(r.userId) || 0, monthlyTarget), 0);
      const rate = total > 0 ? Math.round((achieved / (monthlyTarget * total)) * 100) : 100;
      points.push({ name: label, 'Cumul Gemba (%)': rate });
    }
    return points;
  })();

  const isModified = () => JSON.stringify(baselineRecords) !== JSON.stringify(localRecords);
  const targetIsModified = Number(targetInput) !== monthlyTarget && !isNaN(Number(targetInput)) && Number(targetInput) > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden" id="gemba-tracker-root">

      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 rounded-md">
              <Footprints className="w-5 h-5" />
            </span>
            <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white uppercase tracking-tight">
              Suivi Gemba HSE
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Suivez les Gemba Walks hebdomadaires par personne et injectez automatiquement le taux cumulé mensuel dans le KPI SQCDP.
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
              {monthRange.weeks.map(w => (
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
                className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-50"
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

            {/* Cumulative rate gauge */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cumul Mensuel - {selectedWeek}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-display font-extrabold text-slate-900 dark:text-white">
                    {cumulativeRate}%
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">/ 100% Cible</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  {cumulativeRate >= 100 ? (
                    <span className="text-emerald-600 font-bold">● Objectif Atteint (100%)</span>
                  ) : cumulativeRate >= 70 ? (
                    <span className="text-amber-600 font-bold">● Vigilance (70-99%)</span>
                  ) : (
                    <span className="text-rose-600 font-bold">● Alerte (&lt;70%)</span>
                  )}
                </div>
              </div>

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
                      cumulativeRate >= 100 ? 'text-emerald-500' : cumulativeRate >= 70 ? 'text-amber-500' : 'text-rose-500'
                    }
                    strokeDasharray={`${Math.min(cumulativeRate, 100)}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-extrabold text-slate-850 dark:text-slate-200">
                  {cumulativeRate}%
                </div>
              </div>
            </div>

            {/* Breakdown counters */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                Bilan du Mois — {MONTH_WEEK_RANGES[selectedMonthIndex].name} {CURRENT_YEAR}
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block">À l'objectif</span>
                  <span className="text-xl font-display font-black text-emerald-900 dark:text-emerald-300 mt-1 block">
                    {peopleAtTarget}
                  </span>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block">En retard</span>
                  <span className="text-xl font-display font-black text-rose-900 dark:text-rose-300 mt-1 block">
                    {peopleBehind}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block">Total Gemba</span>
                  <span className="text-xl font-display font-black text-slate-800 dark:text-slate-200 mt-1 block">
                    {totalGembaThisMonth}
                  </span>
                </div>
              </div>

              {/* Configurable monthly objective */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Objectif mensuel :</span>
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-12 text-center py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-[10px] text-slate-400">Gemba / personne / mois</span>
                {targetIsModified && (
                  <button
                    onClick={handleSaveTarget}
                    disabled={savingTarget}
                    className="ml-auto flex items-center gap-1 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-all disabled:opacity-50"
                  >
                    <Pencil className="w-3 h-3" />
                    Modifier
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Historical trend chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs lg:col-span-2 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tendance Cumulée - Gemba HSE ({MONTH_WEEK_RANGES[selectedMonthIndex].name} {CURRENT_YEAR})
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Le taux ne peut que progresser (ou stagner) au fil des semaines du mois — jamais redescendre.
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-rose-500" />
            </div>

            <div className="h-28 w-full mt-2 font-mono text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gembaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Cumul Gemba (%)"
                    stroke="#e11d48"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gembaGrad)"
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
              Règle métier : le cumul se construit semaine après semaine dans le mois — une semaine à 0 Gemba ne fait pas régresser le taux déjà acquis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Add a participant to this week's roster only */}
            {(() => {
              const availableToAdd = users.filter(u => !localRecords.some(r => r.userId === u.id));
              if (availableToAdd.length === 0) return null;
              return (
                <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg px-2 py-1">
                  <UserPlus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) handleAddParticipant(e.target.value); }}
                    className="bg-transparent border-none text-xs font-bold text-rose-800 dark:text-rose-300 focus:outline-none cursor-pointer max-w-40"
                    title="Ajouter un participant pour cette semaine"
                  >
                    <option value="" disabled>Ajouter un participant…</option>
                    {availableToAdd.map(u => (
                      <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900 font-sans font-medium">
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            <button
              onClick={handleResetToZero}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tout à 0</span>
            </button>

            <button
              onClick={handleCopyPreviousWeek}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
              title="Copier les compteurs de la semaine précédente"
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

        {/* Gemba Matrix Grid Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse" id="gemba-matrix-table">

            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-6">Participant</th>
                <th className="py-3 px-4">Fonction / Rôle</th>
                <th className="py-3 px-4">Département</th>
                <th className="py-3 px-4 text-center w-36">Gemba - {selectedWeek}</th>
                <th className="py-3 px-4 text-center w-44">Cumul du Mois</th>
                <th className="py-3 px-4 text-center w-16">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs">
              {localRecords.map(rec => {
                const user = users.find(u => u.id === rec.userId);
                const initial = rec.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const cumulative = cumulativePerPerson.get(rec.userId) || 0;
                const personRate = monthlyTarget > 0 ? Math.round((Math.min(cumulative, monthlyTarget) / monthlyTarget) * 100) : 100;

                return (
                  <tr key={rec.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all">

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

                    <td className="py-3 px-4 font-medium text-slate-750 dark:text-slate-350">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold text-[10px]">
                        {rec.userRole}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-450 dark:text-slate-500 font-medium">
                      {rec.userDepartment}
                    </td>

                    {/* This week's count */}
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="text"
                        value={rec.count}
                        onChange={(e) => handleCountChange(rec.userId, e.target.value)}
                        className="w-16 text-center py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </td>

                    {/* Cumulative vs objective this month */}
                    <td className="py-2.5 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono font-bold text-[11px] text-slate-600 dark:text-slate-300">
                          {cumulative} / {monthlyTarget} ({personRate}%)
                        </span>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${personRate >= 100 ? 'bg-emerald-500' : personRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(personRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(rec.userId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-lg transition-all"
                        title="Retirer ce participant pour cette semaine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <span>Le taux cumulé mensuel alimente directement le KPI "Suivi de Gemba HSE".</span>
        </div>
        <div className="font-mono text-[10px]">
          Fait à Sousse, Tunisie - Officeplast Quality System
        </div>
      </div>

    </div>
  );
}
