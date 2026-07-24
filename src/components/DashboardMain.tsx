/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Award,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertOctagon,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip
} from 'recharts';
import { motion } from 'motion/react';
import { KPI, Action, User } from '../types';

interface DashboardMainProps {
  kpis: KPI[];
  actions: Action[];
  setActiveTab: (tab: string) => void;
  setSelectedModuleId: (id: string) => void;
  currentUser: User;
}

interface AIAnalysis {
  syntheseGenerale: string;
  topBottlenecks: {
    category: string;
    indicator: string;
    rootCause: string;
    recommendation: string;
  }[];
  risquesEscalade: string[];
  conseilLean: string;
}

export default function DashboardMain({
  kpis,
  actions,
  setActiveTab,
  setSelectedModuleId,
  currentUser
}: DashboardMainProps) {
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<'Total' | 'Site 1' | 'Site 2'>('Total');

  // Load AI Analysis on mount
  useEffect(() => {
    fetchAIAnalysis();
  }, []);

  const fetchAIAnalysis = async () => {
    setLoadingAI(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/analyze-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser.name,
          role: currentUser.role
        })
      });
      if (!response.ok) throw new Error('Échec de la récupération de l\'analyse');
      const data = await response.json();
      setAiAnalysis(data);
    } catch (err: any) {
      setAiError(err.message || 'Erreur lors de la connexion au service IA');
    } finally {
      setLoadingAI(false);
    }
  };

  // Derive displayed KPIs according to site selection
  const displayedKpis = kpis.map(kpi => {
    let weeklyValue = kpi.weeklyValue;
    let isApplicable = true;

    if (selectedSite === 'Site 1') {
      isApplicable = kpi.site1Checked;
      weeklyValue = isApplicable ? (kpi.site1Value ?? kpi.weeklyValue) : 0;
    } else if (selectedSite === 'Site 2') {
      isApplicable = kpi.site2Checked;
      weeklyValue = isApplicable ? (kpi.site2Value ?? kpi.weeklyValue) : 0;
    }

    // Determine status dynamically for Site 1 / Site 2 if applicable
    let status = kpi.status;
    if (!isApplicable) {
      status = 'Green'; // Non-applicable doesn't count as penalty
    } else if (selectedSite !== 'Total') {
      const isOver = weeklyValue >= kpi.target;
      if (kpi.greenThreshold.includes('== 0')) {
        status = weeklyValue === 0 ? 'Green' : (weeklyValue > 2 ? 'Red' : 'Orange');
      } else if (kpi.greenThreshold.includes('<=')) {
        status = weeklyValue <= kpi.target ? 'Green' : (weeklyValue <= kpi.target * 1.1 ? 'Orange' : 'Red');
      } else {
        status = isOver ? 'Green' : (weeklyValue >= kpi.target * 0.9 ? 'Orange' : 'Red');
      }
    }

    return {
      ...kpi,
      weeklyValue,
      isNotApplicable: !isApplicable,
      status
    };
  });

  // High-level calculations
  const totalActions = actions.length;
  const activeActions = actions.filter(a => a.status !== 'Clôturé');
  const delayedActions = activeActions.filter(a => new Date(a.dueDate) < new Date());
  const criticalActions = activeActions.filter(a => a.priority === 'Critique' || a.priority === 'Haute');

  // Overall Plant Performance score based on KPIs (percentage of Green KPIs)
  const activeKpiCount = displayedKpis.filter(k => !k.isNotApplicable).length;
  const greenKpisCount = displayedKpis.filter(k => k.status === 'Green' && !k.isNotApplicable).length;
  const plantScore = activeKpiCount > 0 ? Math.round((greenKpisCount / activeKpiCount) * 100) : 100;

  // Group KPIs by category (selecting main KPI per category)
  const categories = [
    { id: 'Sécurité', label: 'Sécurité', desc: 'Accidents & Audits', color: 'bg-emerald-500' },
    { id: 'Qualité', label: 'Qualité', desc: 'PPM & Réclamations', color: 'bg-rose-500' },
    { id: 'Production', label: 'Production', desc: 'TRS (OEE) & Volumes', color: 'bg-blue-500' },
    { id: 'Coût', label: 'Coût', desc: 'Pertes & Budget', color: 'bg-violet-500' },
    { id: 'Livraison', label: 'Livraison', desc: 'OTIF & Stocks', color: 'bg-amber-500' },
    { id: 'RH', label: 'RH', desc: 'Absentéisme & Polyvalence', color: 'bg-teal-500' },
    { id: 'Maintenance', label: 'Maintenance', desc: 'Disponibilité & MTBF', color: 'bg-orange-500' },
    { id: 'Amélioration continue', label: 'Amélioration continue', desc: 'Audits 5S & Environnement', color: 'bg-indigo-500' }
  ];

  // Radar SQCDP data modeling
  const radarData = categories.slice(0, 5).map(cat => {
    const kpi = displayedKpis.find(k => k.category === cat.id);
    // Standardize score between 0 and 100
    let score = 50;
    if (kpi) {
      if (kpi.status === 'Green') score = 90 + Math.random() * 8;
      else if (kpi.status === 'Orange') score = 70 + Math.random() * 10;
      else score = 40 + Math.random() * 15;
    }
    return {
      subject: cat.label,
      Actuel: Math.round(score),
      Cible: 95,
      fullMark: 100
    };
  });

  // Site & Usine Heatmap modeling
  const scopes = ['Site 1', 'Site 2', 'Total Usine'];
  const columns = ['Sécurité', 'Qualité', 'Livraison', 'Production', 'Maintenance', 'Amélioration continue'];

  const getHeatmapColor = (scope: string, column: string) => {
    const categoryMap: Record<string, string> = {
      'Sécurité': 'Sécurité',
      'Qualité': 'Qualité',
      'Livraison': 'Livraison',
      'Production': 'Production',
      'Maintenance': 'Maintenance',
      'Amélioration continue': 'Amélioration continue'
    };

    const catId = categoryMap[column] || column;
    const catKpis = kpis.filter(k => k.category === catId);

    // Find all applicable KPIs for this scope and category
    const applicableKpis = catKpis.filter(k => {
      if (scope === 'Site 1') return k.site1Checked;
      if (scope === 'Site 2') return k.site2Checked;
      return k.totalChecked !== false; // Total Usine
    });

    if (applicableKpis.length === 0) {
      return 'bg-slate-100 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500'; // N/A
    }

    let hasRed = false;
    let hasOrange = false;

    applicableKpis.forEach(k => {
      let val = k.weeklyValue;
      if (scope === 'Site 1') val = k.site1Value ?? 0;
      else if (scope === 'Site 2') val = k.site2Value ?? 0;

      let status = k.status;
      if (scope !== 'Total Usine') {
        const isOver = val >= k.target;
        if (k.greenThreshold.includes('== 0')) {
          status = val === 0 ? 'Green' : (val > 2 ? 'Red' : 'Orange');
        } else if (k.greenThreshold.includes('<=')) {
          status = val <= k.target ? 'Green' : (val <= k.target * 1.1 ? 'Orange' : 'Red');
        } else {
          status = isOver ? 'Green' : (val >= k.target * 0.9 ? 'Orange' : 'Red');
        }
      }

      if (status === 'Red') hasRed = true;
      if (status === 'Orange') hasOrange = true;
    });

    if (hasRed) {
      return 'bg-rose-500 text-white';
    }
    if (hasOrange) {
      return 'bg-amber-500 text-amber-950';
    }
    return 'bg-emerald-500 text-white';
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'Green': return 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/40';
      case 'Orange': return 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950/40';
      case 'Red': return 'bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950/40';
      default: return 'bg-slate-400';
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'Green': return 'border-l-4 border-l-emerald-500';
      case 'Orange': return 'border-l-4 border-l-amber-500';
      case 'Red': return 'border-l-4 border-l-rose-500';
      default: return '';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critique': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold';
      case 'Haute': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold';
      case 'Moyenne': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
            Panneau de Contrôle Directeur
          </p>
          <h2 className="text-2xl font-sans font-bold text-slate-900 dark:text-white tracking-tight">
            Vue d'Ensemble Performance Usine
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Revue de direction Tier 4 • Données consolidées en temps réel
          </p>
        </div>
        
        {/* Site Selector & Date Wrapper */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
          {/* Site Selector */}
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            {(['Total', 'Site 1', 'Site 2'] as const).map(site => (
              <button
                key={site}
                onClick={() => setSelectedSite(site)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  selectedSite === site
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {site === 'Total' ? 'Total Officeplast' : site}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            Lundi 29 Juin 2026 • S26
          </span>
        </div>
      </div>

      {/* 1. KEY EXECUTIVES METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Performance Score */}
        <div className="bento-card p-5 flex items-center justify-between hover:scale-[1.01] transition-transform duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Score Performance Global
            </p>
            <p className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
              {plantScore}%
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 font-mono">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              {greenKpisCount}/{activeKpiCount} indicateurs au Vert
            </p>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-blue-500 border-t-slate-200 dark:border-t-slate-800 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400 shadow-xs font-mono">
            {plantScore}%
          </div>
        </div>

        {/* Actions Actives */}
        <div className="bento-card p-5 flex items-center justify-between hover:scale-[1.01] transition-transform duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Actions Ouvertes / Total
            </p>
            <p className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
              {activeActions.length} <span className="text-lg font-normal text-slate-400">/ {totalActions}</span>
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {totalActions - activeActions.length} actions clôturées
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Actions Critiques */}
        <div className="bento-card p-5 flex items-center justify-between hover:scale-[1.01] transition-transform duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Priorité Critique / Haute
            </p>
            <p className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight text-amber-600">
              {criticalActions.length}
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 font-mono">
              <ShieldAlert className="w-3 h-3 text-amber-500" />
              Arbitrage managérial requis
            </p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Actions En Retard */}
        <div className="bento-card p-5 flex items-center justify-between hover:scale-[1.01] transition-transform duration-300">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Actions en Retard
            </p>
            <p className="text-3xl font-display font-bold text-rose-600 tracking-tight">
              {delayedActions.length}
            </p>
            <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 font-mono">
              <AlertOctagon className="w-3 h-3 text-rose-500" />
              Escalade automatique active
            </p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-500">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. RADAR CHART & HEATMAP ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Radar SQCDP */}
        <div className="bento-card p-5 lg:col-span-5 flex flex-col h-[340px]">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono flex items-center gap-2 mb-3">
            <span>Radar de Performance SQCDP</span>
          </h3>
          <div className="flex-1 min-h-0 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={11} fontWeight={500} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
                <Radar name="Performance" dataKey="Actuel" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.25} />
                <Radar name="Objectif" dataKey="Cible" stroke="#10b981" fill="#10b981" fillOpacity={0.05} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10, marginTop: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmap Ateliers */}
        <div className="bento-card p-5 lg:col-span-7 flex flex-col h-[340px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Heatmap Performance Sites & Usine
            </h3>
            <div className="flex gap-3 text-[10px] font-semibold text-slate-500 font-mono">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Conforme</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Attention</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Alerte</span>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-between overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr>
                  <th className="py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-40 font-mono">Site / Périmètre</th>
                  {columns.map(col => (
                    <th key={col} className="py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center font-mono">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {scopes.map(scope => (
                  <tr key={scope} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="py-3 text-xs font-semibold text-slate-800 dark:text-slate-200">{scope}</td>
                    {columns.map(col => {
                      const colorClass = getHeatmapColor(scope, col);
                      const displayVal = colorClass.includes('emerald') ? 'OK' : colorClass.includes('amber') ? 'ATT' : colorClass.includes('slate-100') ? 'N/A' : 'KO';
                      return (
                        <td key={col} className="py-3 px-1 text-center">
                          <div className={`mx-auto w-10 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-xs transition-transform hover:scale-105 ${colorClass}`}>
                            {displayVal}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 mt-2 border border-blue-100/10">
            <strong>Observation :</strong> Les indicateurs locaux du Site 1 et du Site 2 sont consolidés au niveau de la gouvernance <strong>Total Usine</strong>. Actuellement, la vigilance principale se porte sur les rebus et l'OEE du Site 1.
          </div>
        </div>
      </div>

      {/* 3. CORE 8 MODULES CARDS GRID */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 font-mono">
          Indicateurs Clés par Thématiques (Pilotes Tier 4)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {categories.map((cat, idx) => {
            // Find main KPIs of this category
            const catKpis = displayedKpis.filter(k => k.category === cat.id);
            const mainKpi = catKpis[0] || { name: 'Aucun KPI', weeklyValue: 0, target: 0, unit: '', status: 'Green', trend: 'stable', isNotApplicable: false };
            const subKpi = catKpis[1];

            // Define custom Bento spans:
            // - Sécurité/Qualité/Production are 4/12 (one third of row)
            // - Coût/Livraison/RH/Maint are 3/12 (one fourth of row)
            // - Amélioration continue closes the grid at full width (12/12)
            let colSpanClass = 'md:col-span-6 lg:col-span-4';
            if (['Coût', 'Livraison', 'RH', 'Maintenance'].includes(cat.id)) {
              colSpanClass = 'md:col-span-6 lg:col-span-3';
            } else if (cat.id === 'Amélioration continue') {
              colSpanClass = 'md:col-span-12 lg:col-span-12';
            }

            // Glow effects based on status
            const glowClass = mainKpi.status === 'Green' ? 'hover:shadow-emerald-500/10' :
                             mainKpi.status === 'Orange' ? 'hover:shadow-amber-500/10' :
                             'hover:shadow-rose-500/10';

            return (
              <div
                key={cat.id}
                id={`card-kpi-${cat.id.toLowerCase()}`}
                onClick={() => {
                  setSelectedModuleId(cat.id);
                  setActiveTab('modules');
                }}
                className={`bento-card-interactive p-5 flex flex-col justify-between h-[190px] group relative overflow-hidden ${getStatusBorder(mainKpi.status)} ${colSpanClass} ${glowClass}`}
              >
                {/* Floating Status light */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(mainKpi.status)}`}></span>
                </div>

                {/* Card Title */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.color} ring-2 ring-white dark:ring-slate-950`}></span>
                    <h4 className="text-sm font-display font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">
                      {cat.label}
                    </h4>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono uppercase tracking-wider">{cat.desc}</p>
                </div>

                {/* Primary KPI Value */}
                <div className="py-2">
                  <div className="flex items-baseline gap-1.5">
                    {mainKpi.isNotApplicable ? (
                      <span className="text-base font-semibold text-slate-400 dark:text-slate-500 tracking-tight bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono uppercase text-[10px]">
                        N/A (Non Mesuré)
                      </span>
                    ) : (
                      <>
                        <span className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                          {mainKpi.weeklyValue}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase font-mono">{mainKpi.unit}</span>
                      </>
                    )}
                    
                    {/* Trend Icon */}
                    {!mainKpi.isNotApplicable && (
                      <span className="ml-2">
                        {mainKpi.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-rose-500" />}
                        {mainKpi.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-emerald-500" />}
                        {mainKpi.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-semibold">
                    {mainKpi.name}
                  </p>
                </div>

                {/* Sub KPI or Goal */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-[11px] text-slate-500">
                  <span className="font-mono text-[10px]">Cible : <strong className="text-slate-700 dark:text-slate-300 font-semibold">{mainKpi.target} {mainKpi.unit}</strong></span>
                  
                  {subKpi && !subKpi.isNotApplicable ? (
                    <span className="text-[10px] bg-slate-50 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 truncate max-w-[140px] font-medium">
                      {subKpi.name} : {subKpi.weeklyValue}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5 font-semibold group-hover:text-blue-500 transition-colors">
                      Détails <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. DYNAMIC AI STRATEGY & BOTTLENECK INSIGHTS PANEL (GEMINI) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white rounded-2xl shadow-xl p-6 border border-blue-900/40 relative overflow-hidden">
        {/* Background visual details */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500 opacity-5 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500 opacity-5 blur-3xl rounded-full"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-blue-800/40 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-base text-white tracking-tight flex items-center gap-2">
                Consultant IA de Direction Lean
              </h3>
              <p className="text-xs text-blue-300">Analyse cognitive de performance & détection de dérives complexes</p>
            </div>
          </div>
          
          <button
            onClick={fetchAIAnalysis}
            disabled={loadingAI}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAI ? 'animate-spin' : ''}`} />
            {loadingAI ? 'Analyse...' : 'Actualiser l\'IA'}
          </button>
        </div>

        {/* AI Output Content */}
        <div className="relative z-10 space-y-4">
          {loadingAI ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-300 border-t-white rounded-full animate-spin"></div>
              <p className="text-xs text-blue-300 font-mono">Modélisation de l'usine, calcul des dérives SQCDP & génération des recommandations Lean...</p>
            </div>
          ) : aiError ? (
            <div className="py-4 text-center text-xs text-rose-300">
              <p>Erreur lors de la connexion au service d'analyse cognitive : {aiError}</p>
              <button onClick={fetchAIAnalysis} className="mt-2 text-blue-300 underline">Réessayer</button>
            </div>
          ) : aiAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Synthèse générale & Conseil Lean */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1 bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider font-mono">Synthèse Managériale</span>
                  <p className="text-xs leading-relaxed text-slate-200">
                    {aiAnalysis.syntheseGenerale}
                  </p>
                </div>
                
                <div className="bg-blue-950/40 p-4 rounded-lg border border-blue-900 flex items-start gap-2.5">
                  <div className="text-emerald-400 shrink-0 font-serif text-3xl">“</div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Principe Lean de la Semaine</span>
                    <p className="text-xs italic text-slate-300 leading-relaxed mt-0.5">
                      {aiAnalysis.conseilLean}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Bottlenecks & Recommendations */}
              <div className="lg:col-span-7 space-y-3">
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider font-mono block">Top 3 Bottlenecks & Contre-mesures préconisées</span>
                
                <div className="space-y-2.5">
                  {aiAnalysis.topBottlenecks?.map((item, index) => (
                    <div key={index} className="bg-white/5 p-3 rounded-lg border border-white/5 flex gap-3 items-start hover:bg-white/10 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{item.indicator}</span>
                          <span className="text-[9px] font-bold bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded uppercase">{item.category}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          <strong className="text-rose-300">Cause probable :</strong> {item.rootCause}
                        </p>
                        <p className="text-[11px] text-emerald-300 leading-relaxed">
                          <strong className="text-emerald-400">Recommandation :</strong> {item.recommendation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Escalation Risks */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono block mb-1.5">Signaux Faibles & Risques d'Escalade (48h) :</span>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {aiAnalysis.risquesEscalade?.map((r, i) => (
                      <li key={i} className="text-[10px] text-slate-300 bg-white/5 px-2.5 py-1.5 rounded flex items-center gap-1.5 border border-white/5">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0"></span>
                        <span className="truncate" title={r}>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

            </div>
          ) : (
            <div className="py-4 text-center text-xs text-blue-300">
              <p>Aucune donnée d'analyse disponible. Cliquez sur "Actualiser l'IA".</p>
            </div>
          )}
        </div>

      </div>

      {/* 5. RECENT ALERTS AND TOP CRITICAL ACTIONS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 Critical Actions */}
        <div className="bento-card p-5 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono flex items-center gap-2">
              <span>Actions Critiques Prioritaires</span>
              <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {criticalActions.length} actives
              </span>
            </h3>
            <button
              onClick={() => setActiveTab('actions')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Voir tout le plan <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {criticalActions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                Aucune action critique ouverte ! Félicitations !
              </div>
            ) : (
              criticalActions.slice(0, 5).map(action => (
                <div
                  key={action.id}
                  onClick={() => setActiveTab('actions')}
                  className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex justify-between items-center"
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">{action.autoNum}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded-lg font-medium">{action.workshop}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${getPriorityBadge(action.priority)}`}>
                        {action.priority}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{action.subject}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Responsable : <strong>{action.owner}</strong> • Échéance : {action.dueDate}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2 py-1 rounded shadow-xs">
                      {action.completionPercentage}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Alerts & Escalation System */}
        <div className="bento-card p-5 flex flex-col h-[380px]">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
            <span>Alertes d'Usine & Protocoles d'Escalade</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {/* Alert 1 */}
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border-l-4 border-l-rose-500 rounded-r-xl space-y-1">
              <div className="flex justify-between items-center text-rose-800 dark:text-rose-300 font-bold text-[11px] font-mono">
                <span className="flex items-center gap-1">🚨 ALERTE KPI DÉGRADÉ (SEUILS ROUGES)</span>
                <span className="font-mono text-[9px] bg-rose-200/50 dark:bg-rose-900/40 px-1 rounded">Urgent</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                Le Taux de rebuts clients de la semaine 26 a atteint <strong>210 PPM</strong> (Objectif max 150 PPM). Escalade active vers le Directeur Qualité.
              </p>
            </div>

            {/* Alert 2 */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-l-amber-500 rounded-r-xl space-y-1">
              <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 font-bold text-[11px] font-mono">
                <span className="flex items-center gap-1">⚠️ ACTIONS EN RETARD À CLÔTURER</span>
                <span className="font-mono text-[9px] bg-amber-200/50 dark:bg-amber-900/40 px-1 rounded">2 Jours</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                L'action <strong>ACT-2026-001</strong> (Sécurisation robot Presse 4) est planifiée pour le 30 juin (demain) et est à 30% d'avancement. Relance automatique sur Teams & WhatsApp à <i>Lucas Petit</i>.
              </p>
            </div>

            {/* Alert 3 - Teams WhatsApp integration demo */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500 rounded-r-xl space-y-1">
              <div className="flex justify-between items-center text-blue-800 dark:text-blue-300 font-bold text-[11px] font-mono">
                <span className="flex items-center gap-1">💬 SIMULATION INTEGRATIONS API</span>
                <span className="font-mono text-[9px] bg-blue-200/50 dark:bg-blue-900/40 px-1 rounded">Connecté</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                Les alertes automatiques sont configurées pour expédier un rapport PDF condensé aux groupes <strong>MS Teams "Comité de Direction"</strong> et via <strong>WhatsApp API</strong> aux responsables à chaque clôture de réunion Tier 4.
              </p>
            </div>

            {/* Escalation Rules Info */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 font-mono">
              <span className="font-bold block text-slate-700 dark:text-slate-300 mb-0.5">Règle d'escalade :</span>
              Tout KPI rouge pendant 2 semaines consécutives déclenche automatiquement l'inscription du sujet à l'ordre du jour du comité de division.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
