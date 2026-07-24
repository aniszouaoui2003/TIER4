/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Database,
  Sliders,
  TrendingUp,
  ShieldCheck,
  UserCheck,
  Building2,
  Users,
  LogOut,
  Moon,
  Sun,
  Grid,
  Footprints
} from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  allUsers: User[];
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  setCurrentUser,
  allUsers,
  isDarkMode,
  setIsDarkMode
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'modules', label: 'Indicateurs Métiers', icon: TrendingUp },
    { id: 'kpi-entry', label: 'Saisie KPIs', icon: Grid },
    { id: 'presence-tracker', label: 'Suivi Présence', icon: Users },
    { id: 'gemba-tracker', label: 'Suivi Gemba HSE', icon: Footprints },
    { id: 'actions', label: 'Plan d\'Actions', icon: ClipboardList },
    { id: 'meetings', label: 'Réunion Tier 4', icon: CalendarDays },
    { id: 'db-sync', label: 'Connecteur SQL', icon: Database },
    { id: 'admin', label: 'Configuration', icon: Sliders }
  ];

  const getRoleLabel = (role: UserRole) => {
    return role;
  };

  const getRoleColor = (role: UserRole) => {
    if (role.includes('DGA')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
    if (role.includes('Directeur') || role.includes('directeur')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
    if (role.includes('Responsable')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <aside className="w-68 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen shrink-0 transition-colors duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
          <Building2 className="w-5 h-5" id="sidebar-logo-icon" />
        </div>
        <div>
          <h1 className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-white uppercase">
            Officeplast
          </h1>
          <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
            TIER4 Meeting
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
          Menu Principal
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Role Selector & User Block */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Simuler un Rôle
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Changer de thème"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {/* Dropdown to switch user role directly in UI */}
        <div className="relative">
          <select
            id="role-simulator-select"
            value={currentUser.id}
            onChange={(e) => {
              const selected = allUsers.find(u => u.id === e.target.value);
              if (selected) {
                setCurrentUser(selected);
              }
            }}
            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {allUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({getRoleLabel(u.role)})
              </option>
            ))}
          </select>
        </div>

        {/* Current User Card */}
        <div className="flex items-center gap-2.5 pt-1">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase">
            {currentUser.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
              {currentUser.name}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {currentUser.email}
            </p>
            <div className="mt-1 flex">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getRoleColor(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
