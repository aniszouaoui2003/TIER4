/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'Admin'
  | 'DG' // Directeur Général
  | 'DI' // Directeur Industriel
  | 'Prod' // Responsable Production
  | 'Qual' // Responsable Qualité
  | 'Maint' // Responsable Maintenance
  | 'RH' // Responsable Ressources Humaines
  | 'Log' // Responsable Logistique
  | 'Workshop' // Manager Atelier
  | 'Viewer'; // Consultation uniquement

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  avatar?: string;
}

export type KPIStatus = 'Green' | 'Orange' | 'Red';
export type KPITrend = 'up' | 'down' | 'stable';

export interface KPI {
  id: string;
  category: 'Sécurité' | 'Qualité' | 'Production' | 'Coût' | 'Livraison' | 'RH' | 'Maintenance' | '5S' | 'Environnement';
  name: string;
  unit: string;
  dailyValue: number;
  weeklyValue: number;
  target: number;
  trend: KPITrend;
  status: KPIStatus;
  history: { date: string; value: number }[];
  description: string;
  greenThreshold: string; // e.g., ">= target" or "<= target" or specific range
  owner: string;
  site1Checked: boolean;
  site2Checked: boolean;
  totalChecked: boolean;
  site1Value?: number;
  site2Value?: number;
}

export interface ActionAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
}

export interface ActionComment {
  id: string;
  user: string;
  role: UserRole;
  text: string;
  date: string;
}

export interface Action {
  id: string;
  autoNum: string; // e.g., "ACT-2026-001"
  date: string;
  workshop: string;
  department: string;
  subject: string;
  description: string;
  rootCause: string;
  actionTaken: string;
  owner: string;
  dueDate: string;
  priority: 'Basse' | 'Moyenne' | 'Haute' | 'Critique';
  status: 'A faire' | 'En cours' | 'A valider' | 'Clôturé';
  completionPercentage: number;
  comments: ActionComment[];
  attachments: ActionAttachment[];
}

export interface MeetingAttendee {
  name: string;
  role: string;
  email: string;
  present: boolean;
  signed?: boolean;
  signatureDate?: string;
}

export interface Meeting {
  id: string;
  date: string;
  weekNumber: number;
  facilitator: string;
  scribe: string;
  status: 'planned' | 'ongoing' | 'completed';
  attendees: MeetingAttendee[];
  activeStepIndex: number;
  stepComments: Record<string, string>; // key is category
  stepDecisions: Record<string, string>; // key is category
  generalDecisions: string[];
  reportPdfUrl?: string;
}

export interface SQLServerConfig {
  host: string;
  database: string;
  username: string;
  port: number;
  isConnected: boolean;
  lastSyncTime: string | null;
  syncIntervalMinutes: number;
  mode: 'Demonstration' | 'SQLServer';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  details: string;
}
