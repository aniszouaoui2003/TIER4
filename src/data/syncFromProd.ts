/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { usingPostgres, loadRaw, persistRaw } from './store.js';

const PROD_URL = process.env.PROD_SYNC_URL || 'https://tier-4-chi.vercel.app';
const DEFAULT_PASSWORD_HASH = '$2b$10$RnjyBEVZhPYkD76LTtkFLeuQLK8XE6qnAkx3wVZhoMQlWAg6ChN0O';
const ENDPOINTS = ['kpis', 'actions', 'meetings', 'sql-config', 'logs', 'attendance', 'gemba', 'users'] as const;

async function fetchJson(endpoint: string): Promise<any> {
  const res = await fetch(`${PROD_URL}/api/${endpoint}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status}`);
  return res.json();
}

// Refreshes the local (file-backed) data store from the live production API on every local dev
// startup, so local never silently drifts from what's actually deployed. Production never returns
// bcrypt password hashes (see stripPasswordHash in server.ts), so hashes are carried over from the
// existing local file by user id — falling back to the shared default hash for brand-new accounts.
// Skipped when running against Postgres directly (already the same live data) or on Vercel itself.
// Set SKIP_PROD_SYNC=1 to keep working on local-only test data across a restart.
export async function syncFromProdOnStartup(): Promise<void> {
  if (usingPostgres || process.env.VERCEL || process.env.SKIP_PROD_SYNC) return;

  try {
    const [kpis, actions, meetings, sqlConfig, logs, attendance, gemba, prodUsers] = await Promise.all(
      ENDPOINTS.map(fetchJson)
    );

    const local = await loadRaw<any>();
    const localHashById = new Map((local?.users || []).map((u: any) => [u.id, u.passwordHash]));

    const users = (prodUsers as any[]).map(u => ({
      ...u,
      passwordHash: localHashById.get(u.id) || DEFAULT_PASSWORD_HASH
    }));

    await persistRaw({
      kpis,
      actions,
      meetings,
      sqlConfig,
      logs,
      users,
      attendance,
      gemba: gemba.records || [],
      gembaMonthlyTarget: gemba.monthlyTarget ?? 2,
      meetingStepsMigrated: true
    });

    console.log(`[sync-from-prod] Local data refreshed from ${PROD_URL} (${users.length} users, ${kpis.length} KPIs, ${logs.length} logs).`);
  } catch (err) {
    console.warn(`[sync-from-prod] Skipped — could not reach ${PROD_URL}, keeping existing local data:`, (err as Error).message);
  }
}
