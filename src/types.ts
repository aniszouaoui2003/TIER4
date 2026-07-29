/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'DGA (Administrateur)'
  | 'directeur QHSE'
  | 'DRH'
  | 'Responsable de production'
  | 'Directeur Export'
  | 'Directeur Compta&contrôle de gestion'
  | 'Directeur technique'
  | 'DAF'
  | 'Viewer'
  | 'Admin'
  | 'DG'
  | 'DI'
  | 'Prod'
  | 'Qual'
  | 'Maint'
  | 'RH'
  | 'Log'
  | 'Workshop';

// Account type driving access control — 'admin' has unrestricted access to every module plus
// Configuration/Utilisateurs; 'user' is gated by its own `permissions` map below.
export type AccessLevel = 'admin' | 'user';

// One flag per module a 'user' account can be granted access to. Configuration and the SQL
// connector are deliberately excluded — those stay admin-only regardless of this map.
export type ModuleId =
  | 'dashboard'
  | 'modules'
  | 'kpi-entry'
  | 'presence-tracker'
  | 'gemba-tracker'
  | 'actions'
  | 'meetings';

export type ModulePermissions = Record<ModuleId, boolean>;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessLevel: AccessLevel;
  // Only meaningful when accessLevel === 'user' — admins implicitly have access to everything.
  permissions?: ModulePermissions;
  // Server-only: a bcrypt hash, never included in any API response sent to the client. Optional
  // here only so the shared type still matches the (hash-stripped) objects the frontend receives.
  passwordHash?: string;
  // True whenever the current password was set by someone other than the account holder (a brand
  // new account, or an admin reset) — enforcement only blocks 'user' accounts (see App.tsx), but
  // the flag itself is tracked for every account so it stays meaningful if that's ever loosened.
  mustChangePassword?: boolean;
  department?: string;
  avatar?: string;
}

export type KPIStatus = 'Green' | 'Orange' | 'Red';
export type KPITrend = 'up' | 'down' | 'stable';

export interface KPI {
  id: string;
  category: 'Sécurité' | 'Qualité' | 'Production' | 'Coût' | 'Livraison' | 'RH' | 'Maintenance' | 'Amélioration continue';
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
  site1Owner?: string;
  site2Owner?: string;
  officeplastOwner?: string;
  // Per-site weekly history ("Semaine N" labels), independent from the combined `history` above.
  site1History?: { date: string; value: number }[];
  site2History?: { date: string; value: number }[];
  // Manual monthly entries (month-name labels) that override the computed weekly rollup for
  // that month. Removing an entry here reverts the cell to the computed weekly average.
  monthlyOverrides?: { date: string; value: number }[];
  site1MonthlyOverrides?: { date: string; value: number }[];
  site2MonthlyOverrides?: { date: string; value: number }[];
  // How the Total row combines Site 1 + Site 2 for any KPI tracked on both — 'sum' (default when
  // absent, preserving pre-existing behavior) or 'average'.
  siteAggregation?: 'sum' | 'average';
  // True for any KPI whose value is computed automatically rather than entered directly — read-
  // only in the grid. When also paired with `formula`/`formulaInputs` it's driven by the generic
  // formula engine (src/utils/formulaEngine.ts); without those two it's computed some other way
  // (e.g. présence/Gemba, driven by their own tracker) and stays exactly as before.
  isCalculated?: boolean;
  // Arithmetic expression over the aliases defined in formulaInputs, e.g. "(PC-(NC1*2+NC2))/PC*100".
  formula?: string;
  // Alias -> source KPI id, e.g. { PC: 'kpi-qual-pc', NC1: 'kpi-qual-nc1', NC2: 'kpi-qual-nc2' }.
  formulaInputs?: Record<string, string>;
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
  kpiId?: string; // Optional link to the KPI this action is meant to improve
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

export type AttendanceStatus = 'Présent' | 'Absent' | 'Délégué';

export interface AttendanceRecord {
  userId: string;
  userName: string;
  userRole: string;
  userDepartment: string;
  status: AttendanceStatus;
}

export interface WeeklyAttendance {
  week: string;
  records: AttendanceRecord[];
}

export interface GembaRecord {
  userId: string;
  userName: string;
  userRole: string;
  userDepartment: string;
  count: number; // Gemba walks done by this person during that specific week
}

export interface WeeklyGemba {
  week: string;
  records: GembaRecord[];
}

