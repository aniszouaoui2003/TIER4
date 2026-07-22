/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  User as UserIcon,
  Info,
  Layers,
  Grid,
  Cpu,
  ArrowUp,
  ArrowDown,
  Minus,
  CalendarRange,
  Factory,
  Sigma
} from 'lucide-react';
import { KPI, KPIStatus, User } from '../types';

interface KPITeamGuruEntryProps {
  kpis: KPI[];
  onUpdateKPI: (id: string, updated: Partial<KPI>) => Promise<void>;
  currentUser: User;
}

type RowType = 'total' | 'site1' | 'site2';
type HistoryField = 'history' | 'site1History' | 'site2History';

const CATEGORY_BADGES: Record<string, string> = {
  'Sécurité': 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/40',
  'Qualité': 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/40',
  'Production': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/40',
  'Coût': 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800',
  'Livraison': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/40',
  'RH': 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900/40',
  'Maintenance': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/40',
  '5S': 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/40',
  'Environnement': 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/40'
};

const FORMULA_KPI_IDS = [
  'kpi-qual-conformite',
  'kpi-prod-productivite',
  'kpi-cost-ratio',
  'kpi-cost-valeur-produite',
  'kpi-cost-taux-dechet',
  'kpi-rh-presence'
];

export default function KPITeamGuruEntry({
  kpis,
  onUpdateKPI,
  currentUser
}: KPITeamGuruEntryProps) {
  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyMine, setOnlyMine] = useState<boolean>(false);

  // Annual period axis: monthly rollup (read-only) or weekly detail (editable)
  const [periodMode, setPeriodMode] = useState<'monthly' | 'weekly'>('monthly');
  // Whether to expand each KPI into its Site 1 / Site 2 editable sub-rows
  const [showSiteRows, setShowSiteRows] = useState<boolean>(true);

  // Local state to store edits before saving
  // Map of kpiId -> KPI edits
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<KPI>>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // The app's mock "today" sits in Semaine 26 (late June) of the current exercise year
  const CURRENT_YEAR = 2026;
  const CURRENT_WEEK = 26;

  // 52-week annual axis, grouped into 12 months (4 or 5 weeks each, summing to 52)
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
  const currentMonthIndex = MONTH_WEEK_RANGES.findIndex(m => m.weeks.includes(CURRENT_WEEK));
  const allWeeks = Array.from({ length: 52 }, (_, i) => i + 1);

  // Categories list
  const categories = [
    'Tous',
    'Sécurité',
    'Qualité',
    'Production',
    'Coût',
    'Livraison',
    'RH',
    'Maintenance',
    '5S',
    'Environnement'
  ];

  // Sync edits reset when KPIs from parent change
  useEffect(() => {
    setLocalEdits({});
  }, [kpis]);

  // Helper to determine whether a lower value is the desirable direction for this metric
  const isLowerBetterMetric = (kpiName: string, category: string): boolean => {
    const name = kpiName.toLowerCase();
    return (
      category === 'Sécurité' ||
      name.includes('accidents') ||
      name.includes('ppm') ||
      name.includes('retard') ||
      name.includes('accident') ||
      name.includes('panne') ||
      name.includes('absentéisme') ||
      name.includes('déchet') ||
      name.includes('consommation') ||
      name.includes('électricité') ||
      name.includes('eau')
    );
  };

  // Helper to determine status color dynamically for input cell backgrounds
  const evaluateStatus = (value: number, target: number, kpiName: string, category: string): KPIStatus => {
    const isLowerBetter = isLowerBetterMetric(kpiName, category);

    if (isLowerBetter) {
      if (value <= target) return 'Green';
      if (value <= target * 1.15) return 'Orange';
      return 'Red';
    } else {
      if (value >= target) return 'Green';
      if (value >= target * 0.9) return 'Orange';
      return 'Red';
    }
  };

  // Cell color classes based on evaluated status
  const getCellColorClass = (status: KPIStatus) => {
    switch (status) {
      case 'Green':
        return 'bg-emerald-50 text-emerald-950 border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/40';
      case 'Orange':
        return 'bg-amber-50 text-amber-950 border-amber-200 focus:ring-amber-500 focus:border-amber-500 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40';
      case 'Red':
        return 'bg-rose-50 text-rose-950 border-rose-200 focus:ring-rose-500 focus:border-rose-500 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/40';
      default:
        return 'bg-slate-50 dark:bg-slate-800';
    }
  };

  // Get live value of any field, looking at local edits first, then actual database values
  const getLiveVal = (kpiId: string, field: 'weeklyValue' | 'dailyValue' | 'site1Value' | 'site2Value'): number => {
    const k = kpis.find(item => item.id === kpiId);
    if (!k) return 0;
    const edits = localEdits[kpiId] || {};
    return edits[field] !== undefined ? Number(edits[field]) : (k[field] ?? 0);
  };

  // Older persisted KPI records predate site1History/site2History and only ever carried a
  // current-week snapshot (site1Value/site2Value). Treat that snapshot as an implicit
  // "Semaine {CURRENT_WEEK}" entry so those rows don't appear to have silently lost their data.
  const getSnapshotFallback = (k: KPI, date: string, field: HistoryField): number | undefined => {
    if (date !== `Semaine ${CURRENT_WEEK}`) return undefined;
    const edits = localEdits[k.id] || {};
    if (field === 'site1History') return (edits.site1Value ?? k.site1Value) as number | undefined;
    if (field === 'site2History') return (edits.site2Value ?? k.site2Value) as number | undefined;
    return undefined;
  };

  // Reads a single history entry (from any of the 3 history arrays), local edits first
  const getLiveHistoryVal = (kpiId: string, date: string, field: HistoryField = 'history'): number => {
    const k = kpis.find(item => item.id === kpiId);
    if (!k) return 0;
    const edits = localEdits[kpiId] || {};
    const editHist = (edits as any)[field] as { date: string; value: number }[] | undefined;
    const localHist = editHist?.find(h => h.date === date);
    if (localHist) return Number(localHist.value);
    const origHist = ((k as any)[field] as { date: string; value: number }[] | undefined) || [];
    const orig = origHist.find(h => h.date === date);
    if (orig) return Number(orig.value);
    return getSnapshotFallback(k, date, field) ?? 0;
  };

  // Whether a given week of the exercise year has ever been reported on that history field
  const hasWeekData = (kpiId: string, week: number, field: HistoryField = 'history'): boolean => {
    const k = kpis.find(item => item.id === kpiId);
    if (!k) return false;
    const label = `Semaine ${week}`;
    const edits = localEdits[kpiId] || {};
    const editHist = (edits as any)[field] as { date: string; value: number }[] | undefined;
    if (editHist?.some(h => h.date === label)) return true;
    const origHist = ((k as any)[field] as { date: string; value: number }[] | undefined) || [];
    if (origHist.some(h => h.date === label)) return true;
    return getSnapshotFallback(k, label, field) !== undefined;
  };

  // Resolves the value shown on a given grid row (total / site1 / site2) for a specific week.
  // The "total" row of a site-tracked KPI is never read from `history` directly — it's always
  // the live sum of its site rows, so the two can never silently drift apart.
  const getRowWeekValue = (k: KPI, rowType: RowType, week: number): number | null => {
    const siteTracked = !!(k.site1Checked || k.site2Checked);
    if (rowType === 'total' && siteTracked) {
      const has1 = k.site1Checked && hasWeekData(k.id, week, 'site1History');
      const has2 = k.site2Checked && hasWeekData(k.id, week, 'site2History');
      if (!has1 && !has2) return null;
      const v1 = has1 ? getLiveHistoryVal(k.id, `Semaine ${week}`, 'site1History') : 0;
      const v2 = has2 ? getLiveHistoryVal(k.id, `Semaine ${week}`, 'site2History') : 0;
      return Number((v1 + v2).toFixed(2));
    }
    const field: HistoryField = rowType === 'site1' ? 'site1History' : rowType === 'site2' ? 'site2History' : 'history';
    if (!hasWeekData(k.id, week, field)) return null;
    return getLiveHistoryVal(k.id, `Semaine ${week}`, field);
  };

  // Monthly rollup = average of the reported weeks that fall within that month; null if none reported
  const getMonthAggregate = (monthRange: { weeks: number[] }, getWeekVal: (w: number) => number | null): number | null => {
    const vals = monthRange.weeks.map(getWeekVal).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  // Value-to-date = average of all reported weeks so far this year
  const getVTD = (getWeekVal: (w: number) => number | null): number | null => {
    const vals = allWeeks.map(getWeekVal).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  // Most recent reported week strictly before `week`, or null if none
  const getPrevWeekValue = (week: number, getWeekVal: (w: number) => number | null): number | null => {
    for (let w = week - 1; w >= 1; w--) {
      const v = getWeekVal(w);
      if (v !== null) return v;
    }
    return null;
  };

  // Most recent month with a reported rollup strictly before `monthIndex`, or null if none
  const getPrevMonthAggregate = (monthIndex: number, getWeekVal: (w: number) => number | null): number | null => {
    for (let m = monthIndex - 1; m >= 0; m--) {
      const agg = getMonthAggregate(MONTH_WEEK_RANGES[m], getWeekVal);
      if (agg !== null) return agg;
    }
    return null;
  };

  // Small directional indicator comparing a period's value to the prior reported period
  const getTrendIcon = (current: number, previous: number | null, isLowerBetter: boolean) => {
    if (previous === null || current === previous) {
      return <Minus className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />;
    }
    const improved = isLowerBetter ? current < previous : current > previous;
    return improved
      ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
      : <ArrowDown className="w-2.5 h-2.5 text-rose-500" />;
  };

  // Get live value of any field, looking at local edits first, then actual database values
  const getLiveKPI = (kpi: KPI): KPI => {
    if (kpi.id === 'kpi-qual-conformite') {
      const pcW = getLiveVal('kpi-qual-pc', 'weeklyValue');
      const nc1W = getLiveVal('kpi-qual-nc1', 'weeklyValue');
      const nc2W = getLiveVal('kpi-qual-nc2', 'weeklyValue');
      const weeklyValue = pcW > 0 ? Number(Math.max(0, Math.min(100, ((pcW - (nc1W * 2 + nc2W)) / pcW) * 100)).toFixed(1)) : 100;

      const pcD = getLiveVal('kpi-qual-pc', 'dailyValue');
      const nc1D = getLiveVal('kpi-qual-nc1', 'dailyValue');
      const nc2D = getLiveVal('kpi-qual-nc2', 'dailyValue');
      const dailyValue = pcD > 0 ? Number(Math.max(0, Math.min(100, ((pcD - (nc1D * 2 + nc2D)) / pcD) * 100)).toFixed(1)) : 100;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);
      return { ...kpi, weeklyValue, dailyValue, status };
    }

    if (kpi.id === 'kpi-prod-productivite') {
      const qfW = getLiveVal('kpi-prod-qf', 'weeklyValue');
      const qpW = getLiveVal('kpi-prod-qp', 'weeklyValue');
      const weeklyValue = qpW > 0 ? Number(((qfW / qpW) * 100).toFixed(1)) : 100;

      const qfD = getLiveVal('kpi-prod-qf', 'dailyValue');
      const qpD = getLiveVal('kpi-prod-qp', 'dailyValue');
      const dailyValue = qpD > 0 ? Number(((qfD / qpD) * 100).toFixed(1)) : 100;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);
      return { ...kpi, weeklyValue, dailyValue, status };
    }

    if (kpi.id === 'kpi-cost-ratio') {
      const rfW = getLiveVal('kpi-cost-rf', 'weeklyValue');
      const rpW = getLiveVal('kpi-cost-rp', 'weeklyValue');
      const weeklyValue = rpW > 0 ? Number(((rfW / rpW) * 100).toFixed(1)) : 100;

      const rfD = getLiveVal('kpi-cost-rf', 'dailyValue');
      const rpD = getLiveVal('kpi-cost-rp', 'dailyValue');
      const dailyValue = rpD > 0 ? Number(((rfD / rpD) * 100).toFixed(1)) : 100;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);
      return { ...kpi, weeklyValue, dailyValue, status };
    }

    if (kpi.id === 'kpi-cost-valeur-produite') {
      const rfW = getLiveVal('kpi-cost-rf', 'weeklyValue');
      const rfD = getLiveVal('kpi-cost-rf', 'dailyValue');
      const weeklyValue = rfW;
      const dailyValue = rfD;
      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);
      return { ...kpi, weeklyValue, dailyValue, status };
    }

    if (kpi.id === 'kpi-cost-taux-dechet') {
      const vdW = getLiveVal('kpi-cost-valeur-dechet', 'weeklyValue');
      const vpW = getLiveVal('kpi-cost-valeur-produite', 'weeklyValue');
      const weeklyValue = vpW > 0 ? Number(((vdW / vpW) * 100).toFixed(2)) : 0;

      const vdD = getLiveVal('kpi-cost-valeur-dechet', 'dailyValue');
      const vpD = getLiveVal('kpi-cost-valeur-produite', 'dailyValue');
      const dailyValue = vpD > 0 ? Number(((vdD / vpD) * 100).toFixed(2)) : 0;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);
      return { ...kpi, weeklyValue, dailyValue, status };
    }

    const edits = localEdits[kpi.id] || {};
    return { ...kpi, ...edits };
  };

  // Handle cell text-input changes for main parameters (currently: Target)
  const handleCellChange = (kpiId: string, field: keyof KPI, valStr: string) => {
    const numValue = valStr === '' ? 0 : Number(valStr);
    if (isNaN(numValue)) return;

    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const currentEdits = { ...(localEdits[kpiId] || {}) };
    (currentEdits as any)[field] = numValue;

    if (field === 'target') {
      const currentWeekly = currentEdits.weeklyValue ?? kpi.weeklyValue;
      currentEdits.status = evaluateStatus(currentWeekly, numValue, kpi.name, kpi.category);
    }

    setLocalEdits(prev => ({ ...prev, [kpiId]: currentEdits }));
  };

  // Handle changes for a Total-row week input (only reachable for non-site-tracked KPIs)
  const handleHistoryChange = (kpiId: string, date: string, valStr: string) => {
    const numValue = valStr === '' ? 0 : Number(valStr);
    if (isNaN(numValue)) return;

    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const currentEdits = { ...(localEdits[kpiId] || {}) };
    const history = [...(currentEdits.history || kpi.history)];

    const idx = history.findIndex(h => h.date === date);
    if (idx !== -1) history[idx] = { ...history[idx], value: numValue };
    else history.push({ date, value: numValue });
    currentEdits.history = history;

    // If we're updating the current week, keep the main snapshot fields in sync
    if (date === `Semaine ${CURRENT_WEEK}`) {
      currentEdits.weeklyValue = numValue;
      currentEdits.status = evaluateStatus(numValue, currentEdits.target ?? kpi.target, kpi.name, kpi.category);
    }

    setLocalEdits(prev => ({ ...prev, [kpiId]: currentEdits }));
  };

  // Handle changes for a Site 1 / Site 2 row week input. The parent KPI's Total (`history`) for
  // that same week is recomputed as the live sum of both sites, so it never needs manual entry.
  const handleSiteHistoryChange = (kpiId: string, site: 'site1' | 'site2', date: string, valStr: string) => {
    const numValue = valStr === '' ? 0 : Number(valStr);
    if (isNaN(numValue)) return;

    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const field: 'site1History' | 'site2History' = site === 'site1' ? 'site1History' : 'site2History';
    const otherField: 'site1History' | 'site2History' = site === 'site1' ? 'site2History' : 'site1History';

    const currentEdits = { ...(localEdits[kpiId] || {}) };
    const siteHistory = [...(((currentEdits as any)[field] as { date: string; value: number }[] | undefined) || (kpi as any)[field] || [])];

    const idx = siteHistory.findIndex(h => h.date === date);
    if (idx !== -1) siteHistory[idx] = { ...siteHistory[idx], value: numValue };
    else siteHistory.push({ date, value: numValue });
    (currentEdits as any)[field] = siteHistory;

    // Recompute the combined total for this date from both sites' live values
    const otherHistory = (((currentEdits as any)[otherField] as { date: string; value: number }[] | undefined) || (kpi as any)[otherField] || []);
    const otherHasSite = site === 'site1' ? kpi.site2Checked : kpi.site1Checked;
    const otherVal = otherHasSite ? (otherHistory.find((h: any) => h.date === date)?.value ?? 0) : 0;
    const totalForDate = Number((numValue + otherVal).toFixed(2));

    const totalHistory = [...(currentEdits.history || kpi.history)];
    const tIdx = totalHistory.findIndex(h => h.date === date);
    if (tIdx !== -1) totalHistory[tIdx] = { ...totalHistory[tIdx], value: totalForDate };
    else totalHistory.push({ date, value: totalForDate });
    currentEdits.history = totalHistory;

    // Keep the "current week" snapshot fields in sync, same as the rest of the app expects
    if (date === `Semaine ${CURRENT_WEEK}`) {
      (currentEdits as any)[site === 'site1' ? 'site1Value' : 'site2Value'] = numValue;
      currentEdits.weeklyValue = totalForDate;
      currentEdits.status = evaluateStatus(totalForDate, currentEdits.target ?? kpi.target, kpi.name, kpi.category);
    }

    setLocalEdits(prev => ({ ...prev, [kpiId]: currentEdits }));
  };

  // Perform bulk saving
  const handleSaveAll = async () => {
    const modifiedIds = Object.keys(localEdits);
    if (modifiedIds.length === 0) return;

    setSaving(true);
    try {
      await Promise.all(
        modifiedIds.map(id => onUpdateKPI(id, localEdits[id]))
      );

      setSuccessMessage(`Félicitations ! Les données de ${modifiedIds.length} indicateur(s) ont été enregistrées avec succès.`);
      setLocalEdits({});

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      alert(`Erreur d'enregistrement : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Discard all changes
  const handleReset = () => {
    if (Object.keys(localEdits).length > 0) {
      if (confirm('Êtes-vous sûr de vouloir annuler toutes les modifications non enregistrées ?')) {
        setLocalEdits({});
      }
    }
  };

  // Autofill the current week with realistic mock values near targets (demonstration helper)
  const handleAutofillMock = () => {
    const filled: Record<string, Partial<KPI>> = {};
    const weekLabel = `Semaine ${CURRENT_WEEK}`;

    kpis.forEach(kpi => {
      const isPresence = kpi.name.toLowerCase().includes('présence');
      const isAccident = kpi.name.toLowerCase().includes('accident');
      const isRetard = kpi.name.toLowerCase().includes('retard') || kpi.name.toLowerCase().includes('actions');
      const isTRS = kpi.name.toLowerCase().includes('trs');

      let val = kpi.target;
      if (isPresence) {
        val = Number((90 + Math.random() * 10).toFixed(1));
      } else if (isAccident) {
        val = Math.random() > 0.85 ? 1 : 0;
      } else if (isRetard) {
        val = Math.floor(Math.random() * 3);
      } else if (isTRS) {
        val = Number((72 + Math.random() * 14).toFixed(1));
      } else {
        const delta = (Math.random() - 0.3) * (kpi.target * 0.1);
        val = Number((kpi.target + delta).toFixed(1));
      }

      const edits: Partial<KPI> = {};
      if (kpi.site1Checked && kpi.site2Checked) {
        const s1 = Number((val * 0.4).toFixed(1));
        const s2 = Number((val * 0.6).toFixed(1));
        edits.site1Value = s1;
        edits.site2Value = s2;
        edits.weeklyValue = Number((s1 + s2).toFixed(1));
        edits.site1History = [{ date: weekLabel, value: s1 }];
        edits.site2History = [{ date: weekLabel, value: s2 }];
      } else {
        edits.weeklyValue = val;
      }

      const simulatedHistory = kpi.history.map(hist => {
        let historyVal = hist.value;
        if (hist.date === weekLabel) {
          historyVal = edits.weeklyValue!;
        } else {
          historyVal = Number((hist.value + (Math.random() - 0.5) * (hist.value * 0.05)).toFixed(1));
        }
        return { ...hist, value: historyVal };
      });
      edits.history = simulatedHistory;
      edits.status = evaluateStatus(edits.weeklyValue!, kpi.target, kpi.name, kpi.category);

      filled[kpi.id] = edits;
    });

    setLocalEdits(filled);
  };

  // Filtered KPIs list
  const filteredKPIs = kpis.filter(kpi => {
    const matchesSearch = kpi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          kpi.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          kpi.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'Tous' || kpi.category === selectedCategory;

    const matchesMine = !onlyMine ||
                        kpi.owner.toLowerCase().includes(currentUser.role.toLowerCase()) ||
                        (kpi.site1Owner && kpi.site1Owner.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                        (kpi.site2Owner && kpi.site2Owner.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                        (kpi.officeplastOwner && kpi.officeplastOwner.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                        kpi.owner.toLowerCase().includes(currentUser.name.toLowerCase());

    return matchesSearch && matchesCategory && matchesMine;
  });

  const modifiedCount = Object.keys(localEdits).length;

  // Renders one grid row: the KPI total, or one of its site sub-rows
  const renderRow = (k: KPI, rowType: RowType, liveK: KPI, isFormula: boolean, isLowerBetterRow: boolean, isModified: boolean, bothSites: boolean) => {
    const getWeekVal = (w: number) => getRowWeekValue(k, rowType, w);
    const vtd = getVTD(getWeekVal);
    // Total is editable only when the KPI isn't formula-derived and isn't summed from two sites
    const editable = rowType === 'total' ? !isFormula && !bothSites : !isFormula;

    const rowLabel = rowType === 'total'
      ? null
      : rowType === 'site1'
        ? { icon: <Factory className="w-3 h-3 text-blue-500 shrink-0" />, text: `Site 1${k.site1Owner ? ` — ${k.site1Owner}` : ''}`, tint: 'bg-blue-50/30 dark:bg-blue-950/10' }
        : { icon: <Factory className="w-3 h-3 text-purple-500 shrink-0" />, text: `Site 2${k.site2Owner ? ` — ${k.site2Owner}` : ''}`, tint: 'bg-purple-50/30 dark:bg-purple-950/10' };

    return (
      <tr
        key={`${k.id}-${rowType}`}
        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all ${
          rowType === 'total' ? '' : `${rowLabel?.tint} text-[11px]`
        } ${isModified ? 'bg-blue-50/20 dark:bg-blue-950/5' : ''} ${
          rowType === 'total' && bothSites ? 'border-t-2 border-slate-200 dark:border-slate-800' : ''
        }`}
      >
        {/* 1. Category Badge */}
        <td className="py-3 px-4 font-medium">
          {rowType === 'total' ? (
            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${CATEGORY_BADGES[k.category] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
              {k.category}
            </span>
          ) : null}
        </td>

        {/* 2. Name & Owner */}
        <td className="py-2.5 px-4">
          {rowType === 'total' ? (
            <>
              <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug flex flex-wrap items-center gap-1.5">
                {bothSites && <Sigma className="w-3 h-3 text-slate-400 shrink-0" title="Total = Site 1 + Site 2" />}
                <span>{k.name}</span>
                {isFormula && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/40 text-[9px] font-bold rounded">
                    <Cpu className="w-2.5 h-2.5 text-blue-500" /> Auto
                  </span>
                )}
                {isModified && (
                  <span className="inline-flex items-center px-1 text-[9px] font-extrabold text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/60 rounded">
                    Modifié
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                <UserIcon className="w-3 h-3 text-blue-500 shrink-0" />
                <span>Fonction : {k.owner}</span>
              </div>
              {k.officeplastOwner && (
                <span className="inline-flex items-center mt-1 px-1.5 py-0.5 text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded font-medium font-mono">
                  HQ : {k.officeplastOwner}
                </span>
              )}
            </>
          ) : (
            <div className="pl-4 flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold">
              <span className="text-slate-300 dark:text-slate-700">↳</span>
              {rowLabel!.icon}
              <span>{rowLabel!.text}</span>
            </div>
          )}
        </td>

        {/* 3. Unit */}
        <td className="py-2.5 px-2 text-center text-slate-400 dark:text-slate-500 font-mono font-bold">
          {rowType === 'total' ? k.unit : ''}
        </td>

        {/* 4. Target (editable only on the Total row) */}
        <td className="py-2.5 px-3 text-center">
          {rowType === 'total' ? (
            <input
              type="text"
              value={liveK.target}
              onChange={(e) => handleCellChange(k.id, 'target', e.target.value)}
              className="w-14 text-center py-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-md font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
            />
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">{liveK.target}</span>
          )}
        </td>

        {/* 5. Value-To-Date summary cell */}
        <td className="py-2.5 px-2 border-l-2 border-slate-300 dark:border-slate-700 text-center bg-slate-50/70 dark:bg-slate-800/30">
          {vtd === null ? (
            <span className="text-[11px] text-slate-300 dark:text-slate-600 font-mono">—</span>
          ) : (
            <div className={`mx-auto px-1.5 py-1 rounded-md border font-mono ${getCellColorClass(evaluateStatus(vtd, liveK.target, k.name, k.category))}`}>
              <div className="text-xs font-extrabold leading-none">{vtd}</div>
              <div className="text-[9px] opacity-60 leading-none mt-0.5">cible {liveK.target}</div>
            </div>
          )}
        </td>

        {/* 6. Annual period columns: monthly rollup (read-only) or weekly detail (editable) */}
        {periodMode === 'monthly' ? (
          MONTH_WEEK_RANGES.map((m, idx) => {
            const agg = getMonthAggregate(m, getWeekVal);
            const prev = getPrevMonthAggregate(idx, getWeekVal);
            const status = agg !== null ? evaluateStatus(agg, liveK.target, k.name, k.category) : null;
            return (
              <td
                key={m.name}
                className={`py-2.5 px-2 border-l border-slate-100 dark:border-slate-800 text-center ${
                  idx === currentMonthIndex ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                }`}
              >
                {agg === null ? (
                  <span className="text-[11px] text-slate-300 dark:text-slate-600 font-mono">—</span>
                ) : (
                  <div className={`mx-auto w-16 flex items-center justify-center gap-1 py-1 rounded-md border font-mono font-bold text-xs ${getCellColorClass(status!)}`}>
                    <span>{agg}</span>
                    {getTrendIcon(agg, prev, isLowerBetterRow)}
                  </div>
                )}
              </td>
            );
          })
        ) : (
          allWeeks.map(w => {
            const val = getWeekVal(w);
            const prev = getPrevWeekValue(w, getWeekVal);
            const status = val !== null ? evaluateStatus(val, liveK.target, k.name, k.category) : null;
            const label = `Semaine ${w}`;

            return (
              <td
                key={w}
                className={`py-2.5 px-2 border-l border-slate-100 dark:border-slate-800 text-center ${
                  w === CURRENT_WEEK ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                }`}
              >
                <div className="relative w-16 mx-auto">
                  <input
                    type="text"
                    value={val ?? ''}
                    placeholder="—"
                    readOnly={!editable}
                    disabled={!editable}
                    onChange={(e) => {
                      if (rowType === 'total') handleHistoryChange(k.id, label, e.target.value);
                      else handleSiteHistoryChange(k.id, rowType, label, e.target.value);
                    }}
                    className={`w-full text-center py-1 border rounded-md font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
                      !editable
                        ? 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-850'
                        : status
                          ? getCellColorClass(status)
                          : 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-300 dark:text-slate-700 border-slate-100 dark:border-slate-850'
                    }`}
                  />
                  {val !== null && (
                    <span className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full">
                      {getTrendIcon(val, prev, isLowerBetterRow)}
                    </span>
                  )}
                </div>
              </td>
            );
          })
        )}
      </tr>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden" id="tg-kpi-root">

      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-md">
              <Grid className="w-5 h-5" />
            </span>
            <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white uppercase tracking-tight">
              Saisie Grid - Matrice TeamGuru
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Grille de saisie matricielle centralisée des indicateurs hebdomadaires SQCDP de l'usine Officeplast.
          </p>
        </div>

        {/* Bulk tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutofillMock}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs font-semibold transition-all"
            title="Simuler des valeurs pour la semaine courante"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simuler Saisie</span>
          </button>

          {modifiedCount > 0 && (
            <>
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Annuler ({modifiedCount})</span>
              </button>

              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Enregistrer Tout ({modifiedCount})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Messages Banner */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-150 dark:border-emerald-900/50 px-6 py-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium">{successMessage}</p>
        </div>
      )}

      {/* Filter Toolbar Panel */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">

        {/* Left filter options */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Quick Badges */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 overflow-x-auto max-w-lg scrollbar-none">
            {categories.slice(0, 6).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
            {selectedCategory !== 'Tous' && !categories.slice(0, 6).includes(selectedCategory) && (
              <span className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs rounded-md">
                {selectedCategory}
              </span>
            )}
          </div>

          {/* Quick toggle filter for "My KPIs" */}
          <button
            onClick={() => setOnlyMine(!onlyMine)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              onlyMine
                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Mes Indicateurs</span>
          </button>
        </div>

        {/* Advanced columns views and search */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Total-only vs. per-site rows toggler */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setShowSiteRows(false)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                !showSiteRows ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Total Usine
            </button>
            <button
              onClick={() => setShowSiteRows(true)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                showSiteRows ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Détail par Site
            </button>
          </div>

          {/* Monthly / Weekly period toggler (TeamGuru-style annual view) */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 ml-1.5 shrink-0" />
            <button
              onClick={() => setPeriodMode('monthly')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                periodMode === 'monthly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setPeriodMode('weekly')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                periodMode === 'weekly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Hebdomadaire
            </button>
            <span className="pr-2.5 text-[10px] font-mono text-slate-400">Exercice {CURRENT_YEAR}</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un KPI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-56"
            />
          </div>
        </div>

      </div>

      {/* Main Matrice Table Area */}
      <div className="flex-1 overflow-auto p-6">

        {filteredKPIs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center max-w-md mx-auto my-12 shadow-sm">
            <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-800 dark:text-slate-200 font-bold text-sm">Aucun KPI ne correspond</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Nous n'avons trouvé aucun indicateur avec vos critères de filtrage actuels. Essayez de réinitialiser vos sélections de catégorie ou votre barre de recherche.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('Tous');
                setSearchQuery('');
                setOnlyMine(false);
              }}
              className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse" id="teamguru-grid-table">

              {/* Table Headers */}
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Catégorie</th>
                  <th className="py-3 px-4 min-w-44">Indicateur & Responsable</th>
                  <th className="py-3 px-2 w-14 text-center">Unité</th>
                  <th className="py-3 px-3 w-16 text-center">Target</th>

                  <th className="py-3 px-2 w-20 text-center border-l-2 border-slate-300 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800/60">
                    VTD
                  </th>

                  {periodMode === 'monthly' ? (
                    MONTH_WEEK_RANGES.map((m, idx) => (
                      <th
                        key={m.name}
                        className={`py-3 px-2 w-20 text-center border-l border-slate-200 dark:border-slate-800 ${
                          idx === currentMonthIndex ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-slate-50/50 dark:bg-slate-800/20'
                        }`}
                      >
                        {m.name} {idx === currentMonthIndex ? '🔥' : ''}
                      </th>
                    ))
                  ) : (
                    allWeeks.map(w => (
                      <th
                        key={w}
                        className={`py-3 px-2 w-16 text-center border-l border-slate-200 dark:border-slate-800 ${
                          w === CURRENT_WEEK ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-slate-50/50 dark:bg-slate-800/20'
                        }`}
                      >
                        S{w} {w === CURRENT_WEEK ? '🔥' : ''}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs" id="teamguru-grid-tbody">
                {filteredKPIs.map(k => {
                  const liveK = getLiveKPI(k);
                  const isModified = !!localEdits[k.id];
                  const isFormula = FORMULA_KPI_IDS.includes(k.id);
                  const isLowerBetterRow = isLowerBetterMetric(k.name, k.category);
                  const bothSites = !!(k.site1Checked && k.site2Checked);

                  const rowTypes: RowType[] = [
                    'total',
                    ...(showSiteRows && k.site1Checked ? (['site1'] as RowType[]) : []),
                    ...(showSiteRows && k.site2Checked ? (['site2'] as RowType[]) : [])
                  ];

                  return (
                    <React.Fragment key={k.id}>
                      {rowTypes.map(rowType => renderRow(k, rowType, liveK, isFormula, isLowerBetterRow, isModified, bothSites))}
                    </React.Fragment>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </div>

      {/* Grid instructions footer */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 shrink-0 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <span>Passez en "Détail par Site" pour saisir Site 1 / Site 2 semaine par semaine — le Total se recalcule automatiquement.</span>
        </div>
        <div className="font-mono text-[10px]">
          Site 1 + Site 2 = Total Automatique
        </div>
      </div>

    </div>
  );
}
