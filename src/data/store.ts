/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const DB_FILE = path.join(process.cwd(), 'data-store.json');
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null;

export const usingPostgres = !!pool;

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_state (
          id INT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      )
      .then(() => undefined);
  }
  return tableReady;
}

// Loads the single JSON blob holding the whole Tier 4 data set.
export async function loadRaw<T>(): Promise<T | null> {
  if (pool) {
    await ensureTable();
    const { rows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
    return rows[0]?.data ?? null;
  }
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  }
  return null;
}

// Persists the whole JSON blob as a single upserted row.
export async function persistRaw<T>(data: T): Promise<void> {
  if (pool) {
    await ensureTable();
    const json = JSON.stringify(data);
    await pool.query(
      `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
      [json]
    );
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
