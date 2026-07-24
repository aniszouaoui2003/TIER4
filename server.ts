/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { loadRaw, persistRaw } from './src/data/store.js';
import { MONTH_WEEK_RANGES, CURRENT_WEEK, getMonthIndexForWeek } from './src/utils/weekCalendar.js';

// Load environment variables
dotenv.config();

// Determine directory name safely in both ES Module and CommonJS scopes
const getPaths = () => {
  try {
    const isESM = typeof import.meta !== 'undefined' && !!import.meta.url;
    const filename = isESM ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
    const dirname = isESM ? path.dirname(filename) : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());
    return { filename, dirname };
  } catch {
    return { filename: '', dirname: process.cwd() };
  }
};
const { filename: __filename, dirname: __dirname } = getPaths();

// Initialize Express
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Import initial data structures
import {
  INITIAL_KPIS,
  INITIAL_ACTIONS,
  INITIAL_MEETINGS,
  INITIAL_SQL_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_USERS,
  INITIAL_ATTENDANCE,
  INITIAL_GEMBA,
  INITIAL_GEMBA_TARGET
} from './src/data/mockData.js';

// Helper to initialize and retrieve database
interface DataStoreSchema {
  kpis: typeof INITIAL_KPIS;
  actions: typeof INITIAL_ACTIONS;
  meetings: typeof INITIAL_MEETINGS;
  sqlConfig: typeof INITIAL_SQL_CONFIG;
  logs: typeof INITIAL_AUDIT_LOGS;
  users: typeof INITIAL_USERS;
  attendance: typeof INITIAL_ATTENDANCE;
  gemba: typeof INITIAL_GEMBA;
  gembaMonthlyTarget: number;
}

function evaluateKPIStatus(value: number, target: number, name: string, category: string): 'Green' | 'Orange' | 'Red' {
  const lowerName = name.toLowerCase();
  const isLowerBetter =
    category === 'Sécurité' ||
    lowerName.includes('accidents') ||
    lowerName.includes('ppm') ||
    lowerName.includes('retard') ||
    lowerName.includes('accident') ||
    lowerName.includes('panne') ||
    lowerName.includes('absentéisme') ||
    lowerName.includes('déchet') ||
    lowerName.includes('consommation') ||
    lowerName.includes('électricité') ||
    lowerName.includes('eau');

  if (isLowerBetter) {
    if (value <= target) return 'Green';
    if (value <= target * 1.15) return 'Orange';
    return 'Red';
  } else {
    if (value >= target) return 'Green';
    if (value >= target * 0.9) return 'Orange';
    return 'Red';
  }
}

function updateKPIHistory(kpi: any, week: string, value: number) {
  if (!kpi.history) kpi.history = [];
  const idx = kpi.history.findIndex((h: any) => h.date === week);
  if (idx !== -1) {
    kpi.history[idx].value = value;
  } else {
    kpi.history.push({ date: week, value });
  }
}

// A formula KPI has nothing to compute from until at least one of its raw inputs has a
// recorded value or history entry — until then, leave it untouched instead of manufacturing
// a fallback "100%" (or "0%") reading out of an empty dataset.
function hasRecordedData(...kpis: (typeof INITIAL_KPIS[number] | undefined)[]): boolean {
  return kpis.some(k => k && (k.weeklyValue !== 0 || (k.history && k.history.length > 0)));
}

// Only backfill weeks the raw inputs actually recorded — never a fixed legacy week range.
function recordedWeeks(...kpis: (typeof INITIAL_KPIS[number] | undefined)[]): string[] {
  const weeks = new Set<string>();
  kpis.forEach(k => k?.history?.forEach(h => weeks.add(h.date)));
  return Array.from(weeks);
}

function recalculateAllFormulas(db: DataStoreSchema) {
  if (!db.kpis) return;

  const currentWeekLabel = `Semaine ${CURRENT_WEEK}`;

  // 1. Recalculate % de conformité = (PC - (NC1 * 2 + NC2)) / PC * 100
  const pc = db.kpis.find(k => k.id === 'kpi-qual-pc');
  const nc1 = db.kpis.find(k => k.id === 'kpi-qual-nc1');
  const nc2 = db.kpis.find(k => k.id === 'kpi-qual-nc2');
  const conf = db.kpis.find(k => k.id === 'kpi-qual-conformite');

  if (conf && hasRecordedData(pc, nc1, nc2)) {
    const pcW = pc?.weeklyValue || 0;
    const nc1W = nc1?.weeklyValue || 0;
    const nc2W = nc2?.weeklyValue || 0;
    const valW = pcW > 0 ? ((pcW - (nc1W * 2 + nc2W)) / pcW) * 100 : 100;
    conf.weeklyValue = Number(Math.max(0, Math.min(100, valW)).toFixed(1));

    const pcD = pc?.dailyValue || 0;
    const nc1D = nc1?.dailyValue || 0;
    const nc2D = nc2?.dailyValue || 0;
    const valD = pcD > 0 ? ((pcD - (nc1D * 2 + nc2D)) / pcD) * 100 : 100;
    conf.dailyValue = Number(Math.max(0, Math.min(100, valD)).toFixed(1));

    conf.status = evaluateKPIStatus(conf.weeklyValue, conf.target, conf.name, conf.category);
    updateKPIHistory(conf, currentWeekLabel, conf.weeklyValue);

    recordedWeeks(pc, nc1, nc2).forEach(w => {
      const pcH = pc?.history?.find(h => h.date === w)?.value || 0;
      const nc1H = nc1?.history?.find(h => h.date === w)?.value || 0;
      const nc2H = nc2?.history?.find(h => h.date === w)?.value || 0;
      const valH = pcH > 0 ? ((pcH - (nc1H * 2 + nc2H)) / pcH) * 100 : 100;
      updateKPIHistory(conf, w, Number(Math.max(0, Math.min(100, valH)).toFixed(1)));
    });
  }

  // 2. Recalculate % de productivité = (QF / QP) * 100
  const qf = db.kpis.find(k => k.id === 'kpi-prod-qf');
  const qp = db.kpis.find(k => k.id === 'kpi-prod-qp');
  const prod = db.kpis.find(k => k.id === 'kpi-prod-productivite');

  if (prod && hasRecordedData(qf, qp)) {
    const qfW = qf?.weeklyValue || 0;
    const qpW = qp?.weeklyValue || 0;
    prod.weeklyValue = qpW > 0 ? Number(((qfW / qpW) * 100).toFixed(1)) : 100;

    const qfD = qf?.dailyValue || 0;
    const qpD = qp?.dailyValue || 0;
    prod.dailyValue = qpD > 0 ? Number(((qfD / qpD) * 100).toFixed(1)) : 100;

    prod.status = evaluateKPIStatus(prod.weeklyValue, prod.target, prod.name, prod.category);
    updateKPIHistory(prod, currentWeekLabel, prod.weeklyValue);

    recordedWeeks(qf, qp).forEach(w => {
      const qfH = qf?.history?.find(h => h.date === w)?.value || 0;
      const qpH = qp?.history?.find(h => h.date === w)?.value || 0;
      const valH = qpH > 0 ? (qfH / qpH) * 100 : 100;
      updateKPIHistory(prod, w, Number(valH.toFixed(1)));
    });
  }

  // 3. Recalculate % recette = RF/RP
  const rf = db.kpis.find(k => k.id === 'kpi-cost-rf');
  const rp = db.kpis.find(k => k.id === 'kpi-cost-rp');
  const ratio = db.kpis.find(k => k.id === 'kpi-cost-ratio');

  if (ratio && hasRecordedData(rf, rp)) {
    const rfW = rf?.weeklyValue || 0;
    const rpW = rp?.weeklyValue || 0;
    ratio.weeklyValue = rpW > 0 ? Number(((rfW / rpW) * 100).toFixed(1)) : 100;

    const rfD = rf?.dailyValue || 0;
    const rpD = rp?.dailyValue || 0;
    ratio.dailyValue = rpD > 0 ? Number(((rfD / rpD) * 100).toFixed(1)) : 100;

    ratio.status = evaluateKPIStatus(ratio.weeklyValue, ratio.target, ratio.name, ratio.category);
    updateKPIHistory(ratio, currentWeekLabel, ratio.weeklyValue);

    recordedWeeks(rf, rp).forEach(w => {
      const rfH = rf?.history?.find(h => h.date === w)?.value || 0;
      const rpH = rp?.history?.find(h => h.date === w)?.value || 0;
      const valH = rpH > 0 ? (rfH / rpH) * 100 : 100;
      updateKPIHistory(ratio, w, Number(valH.toFixed(1)));
    });
  }

  // 4. Recalculate "valeur produite" = rf (recette fabrique)
  const valProd = db.kpis.find(k => k.id === 'kpi-cost-valeur-produite');
  if (rf && valProd && hasRecordedData(rf)) {
    valProd.weeklyValue = rf.weeklyValue;
    valProd.dailyValue = rf.dailyValue;
    valProd.target = rf.target;
    valProd.status = evaluateKPIStatus(valProd.weeklyValue, valProd.target, valProd.name, valProd.category);
    updateKPIHistory(valProd, currentWeekLabel, valProd.weeklyValue);

    recordedWeeks(rf).forEach(w => {
      const rfH = rf.history?.find(h => h.date === w)?.value || 0;
      updateKPIHistory(valProd, w, rfH);
    });
  }

  // 5. Recalculate % déchet = Valeur déchet/Valeur produite
  const valDechet = db.kpis.find(k => k.id === 'kpi-cost-valeur-dechet');
  const tauxDechet = db.kpis.find(k => k.id === 'kpi-cost-taux-dechet');

  if (valDechet && valProd && tauxDechet && hasRecordedData(valDechet, valProd)) {
    const vdW = valDechet.weeklyValue || 0;
    const vpW = valProd.weeklyValue || 0;
    tauxDechet.weeklyValue = vpW > 0 ? Number(((vdW / vpW) * 100).toFixed(2)) : 0;

    const vdD = valDechet.dailyValue || 0;
    const vpD = valProd.dailyValue || 0;
    tauxDechet.dailyValue = vpD > 0 ? Number(((vdD / vpD) * 100).toFixed(2)) : 0;

    tauxDechet.status = evaluateKPIStatus(tauxDechet.weeklyValue, tauxDechet.target, tauxDechet.name, tauxDechet.category);
    updateKPIHistory(tauxDechet, currentWeekLabel, tauxDechet.weeklyValue);

    recordedWeeks(valDechet, valProd).forEach(w => {
      const vdH = valDechet.history?.find(h => h.date === w)?.value || 0;
      const vpH = valProd.history?.find(h => h.date === w)?.value || 0;
      const valH = vpH > 0 ? (vdH / vpH) * 100 : 0;
      updateKPIHistory(tauxDechet, w, Number(valH.toFixed(2)));
    });
  }
}

async function readDB(): Promise<DataStoreSchema> {
  try {
    const data = await loadRaw<DataStoreSchema>();
    if (data) {
      let modified = false;

      if (!data.users || data.users.length === 0) {
        data.users = INITIAL_USERS;
        modified = true;
      }

      const hasOldUsers = data.attendance && data.attendance.some((week: any) =>
        week.records && week.records.some((rec: any) => rec.userName === 'Jean-Pierre Dubois' || rec.userName === 'Marc Lemaire')
      );

      if (!data.attendance || hasOldUsers) {
        data.attendance = INITIAL_ATTENDANCE;
        modified = true;
      }

      const hasOldMeetings = data.meetings && data.meetings.some((m: any) =>
        m.facilitator && m.facilitator.includes('Marc Lemaire')
      );

      if (!data.meetings || hasOldMeetings) {
        data.meetings = INITIAL_MEETINGS;
        modified = true;
      }

      if (!data.kpis || data.kpis.length === 0) {
        data.kpis = INITIAL_KPIS;
        modified = true;
      }

      if (!data.gemba) {
        data.gemba = INITIAL_GEMBA;
        modified = true;
      }

      if (data.gembaMonthlyTarget === undefined || data.gembaMonthlyTarget === null) {
        data.gembaMonthlyTarget = INITIAL_GEMBA_TARGET;
        modified = true;
      }

      if (modified) {
        await writeDB(data);
      }
      return data;
    }
  } catch (err) {
    console.error('Error reading database, using fallback mock data:', err);
  }

  // Return default mock structures
  const defaultData: DataStoreSchema = {
    kpis: INITIAL_KPIS,
    actions: INITIAL_ACTIONS,
    meetings: INITIAL_MEETINGS,
    sqlConfig: INITIAL_SQL_CONFIG,
    logs: INITIAL_AUDIT_LOGS,
    users: INITIAL_USERS,
    attendance: INITIAL_ATTENDANCE,
    gemba: INITIAL_GEMBA,
    gembaMonthlyTarget: INITIAL_GEMBA_TARGET
  };
  await writeDB(defaultData);
  return defaultData;
}

async function writeDB(data: DataStoreSchema) {
  try {
    recalculateAllFormulas(data);
    await persistRaw(data);
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

// Helper to create audit log
async function addAuditLog(user: string, role: string, action: string, module: string, details: string) {
  const db = await readDB();
  const newLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user,
    role,
    action,
    module,
    details
  };
  db.logs.unshift(newLog);
  // Keep logs at a reasonable limit
  if (db.logs.length > 200) {
    db.logs = db.logs.slice(0, 200);
  }
  await writeDB(db);
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Users list
app.get('/api/users', async (req, res) => {
  const db = await readDB();
  res.json(db.users);
});

app.post('/api/users', async (req, res) => {
  const db = await readDB();
  const newUser = {
    id: `usr-${Date.now()}`,
    ...req.body
  };
  db.users.push(newUser);
  await writeDB(db);
  await addAuditLog(
    'Administrateur',
    'Admin',
    'Habilitation',
    'Utilisateurs',
    `Nouvel utilisateur inscrit : [${newUser.name}] avec le rôle [${newUser.role}]`
  );
  res.status(201).json(newUser);
});

// 2. KPIs list & single operations
app.get('/api/kpis', async (req, res) => {
  const db = await readDB();
  res.json(db.kpis);
});

app.put('/api/kpis/:id', async (req, res) => {
  const db = await readDB();
  const { id } = req.params;
  const index = db.kpis.findIndex(k => k.id === id);
  if (index !== -1) {
    db.kpis[index] = { ...db.kpis[index], ...req.body };
    await writeDB(db);
    await addAuditLog(
      req.body.modifiedBy || 'Jean-Pierre Dubois',
      req.body.modifiedByRole || 'DG',
      'Modification',
      'KPIs',
      `Mise à jour du KPI [${db.kpis[index].name}]`
    );
    res.json(db.kpis[index]);
  } else {
    res.status(404).json({ error: 'KPI non trouvé' });
  }
});

// Bulk update — applies every KPI's edits within a single read-modify-write cycle. The
// Saisie KPIs grid used to fire one PUT /api/kpis/:id per modified row via Promise.all; those
// requests each read the DB independently and raced each other's writes, silently dropping
// all but the last one to finish (e.g. saving 20+ modified KPIs at once could lose everything
// except one). Route all bulk saves through here instead of parallel single-KPI PUTs.
app.put('/api/kpis', async (req, res) => {
  const db = await readDB();
  const { updates, modifiedBy, modifiedByRole } = req.body as {
    updates?: Record<string, Record<string, unknown>>;
    modifiedBy?: string;
    modifiedByRole?: string;
  };

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates object is required.' });
  }

  const updatedNames: string[] = [];
  for (const [id, fields] of Object.entries(updates)) {
    const index = db.kpis.findIndex(k => k.id === id);
    if (index !== -1) {
      db.kpis[index] = { ...db.kpis[index], ...fields, modifiedBy, modifiedByRole } as typeof db.kpis[number];
      updatedNames.push(db.kpis[index].name);
    }
  }

  await writeDB(db);
  await addAuditLog(
    modifiedBy || 'Jean-Pierre Dubois',
    modifiedByRole || 'DG',
    'Modification groupée',
    'KPIs',
    `Mise à jour groupée de ${updatedNames.length} KPI(s) : ${updatedNames.join(', ')}`
  );

  res.json({ success: true, updated: updatedNames.length, kpis: db.kpis });
});

// Create new KPI (Admin UI capability)
app.post('/api/kpis', async (req, res) => {
  const db = await readDB();
  const newKpi = {
    id: `kpi-custom-${Date.now()}`,
    history: [
      { date: 'Semaine 24', value: req.body.weeklyValue || 0 },
      { date: 'Semaine 25', value: req.body.weeklyValue || 0 },
      { date: 'Semaine 26', value: req.body.weeklyValue || 0 }
    ],
    ...req.body
  };
  db.kpis.push(newKpi);
  await writeDB(db);
  await addAuditLog(
    req.body.modifiedBy || 'Administrateur',
    'Admin',
    'Création',
    'KPIs',
    `Nouveau KPI créé : [${newKpi.name}] dans [${newKpi.category}]`
  );
  res.status(201).json(newKpi);
});

// Delete KPI
app.delete('/api/kpis/:id', async (req, res) => {
  const db = await readDB();
  const { id } = req.params;
  const index = db.kpis.findIndex(k => k.id === id);
  if (index !== -1) {
    const deleted = db.kpis[index];
    db.kpis.splice(index, 1);
    await writeDB(db);
    await addAuditLog(
      (req.query.user as string) || 'Administrateur',
      (req.query.role as string) || 'Admin',
      'Suppression',
      'KPIs',
      `Suppression du KPI [${deleted.name}]`
    );
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'KPI non trouvé' });
  }
});

// 3. Action Plan Operations
app.get('/api/actions', async (req, res) => {
  const db = await readDB();
  res.json(db.actions);
});

app.post('/api/actions', async (req, res) => {
  const db = await readDB();
  const year = new Date().getFullYear();
  const nextNum = String(db.actions.length + 1).padStart(3, '0');
  const autoNum = `ACT-${year}-${nextNum}`;

  const newAction = {
    id: `act-${Date.now()}`,
    autoNum,
    date: new Date().toISOString().split('T')[0],
    completionPercentage: req.body.status === 'Clôturé' ? 100 : (req.body.completionPercentage || 0),
    comments: [],
    attachments: req.body.attachments || [],
    ...req.body
  };

  db.actions.unshift(newAction);
  await writeDB(db);

  await addAuditLog(
    req.body.createdBy || 'Sophie Martin',
    req.body.createdByRole || 'Prod',
    'Création',
    'Plan d\'actions',
    `Action [${autoNum}] créée par l'atelier [${newAction.workshop}]`
  );

  res.status(201).json(newAction);
});

app.put('/api/actions/:id', async (req, res) => {
  const db = await readDB();
  const { id } = req.params;
  const index = db.actions.findIndex(a => a.id === id);
  if (index !== -1) {
    const prevStatus = db.actions[index].status;
    
    // Automatically set 100% when Clôturé
    let completion = req.body.completionPercentage ?? db.actions[index].completionPercentage;
    if (req.body.status === 'Clôturé') {
      completion = 100;
    } else if (req.body.status === 'A faire') {
      completion = 0;
    }

    db.actions[index] = {
      ...db.actions[index],
      ...req.body,
      completionPercentage: completion
    };

    await writeDB(db);

    const user = req.body.modifiedBy || 'Marc Lemaire';
    const role = req.body.modifiedByRole || 'DI';

    if (prevStatus !== db.actions[index].status) {
      await addAuditLog(
        user,
        role,
        'Statut Action',
        'Plan d\'actions',
        `Action [${db.actions[index].autoNum}] passée de [${prevStatus}] à [${db.actions[index].status}]`
      );
    } else {
      await addAuditLog(
        user,
        role,
        'Modification Action',
        'Plan d\'actions',
        `Mise à jour des informations de l'action [${db.actions[index].autoNum}]`
      );
    }

    res.json(db.actions[index]);
  } else {
    res.status(404).json({ error: 'Action non trouvée' });
  }
});

// Delete Action
app.delete('/api/actions/:id', async (req, res) => {
  const db = await readDB();
  const { id } = req.params;
  const index = db.actions.findIndex(a => a.id === id);
  if (index !== -1) {
    const deleted = db.actions[index];
    db.actions.splice(index, 1);
    await writeDB(db);
    await addAuditLog(
      (req.query.user as string) || 'Administrateur',
      (req.query.role as string) || 'Admin',
      'Suppression',
      'Plan d\'actions',
      `Suppression de l'action [${deleted.autoNum}] : ${deleted.subject}`
    );
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Action non trouvée' });
  }
});

// Add comment to Action
app.post('/api/actions/:id/comments', async (req, res) => {
  const db = await readDB();
  const { id } = req.params;
  const index = db.actions.findIndex(a => a.id === id);
  if (index !== -1) {
    const newComment = {
      id: `c-${Date.now()}`,
      user: req.body.user,
      role: req.body.role,
      text: req.body.text,
      date: new Date().toISOString()
    };
    db.actions[index].comments.push(newComment);
    await writeDB(db);
    await addAuditLog(
      req.body.user,
      req.body.role,
      'Nouveau Commentaire',
      'Plan d\'actions',
      `Ajout d'un commentaire sur l'action [${db.actions[index].autoNum}]`
    );
    res.status(201).json(newComment);
  } else {
    res.status(404).json({ error: 'Action non trouvée' });
  }
});

// 4. Meetings orchestrator
app.get('/api/meetings', async (req, res) => {
  const db = await readDB();
  res.json(db.meetings);
});

app.put('/api/meetings/:id', async (req, res) => {
  const db = await readDB();
  const { id } = req.params;
  const index = db.meetings.findIndex(m => m.id === id);
  if (index !== -1) {
    db.meetings[index] = { ...db.meetings[index], ...req.body };
    await writeDB(db);
    res.json(db.meetings[index]);
  } else {
    res.status(404).json({ error: 'Réunion non trouvée' });
  }
});

// Create new review meeting
app.post('/api/meetings', async (req, res) => {
  const db = await readDB();
  
  // Close any ongoing meeting first
  db.meetings.forEach(m => {
    if (m.status === 'ongoing') {
      m.status = 'completed';
    }
  });

  const nextWeek = Math.max(...db.meetings.map(m => m.weekNumber), 26) + 1;
  const newMeeting = {
    id: `meet-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    weekNumber: nextWeek,
    facilitator: req.body.facilitator || 'Marc Lemaire (Directeur Industriel)',
    scribe: req.body.scribe || 'Sophie Martin (Prod)',
    status: 'ongoing' as 'planned' | 'ongoing' | 'completed',
    activeStepIndex: 0,
    attendees: req.body.attendees || INITIAL_MEETINGS[0].attendees,
    stepComments: {
      'Sécurité': '', 'Qualité': '', 'Livraison': '', 'Production': '', 'Coût': '', 'Maintenance': '', 'RH': '', '5S': '', 'Environnement': ''
    },
    stepDecisions: {
      'Sécurité': '', 'Qualité': '', 'Livraison': '', 'Production': '', 'Coût': '', 'Maintenance': '', 'RH': '', '5S': '', 'Environnement': ''
    },
    generalDecisions: []
  };

  db.meetings.unshift(newMeeting);
  await writeDB(db);

  await addAuditLog(
    req.body.createdBy || 'Marc Lemaire',
    'DI',
    'Début Réunion',
    'Réunion Tier 4',
    `Lancement d'une nouvelle revue hebdomadaire Tier 4 pour la semaine ${nextWeek}`
  );

  res.status(201).json(newMeeting);
});

// 5. Audit logs list
app.get('/api/logs', async (req, res) => {
  const db = await readDB();
  res.json(db.logs);
});

// 5b. Attendance API routes
app.get('/api/attendance', async (req, res) => {
  const db = await readDB();
  res.json(db.attendance || []);
});

app.post('/api/attendance', async (req, res) => {
  const db = await readDB();
  const { week, records } = req.body;

  if (!week || !records) {
    return res.status(400).json({ error: 'Week and records are required.' });
  }

  if (!db.attendance) {
    db.attendance = [];
  }

  const existingIdx = db.attendance.findIndex(a => a.week === week);
  if (existingIdx !== -1) {
    db.attendance[existingIdx].records = records;
  } else {
    db.attendance.push({ week, records });
  }

  // Calculate presence rate: Present = 1.0, Delegated = 1.0, Absent = 0.0
  const totalCount = records.length;
  const presentCount = records.filter((r: any) => r.status === 'Présent' || r.status === 'Délégué').length;
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

  // Auto-update 'kpi-rh-presence' KPI
  const kpiIdx = db.kpis.findIndex(k => k.id === 'kpi-rh-presence');
  if (kpiIdx !== -1) {
    const kpi = db.kpis[kpiIdx];

    // Update the live snapshot only if this is the current real week
    if (week === `Semaine ${CURRENT_WEEK}`) {
      kpi.weeklyValue = rate;
      kpi.status = rate >= 100 ? 'Green' : (rate >= 90 ? 'Orange' : 'Red');
    }

    // Update historical value
    const histIdx = kpi.history.findIndex(h => h.date === week);
    if (histIdx !== -1) {
      kpi.history[histIdx].value = rate;
    } else {
      kpi.history.push({ date: week, value: rate });
    }
    
    // Log KPI change
    await addAuditLog(
      'Système (Auto)',
      'Admin',
      'Calcul Présence',
      'Ressources Humaines',
      `Taux de présence au Tier4 recalculé à ${rate}% pour la ${week} et injecté dans le KPI [${kpi.name}].`
    );
  }

  await writeDB(db);

  res.json({
    success: true,
    week,
    calculatedRate: rate,
    attendance: db.attendance
  });
});

// Wipe all recorded weeks and reset the auto-injected 'kpi-rh-presence' KPI to a clean slate.
app.delete('/api/attendance', async (req, res) => {
  const db = await readDB();
  db.attendance = [];

  const kpi = db.kpis.find(k => k.id === 'kpi-rh-presence');
  if (kpi) {
    kpi.weeklyValue = 0;
    kpi.dailyValue = 0;
    kpi.status = 'Red';
    kpi.trend = 'stable';
    kpi.history = [];
  }

  await writeDB(db);
  await addAuditLog(
    'Système (Auto)',
    'Admin',
    'Réinitialisation',
    'Ressources Humaines',
    'Toutes les données de suivi de présence ont été supprimées.'
  );

  res.json({ success: true, attendance: db.attendance });
});

// 5c. Gemba HSE weekly tracking — cumulative % vs. a configurable monthly objective per person
app.get('/api/gemba', async (req, res) => {
  const db = await readDB();
  res.json({ records: db.gemba || [], monthlyTarget: db.gembaMonthlyTarget ?? 2 });
});

app.put('/api/gemba-target', async (req, res) => {
  const db = await readDB();
  const { target } = req.body;

  if (typeof target !== 'number' || !(target > 0)) {
    return res.status(400).json({ error: 'Objectif mensuel invalide.' });
  }

  db.gembaMonthlyTarget = target;
  await writeDB(db);
  await addAuditLog(
    'Administrateur',
    'Admin',
    'Configuration',
    'Sécurité',
    `Objectif mensuel Gemba HSE modifié à ${target} par personne.`
  );

  res.json({ success: true, monthlyTarget: target });
});

app.post('/api/gemba', async (req, res) => {
  const db = await readDB();
  const { week, records } = req.body;

  if (!week || !records) {
    return res.status(400).json({ error: 'Week and records are required.' });
  }

  if (!db.gemba) {
    db.gemba = [];
  }

  const existingIdx = db.gemba.findIndex(g => g.week === week);
  if (existingIdx !== -1) {
    db.gemba[existingIdx].records = records;
  } else {
    db.gemba.push({ week, records });
  }

  const target = db.gembaMonthlyTarget ?? 2;
  const weekNum = parseInt(String(week).replace(/\D/g, ''), 10) || 0;
  const monthIdx = getMonthIndexForWeek(weekNum);
  const monthRange = monthIdx !== -1 ? MONTH_WEEK_RANGES[monthIdx] : null;
  const kpi = db.kpis.find(k => k.id === 'kpi-sec-gemba');

  let currentWeekRate: number | null = null;

  if (monthRange) {
    // Recompute the cumulative-vs-target rate for every recorded week of this month, in
    // order — editing an earlier week must cascade forward into every later week's total,
    // since the objective is monthly and the count only ever accumulates within the month.
    const cumulativePerPerson = new Map<string, number>();

    for (const w of monthRange.weeks) {
      const label = `Semaine ${w}`;
      const weekData = db.gemba.find(g => g.week === label);
      if (!weekData) continue;

      weekData.records.forEach((r: any) => {
        cumulativePerPerson.set(r.userId, (cumulativePerPerson.get(r.userId) || 0) + (Number(r.count) || 0));
      });

      const totalPeople = weekData.records.length;
      const achieved = weekData.records.reduce((sum: number, r: any) => {
        const cum = cumulativePerPerson.get(r.userId) || 0;
        return sum + Math.min(cum, target);
      }, 0);
      const rate = totalPeople > 0 ? Math.round((achieved / (target * totalPeople)) * 100) : 100;

      if (kpi) {
        const histIdx = kpi.history.findIndex(h => h.date === label);
        if (histIdx !== -1) kpi.history[histIdx].value = rate;
        else kpi.history.push({ date: label, value: rate });
      }

      if (w === CURRENT_WEEK) {
        currentWeekRate = rate;
      }
    }
  }

  if (kpi && currentWeekRate !== null) {
    kpi.weeklyValue = currentWeekRate;
    kpi.dailyValue = currentWeekRate;
    kpi.status = currentWeekRate >= 95 ? 'Green' : (currentWeekRate >= 70 ? 'Orange' : 'Red');
  }

  await writeDB(db);
  await addAuditLog(
    'Système (Auto)',
    'Admin',
    'Calcul Gemba',
    'Sécurité',
    `Taux de Gemba HSE cumulé recalculé pour la ${week} et injecté dans le KPI [Suivi de Gemba HSE].`
  );

  res.json({
    success: true,
    week,
    gemba: db.gemba
  });
});

// Wipe all recorded weeks and reset the auto-injected 'kpi-sec-gemba' KPI to a clean slate.
app.delete('/api/gemba', async (req, res) => {
  const db = await readDB();
  db.gemba = [];

  const kpi = db.kpis.find(k => k.id === 'kpi-sec-gemba');
  if (kpi) {
    kpi.weeklyValue = 0;
    kpi.dailyValue = 0;
    kpi.status = 'Red';
    kpi.trend = 'stable';
    kpi.history = [];
  }

  await writeDB(db);
  await addAuditLog(
    'Système (Auto)',
    'Admin',
    'Réinitialisation',
    'Sécurité',
    'Toutes les données de suivi Gemba HSE ont été supprimées.'
  );

  res.json({ success: true, gemba: db.gemba });
});

// 6. SQL Server Sync Simulator
app.get('/api/sql-config', async (req, res) => {
  const db = await readDB();
  res.json(db.sqlConfig);
});

app.put('/api/sql-config', async (req, res) => {
  const db = await readDB();
  db.sqlConfig = { ...db.sqlConfig, ...req.body };
  await writeDB(db);
  res.json(db.sqlConfig);
});

// Execute SQL Server Sync (Demonstration)
app.post('/api/sql-sync', async (req, res) => {
  const db = await readDB();
  
  // Update SQL config status
  db.sqlConfig.isConnected = true;
  db.sqlConfig.lastSyncTime = new Date().toISOString();

  // Simulate updates to KPIs with slight variations
  db.kpis.forEach(k => {
    // Generate slight drift
    const drift = (Math.random() - 0.45) * (k.weeklyValue * 0.05);
    k.dailyValue = Number((k.dailyValue + (Math.random() - 0.5) * (k.dailyValue * 0.1)).toFixed(1));
    k.weeklyValue = Number((k.weeklyValue + drift).toFixed(1));
    
    // Add current week to history if it isn't there, or update last
    const currentWeekLabel = `Semaine ${db.meetings[0]?.weekNumber || 26}`;
    const lastHistory = k.history[k.history.length - 1];
    if (lastHistory && lastHistory.date === currentWeekLabel) {
      lastHistory.value = k.weeklyValue;
    } else {
      k.history.push({ date: currentWeekLabel, value: k.weeklyValue });
      if (k.history.length > 5) k.history.shift();
    }

    // Dynamic Trend
    if (drift > 0.1) k.trend = 'up';
    else if (drift < -0.1) k.trend = 'down';
    else k.trend = 'stable';

    // Recalculate status based on rules
    if (k.category === 'Sécurité') {
      k.status = k.weeklyValue === 0 ? 'Green' : 'Red';
    } else if (k.category === 'Qualité' && k.name.includes('PPM')) {
      k.status = k.weeklyValue <= 150 ? 'Green' : k.weeklyValue <= 180 ? 'Orange' : 'Red';
    } else if (k.category === 'Production' && k.name.includes('TRS')) {
      k.status = k.weeklyValue >= 80.0 ? 'Green' : k.weeklyValue >= 76.0 ? 'Orange' : 'Red';
    } else if (k.category === 'Environnement' && k.name.includes('Électricité')) {
      k.status = k.weeklyValue <= 85.0 ? 'Green' : k.weeklyValue <= 92.0 ? 'Orange' : 'Red';
    } else {
      // Default auto
      if (k.weeklyValue >= k.target) k.status = 'Green';
      else if (k.weeklyValue >= k.target * 0.9) k.status = 'Orange';
      else k.status = 'Red';
    }
  });

  await writeDB(db);

  await addAuditLog(
    req.body.user || 'Système (Auto)',
    req.body.role || 'Admin',
    'Synchronisation',
    'MES Database',
    `Synchronisation lancée avec succès. Connecteur SQL Server [MSSQL@${db.sqlConfig.host}]. 18 enregistrements actualisés.`
  );

  res.json({ success: true, lastSyncTime: db.sqlConfig.lastSyncTime, updatedKpis: db.kpis });
});

// ==========================================
// server-side GEMINI AI API IMPLEMENTATION
// ==========================================

// Initialize GoogleGenAI SDK
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    console.log('Gemini AI SDK initialized successfully on backend.');
  } catch (err) {
    console.error('Failed to initialize Gemini AI SDK:', err);
  }
} else {
  console.log('No GEMINI_API_KEY found in process.env. AI capabilities will run in fallback simulation mode.');
}

// Utility delay function for exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust caller with retry mechanism to handle transient API errors like 503 (high demand)
async function callGeminiWithRetry(contents: string, config?: any): Promise<string> {
  if (!ai) {
    throw new Error('AI client not initialized');
  }

  let lastError: any = null;
  const maxRetries = 3;
  const baseDelay = 500; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config
      });
      if (response.text) {
        return response.text;
      }
      throw new Error('Empty response text from Gemini');
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini call attempt ${attempt} failed:`, err.message || err);
      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 200;
        await delay(delayMs);
      }
    }
  }

  throw lastError || new Error('Gemini call failed after retries');
}

// Robust JSON parsing utility to strip potential Markdown code blocks and parse securely
function cleanAndParseJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(cleaned);
}

// Schemas for Gemini Structured JSON Output
const performanceSchema = {
  type: Type.OBJECT,
  properties: {
    syntheseGenerale: {
      type: Type.STRING,
      description: "Un résumé d'expert de 3-4 phrases sur la santé actuelle de la production, les goulots d'étranglements identifiés et le climat opérationnel."
    },
    topBottlenecks: {
      type: Type.ARRAY,
      description: "La liste des principaux goulots d'étranglements identifiés.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "Catégorie (ex: Qualité, Sécurité, Production, etc.)"
          },
          indicator: {
            type: Type.STRING,
            description: "Nom du KPI ou de l'indicateur affecté."
          },
          rootCause: {
            type: Type.STRING,
            description: "Hypothèse de cause racine selon l'analyse Lean."
          },
          recommendation: {
            type: Type.STRING,
            description: "Plan de contre-mesure immédiat type Kaizen, standard ou action rapide."
          }
        },
        required: ["category", "indicator", "rootCause", "recommendation"]
      }
    },
    risquesEscalade: {
      type: Type.ARRAY,
      description: "Un tableau de 3 alertes ou risques opérationnels d'escalade sous 48h si aucune action n'est menée.",
      items: {
        type: Type.STRING
      }
    },
    conseilLean: {
      type: Type.STRING,
      description: "Une citation ou un conseil méthodologique Lean Manufacturing fort et inspirant adapté à la situation."
    }
  },
  required: ["syntheseGenerale", "topBottlenecks", "risquesEscalade", "conseilLean"]
};

const meetingSchema = {
  type: Type.OBJECT,
  properties: {
    bulletinClimat: {
      type: Type.STRING,
      description: "Un bilan synthétique (3-4 phrases) du climat de l'usine, soulignant les réussites de l'équipe et les principaux points d'effort pour la semaine à venir."
    },
    pointsCles: {
      type: Type.ARRAY,
      description: "Une liste de 4 points stratégiques majeurs abordés ou validés lors de la séance.",
      items: {
        type: Type.STRING
      }
    },
    actionsSuggereesIA: {
      type: Type.ARRAY,
      description: "Des suggestions d'actions correctives basées sur les discussions de la réunion.",
      items: {
        type: Type.OBJECT,
        properties: {
          workshop: {
            type: Type.STRING,
            description: "Atelier concerné"
          },
          department: {
            type: Type.STRING,
            description: "Département (ex: Qualité, Sécurité, Production, Logistique)"
          },
          subject: {
            type: Type.STRING,
            description: "Sujet ou titre court de l'action corrective"
          },
          description: {
            type: Type.STRING,
            description: "Détail précis de la contre-mesure à mettre en oeuvre"
          },
          owner: {
            type: Type.STRING,
            description: "Responsable suggéré pour l'action"
          }
        },
        required: ["workshop", "department", "subject", "description", "owner"]
      }
    }
  },
  required: ["bulletinClimat", "pointsCles", "actionsSuggereesIA"]
};

// High-fidelity fallback simulated data for performance analysis
function getFallbackPerformance() {
  return {
    syntheseGenerale: "L'usine fait face à des tensions cumulées sur la Qualité (rebuts clients élevés à 210 PPM) et sur la Maintenance de la ligne CNC-4 (Disponibilité basse de 88.5%). De plus, un taux d'absentéisme de 5.8% impacte négativement l'allure de la ligne de montage. L'Atelier Injection performe correctement mais consomme trop d'électricité pour refroidir ses moules.",
    topBottlenecks: [
      {
        category: "Qualité",
        indicator: "Taux de rebuts clients (PPM)",
        rootCause: "Absence de détrompeur (Poka-Yoke) récurrent sur les étapes critiques d'assemblage et de contrôle dimensionnel.",
        recommendation: "Généraliser le déploiement de gabarits Poka-Yoke mécaniques et instruire les opérateurs via des fiches de poste visuelles."
      },
      {
        category: "Maintenance",
        indicator: "Disponibilité Équipements",
        rootCause: "Problèmes de colmatage et entretien préventif défaillant sur les échangeurs thermiques hydrauliques.",
        recommendation: "Mettre en place un planning de Maintenance Productive Totale (TPM) niveau 1 délégué aux opérateurs (nettoyage et vérification de pression quotidienne)."
      },
      {
        category: "RH",
        indicator: "Taux d'Absentéisme",
        rootCause: "Surcharges ponctuelles de travail et manque de polyvalence de l'équipe de nuit sur le poste de vissage.",
        recommendation: "Lancer un plan de formation flash croisé en fin d'équipe pour augmenter l'indice de polyvalence de 74% à 80%."
      }
    ],
    risquesEscalade: [
      "Retards accrus sur les commandes critiques de vannes 2 pouces si le vissage n'est pas soulagé.",
      "Pénalités financières directes du client principal en cas de nouvelle pièce PPM défectueuse reçue.",
      "Rupture de charge énergétique le week-end prochain si les refroidisseurs restent configurés à pleine puissance."
    ],
    conseilLean: "Le meilleur indicateur de la santé d'un atelier n'est pas le tableau Excel de résultats, mais la rigueur du respect des standards visuels au poste de travail."
  };
}

// High-fidelity fallback simulated data for meeting summary reports
function getFallbackMeetingSummary(weekNumber: number) {
  return {
    bulletinClimat: `La réunion Tier 4 de la semaine ${weekNumber} s'est déroulée de manière constructive. L'usine affiche un excellent bilan de Sécurité avec aucun accident à déplorer, conforté par une vigilance accrue de terrain. L'effort principal doit converger vers la logistique (OTIF sous pression) et les réglages de démarrage en injection pour résorber les surcoûts CNQ.`,
    pointsCles: [
      "Soutien total de la direction générale à l'embauche de 3 intérimaires qualifiés en injection pour pallier l'absentéisme de 5.8%.",
      "Mise sous contrôle immédiate de la presse de la ligne CNC-3 par l'intégration du gabarit Poka-Yoke.",
      "Programmation d'un audit physique d'urgence chez le sous-traitant fonderie pour sécuriser les approvisionnements bruts.",
      "Validation de la charte de marquage au sol 5S déclinée sur l'ensemble des ateliers."
    ],
    actionsSuggereesIA: [
      {
        workshop: "Atelier Injection",
        department: "Environnement",
        subject: "Audit de fuites d'air comprimé",
        description: "La hausse de consommation électrique suggère de potentielles fuites d'air comprimé sur le réseau de distribution moules. Programmer une recherche ultra-sons le week-end.",
        owner: "Lucas Petit"
      },
      {
        workshop: "Atelier Assemblage",
        department: "RH / Polyvalence",
        subject: "Matrice de polyvalence - Poste de vissage",
        description: "Former de toute urgence 2 opérateurs de rechange (Équipe A et B) sur le paramétrage et la conduite du vissage automatique pour libérer le goulot de cycle.",
        owner: "Sophie Martin"
      }
    ]
  };
}

// Gemini API Route 1: Analyze current plant performance to suggest bottleneck solutions
app.post('/api/ai/analyze-performance', async (req, res) => {
  const db = await readDB();
  const redKpis = db.kpis.filter(k => k.status === 'Red');
  const orangeKpis = db.kpis.filter(k => k.status === 'Orange');
  const activeActions = db.actions.filter(a => a.status !== 'Clôturé');

  const performancePrompt = `
En tant qu'expert d'élite en Lean Manufacturing, Direction Industrielle et Management SQCDP, analyse les indicateurs de performance d'usine suivants :
Indicateurs Critiques (Rouge/Red) :
${redKpis.map(k => `- ${k.category} > ${k.name} : Actuel=${k.weeklyValue}${k.unit} (Cible=${k.target}${k.unit})`).join('\n')}

Indicateurs Fragiles (Orange) :
${orangeKpis.map(k => `- ${k.category} > ${k.name} : Actuel=${k.weeklyValue}${k.unit} (Cible=${k.target}${k.unit})`).join('\n')}

Plans d'Actions Actifs en cours :
${activeActions.slice(0, 5).map(a => `- ${a.autoNum} [${a.department}] [Atelier: ${a.workshop}] : ${a.subject} (Avancement ${a.completionPercentage}%, Échéance: ${a.dueDate})`).join('\n')}

Fournis un rapport de synthèse analytique court destiné au Comité de Direction (au format JSON brut sans code block markdown Markdown comme \`\`\`json).
Tu dois renvoyer exactement cet objet JSON de structure :
{
  "syntheseGenerale": "Un résumé d'expert de 3-4 phrases sur la santé actuelle de la production, les goulots d'étranglements identifiés et le climat opérationnel.",
  "topBottlenecks": [
    {
      "category": "Catégorie (ex: Qualité, Production, etc)",
      "indicator": "Nom du KPI",
      "rootCause": "Hypothèse de cause racine Lean",
      "recommendation": "Plan de contre-mesure immédiat type Kaizen ou standard opérationnel"
    }
  ],
  "risquesEscalade": [
    "Un tableau de 3 alertes ou risques opérationnels d'escalade sous 48h si aucune action n'est menée"
  ],
  "conseilLean": "Une citation ou un conseil méthodologique Lean Manufacturing fort et inspirant adapté à la situation."
}
`;

  if (ai) {
    try {
      const text = await callGeminiWithRetry(performancePrompt, {
        responseMimeType: 'application/json',
        responseSchema: performanceSchema
      });
      res.json(cleanAndParseJSON(text));
    } catch (err: any) {
      console.error('Gemini performance analysis failed after retries, falling back to mock:', err);
      // Fallback gracefully on error so that transient 503s don't break the client dashboard
      res.json(getFallbackPerformance());
    }
  } else {
    // Return high-fidelity fallback simulation
    res.json(getFallbackPerformance());
  }
});

// Gemini API Route 2: Generate a beautiful meeting summary report
app.post('/api/ai/meeting-summary', async (req, res) => {
  const { meetingId } = req.body;
  const db = await readDB();
  const meeting = db.meetings.find(m => m.id === meetingId);

  if (!meeting) {
    return res.status(404).json({ error: 'Réunion introuvable' });
  }

  const meetingPrompt = `
En tant que secrétaire de séance expert de direction industrielle, analyse le procès-verbal de cette réunion Tier 4 :
Semaine : ${meeting.weekNumber}
Date : ${meeting.date}
Animateur : ${meeting.facilitator}
Secrétaire : ${meeting.scribe}

Commentaires par sujet SQCDP :
${Object.entries(meeting.stepComments).map(([cat, text]) => `- ${cat} : ${text}`).join('\n')}

Décisions par sujet SQCDP :
${Object.entries(meeting.stepDecisions).map(([cat, text]) => `- ${cat} : ${text}`).join('\n')}

Génère un résumé rédigé formel et impeccable pour le Directeur Général (au format JSON brut sans code block markdown comme \`\`\`json).
Tu dois renvoyer exactement cet objet JSON de structure :
{
  "bulletinClimat": "Un bilan synthétique (3-4 phrases) du climat de l'usine, soulignant les réussites de l'équipe et les principaux points d'effort pour la semaine à venir.",
  "pointsCles": [
    "Une liste de 4 points stratégiques majeurs abordés ou validés lors de la séance."
  ],
  "actionsSuggereesIA": [
    {
      "workshop": "Atelier concerné",
      "department": "Département (ex: Qualité, Sécurité)",
      "subject": "Sujet de l'action corrective",
      "description": "Détail précis de la contre-mesure à mettre en oeuvre",
      "owner": "Responsable suggéré"
    }
  ]
}
`;

  if (ai) {
    try {
      const text = await callGeminiWithRetry(meetingPrompt, {
        responseMimeType: 'application/json',
        responseSchema: meetingSchema
      });
      res.json(cleanAndParseJSON(text));
    } catch (err: any) {
      console.error('Gemini meeting summary failed after retries, falling back to mock:', err);
      // Fallback gracefully on error so that transient 503s don't break the client dashboard
      res.json(getFallbackMeetingSummary(meeting.weekNumber));
    }
  } else {
    // Return mock fallback
    res.json(getFallbackMeetingSummary(meeting.weekNumber));
  }
});


// ==========================================
// VITE DEV / PRODUCTION STATIC SERVER
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Dynamically imported so 'vite' (a devDependency) never has to be bundled
    // into the Vercel serverless function, which only runs in production mode.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Tier 4 Control Server] Running at http://localhost:${PORT}`);
  });
}

// On Vercel, the platform serves the built frontend and invokes this file as a
// serverless function per /api/* request — it must not bind a port or run Vite.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
