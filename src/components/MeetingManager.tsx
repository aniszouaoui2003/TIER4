/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  PenTool,
  Sparkles,
  Printer,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  MessageSquare,
  Bookmark,
  RefreshCw,
  PlusCircle,
  FileCheck2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { Meeting, KPI, Action, User } from '../types';

interface MeetingManagerProps {
  meetings: Meeting[];
  kpis: KPI[];
  actions: Action[];
  onAddAction: (action: Omit<Action, 'id' | 'autoNum' | 'date' | 'comments' | 'attachments'>) => Promise<void>;
  onUpdateMeeting: (id: string, updated: Partial<Meeting>) => Promise<void>;
  onCreateMeeting: (opts: { facilitator: string; scribe: string }) => Promise<void>;
  currentUser: User;
}

interface AIMeetingSummary {
  bulletinClimat: string;
  pointsCles: string[];
  actionsSuggereesIA: {
    workshop: string;
    department: string;
    subject: string;
    description: string;
    owner: string;
  }[];
}

export default function MeetingManager({
  meetings,
  kpis,
  actions,
  onAddAction,
  onUpdateMeeting,
  onCreateMeeting,
  currentUser
}: MeetingManagerProps) {
  const currentMeeting = meetings.find(m => m.status === 'ongoing') || meetings[0];
  const [facilitator, setFacilitator] = useState(currentMeeting?.facilitator || 'Marc Lemaire (Directeur Industriel)');
  const [scribe, setScribe] = useState(currentMeeting?.scribe || 'Sophie Martin (Prod)');

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Gemini AI state
  const [aiSummary, setAiSummary] = useState<AIMeetingSummary | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Quick Action form within step
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickSubject, setQuickSubject] = useState('');
  const [quickOwner, setQuickOwner] = useState('');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [quickWorkshop, setQuickWorkshop] = useState('Atelier Usinage');

  // Agenda steps mapping
  const agendaSteps = [
    { id: 'Sécurité', label: '1. Sécurité', color: 'bg-emerald-500', text: 'bg-emerald-50 text-emerald-800' },
    { id: 'Qualité', label: '2. Qualité', color: 'bg-rose-500', text: 'bg-rose-50 text-rose-800' },
    { id: 'Livraison', label: '3. Livraison', color: 'bg-amber-500', text: 'bg-amber-50 text-amber-800' },
    { id: 'Production', label: '4. Production', color: 'bg-blue-500', text: 'bg-blue-50 text-blue-800' },
    { id: 'Coût', label: '5. Coût', color: 'bg-violet-500', text: 'bg-violet-50 text-violet-800' },
    { id: 'Maintenance', label: '6. Maintenance', color: 'bg-orange-500', text: 'bg-orange-50 text-orange-800' },
    { id: 'RH', label: '7. RH', color: 'bg-teal-500', text: 'bg-teal-50 text-teal-800' },
    { id: '5S', label: '8. 5S', color: 'bg-indigo-500', text: 'bg-indigo-50 text-indigo-800' },
    { id: 'Environnement', label: '9. Environnement', color: 'bg-lime-500', text: 'bg-lime-50 text-lime-800' },
    { id: 'Clôture', label: 'Synthèse & Signature', color: 'bg-slate-700', text: 'bg-slate-100 text-slate-800' }
  ];

  const currentStep = agendaSteps[currentMeeting?.activeStepIndex ?? 0];

  // Load signature and AI when reaching summary
  useEffect(() => {
    if (currentStep?.id === 'Clôture' && canvasRef.current) {
      initCanvas();
    }
  }, [currentMeeting?.activeStepIndex, currentStep?.id]);

  // Init Canvas signature pad
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#1e3a8a'; // Blue ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  };

  const startSigning = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopSigning = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // Generate meeting minute PDF summary via Gemini AI
  const fetchAIMinutes = async () => {
    if (!currentMeeting) return;
    setLoadingAI(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: currentMeeting.id })
      });
      if (!response.ok) throw new Error('Échec de la génération des minutes par l\'IA');
      const data = await response.json();
      setAiSummary(data);
    } catch (err: any) {
      setAiError(err.message || 'Erreur service IA de compte rendu');
    } finally {
      setLoadingAI(false);
    }
  };

  // Automatically add AI suggested action to real action list
  const handleAdoptAIAction = async (aiAct: any) => {
    await onAddAction({
      workshop: aiAct.workshop,
      department: aiAct.department,
      subject: aiAct.subject,
      description: aiAct.description,
      rootCause: "Généré automatiquement par le Secrétaire IA lors de la revue Tier 4.",
      actionTaken: aiAct.description,
      owner: aiAct.owner,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days out
      priority: 'Moyenne',
      status: 'A faire',
      completionPercentage: 0
    });
    // Remove from temporary suggested list so we don't double click
    if (aiSummary) {
      setAiSummary({
        ...aiSummary,
        actionsSuggereesIA: aiSummary.actionsSuggereesIA.filter(a => a.subject !== aiAct.subject)
      });
    }
  };

  // Save changes to current step notes/decisions
  const saveStepText = async (type: 'comments' | 'decisions', value: string) => {
    if (!currentMeeting) return;
    const key = currentStep.id;
    const updatedStepObj = {
      ...(type === 'comments' ? currentMeeting.stepComments : currentMeeting.stepDecisions),
      [key]: value
    };
    
    await onUpdateMeeting(currentMeeting.id, {
      [type === 'comments' ? 'stepComments' : 'stepDecisions']: updatedStepObj
    });
  };

  const handleNextStep = async () => {
    if (!currentMeeting) return;
    const nextIdx = currentMeeting.activeStepIndex + 1;
    if (nextIdx < agendaSteps.length) {
      await onUpdateMeeting(currentMeeting.id, { activeStepIndex: nextIdx });
    }
  };

  const handlePrevStep = async () => {
    if (!currentMeeting) return;
    const prevIdx = currentMeeting.activeStepIndex - 1;
    if (prevIdx >= 0) {
      await onUpdateMeeting(currentMeeting.id, { activeStepIndex: prevIdx });
    }
  };

  // Submit Quick Action in Meeting Step
  const handleSubmitQuickAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSubject || !quickOwner || !quickDueDate) return;

    await onAddAction({
      workshop: quickWorkshop,
      department: currentStep.id,
      subject: quickSubject,
      description: `Action ouverte en direct durant la revue Tier 4 - Thématique [${currentStep.id}].`,
      rootCause: 'Constat d\'écart en réunion.',
      actionTaken: quickSubject,
      owner: quickOwner,
      dueDate: quickDueDate,
      priority: 'Moyenne',
      status: 'A faire',
      completionPercentage: 0
    });

    setQuickSubject('');
    setQuickOwner('');
    setQuickDueDate('');
    setIsQuickAddOpen(false);
  };

  const triggerPrint = () => {
    window.print();
  };

  // KPIs of current step category
  const currentStepKpis = kpis.filter(k => k.category === currentStep?.id);
  const currentStepActions = actions.filter(a => a.department === currentStep?.id && a.status !== 'Clôturé');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200 print:bg-white print:p-0">
      
      {/* 1. START MEETING SCREEN (IF NO MEETING ACTIVE OR COMPLETED SELECTED) */}
      {!currentMeeting ? (
        <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg text-center space-y-5">
          <CalendarDays className="w-12 h-12 text-blue-500 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Lancer une revue Tier 4</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Préparez l'ordre du jour standardisé et connectez le comité de direction.
            </p>
          </div>

          <div className="space-y-3 text-left text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Animateur de Séance</label>
              <input
                type="text"
                value={facilitator}
                onChange={(e) => setFacilitator(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Secrétaire (Scribe)</label>
              <input
                type="text"
                value={scribe}
                onChange={(e) => setScribe(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded p-2 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <button
            onClick={() => onCreateMeeting({ facilitator, scribe })}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Play className="w-4 h-4 fill-white" /> Démarrer la Revue Hebdomadaire
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Meeting Dashboard */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 print:border-none print:pb-0">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                Revue en cours • Semaine {currentMeeting.weekNumber}
              </p>
              <h2 className="text-2xl font-sans font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Réunion Directeur Générale Tier 4
                <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                  Semaine {currentMeeting.weekNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Animateur : <strong>{currentMeeting.facilitator}</strong> • Secrétaire : <strong>{currentMeeting.scribe}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center print:hidden">
              <button
                onClick={triggerPrint}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Compte rendu
              </button>
              
              <button
                onClick={() => onCreateMeeting({ facilitator, scribe })}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Nouvelle Revue
              </button>
            </div>
          </div>

          {/* Agenda Progress bar */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto print:hidden">
            <div className="flex items-center justify-between min-w-[760px] gap-1 text-[11px] font-bold text-slate-400">
              {agendaSteps.map((step, idx) => {
                const isActive = currentMeeting.activeStepIndex === idx;
                const isPassed = currentMeeting.activeStepIndex > idx;
                return (
                  <button
                    key={step.id}
                    onClick={() => onUpdateMeeting(currentMeeting.id, { activeStepIndex: idx })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isPassed
                        ? 'text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <span className={`w-2 h-2 rounded-full ${step.color}`}></span>}
                    <span className="truncate">{step.label.replace(/^\d\.\s/, '')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. DYNAMIC WORKFLOW CONTAINER */}
          {currentStep.id !== 'Clôture' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Side: KPIs & Charts & Actions (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Subject KPI Block */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${currentStep.color}`}></span>
                      Indicateurs Métiers de la Thématique
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentStepKpis.map(k => (
                      <div key={k.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">KPI Hebdo / Target</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={k.name}>{k.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Target : <strong>{k.target} {k.unit}</strong></p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xl font-sans font-extrabold ${
                            k.status === 'Green' ? 'text-emerald-600' : k.status === 'Orange' ? 'text-amber-500' : 'text-rose-600'
                          }`}>
                            {k.weeklyValue} <span className="text-[10px] font-normal uppercase text-slate-400">{k.unit}</span>
                          </p>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            k.status === 'Green' ? 'bg-emerald-100 text-emerald-800' : k.status === 'Orange' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {k.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sparkline trend for main KPI */}
                  {currentStepKpis[0] && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 h-[140px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-2">Historique d'Évolution (5 Semaines) - {currentStepKpis[0].name}</span>
                      <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={currentStepKpis[0].history}>
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Subject Actions Plan Block */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[280px]">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                      <span>Actions associées à ce sujet ({currentStepActions.length})</span>
                    </h3>
                    <button
                      onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ouvrir action
                    </button>
                  </div>

                  {isQuickAddOpen ? (
                    <form onSubmit={handleSubmitQuickAction} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-xs space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Atelier concerné</label>
                          <select
                            value={quickWorkshop}
                            onChange={(e) => setQuickWorkshop(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-800 dark:text-slate-200"
                          >
                            <option value="Atelier Injection">Atelier Injection</option>
                            <option value="Atelier Usinage">Atelier Usinage</option>
                            <option value="Atelier Assemblage">Atelier Assemblage</option>
                            <option value="Atelier Expédition">Atelier Expédition</option>
                            <option value="Usine (Toutes zones)">Usine (Toutes zones)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Sujet de la contre-mesure *</label>
                          <input
                            type="text"
                            required
                            placeholder="ex: Remplacer le capteur de proximité..."
                            value={quickSubject}
                            onChange={(e) => setQuickSubject(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Responsable *</label>
                          <input
                            type="text"
                            required
                            placeholder="Pilote"
                            value={quickOwner}
                            onChange={(e) => setQuickOwner(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Échéance *</label>
                          <input
                            type="date"
                            required
                            value={quickDueDate}
                            onChange={(e) => setQuickDueDate(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-800 dark:text-slate-200 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsQuickAddOpen(false)} className="px-2.5 py-1 border border-slate-200 rounded text-[10px]">Annuler</button>
                        <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-[10px] font-bold">Valider l'action</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {currentStepActions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                          Aucun plan d'action actif pour ce sujet.
                        </div>
                      ) : (
                        currentStepActions.map(act => (
                          <div key={act.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:bg-slate-100/50 transition-colors">
                            <div className="min-w-0 flex-1 pr-3">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{act.subject}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Pilote : <strong>{act.owner}</strong> • Échéance : {act.dueDate} • Atelier : {act.workshop}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-bold font-mono bg-white dark:bg-slate-900 border px-1.5 py-0.5 rounded shadow-xs">
                                {act.completionPercentage}%
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Side: Comments and Decisions Notebook (5 cols) */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* Scribe comment block */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[280px]">
                  <div className="flex items-center gap-1.5 mb-2 shrink-0">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Commentaires de Séance (Scribe)
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">Quels sont les faits marquants, anomalies ou explications observées ?</p>
                  
                  <textarea
                    rows={8}
                    value={currentMeeting.stepComments[currentStep.id] || ''}
                    onChange={(e) => saveStepText('comments', e.target.value)}
                    placeholder="Saisissez les explications, analyses de dérives, anomalies constatées en réunion..."
                    className="w-full flex-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Scribe decisions block */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[280px]">
                  <div className="flex items-center gap-1.5 mb-2 shrink-0">
                    <Bookmark className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Décisions Prises & Arbitrages
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">Quelles sont les résolutions votées pour cette thématique ?</p>
                  
                  <textarea
                    rows={8}
                    value={currentMeeting.stepDecisions[currentStep.id] || ''}
                    onChange={(e) => saveStepText('decisions', e.target.value)}
                    placeholder="Saisissez les arbitrages budgétaires, recrutements temporaires approuvés, priorités de traitement..."
                    className="w-full flex-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

              </div>

              {/* Navigation Footer for Step */}
              <div className="lg:col-span-12 flex justify-between items-center py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentMeeting.activeStepIndex === 0}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Sujet Précédent
                </button>

                <div className="text-xs text-slate-400 font-mono font-bold uppercase">
                  Sujet {currentMeeting.activeStepIndex + 1} / {agendaSteps.length}
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Sujet Suivant <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          ) : (
            /* 3. SYNTHESE & SIGNATURE SCREEN (FINAL AGEND STEP) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Signature, Attendees, General decisions */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* Meeting Attendees Checkbox List */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-500" />
                    Présence des Participants de Direction
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {currentMeeting.attendees.map((att, index) => (
                      <label key={index} className="flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={att.present}
                          onChange={(e) => {
                            const updatedList = [...currentMeeting.attendees];
                            updatedList[index].present = e.target.checked;
                            onUpdateMeeting(currentMeeting.id, { attendees: updatedList });
                          }}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <div className="overflow-hidden">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{att.role}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Draw Electronic Signature Box */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-emerald-500" />
                    Signature Électronique (Validation Animateur)
                  </h3>
                  <p className="text-[10px] text-slate-400">Signez à l'aide de votre souris ou touchpad pour clore définitivement le compte-rendu S{currentMeeting.weekNumber}.</p>
                  
                  <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20 rounded-xl overflow-hidden h-[150px]">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={150}
                      onMouseDown={startSigning}
                      onMouseMove={drawSignature}
                      onMouseUp={stopSigning}
                      onMouseLeave={stopSigning}
                      className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                    />
                    {!hasSigned && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[11px] pointer-events-none select-none font-mono">
                        Signer ici • Animateur
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1">
                    <button
                      onClick={clearSignature}
                      className="text-slate-400 hover:text-rose-500 font-bold underline"
                    >
                      Effacer la signature
                    </button>
                    
                    <button
                      onClick={() => {
                        if (!hasSigned) return;
                        alert('Signature électronique apposée avec succès dans le compte-rendu cryptographique.');
                        onUpdateMeeting(currentMeeting.id, { status: 'completed' });
                      }}
                      disabled={!hasSigned}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold rounded-lg transition-all"
                    >
                      Clôturer & Archiver la Revue
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: AI GENERATED SUMMARY REPORT (GEMINI COGNITIVE ACTION) */}
              <div className="lg:col-span-6 space-y-5">
                
                {/* AI Assistant summary widget */}
                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white p-5 rounded-xl border border-indigo-900 shadow-lg space-y-4 relative overflow-hidden">
                  
                  <div className="flex justify-between items-center pb-2 border-b border-indigo-900/60 relative z-10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <div>
                        <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Secrétaire IA de Direction</h4>
                        <p className="text-[9px] text-indigo-300">Synthétise instantanément les notes, les décisions et propose des actions correctives</p>
                      </div>
                    </div>

                    <button
                      onClick={fetchAIMinutes}
                      disabled={loadingAI}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingAI ? 'animate-spin' : ''}`} />
                      {loadingAI ? 'Génération...' : 'Lancer l\'IA'}
                    </button>
                  </div>

                  {/* IA Output */}
                  <div className="relative z-10 text-xs">
                    {loadingAI ? (
                      <div className="py-10 text-center space-y-2">
                        <div className="w-6 h-6 border-2 border-indigo-400 border-t-white rounded-full animate-spin mx-auto"></div>
                        <p className="text-[10px] text-indigo-300 font-mono">Analyse des 9 sujets, rédaction du bulletin d'usine et calcul d'actions...</p>
                      </div>
                    ) : aiError ? (
                      <div className="py-4 text-center text-rose-300 text-[11px]">
                        Échec de la rédaction IA : {aiError}. Veuillez réessayer.
                      </div>
                    ) : aiSummary ? (
                      <div className="space-y-4">
                        {/* Bulletin d'usine */}
                        <div className="space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono">Rapport de Séance Directeur</span>
                          <p className="text-[11px] leading-relaxed text-slate-200 italic">
                            "{aiSummary.bulletinClimat}"
                          </p>
                        </div>

                        {/* Points clés */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono block">Décisions Stratégiques Majeures</span>
                          <ul className="space-y-1">
                            {aiSummary.pointsCles?.map((pt, idx) => (
                              <li key={idx} className="text-[10px] text-slate-300 flex items-start gap-1.5 leading-relaxed bg-white/2 p-1.5 rounded">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0 mt-1.5"></span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Actions Suggérées IA */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-mono block">Actions d'Ajustement d'Usine Suggérées (IA)</span>
                          <div className="space-y-2">
                            {aiSummary.actionsSuggereesIA?.map((act, idx) => (
                              <div key={idx} className="bg-white/5 p-2.5 rounded border border-white/5 flex justify-between items-start gap-4">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-[10px]">{act.subject}</span>
                                    <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold font-mono uppercase">{act.department}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-300">{act.description}</p>
                                  <p className="text-[9px] text-slate-400">Responsable proposé : <strong>{act.owner}</strong> • Atelier : {act.workshop}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAdoptAIAction(act)}
                                  className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] px-2 py-1 rounded transition-colors"
                                >
                                  Adopter
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="py-6 text-center text-indigo-300 italic">
                        Le rapport IA consolidé rédigera la synthèse générale de direction à partir des notes de séance saisies sur les 9 onglets. Cliquez sur "Lancer l'IA" ci-dessus.
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Back navigation */}
              <div className="lg:col-span-12 flex justify-start py-4 border-t border-slate-200 dark:border-slate-800 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour aux Notes SQCDP
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
