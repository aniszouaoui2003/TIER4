/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

// Determine directory name in ES Module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data-store.json');

// Import initial data structures
import {
  INITIAL_KPIS,
  INITIAL_ACTIONS,
  INITIAL_MEETINGS,
  INITIAL_SQL_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_USERS
} from './src/data/mockData';

// Helper to initialize and retrieve database
interface DataStoreSchema {
  kpis: typeof INITIAL_KPIS;
  actions: typeof INITIAL_ACTIONS;
  meetings: typeof INITIAL_MEETINGS;
  sqlConfig: typeof INITIAL_SQL_CONFIG;
  logs: typeof INITIAL_AUDIT_LOGS;
  users: typeof INITIAL_USERS;
}

function readDB(): DataStoreSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading database file, using fallback mock data:', err);
  }
  
  // Return default mock structures
  const defaultData: DataStoreSchema = {
    kpis: INITIAL_KPIS,
    actions: INITIAL_ACTIONS,
    meetings: INITIAL_MEETINGS,
    sqlConfig: INITIAL_SQL_CONFIG,
    logs: INITIAL_AUDIT_LOGS,
    users: INITIAL_USERS
  };
  writeDB(defaultData);
  return defaultData;
}

function writeDB(data: DataStoreSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Helper to create audit log
function addAuditLog(user: string, role: string, action: string, module: string, details: string) {
  const db = readDB();
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
  writeDB(db);
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Users list
app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users);
});

app.post('/api/users', (req, res) => {
  const db = readDB();
  const newUser = {
    id: `usr-${Date.now()}`,
    ...req.body
  };
  db.users.push(newUser);
  writeDB(db);
  addAuditLog(
    'Administrateur',
    'Admin',
    'Habilitation',
    'Utilisateurs',
    `Nouvel utilisateur inscrit : [${newUser.name}] avec le rôle [${newUser.role}]`
  );
  res.status(201).json(newUser);
});

// 2. KPIs list & single operations
app.get('/api/kpis', (req, res) => {
  const db = readDB();
  res.json(db.kpis);
});

app.put('/api/kpis/:id', (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.kpis.findIndex(k => k.id === id);
  if (index !== -1) {
    db.kpis[index] = { ...db.kpis[index], ...req.body };
    writeDB(db);
    addAuditLog(
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

// Create new KPI (Admin UI capability)
app.post('/api/kpis', (req, res) => {
  const db = readDB();
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
  writeDB(db);
  addAuditLog(
    req.body.modifiedBy || 'Administrateur',
    'Admin',
    'Création',
    'KPIs',
    `Nouveau KPI créé : [${newKpi.name}] dans [${newKpi.category}]`
  );
  res.status(201).json(newKpi);
});

// Delete KPI
app.delete('/api/kpis/:id', (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.kpis.findIndex(k => k.id === id);
  if (index !== -1) {
    const deleted = db.kpis[index];
    db.kpis.splice(index, 1);
    writeDB(db);
    addAuditLog(
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
app.get('/api/actions', (req, res) => {
  const db = readDB();
  res.json(db.actions);
});

app.post('/api/actions', (req, res) => {
  const db = readDB();
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
  writeDB(db);

  addAuditLog(
    req.body.createdBy || 'Sophie Martin',
    req.body.createdByRole || 'Prod',
    'Création',
    'Plan d\'actions',
    `Action [${autoNum}] créée par l'atelier [${newAction.workshop}]`
  );

  res.status(201).json(newAction);
});

app.put('/api/actions/:id', (req, res) => {
  const db = readDB();
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

    writeDB(db);

    const user = req.body.modifiedBy || 'Marc Lemaire';
    const role = req.body.modifiedByRole || 'DI';

    if (prevStatus !== db.actions[index].status) {
      addAuditLog(
        user,
        role,
        'Statut Action',
        'Plan d\'actions',
        `Action [${db.actions[index].autoNum}] passée de [${prevStatus}] à [${db.actions[index].status}]`
      );
    } else {
      addAuditLog(
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

// Add comment to Action
app.post('/api/actions/:id/comments', (req, res) => {
  const db = readDB();
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
    writeDB(db);
    addAuditLog(
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
app.get('/api/meetings', (req, res) => {
  const db = readDB();
  res.json(db.meetings);
});

app.put('/api/meetings/:id', (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.meetings.findIndex(m => m.id === id);
  if (index !== -1) {
    db.meetings[index] = { ...db.meetings[index], ...req.body };
    writeDB(db);
    res.json(db.meetings[index]);
  } else {
    res.status(404).json({ error: 'Réunion non trouvée' });
  }
});

// Create new review meeting
app.post('/api/meetings', (req, res) => {
  const db = readDB();
  
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
  writeDB(db);

  addAuditLog(
    req.body.createdBy || 'Marc Lemaire',
    'DI',
    'Début Réunion',
    'Réunion Tier 4',
    `Lancement d'une nouvelle revue hebdomadaire Tier 4 pour la semaine ${nextWeek}`
  );

  res.status(201).json(newMeeting);
});

// 5. Audit logs list
app.get('/api/logs', (req, res) => {
  const db = readDB();
  res.json(db.logs);
});

// 6. SQL Server Sync Simulator
app.get('/api/sql-config', (req, res) => {
  const db = readDB();
  res.json(db.sqlConfig);
});

app.put('/api/sql-config', (req, res) => {
  const db = readDB();
  db.sqlConfig = { ...db.sqlConfig, ...req.body };
  writeDB(db);
  res.json(db.sqlConfig);
});

// Execute SQL Server Sync (Demonstration)
app.post('/api/sql-sync', (req, res) => {
  const db = readDB();
  
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

  writeDB(db);

  addAuditLog(
    req.body.user || 'Système (Auto)',
    req.body.role || 'Admin',
    'Synchronisation',
    'MES Database',
    `Synchronisation lancée avec succès. Connecteur SQL Server [MSSQL@${db.sqlConfig.host}]. 18 enregistrements actualisés.`
  );

  res.json({ success: true, lastSyncTime: db.sqlConfig.lastSyncTime, updatedKpis: db.kpis });
});

// 7. Simulated Excel Import
app.post('/api/excel-import', (req, res) => {
  const db = readDB();
  const { fileName, items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Données d\'importation non valides' });
  }

  let updatedCount = 0;
  items.forEach((item: any) => {
    const kpi = db.kpis.find(k => k.id === item.id || k.name.toLowerCase() === String(item.name).toLowerCase());
    if (kpi) {
      if (item.dailyValue !== undefined) kpi.dailyValue = Number(item.dailyValue);
      if (item.weeklyValue !== undefined) kpi.weeklyValue = Number(item.weeklyValue);
      if (item.target !== undefined) kpi.target = Number(item.target);
      updatedCount++;
    }
  });

  writeDB(db);

  addAuditLog(
    req.body.user || 'Administrateur',
    req.body.role || 'Admin',
    'Importation Excel',
    'Administration',
    `Importation de ${updatedCount} indicateurs de performance depuis le fichier [${fileName || 'kpi_export.xlsx'}]`
  );

  res.json({ success: true, updatedCount });
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
  const db = readDB();
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
  const db = readDB();
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Tier 4 Control Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
