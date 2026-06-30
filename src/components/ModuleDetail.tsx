/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Award,
  Zap,
  Users,
  Wrench,
  CheckSquare,
  Droplet,
  Trash2,
  Calendar,
  Image as ImageIcon,
  ArrowRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Lock,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Area
} from 'recharts';
import { KPI, Action, User } from '../types';

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

  // Pareto Chart Data (Qualité)
  const paretoData = [
    { defect: 'Rainure non conforme', count: 42, cumulativePercentage: 45 },
    { defect: 'Fissure d\'éjection', count: 22, cumulativePercentage: 68 },
    { defect: 'Écart de taraudage', count: 14, cumulativePercentage: 83 },
    { defect: 'Bavure excessive', count: 10, cumulativePercentage: 94 },
    { defect: 'Autre défaut mineur', count: 6, cumulativePercentage: 100 }
  ];

  // TRS Decomposition Data (Production)
  const trsData = [
    { name: 'Disponibilité', value: 88.5, target: 92.0 },
    { name: 'Performance', value: 91.2, target: 94.0 },
    { name: 'Qualité', value: 94.4, target: 97.0 },
    { name: 'TRS (OEE)', value: 76.2, target: 80.0 }
  ];

  // Matrix Competence (RH Polyvalence matrix simulation)
  const polyvalenceMatrix = [
    { operator: 'Jean R.', injection: 'Expert', usinage: 'Formé', assemblage: 'Débutant', conditionnement: 'Expert' },
    { operator: 'Sophie L.', injection: 'Débutant', usinage: 'Expert', assemblage: 'Expert', conditionnement: 'Formé' },
    { operator: 'Lucas P.', injection: 'Formé', usinage: 'Néant', assemblage: 'Formé', conditionnement: 'Néant' },
    { operator: 'Marc A.', injection: 'Néant', usinage: 'Expert', assemblage: 'Formé', conditionnement: 'Expert' }
  ];

  // Resource Cost Trends (Coût/Environnement combo)
  const energyCostData = [
    { name: 'Avril', Electricité: 24, Eau: 4.5, Gaz: 12.0 },
    { name: 'Mai', Electricité: 26, Eau: 4.8, Gaz: 11.5 },
    { name: 'Juin', Electricité: 29, Eau: 5.2, Gaz: 10.8 }
  ];

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'Green': return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400';
      case 'Orange': return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400';
      case 'Red': return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const getCompetenceBadge = (level: string) => {
    switch (level) {
      case 'Expert': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-bold';
      case 'Formé': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400';
      case 'Débutant': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-400 dark:bg-slate-800';
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
            Focus Thématique Métier
          </p>
          <h2 className="text-2xl font-sans font-bold text-slate-900 dark:text-white tracking-tight">
            Analyse Détaillée - {selectedModuleId}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Indicateurs industriels, graphiques analytiques Pareto/Trends et plans d'actions associés
          </p>
        </div>
      </div>

      {/* 3. DYNAMIC METRICS SUMMARY GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {currentModuleKpis.length === 0 ? (
          <div className="md:col-span-3 bento-card p-5 text-center text-slate-400 text-xs font-mono">
            Aucun indicateur de performance (KPI) répertorié pour le module [{selectedModuleId}].
          </div>
        ) : (
          currentModuleKpis.map(k => (
            <div key={k.id} className="bento-card p-5 flex flex-col justify-between h-[150px] hover:scale-[1.01] transition-transform duration-300">
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Pilote : {k.owner}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold font-mono ${getStatusColorClass(k.status)}`}>
                    {k.status}
                  </span>
                </div>
                <h4 className="text-sm font-display font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight" title={k.name}>{k.name}</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed" title={k.description}>
                  {k.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-baseline">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">{k.weeklyValue}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">{k.unit}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium font-mono">
                  Cible : <strong className="text-slate-700 dark:text-slate-200">{k.target} {k.unit}</strong>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. MODULAR CHART COMPONENT WRAPPERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART PORTLET */}
        <div className="bento-card p-5 lg:col-span-7 flex flex-col h-[350px]">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 font-mono">
            Graphique Analytique de Performance
          </h3>
          <div className="flex-1 min-h-0 text-xs">
            
            {/* SÉCURITÉ CHART: accidents vs near-miss trend */}
            {selectedModuleId === 'Sécurité' && currentModuleKpis[0] && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentModuleKpis[1]?.history || []}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <Tooltip />
                  <Legend />
                  <Bar name="Near Misses Signalés (Bar)" dataKey="value" fill="#10b981" barSize={25} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {/* QUALITÉ CHART: PARETO CHART OF DEFECTS */}
            {selectedModuleId === 'Qualité' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData}>
                  <XAxis dataKey="defect" stroke="#94a3b8" fontSize={10} />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" name="Nombre de Défauts (Pareto)" dataKey="count" fill="#f43f5e" barSize={35} />
                  <Line yAxisId="right" name="Courbe Cumulative (%)" dataKey="cumulativePercentage" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {/* PRODUCTION CHART: TRS / OEE BREAKDOWN */}
            {selectedModuleId === 'Production' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trsData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
                  <CartesianGrid stroke="#f1f5f9" />
                  <Tooltip />
                  <Legend />
                  <Bar name="Réalisé (%)" dataKey="value" fill="#3b82f6" barSize={30} />
                  <Bar name="Cible (%)" dataKey="target" fill="#10b981" barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* MAINTENANCE CHART: MTTR & MTBF TRENDS */}
            {selectedModuleId === 'Maintenance' && currentModuleKpis[1] && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentModuleKpis[1].history}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <Tooltip />
                  <Legend />
                  <Line name="MTBF (Temps Moyen Sans Panne) - Heures" dataKey="value" stroke="#f97316" strokeWidth={2} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* LIVRAISON OTIF GAUGE/BARS */}
            {selectedModuleId === 'Livraison' && currentModuleKpis[0] && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentModuleKpis[0].history}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} domain={[85, 100]} />
                  <CartesianGrid stroke="#f1f5f9" />
                  <Tooltip />
                  <Legend />
                  <Area name="Taux OTIF (%)" dataKey="value" fill="#f59e0b" fillOpacity={0.15} stroke="#d97706" strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {/* COÛT & ENVIRONNEMENT RECHARGE STACKS */}
            {(selectedModuleId === 'Coût' || selectedModuleId === 'Environnement') && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energyCostData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <CartesianGrid stroke="#f1f5f9" />
                  <Tooltip />
                  <Legend />
                  <Bar name="Électricité (MWh/M€)" dataKey="Electricité" fill="#3b82f6" stackId="a" />
                  <Bar name="Eau (m³)" dataKey="Eau" fill="#06b6d4" stackId="a" />
                  <Bar name="Gaz (MW)" dataKey="Gaz" fill="#a855f7" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* 5S AUDITS SCORE & BEFORE/AFTER */}
            {selectedModuleId === '5S' && currentModuleKpis[0] && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentModuleKpis[0].history}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} domain={[70, 100]} />
                  <CartesianGrid stroke="#f1f5f9" />
                  <Tooltip />
                  <Legend />
                  <Line name="Score d'audit 5S (%)" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* RH ABSENTEISME GRAPH */}
            {selectedModuleId === 'RH' && currentModuleKpis[0] && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentModuleKpis[0].history}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <CartesianGrid stroke="#f1f5f9" />
                  <Tooltip />
                  <Legend />
                  <Bar name="Absentéisme hebdomadaire (%)" dataKey="value" fill="#14b8a6" barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}

          </div>
        </div>

        {/* COMPLEMENTARY SPECIAL WIDGET (5 cols) */}
        <div className="bento-card p-5 lg:col-span-5 flex flex-col h-[350px]">
          
          {/* SPECIAL WIDGET 1: BEFORE AFTER PHOTO SLIDER (5S) */}
          {selectedModuleId === '5S' ? (
            <div className="flex flex-col h-full space-y-3 text-xs">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span>Photos 5S - Avant / Après Chantier</span>
              </h3>
              <p className="text-[10px] text-slate-400 leading-normal">Visualisation des standards de propreté et délimitation de stockage zone Expédition.</p>
              
              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                <div className="relative rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 h-full">
                  <img
                    src="https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=300"
                    alt="Avant chantier 5S"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-rose-600/95 text-white font-bold text-[9px] rounded uppercase">Avant</span>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 h-full">
                  <img
                    src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=300"
                    alt="Après chantier 5S"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-emerald-600/95 text-white font-bold text-[9px] rounded uppercase">Après (Standardisé)</span>
                </div>
              </div>
            </div>
          ) : selectedModuleId === 'RH' ? (
            /* SPECIAL WIDGET 2: COMPÉTENCE & POLYVALENCE MATRIX (RH) */
            <div className="flex flex-col h-full space-y-3 text-xs">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-500" />
                <span>Matrice de Polyvalence (ILUO)</span>
              </h3>
              <p className="text-[10px] text-slate-400">Évaluation des compétences croisées de l'équipe de l'Atelier Injection.</p>
              
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                      <th className="py-2 text-left">Opérateur</th>
                      <th className="py-2 text-center">Injection</th>
                      <th className="py-2 text-center">Usinage</th>
                      <th className="py-2 text-center">Assemblage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {polyvalenceMatrix.map(m => (
                      <tr key={m.operator} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">{m.operator}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${getCompetenceBadge(m.injection)}`}>{m.injection}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${getCompetenceBadge(m.usinage)}`}>{m.usinage}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${getCompetenceBadge(m.assemblage)}`}>{m.assemblage}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* DEFAULT COMPLEMENTARY WIDGET: OPEN CORRECTIVE ACTIONS LIST */
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
          )}

        </div>

      </div>

    </div>
  );
}
