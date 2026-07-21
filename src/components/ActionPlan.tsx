/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MessageSquare,
  Paperclip,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  X,
  FileText,
  Trash2,
  Calendar,
  Layers,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { Action, User, UserRole, ActionComment } from '../types';

interface ActionPlanProps {
  actions: Action[];
  onAddAction: (action: Omit<Action, 'id' | 'autoNum' | 'date' | 'comments' | 'attachments'>) => Promise<void>;
  onUpdateAction: (id: string, updated: Partial<Action>) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
  onAddComment: (actionId: string, text: string) => Promise<void>;
  currentUser: User;
}

export default function ActionPlan({
  actions,
  onAddAction,
  onUpdateAction,
  onDeleteAction,
  onAddComment,
  currentUser
}: ActionPlanProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState('Tous');
  const [selectedDept, setSelectedDept] = useState('Tous');
  const [selectedPriority, setSelectedPriority] = useState('Tous');
  const [selectedStatus, setSelectedStatus] = useState('Tous');

  // Modal / Form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  // Form inputs
  const [newWorkshop, setNewWorkshop] = useState('Site 1');
  const [newDept, setNewDept] = useState('Production');
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRootCause, setNewRootCause] = useState('');
  const [newActionTaken, setNewActionTaken] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'Basse' | 'Moyenne' | 'Haute' | 'Critique'>('Moyenne');
  const [newStatus, setNewStatus] = useState<'A faire' | 'En cours' | 'A valider' | 'Clôturé'>('A faire');

  // Detail Comment input
  const [commentText, setCommentText] = useState('');

  // Dropdown lists
  const workshops = ['Site 1', 'Site 2', 'Total Usine'];
  const depts = ['Sécurité', 'Qualité', 'Production', 'Coût', 'Livraison', 'RH', 'Maintenance', '5S', 'Environnement'];
  const priorities = ['Basse', 'Moyenne', 'Haute', 'Critique'];
  const statuses = ['A faire', 'En cours', 'A valider', 'Clôturé'];

  // Handle Action submit
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject || !newOwner || !newDueDate) return;

    await onAddAction({
      workshop: newWorkshop,
      department: newDept,
      subject: newSubject,
      description: newDesc,
      rootCause: newRootCause,
      actionTaken: newActionTaken,
      owner: newOwner,
      dueDate: newDueDate,
      priority: newPriority,
      status: newStatus,
      completionPercentage: 0
    });

    // Reset Form
    setNewSubject('');
    setNewDesc('');
    setNewRootCause('');
    setNewActionTaken('');
    setNewOwner('');
    setNewDueDate('');
    setNewPriority('Moyenne');
    setNewStatus('A faire');
    setIsAddOpen(false);
  };

  // Add Comment submit
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedAction) return;

    await onAddComment(selectedAction.id, commentText);
    setCommentText('');
    
    // Refresh detailed view action reference
    const updatedAction = actions.find(a => a.id === selectedAction.id);
    if (updatedAction) {
      setSelectedAction(updatedAction);
    }
  };

  // Change action status directly in detail view
  const handleDetailStatusChange = async (status: 'A faire' | 'En cours' | 'A valider' | 'Clôturé') => {
    if (!selectedAction) return;
    await onUpdateAction(selectedAction.id, {
      status
    });
    // Refresh reference
    const updatedAction = actions.find(a => a.id === selectedAction.id);
    if (updatedAction) {
      setSelectedAction(updatedAction);
    }
  };

  // Delete action from detail view
  const handleDeleteAction = async () => {
    if (!selectedAction) return;
    if (!window.confirm(`Supprimer définitivement l'action [${selectedAction.autoNum}] ? Cette opération est irréversible.`)) return;
    await onDeleteAction(selectedAction.id);
    setIsDetailOpen(false);
    setSelectedAction(null);
  };

  // Filter actions based on states
  const filteredActions = actions.filter(action => {
    const matchesSearch =
      action.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.autoNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.owner.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWorkshop = selectedWorkshop === 'Tous' || action.workshop === selectedWorkshop;
    const matchesDept = selectedDept === 'Tous' || action.department === selectedDept;
    const matchesPriority = selectedPriority === 'Tous' || action.priority === selectedPriority;
    const matchesStatus = selectedStatus === 'Tous' || action.status === selectedStatus;

    return matchesSearch && matchesWorkshop && matchesDept && matchesPriority && matchesStatus;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critique': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold';
      case 'Haute': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold';
      case 'Moyenne': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
      case 'Basse': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Clôturé':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-200/40">
            <CheckCircle className="w-3.5 h-3.5" /> Clôturé
          </span>
        );
      case 'A valider':
        return (
          <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded text-[11px] font-bold border border-blue-200/40">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> A valider
          </span>
        );
      case 'En cours':
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded text-[11px] font-bold border border-amber-200/40">
            <Clock className="w-3.5 h-3.5" /> En cours
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> A faire
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
            Plan d'actions d'usine
          </p>
          <h2 className="text-2xl font-sans font-bold text-slate-900 dark:text-white tracking-tight">
            Registre Unique d'Actions Correctives
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Traçabilité, causes racines (RCA) et avancement des contre-mesures
          </p>
        </div>

        {/* Create Action Button */}
        {currentUser.role !== 'Viewer' && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer self-start shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nouvelle Action
          </button>
        )}
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bento-card p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Rechercher par sujet, n° d'action, responsable..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Quick Stats in Filter bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 px-2 font-mono">
            <span>Filtré : <strong className="text-slate-800 dark:text-slate-100">{filteredActions.length}</strong></span>
            <span>Clôturé : <strong className="text-emerald-600">{actions.filter(a => a.status === 'Clôturé').length}</strong></span>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Workshop Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1 font-mono">Périmètre / Site</label>
            <select
              value={selectedWorkshop}
              onChange={(e) => setSelectedWorkshop(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none font-semibold cursor-pointer"
            >
              <option value="Tous">Tous les sites</option>
              {workshops.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1 font-mono">Département (SQCDP)</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none font-semibold cursor-pointer"
            >
              <option value="Tous">Tous les départements</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1 font-mono">Priorité</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none font-semibold cursor-pointer"
            >
              <option value="Tous">Toutes priorités</option>
              {priorities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1 font-mono">Statut</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none font-semibold cursor-pointer"
            >
              <option value="Tous">Tous les statuts</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ACTIONS GRID LIST */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3 px-4 w-28">N° Action</th>
                <th className="py-3 px-4 w-40">Périmètre / Dept</th>
                <th className="py-3 px-4">Sujet / Description</th>
                <th className="py-3 px-4 w-36">Responsable</th>
                <th className="py-3 px-4 w-28">Échéance</th>
                <th className="py-3 px-4 w-24 text-center">Priorité</th>
                <th className="py-3 px-4 w-28 text-center">Statut</th>
                <th className="py-3 px-4 w-24 text-center">Taux</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredActions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                    Aucune action ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                filteredActions.map(action => (
                  <tr
                    key={action.id}
                    onClick={() => {
                      setSelectedAction(action);
                      setIsDetailOpen(true);
                    }}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/10 cursor-pointer transition-colors"
                  >
                    {/* Auto Number */}
                    <td className="py-4 px-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {action.autoNum}
                    </td>

                    {/* Workshop & Dept */}
                    <td className="py-4 px-4 space-y-0.5">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold block w-fit truncate max-w-[140px]" title={action.workshop}>
                        {action.workshop}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                        • {action.department}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="py-4 px-4 max-w-[320px]">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={action.subject}>
                        {action.subject}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5" title={action.description}>
                        {action.description}
                      </p>
                    </td>

                    {/* Owner */}
                    <td className="py-4 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {action.owner}
                    </td>

                    {/* Due Date */}
                    <td className={`py-4 px-4 text-xs font-mono font-medium ${
                      new Date(action.dueDate) < new Date() && action.status !== 'Clôturé'
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {action.dueDate}
                    </td>

                    {/* Priority */}
                    <td className="py-4 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityColor(action.priority)}`}>
                        {action.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      {getStatusBadge(action.status)}
                    </td>

                    {/* Completion rate bar */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                          {action.completionPercentage}%
                        </span>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${action.status === 'Clôturé' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${action.completionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD ACTION FORM */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-500" /> Créer une Action Corrective
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitAction} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Workshop */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Périmètre affecté</label>
                  <select
                    value={newWorkshop}
                    onChange={(e) => setNewWorkshop(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {workshops.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Département SQCDP</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sujet de l'action *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Sécurisation du robot de déchargement..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description du problème constaté</label>
                <textarea
                  rows={2}
                  placeholder="Description détaillée du problème physique ou organisationnel..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* RCA Cause racine */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cause Racine (RCA - 5 Pourquoi)</label>
                  <textarea
                    rows={2}
                    placeholder="Pourquoi le problème est arrivé ? (ex: Fatigue fixations...)"
                    value={newRootCause}
                    onChange={(e) => setNewRootCause(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Contre-mesures */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Action à mener (Contre-mesure)</label>
                  <textarea
                    rows={2}
                    placeholder="Quelle est la solution de verrouillage permanent ?"
                    value={newActionTaken}
                    onChange={(e) => setNewActionTaken(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Owner */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Responsable *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nom du pilote"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Due Date */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Échéance *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priorité</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statut Initial</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                >
                  Valider la Création
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ACTION DETAILS & COMMENT DISCUSSIONS */}
      {isDetailOpen && selectedAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{selectedAction.autoNum}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityColor(selectedAction.priority)}`}>
                  {selectedAction.priority}
                </span>
                <span className="text-xs text-slate-400 font-mono">Date : {selectedAction.date}</span>
              </div>
              <div className="flex items-center gap-1">
                {currentUser.role !== 'Viewer' && (
                  <button
                    onClick={handleDeleteAction}
                    title="Supprimer l'action"
                    className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setIsDetailOpen(false); setSelectedAction(null); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
              
              {/* Left Column: Details (8 cols) */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-950 dark:text-white leading-tight">
                    {selectedAction.subject}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Périmètre : <strong>{selectedAction.workshop}</strong> • Thématique : <strong>{selectedAction.department}</strong>
                  </p>
                </div>

                {/* Description block */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Description du constat physique</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                    {selectedAction.description || 'Aucune description rédigée.'}
                  </p>
                </div>

                {/* Causes & Counter-measures */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-rose-50/40 dark:bg-rose-950/10 p-3 rounded-lg border border-rose-100/60 dark:border-rose-950/40 space-y-1">
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider font-mono">Cause Racine (RCA)</span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                      {selectedAction.rootCause || 'En attente de démarche 5 Pourquoi (5 Whys).'}
                    </p>
                  </div>

                  <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-3 rounded-lg border border-emerald-100/60 dark:border-emerald-950/40 space-y-1">
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider font-mono">Action corrective planifiée</span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                      {selectedAction.actionTaken || 'Aucune contre-mesure spécifiée.'}
                    </p>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Pièces Jointes & Preuves Photographiques</span>
                  
                  {selectedAction.attachments.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Aucune pièce jointe (PDF, Excel, Photo d'avant/après) liée.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedAction.attachments.map(att => (
                        <div key={att.id} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                          {att.type.startsWith('image/') ? (
                            <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded-md border border-slate-200" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center font-bold text-[10px]">
                              PDF
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                            <p className="text-[10px] text-slate-400">{att.size}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interactive Status Transition & Percentage */}
                {currentUser.role !== 'Viewer' && (
                  <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-100/40 dark:border-blue-950/20 space-y-3">
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider font-mono block">Gérer l'avancement de l'action</span>
                    
                    {/* Status Toggle buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {statuses.map(s => {
                        const isSel = selectedAction.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleDetailStatusChange(s as any)}
                            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                              isSel
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>

                    {/* Progress Slider */}
                    {selectedAction.status !== 'Clôturé' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                          <span>Pourcentage d'avancement</span>
                          <span className="font-mono font-bold text-blue-600">{selectedAction.completionPercentage}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="95"
                          step="5"
                          value={selectedAction.completionPercentage}
                          onChange={(e) => {
                            onUpdateAction(selectedAction.id, {
                              completionPercentage: Number(e.target.value)
                            });
                          }}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Scribe & Comments Timeline (5 cols) */}
              <div className="md:col-span-5 border-l border-slate-100 dark:border-slate-800 pl-6 space-y-4 flex flex-col max-h-full">
                
                {/* Pilote Info Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg space-y-1.5 border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Pilote de l'action</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[10px]">
                      {selectedAction.owner[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedAction.owner}</p>
                      <p className="text-[9px] text-slate-400">Échéance cible : {selectedAction.dueDate}</p>
                    </div>
                  </div>
                </div>

                {/* Comments Timeline */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[220px]">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">Journal de Séance / Commentaires</span>
                  
                  {selectedAction.comments.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic py-4 text-center">Aucun commentaire rédigé pour le moment.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAction.comments.map(c => (
                        <div key={c.id} className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-[10px]">{c.user} <span className="text-[8px] font-normal text-slate-400">({c.role})</span></span>
                            <span className="text-[8px] text-slate-400 font-mono">{new Date(c.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-[10px] leading-relaxed">
                            {c.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Comment input */}
                {currentUser.role !== 'Viewer' && (
                  <form onSubmit={handleSubmitComment} className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <textarea
                      rows={2}
                      required
                      placeholder="Ajouter une mise à jour sur le terrain..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      Commenter <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
