/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  Award,
  Zap,
  Users,
  Wrench,
  CheckSquare,
  Droplet,
  Calendar,
  ShieldAlert,
  CalendarRange
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { KPI, Action, User } from '../types';
import { CURRENT_WEEK, MONTH_WEEK_RANGES, getMonthIndexForWeek } from '../utils/weekCalendar';
import { getWeeklyRowValue, getMonthlyRowValue, evaluateStatus, ALL_WEEKS } from '../utils/kpiExcelData';

interface ModuleDetailProps {
  kpis: KPI[];
  actions: Action[];
  selectedModuleId: string;
  setSelectedModuleId: (id: string) => void;
  currentUser: User;
}

export default function ModuleDetail({
  kpis,
  actions,
  selectedModuleId,
  setSelectedModuleId,
  currentUser
}: ModuleDetailProps) {
  
  // Tab mapping
  const tabs = [
    { id: 'Sécurité', label: 'Sécurité', icon: ShieldAlert, color: 'border-b-2 border-b-emerald-500 text-emerald-600' },
    { id: 'Qualité', label: 'Qualité', icon: Award, color: 'border-b-2 border-b-rose-500 text-rose-600' },
    { id: 'Production', label: 'Production', icon: TrendingUp, color: 'border-b-2 border-b-blue-500 text-blue-600' },
    { id: 'Coût', label: 'Coût', icon: Zap, color: 'border-b-2 border-b-violet-500 text-violet-600' },
    { id: 'Livraison', label: 'Livraison', icon: Calendar, color: 'border-b-2 border-b-amber-500 text-amber-600' },
    { id: 'RH', label: 'RH', icon: Users, color: 'border-b-2 border-b-teal-500 text-teal-600' },
    { id: 'Maintenance', label: 'Maintenance', icon: Wrench, color: 'border-b-2 border-b-orange-500 text-orange-600' },
    { id: '5S', label: '5S', icon: CheckSquare, color: 'border-b-2 border-b-indigo-500 text-indigo-600' },
    { id: 'Environnement', label: 'Environnement', icon: Droplet, color: 'border-b-2 border-b-lime-500 text-lime-600' }
  ];

  const currentModuleKpis = kpis.filter(k => k.category === selectedModuleId);
  const currentModuleActions = actions.filter(a => a.department === selectedModuleId);

  // Period selector: a single week, a month (aggregated like the Saisie KPIs monthly rollup),
  // or a custom week-to-week range. Drives both the KPI cards' displayed value and the trend
  // chart's x-axis/range, using the exact same value logic as Saisie KPIs (getWeeklyRowValue /
  // getMonthlyRowValue — the site-tracked KPIs' Total is always the live sum of Site 1 + Site 2)
  // so a card here can never disagree with the grid it's sourced from.
  const [periodMode, setPeriodMode] = React.useState<'week' | 'month' | 'range'>('week');
  const [selectedWeek, setSelectedWeek] = React.useState<number>(CURRENT_WEEK);
  const [selectedMonthIndex, setSelectedMonthIndex] = React.useState<number>(Math.max(0, getMonthIndexForWeek(CURRENT_WEEK)));
  const [rangeStart, setRangeStart] = React.useState<number>(Math.max(1, CURRENT_WEEK - 4));
  const [rangeEnd, setRangeEnd] = React.useState<number>(CURRENT_WEEK);

  // The weeks that actually have at least one real value in this module, so the chart never
  // spans all 52 weeks of empty cells just because week 52 exists.
  const weeksWithData = React.useMemo(() => {
    const set = new Set<number>();
    currentModuleKpis.forEach(k => {
      ALL_WEEKS.forEach(w => {
        if (getWeeklyRowValue(k, 'total', w) !== null) set.add(w);
      });
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [currentModuleKpis]);

  // Card value for the selected period: the week's value, the month's aggregate, or the
  // average across the chosen week range.
  const getCardValue = (k: KPI): number | null => {
    if (periodMode === 'week') return getWeeklyRowValue(k, 'total', selectedWeek);
    if (periodMode === 'month') return getMonthlyRowValue(k, 'total', selectedMonthIndex);
    const vals: number[] = [];
    for (let w = Math.min(rangeStart, rangeEnd); w <= Math.max(rangeStart, rangeEnd); w++) {
      const v = getWeeklyRowValue(k, 'total', w);
      if (v !== null) vals.push(v);
    }
    return vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
  };

  // Trend chart series: monthly aggregates (12 points) in "Mois" mode, weekly values in "Semaine"
  // mode (all weeks with data) or "Semaine à Semaine" mode (only the chosen range).
  const trendChartData = React.useMemo(() => {
    if (periodMode === 'month') {
      return MONTH_WEEK_RANGES.map((m, idx) => {
        const point: Record<string, string | number> = { date: m.name };
        currentModuleKpis.forEach(k => {
          const v = getMonthlyRowValue(k, 'total', idx);
          if (v !== null) point[k.name] = v;
        });
        return point;
      });
    }

    const lo = periodMode === 'range' ? Math.min(rangeStart, rangeEnd) : 1;
    const hi = periodMode === 'range' ? Math.max(rangeStart, rangeEnd) : 52;
    return weeksWithData
      .filter(w => w >= lo && w <= hi)
      .map(w => {
        const point: Record<string, string | number> = { date: `Semaine ${w}` };
        currentModuleKpis.forEach(k => {
          const v = getWeeklyRowValue(k, 'total', w);
          if (v !== null) point[k.name] = v;
        });
        return point;
      });
  }, [currentModuleKpis, periodMode, rangeStart, rangeEnd, weeksWithData]);

  const TREND_COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'Green': return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400';
      case 'Orange': return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400';
      case 'Red': return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* 1. MODULE SUB-TABS SELECTOR */}
      <div className="border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1 min-w-[700px]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = selectedModuleId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedModuleId(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  isSelected
                    ? tab.color
                    : 'border-b-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white hover:border-b-slate-200 dark:hover:border-b-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. HEADER DETAILS OF CHOSEN MODULE */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
            Focus Thématique Métier
          </p>
          <h2 className="text-2xl font-sans font-bold text-slate-900 dark:text-white tracking-tight">
            Analyse Détaillée - {selectedModuleId}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Indicateurs industriels, tendance sur la période choisie et plans d'actions associés
          </p>
        </div>

        {/* Period selector: single week, month, or a custom week-to-week range */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 ml-1.5 shrink-0" />
            {(['week', 'month', 'range'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  periodMode === mode ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                {mode === 'week' ? 'Semaine' : mode === 'month' ? 'Mois' : 'Semaine à Semaine'}
              </button>
            ))}
          </div>

          {periodMode === 'week' && (
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              {ALL_WEEKS.map(w => (
                <option key={w} value={w}>Semaine {w}{w === CURRENT_WEEK ? ' (actuelle)' : ''}</option>
              ))}
            </select>
          )}

          {periodMode === 'month' && (
            <select
              value={selectedMonthIndex}
              onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              {MONTH_WEEK_RANGES.map((m, idx) => (
                <option key={m.name} value={idx}>{m.name}</option>
              ))}
            </select>
          )}

          {periodMode === 'range' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">De</span>
              <select
                value={rangeStart}
                onChange={(e) => setRangeStart(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {ALL_WEEKS.map(w => (
                  <option key={w} value={w}>S{w}</option>
                ))}
              </select>
              <span className="text-slate-400">à</span>
              <select
                value={rangeEnd}
                onChange={(e) => setRangeEnd(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {ALL_WEEKS.map(w => (
                  <option key={w} value={w}>S{w}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. DYNAMIC METRICS SUMMARY GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {currentModuleKpis.length === 0 ? (
          <div className="md:col-span-3 bento-card p-5 text-center text-slate-400 text-xs font-mono">
            Aucun indicateur de performance (KPI) répertorié pour le module [{selectedModuleId}].
          </div>
        ) : (
          currentModuleKpis.map(k => {
            const periodValue = getCardValue(k);
            const periodStatus = periodValue !== null ? evaluateStatus(periodValue, k.target, k.name, k.category) : k.status;
            return (
              <div key={k.id} className="bento-card p-5 flex flex-col justify-between h-[150px] hover:scale-[1.01] transition-transform duration-300">
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Pilote : {k.owner}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold font-mono ${getStatusColorClass(periodStatus)}`}>
                      {periodStatus}
                    </span>
                  </div>
                  <h4 className="text-sm font-display font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight" title={k.name}>{k.name}</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed" title={k.description}>
                    {k.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-baseline">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">{periodValue ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">{k.unit}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium font-mono">
                    Cible : <strong className="text-slate-700 dark:text-slate-200">{k.target} {k.unit}</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. MODULAR CHART COMPONENT WRAPPERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* CHART PORTLET — real weekly history from the KPIs entered in Saisie KPIs for this
            module, one line per KPI. No fabricated or mislabeled data: what's plotted is exactly
            what was saisi, named after the actual KPI it comes from. */}
        <div className="bento-card p-5 lg:col-span-7 flex flex-col h-[350px]">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 font-mono">
            Tendance {periodMode === 'month' ? 'Mensuelle' : 'Hebdomadaire'} — {selectedModuleId}
          </h3>
          <div className="flex-1 min-h-0 text-xs">
            {trendChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-center px-6">
                Aucune donnée saisie pour les indicateurs du module [{selectedModuleId}]{periodMode === 'range' ? ` entre les semaines ${Math.min(rangeStart, rangeEnd)} et ${Math.max(rangeStart, rangeEnd)}` : ''}.
                <br />Renseignez-les dans l'onglet Saisie KPIs pour voir apparaître la tendance ici.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <Tooltip />
                  <Legend />
                  {currentModuleKpis.map((k, i) => (
                    <Line
                      key={k.id}
                      name={k.name}
                      dataKey={k.name}
                      stroke={TREND_COLORS[i % TREND_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* COMPLEMENTARY WIDGET (5 cols): open corrective actions for this module — real data,
            same widget for every module (no fabricated stock photos or fictional operator
            competence matrix). */}
        <div className="bento-card p-5 lg:col-span-5 flex flex-col h-[350px]">
          <div className="flex flex-col h-full space-y-3 text-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest">
              Actions associées ouvertes ({currentModuleActions.filter(a => a.status !== 'Clôturé').length})
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {currentModuleActions.filter(a => a.status !== 'Clôturé').length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                  Aucune action en cours pour la thématique [{selectedModuleId}].
                </div>
              ) : (
                currentModuleActions.filter(a => a.status !== 'Clôturé').map(act => (
                  <div key={act.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:bg-slate-100/50">
                    <div className="min-w-0 flex-1 pr-3">
                      <span className="font-mono text-[9px] font-bold text-blue-600 dark:text-blue-400">{act.autoNum}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{act.subject}</p>
                      <p className="text-[10px] text-slate-400">Responsable : <strong>{act.owner}</strong></p>
                    </div>
                    <span className="text-[10px] font-bold font-mono bg-white dark:bg-slate-900 border px-1.5 py-0.5 rounded shrink-0 shadow-xs">
                      {act.completionPercentage}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
