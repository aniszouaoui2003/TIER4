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
  Filter,
  CheckCircle2,
  User as UserIcon,
  Building,
  Table,
  Info,
  Layers,
  FileSpreadsheet,
  Grid,
  Cpu,
  ArrowUp,
  ArrowDown,
  Minus,
  CalendarRange
} from 'lucide-react';
import { KPI, KPIStatus, User } from '../types';

interface KPITeamGuruEntryProps {
  kpis: KPI[];
  onUpdateKPI: (id: string, updated: Partial<KPI>) => Promise<void>;
  currentUser: User;
}

export default function KPITeamGuruEntry({
  kpis,
  onUpdateKPI,
  currentUser
}: KPITeamGuruEntryProps) {
  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [selectedOwner, setSelectedOwner] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyMine, setOnlyMine] = useState<boolean>(false);

  // Grid view configuration
  const [viewMode, setViewMode] = useState<'weeks' | 'sites' | 'both'>('both');
  // Annual period axis: monthly rollup (read-only) or weekly detail (editable)
  const [periodMode, setPeriodMode] = useState<'monthly' | 'weekly'>('monthly');

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

  // List of owners
  const owners = ['Tous', ...Array.from(new Set(kpis.map(k => k.owner)))];

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

  const getLiveHistoryVal = (kpiId: string, date: string): number => {
    const k = kpis.find(item => item.id === kpiId);
    if (!k) return 0;
    const edits = localEdits[kpiId] || {};
    const localHist = edits.history?.find(h => h.date === date);
    if (localHist) return Number(localHist.value);
    const origHist = k.history.find(h => h.date === date);
    return origHist ? Number(origHist.value) : 0;
  };

  // Whether a given week of the exercise year has ever been reported (vs. genuinely unreported/blank)
  const hasWeekData = (kpiId: string, week: number): boolean => {
    const k = kpis.find(item => item.id === kpiId);
    if (!k) return false;
    const label = `Semaine ${week}`;
    const edits = localEdits[kpiId] || {};
    if (edits.history?.some(h => h.date === label)) return true;
    return k.history.some(h => h.date === label);
  };

  // Monthly rollup = average of the reported weeks that fall within that month; null if none reported
  const getMonthAggregate = (kpiId: string, monthRange: { weeks: number[] }): number | null => {
    const vals = monthRange.weeks.filter(w => hasWeekData(kpiId, w)).map(w => getLiveHistoryVal(kpiId, `Semaine ${w}`));
    if (vals.length === 0) return null;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  // Value-to-date = average of all reported weeks so far this year
  const getVTD = (kpiId: string): number | null => {
    const vals = allWeeks.filter(w => hasWeekData(kpiId, w)).map(w => getLiveHistoryVal(kpiId, `Semaine ${w}`));
    if (vals.length === 0) return null;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  // Most recent reported week strictly before `week`, or null if none
  const getPrevWeekValue = (kpiId: string, week: number): number | null => {
    for (let w = week - 1; w >= 1; w--) {
      if (hasWeekData(kpiId, w)) return getLiveHistoryVal(kpiId, `Semaine ${w}`);
    }
    return null;
  };

  // Most recent month with a reported rollup strictly before `monthIndex`, or null if none
  const getPrevMonthAggregate = (kpiId: string, monthIndex: number): number | null => {
    for (let m = monthIndex - 1; m >= 0; m--) {
      const agg = getMonthAggregate(kpiId, MONTH_WEEK_RANGES[m]);
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

      const pcS1 = getLiveVal('kpi-qual-pc', 'site1Value');
      const nc1S1 = getLiveVal('kpi-qual-nc1', 'site1Value');
      const nc2S1 = getLiveVal('kpi-qual-nc2', 'site1Value');
      const site1Value = pcS1 > 0 ? Number(Math.max(0, Math.min(100, ((pcS1 - (nc1S1 * 2 + nc2S1)) / pcS1) * 100)).toFixed(1)) : 100;

      const pcS2 = getLiveVal('kpi-qual-pc', 'site2Value');
      const nc1S2 = getLiveVal('kpi-qual-nc1', 'site2Value');
      const nc2S2 = getLiveVal('kpi-qual-nc2', 'site2Value');
      const site2Value = pcS2 > 0 ? Number(Math.max(0, Math.min(100, ((pcS2 - (nc1S2 * 2 + nc2S2)) / pcS2) * 100)).toFixed(1)) : 100;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);

      const history = kpi.history.map(hist => {
        const pcH = getLiveHistoryVal('kpi-qual-pc', hist.date);
        const nc1H = getLiveHistoryVal('kpi-qual-nc1', hist.date);
        const nc2H = getLiveHistoryVal('kpi-qual-nc2', hist.date);
        const valH = pcH > 0 ? Number(Math.max(0, Math.min(100, ((pcH - (nc1H * 2 + nc2H)) / pcH) * 100)).toFixed(1)) : 100;
        return { ...hist, value: valH };
      });

      return { ...kpi, weeklyValue, dailyValue, site1Value, site2Value, status, history };
    }

    if (kpi.id === 'kpi-prod-productivite') {
      const qfW = getLiveVal('kpi-prod-qf', 'weeklyValue');
      const qpW = getLiveVal('kpi-prod-qp', 'weeklyValue');
      const weeklyValue = qpW > 0 ? Number(((qfW / qpW) * 100).toFixed(1)) : 100;

      const qfD = getLiveVal('kpi-prod-qf', 'dailyValue');
      const qpD = getLiveVal('kpi-prod-qp', 'dailyValue');
      const dailyValue = qpD > 0 ? Number(((qfD / qpD) * 100).toFixed(1)) : 100;

      const qfS1 = getLiveVal('kpi-prod-qf', 'site1Value');
      const qpS1 = getLiveVal('kpi-prod-qp', 'site1Value');
      const site1Value = qpS1 > 0 ? Number(((qfS1 / qpS1) * 100).toFixed(1)) : 100;

      const qfS2 = getLiveVal('kpi-prod-qf', 'site2Value');
      const qpS2 = getLiveVal('kpi-prod-qp', 'site2Value');
      const site2Value = qpS2 > 0 ? Number(((qfS2 / qpS2) * 100).toFixed(1)) : 100;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);

      const history = kpi.history.map(hist => {
        const qfH = getLiveHistoryVal('kpi-prod-qf', hist.date);
        const qpH = getLiveHistoryVal('kpi-prod-qp', hist.date);
        const valH = qpH > 0 ? Number(((qfH / qpH) * 100).toFixed(1)) : 100;
        return { ...hist, value: valH };
      });

      return { ...kpi, weeklyValue, dailyValue, site1Value, site2Value, status, history };
    }

    if (kpi.id === 'kpi-cost-ratio') {
      const rfW = getLiveVal('kpi-cost-rf', 'weeklyValue');
      const rpW = getLiveVal('kpi-cost-rp', 'weeklyValue');
      const weeklyValue = rpW > 0 ? Number(((rfW / rpW) * 100).toFixed(1)) : 100;

      const rfD = getLiveVal('kpi-cost-rf', 'dailyValue');
      const rpD = getLiveVal('kpi-cost-rp', 'dailyValue');
      const dailyValue = rpD > 0 ? Number(((rfD / rpD) * 100).toFixed(1)) : 100;

      const rfS1 = getLiveVal('kpi-cost-rf', 'site1Value');
      const rpS1 = getLiveVal('kpi-cost-rp', 'site1Value');
      const site1Value = rpS1 > 0 ? Number(((rfS1 / rpS1) * 100).toFixed(1)) : 100;

      const rfS2 = getLiveVal('kpi-cost-rf', 'site2Value');
      const rpS2 = getLiveVal('kpi-cost-rp', 'site2Value');
      const site2Value = rpS2 > 0 ? Number(((rfS2 / rpS2) * 100).toFixed(1)) : 100;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);

      const history = kpi.history.map(hist => {
        const rfH = getLiveHistoryVal('kpi-cost-rf', hist.date);
        const rpH = getLiveHistoryVal('kpi-cost-rp', hist.date);
        const valH = rpH > 0 ? Number(((rfH / rpH) * 100).toFixed(1)) : 100;
        return { ...hist, value: valH };
      });

      return { ...kpi, weeklyValue, dailyValue, site1Value, site2Value, status, history };
    }

    if (kpi.id === 'kpi-cost-valeur-produite') {
      const rfW = getLiveVal('kpi-cost-rf', 'weeklyValue');
      const rfD = getLiveVal('kpi-cost-rf', 'dailyValue');
      const rfS1 = getLiveVal('kpi-cost-rf', 'site1Value');
      const rfS2 = getLiveVal('kpi-cost-rf', 'site2Value');

      const weeklyValue = rfW;
      const dailyValue = rfD;
      const site1Value = rfS1;
      const site2Value = rfS2;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);

      const history = kpi.history.map(hist => {
        const rfH = getLiveHistoryVal('kpi-cost-rf', hist.date);
        return { ...hist, value: rfH };
      });

      return { ...kpi, weeklyValue, dailyValue, site1Value, site2Value, status, history };
    }

    if (kpi.id === 'kpi-cost-taux-dechet') {
      const vdW = getLiveVal('kpi-cost-valeur-dechet', 'weeklyValue');
      const vpW = getLiveVal('kpi-cost-valeur-produite', 'weeklyValue');
      const weeklyValue = vpW > 0 ? Number(((vdW / vpW) * 100).toFixed(2)) : 0;

      const vdD = getLiveVal('kpi-cost-valeur-dechet', 'dailyValue');
      const vpD = getLiveVal('kpi-cost-valeur-produite', 'dailyValue');
      const dailyValue = vpD > 0 ? Number(((vdD / vpD) * 100).toFixed(2)) : 0;

      const vdS1 = getLiveVal('kpi-cost-valeur-dechet', 'site1Value');
      const vpS1 = getLiveVal('kpi-cost-valeur-produite', 'site1Value');
      const site1Value = vpS1 > 0 ? Number(((vdS1 / vpS1) * 100).toFixed(2)) : 0;

      const vdS2 = getLiveVal('kpi-cost-valeur-dechet', 'site2Value');
      const vpS2 = getLiveVal('kpi-cost-valeur-produite', 'site2Value');
      const site2Value = vpS2 > 0 ? Number(((vdS2 / vpS2) * 100).toFixed(2)) : 0;

      const status = evaluateStatus(weeklyValue, kpi.target, kpi.name, kpi.category);

      const history = kpi.history.map(hist => {
        const vdH = getLiveHistoryVal('kpi-cost-valeur-dechet', hist.date);
        const vpH = getLiveHistoryVal('kpi-cost-valeur-produite', hist.date);
        const valH = vpH > 0 ? Number(((vdH / vpH) * 100).toFixed(2)) : 0;
        return { ...hist, value: valH };
      });

      return { ...kpi, weeklyValue, dailyValue, site1Value, site2Value, status, history };
    }

    const edits = localEdits[kpi.id] || {};
    return {
      ...kpi,
      ...edits,
      history: kpi.history.map(hist => {
        const localHist = edits.history?.find(h => h.date === hist.date);
        return localHist ? { ...hist, value: localHist.value } : hist;
      })
    };
  };

  // Handle cell text-input changes for main parameters
  const handleCellChange = (kpiId: string, field: keyof KPI, valStr: string) => {
    const numValue = valStr === '' ? 0 : Number(valStr);
    if (isNaN(numValue)) return;

    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const currentEdits = { ...(localEdits[kpiId] || {}) };
    
    // Update the specific field
    (currentEdits as any)[field] = numValue;

    // Side-effects: 
    // 1. If we edit Site 1 / Site 2 values, calculate the global total weekly value automatically!
    if (field === 'site1Value' || field === 'site2Value') {
      const site1 = field === 'site1Value' ? numValue : (currentEdits.site1Value ?? kpi.site1Value ?? 0);
      const site2 = field === 'site2Value' ? numValue : (currentEdits.site2Value ?? kpi.site2Value ?? 0);
      
      currentEdits.weeklyValue = Number((site1 + site2).toFixed(1));
    }

    // 2. If weeklyValue is modified, automatically re-evaluate status & update history's last week
    const currentWeekly = currentEdits.weeklyValue ?? kpi.weeklyValue;
    const currentTarget = currentEdits.target ?? kpi.target;
    currentEdits.status = evaluateStatus(currentWeekly, currentTarget, kpi.name, kpi.category);

    // Also update history's Semaine 26 value automatically
    const history = [...(currentEdits.history || kpi.history)];
    const lastWeekIdx = history.findIndex(h => h.date === 'Semaine 26');
    if (lastWeekIdx !== -1) {
      history[lastWeekIdx] = { ...history[lastWeekIdx], value: currentWeekly };
    } else {
      history.push({ date: 'Semaine 26', value: currentWeekly });
    }
    currentEdits.history = history;

    setLocalEdits(prev => ({
      ...prev,
      [kpiId]: currentEdits
    }));
  };

  // Handle changes for historic week inputs
  const handleHistoryChange = (kpiId: string, date: string, valStr: string) => {
    const numValue = valStr === '' ? 0 : Number(valStr);
    if (isNaN(numValue)) return;

    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const currentEdits = { ...(localEdits[kpiId] || {}) };
    const history = [...(currentEdits.history || kpi.history)];

    const idx = history.findIndex(h => h.date === date);
    if (idx !== -1) {
      history[idx] = { ...history[idx], value: numValue };
    } else {
      history.push({ date, value: numValue });
    }
    currentEdits.history = history;

    // If we're updating the current week (Semaine 26), update the main weeklyValue too
    if (date === 'Semaine 26') {
      currentEdits.weeklyValue = numValue;
      currentEdits.status = evaluateStatus(numValue, currentEdits.target ?? kpi.target, kpi.name, kpi.category);
    }

    setLocalEdits(prev => ({
      ...prev,
      [kpiId]: currentEdits
    }));
  };

  // Perform bulk saving
  const handleSaveAll = async () => {
    const modifiedIds = Object.keys(localEdits);
    if (modifiedIds.length === 0) return;

    setSaving(true);
    try {
      // Execute saving requests in parallel
      await Promise.all(
        modifiedIds.map(id => onUpdateKPI(id, localEdits[id]))
      );

      setSuccessMessage(`Félicitations ! Les données de ${modifiedIds.length} indicateur(s) ont été enregistrées avec succès.`);
      setLocalEdits({});
      
      // Auto-clear success banner
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

  // Autofill with realistic mock values near targets (perfect for simulation/demonstrations)
  const handleAutofillMock = () => {
    const filled: Record<string, Partial<KPI>> = {};
    
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
        // Standard numerical simulation
        const delta = (Math.random() - 0.3) * (kpi.target * 0.1); // slight bias to target met
        val = Number((kpi.target + delta).toFixed(1));
      }

      // If site values are checked
      const edits: Partial<KPI> = {};
      if (kpi.site1Checked && kpi.site2Checked) {
        edits.site1Value = Number((val * 0.4).toFixed(1));
        edits.site2Value = Number((val * 0.6).toFixed(1));
        edits.weeklyValue = Number((edits.site1Value + edits.site2Value).toFixed(1));
      } else {
        edits.weeklyValue = val;
      }

      // Add slight variations for past weeks
      const simulatedHistory = kpi.history.map(hist => {
        let historyVal = hist.value;
        if (hist.date === 'Semaine 26') {
          historyVal = edits.weeklyValue!;
        } else {
          // drift past weeks
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
    // 1. Search Query
    const matchesSearch = kpi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          kpi.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          kpi.category.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Category Filter
    const matchesCategory = selectedCategory === 'Tous' || kpi.category === selectedCategory;

    // 3. Owner Filter
    const matchesOwner = selectedOwner === 'Tous' || kpi.owner === selectedOwner;

    // 4. "Mes Indicateurs" Filter
    const matchesMine = !onlyMine || 
                        kpi.owner.toLowerCase().includes(currentUser.role.toLowerCase()) ||
                        (kpi.site1Owner && kpi.site1Owner.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                        (kpi.site2Owner && kpi.site2Owner.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                        (kpi.officeplastOwner && kpi.officeplastOwner.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                        kpi.owner.toLowerCase().includes(currentUser.name.toLowerCase());

    return matchesSearch && matchesCategory && matchesOwner && matchesMine;
  });

  const modifiedCount = Object.keys(localEdits).length;

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
            title="Simuler des valeurs pour toute la grille"
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
          
          {/* View Columns toggler */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setViewMode('weeks')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'weeks' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Vue Annuelle
            </button>
            <button
              onClick={() => setViewMode('sites')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'sites' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Par Site Usine
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'both' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Complet
            </button>
          </div>

          {/* Monthly / Weekly period toggler (TeamGuru-style annual view) */}
          {(viewMode === 'weeks' || viewMode === 'both') && (
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
          )}

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
                setSelectedOwner('Tous');
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
                  
                  {/* Value-To-Date column */}
                  {(viewMode === 'weeks' || viewMode === 'both') && (
                    <th className="py-3 px-2 w-20 text-center border-l-2 border-slate-300 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800/60">
                      VTD
                    </th>
                  )}

                  {/* Annual period columns: 12 months or 52 weeks, depending on periodMode */}
                  {(viewMode === 'weeks' || viewMode === 'both') && (
                    periodMode === 'monthly' ? (
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
                    )
                  )}

                  {/* Site values columns */}
                  {(viewMode === 'sites' || viewMode === 'both') && (
                    <>
                      <th className="py-3 px-2 w-24 text-center border-l border-slate-200 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-950/10">
                        Site 1 (S1)
                      </th>
                      <th className="py-3 px-2 w-24 text-center border-l border-slate-200 dark:border-slate-800 bg-purple-50/30 dark:bg-purple-950/10">
                        Site 2 (S2)
                      </th>
                      <th className="py-3 px-2 w-24 text-center border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                        Total S1 + S2
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs">
                {filteredKPIs.map(k => {
                  const liveK = getLiveKPI(k);
                  const isModified = !!localEdits[k.id];
                  const isFormula = [
                    'kpi-qual-conformite',
                    'kpi-prod-productivite',
                    'kpi-cost-ratio',
                    'kpi-cost-valeur-produite',
                    'kpi-cost-taux-dechet',
                    'kpi-rh-presence'
                  ].includes(k.id);
                  const isLowerBetterRow = isLowerBetterMetric(k.name, k.category);

                  // Status indicators for categorizing
                  const catBadges: Record<string, string> = {
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

                  return (
                    <tr 
                      key={k.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all ${
                        isModified ? 'bg-blue-50/20 dark:bg-blue-950/5' : ''
                      }`}
                    >
                      {/* 1. Category Badge */}
                      <td className="py-3 px-4 font-medium">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${catBadges[k.category] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                          {k.category}
                        </span>
                      </td>

                      {/* 2. Name & Owner */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug flex flex-wrap items-center gap-1.5">
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
                        <div className="mt-1 flex flex-col gap-1">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                            <UserIcon className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>Fonction : {k.owner}</span>
                          </div>
                          {(k.site1Owner || k.site2Owner || k.officeplastOwner) && (
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {k.site1Owner && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 rounded font-medium">
                                  S1 : {k.site1Owner}
                                </span>
                              )}
                              {k.site2Owner && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 rounded font-medium">
                                  S2 : {k.site2Owner}
                                </span>
                              )}
                              {k.officeplastOwner && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded font-medium font-mono">
                                  HQ : {k.officeplastOwner}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Unit */}
                      <td className="py-3 px-2 text-center text-slate-400 dark:text-slate-500 font-mono font-bold">
                        {k.unit}
                      </td>

                      {/* 4. Target */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="text"
                          value={liveK.target}
                          onChange={(e) => handleCellChange(k.id, 'target', e.target.value)}
                          className="w-14 text-center py-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-md font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                        />
                      </td>

                      {/* 5. Value-To-Date summary cell */}
                      {(viewMode === 'weeks' || viewMode === 'both') && (() => {
                        const vtd = getVTD(k.id);
                        return (
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
                        );
                      })()}

                      {/* 6. Annual period columns: monthly rollup (read-only) or weekly detail (editable) */}
                      {(viewMode === 'weeks' || viewMode === 'both') && (
                        periodMode === 'monthly' ? (
                          MONTH_WEEK_RANGES.map((m, idx) => {
                            const agg = getMonthAggregate(k.id, m);
                            const prev = getPrevMonthAggregate(k.id, idx);
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
                            const hasData = hasWeekData(k.id, w);
                            const val = hasData ? getLiveHistoryVal(k.id, `Semaine ${w}`) : null;
                            const prev = getPrevWeekValue(k.id, w);
                            const status = val !== null ? evaluateStatus(val, liveK.target, k.name, k.category) : null;

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
                                    readOnly={isFormula}
                                    disabled={isFormula}
                                    onChange={(e) => handleHistoryChange(k.id, `Semaine ${w}`, e.target.value)}
                                    className={`w-full text-center py-1 border rounded-md font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
                                      isFormula
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
                        )
                      )}

                      {/* 6. Site-Specific inputs */}
                      {(viewMode === 'sites' || viewMode === 'both') && (
                        <>
                          {/* Site 1 */}
                          <td className="py-2.5 px-2 border-l border-slate-100 dark:border-slate-800 text-center">
                            {k.site1Checked ? (
                              <input
                                type="text"
                                value={liveK.site1Value ?? ''}
                                readOnly={isFormula}
                                disabled={isFormula}
                                onChange={(e) => handleCellChange(k.id, 'site1Value', e.target.value)}
                                className={`w-18 text-center py-1 border rounded-md font-mono font-semibold text-xs text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                  isFormula
                                    ? 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-850'
                                    : 'bg-blue-50/40 border-blue-200 dark:bg-blue-950/10 dark:border-blue-900/50'
                                }`}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-350 dark:text-slate-600 font-medium italic">N/A</span>
                            )}
                          </td>

                          {/* Site 2 */}
                          <td className="py-2.5 px-2 border-l border-slate-100 dark:border-slate-800 text-center">
                            {k.site2Checked ? (
                              <input
                                type="text"
                                value={liveK.site2Value ?? ''}
                                readOnly={isFormula}
                                disabled={isFormula}
                                onChange={(e) => handleCellChange(k.id, 'site2Value', e.target.value)}
                                className={`w-18 text-center py-1 border rounded-md font-mono font-semibold text-xs text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                                  isFormula
                                    ? 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-850'
                                    : 'bg-purple-50/40 border-purple-200 dark:bg-purple-950/10 dark:border-purple-900/50'
                                }`}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-350 dark:text-slate-600 font-medium italic">N/A</span>
                            )}
                          </td>

                          {/* Sum / Total */}
                          <td className="py-2.5 px-2 border-l border-slate-100 dark:border-slate-800 text-center">
                            {/* Disabled if Site 1 & 2 are used since it is automatically summed. Otherwise editable! */}
                            {k.site1Checked && k.site2Checked ? (
                              <div className={`w-18 mx-auto py-1 border rounded-md font-mono font-extrabold text-xs flex items-center justify-center ${getCellColorClass(evaluateStatus(liveK.weeklyValue, liveK.target, k.name, k.category))}`}>
                                {liveK.weeklyValue}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={liveK.weeklyValue}
                                readOnly={isFormula}
                                disabled={isFormula}
                                onChange={(e) => handleCellChange(k.id, 'weeklyValue', e.target.value)}
                                className={`w-18 text-center py-1 border rounded-md font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
                                  isFormula
                                    ? 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-850'
                                    : getCellColorClass(evaluateStatus(liveK.weeklyValue, liveK.target, k.name, k.category))
                                }`}
                              />
                            )}
                          </td>
                        </>
                      )}

                    </tr>
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
          <span>Saisie ergonomique : saisissez les valeurs d'atelier de la semaine pour que les KPI recalculent automatiquement leurs statuts SQCDP.</span>
        </div>
        <div className="font-mono text-[10px]">
          Site 1 + Site 2 = Total Automatique
        </div>
      </div>

    </div>
  );
}
