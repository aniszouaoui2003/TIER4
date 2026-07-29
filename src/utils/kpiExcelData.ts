/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared row/value logic for the KPI Excel import/export feature, used by both the Saisie KPIs
// grid (current-view export, review-before-save import) and the Configuration admin panel
// (full-base export, direct-save import). Kept independent of any component's live-edit state
// so both call sites compute identical values from the same persisted KPI data.

import { KPI, KPIStatus } from '../types';
import { MONTH_WEEK_RANGES, CURRENT_WEEK } from './weekCalendar';

export type RowType = 'total' | 'site1' | 'site2';
type HistoryEntry = { date: string; value: number };

export const ALL_WEEKS: number[] = Array.from({ length: 52 }, (_, i) => i + 1);

const isLowerBetterMetric = (kpiName: string, category: string): boolean => {
  const name = kpiName.toLowerCase();
  return (
    category === 'Sécurité' ||
    name.includes('accidents') ||
    name.includes('ppm') ||
    name.includes('retard') ||
    name.includes('accident') ||
    name.includes('panne') ||
    name.includes('absentéisme') ||
    name.includes('déchet') ||
    name.includes('consommation') ||
    name.includes('électricité') ||
    name.includes('eau')
  );
};

export const evaluateStatus = (value: number, target: number, kpiName: string, category: string): KPIStatus => {
  const isLowerBetter = isLowerBetterMetric(kpiName, category);
  if (isLowerBetter) {
    if (value <= target) return 'Green';
    if (value <= target * 1.15) return 'Orange';
    return 'Red';
  }
  if (value >= target) return 'Green';
  if (value >= target * 0.9) return 'Orange';
  return 'Red';
};

// Row types to render for one KPI under a given site view — mirrors the Saisie KPIs grid.
export function rowTypesForKpi(kpi: KPI, siteView: RowType): RowType[] {
  if (siteView === 'site1') return [kpi.site1Checked ? 'site1' : 'total'];
  if (siteView === 'site2') return [kpi.site2Checked ? 'site2' : 'total'];
  return ['total', ...(kpi.site1Checked ? (['site1'] as RowType[]) : []), ...(kpi.site2Checked ? (['site2'] as RowType[]) : [])];
}

// A row is importable unless it's an auto-calculated KPI, or it's a Total row whose value is
// always derived from Site 1 + Site 2 (so it has nothing of its own to overwrite).
export function isRowEditable(kpi: KPI, rowType: RowType): boolean {
  if (kpi.isCalculated) return false;
  const bothSites = !!(kpi.site1Checked && kpi.site2Checked);
  return !(rowType === 'total' && bothSites);
}

function historyField(rowType: RowType): 'history' | 'site1History' | 'site2History' {
  return rowType === 'site1' ? 'site1History' : rowType === 'site2' ? 'site2History' : 'history';
}

function monthlyField(rowType: RowType): 'monthlyOverrides' | 'site1MonthlyOverrides' | 'site2MonthlyOverrides' {
  return rowType === 'site1' ? 'site1MonthlyOverrides' : rowType === 'site2' ? 'site2MonthlyOverrides' : 'monthlyOverrides';
}

// Combines whichever of Site 1 / Site 2 have a value into the Total, per the KPI's own
// siteAggregation setting ('sum' by default, preserving pre-existing behavior). Averaging divides
// by however many sites actually reported, not always 2 — a week with only one site entered
// isn't "half" of anything. Exported so live-edit preview logic (KPITeamGuruEntry.tsx) can apply
// the exact same rule to in-progress edits that haven't been saved yet.
export function aggregateSites(v1: number | null | undefined, v2: number | null | undefined, aggregation: 'sum' | 'average' | undefined): number | null {
  const vals = [v1, v2].filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Number((aggregation === 'average' ? sum / vals.length : sum).toFixed(2));
}

// Weekly value for one row; the Total row of a site-tracked KPI is always derived live from its
// sites via aggregateSites (never read from `history` directly) — including calculated KPIs,
// whose site1History/site2History already hold their own formula-evaluated results.
export function getWeeklyRowValue(kpi: KPI, rowType: RowType, week: number): number | null {
  const label = `Semaine ${week}`;
  const siteTracked = !!(kpi.site1Checked || kpi.site2Checked);
  if (rowType === 'total' && siteTracked) {
    const h1 = kpi.site1Checked ? kpi.site1History?.find(h => h.date === label) : undefined;
    const h2 = kpi.site2Checked ? kpi.site2History?.find(h => h.date === label) : undefined;
    return aggregateSites(h1?.value, h2?.value, kpi.siteAggregation);
  }
  const found = (kpi[historyField(rowType)] as HistoryEntry[] | undefined)?.find(h => h.date === label);
  return found ? Number(found.value) : null;
}

// Effective monthly value for one row: a manual override wins, otherwise the average of the
// weeks reported so far in that month. Total is always derived from its sites' effective monthly
// values via aggregateSites (so it inherits their overrides too).
export function getMonthlyRowValue(kpi: KPI, rowType: RowType, monthIndex: number): number | null {
  const month = MONTH_WEEK_RANGES[monthIndex];
  const siteTracked = !!(kpi.site1Checked || kpi.site2Checked);

  if (rowType === 'total' && siteTracked) {
    const v1 = kpi.site1Checked ? getMonthlyRowValue(kpi, 'site1', monthIndex) : null;
    const v2 = kpi.site2Checked ? getMonthlyRowValue(kpi, 'site2', monthIndex) : null;
    return aggregateSites(v1, v2, kpi.siteAggregation);
  }

  const override = (kpi[monthlyField(rowType)] as HistoryEntry[] | undefined)?.find(e => e.date === month.name);
  if (override) return Number(override.value);

  const vals = month.weeks.map(w => getWeeklyRowValue(kpi, rowType, w)).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
}

// Merges one imported numeric cell into a working-copy accumulator, exactly like manual entry
// in the grid: weekly cells upsert into history (recomputing the site-sum Total and, for the
// current week, the live snapshot fields); monthly cells always land as an override.
export function applyImportedValue(
  working: Partial<KPI>,
  kpi: KPI,
  rowType: RowType,
  periodLabel: string,
  isWeekly: boolean,
  value: number
): void {
  if (!isWeekly) {
    const field = monthlyField(rowType);
    const arr = [...(((working as any)[field] as HistoryEntry[] | undefined) || ((kpi as any)[field] as HistoryEntry[] | undefined) || [])];
    const idx = arr.findIndex(e => e.date === periodLabel);
    if (idx !== -1) arr[idx] = { ...arr[idx], value }; else arr.push({ date: periodLabel, value });
    (working as any)[field] = arr;
    return;
  }

  if (rowType === 'total') {
    const history = [...(working.history || kpi.history)];
    const idx = history.findIndex(h => h.date === periodLabel);
    if (idx !== -1) history[idx] = { ...history[idx], value }; else history.push({ date: periodLabel, value });
    working.history = history;
    if (periodLabel === `Semaine ${CURRENT_WEEK}`) {
      working.weeklyValue = value;
      working.status = evaluateStatus(value, working.target ?? kpi.target, kpi.name, kpi.category);
    }
    return;
  }

  const field = rowType === 'site1' ? 'site1History' : 'site2History';
  const otherField = rowType === 'site1' ? 'site2History' : 'site1History';
  const siteHistory = [...(((working as any)[field] as HistoryEntry[] | undefined) || ((kpi as any)[field] as HistoryEntry[] | undefined) || [])];
  const idx = siteHistory.findIndex(h => h.date === periodLabel);
  if (idx !== -1) siteHistory[idx] = { ...siteHistory[idx], value }; else siteHistory.push({ date: periodLabel, value });
  (working as any)[field] = siteHistory;

  const otherHistory = ((working as any)[otherField] as HistoryEntry[] | undefined) || ((kpi as any)[otherField] as HistoryEntry[] | undefined) || [];
  const otherHasSite = rowType === 'site1' ? kpi.site2Checked : kpi.site1Checked;
  const otherVal = otherHasSite ? (otherHistory.find(h => h.date === periodLabel)?.value ?? 0) : 0;
  const totalForDate = Number((value + otherVal).toFixed(2));

  const totalHistory = [...(working.history || kpi.history)];
  const tIdx = totalHistory.findIndex(h => h.date === periodLabel);
  if (tIdx !== -1) totalHistory[tIdx] = { ...totalHistory[tIdx], value: totalForDate }; else totalHistory.push({ date: periodLabel, value: totalForDate });
  working.history = totalHistory;

  if (periodLabel === `Semaine ${CURRENT_WEEK}`) {
    (working as any)[rowType === 'site1' ? 'site1Value' : 'site2Value'] = value;
    working.weeklyValue = totalForDate;
    working.status = evaluateStatus(totalForDate, working.target ?? kpi.target, kpi.name, kpi.category);
  }
}

export const SITE_LABEL: Record<RowType, string> = { total: 'Total', site1: 'Site 1', site2: 'Site 2' };

export function siteLabelToRowType(label: string): RowType {
  const trimmed = label.trim();
  if (trimmed === 'Site 1') return 'site1';
  if (trimmed === 'Site 2') return 'site2';
  return 'total';
}

export interface ExportBuildResult {
  headers: string[];
  rows: (string | number)[][];
}

// Builds the header/row grid for an export — one row per (KPI, visible site row) pair, values
// for the requested period axis. `kpisToExport` is whatever the caller already filtered
// (category/search/"my KPIs" for the live grid, or the full base for a full backup).
export function buildExportSheet(
  kpisToExport: KPI[],
  periodMode: 'monthly' | 'weekly',
  siteView: RowType
): ExportBuildResult {
  const periodHeaders = periodMode === 'monthly'
    ? MONTH_WEEK_RANGES.map(m => m.name)
    : ALL_WEEKS.map(w => `Semaine ${w}`);

  const headers = ['ID KPI', 'Catégorie', 'Indicateur', 'Site', 'Unité', 'Cible', 'Modifiable', ...periodHeaders];

  const rows: (string | number)[][] = [];
  kpisToExport.forEach(kpi => {
    rowTypesForKpi(kpi, siteView).forEach(rowType => {
      const editable = isRowEditable(kpi, rowType);
      const periodValues = periodMode === 'monthly'
        ? MONTH_WEEK_RANGES.map((_, idx) => getMonthlyRowValue(kpi, rowType, idx) ?? '')
        : ALL_WEEKS.map(w => getWeeklyRowValue(kpi, rowType, w) ?? '');

      rows.push([
        kpi.id,
        kpi.category,
        kpi.name,
        SITE_LABEL[rowType],
        kpi.unit,
        kpi.target,
        editable ? 'Oui' : 'Non',
        ...periodValues
      ]);
    });
  });

  return { headers, rows };
}

export interface ImportParseResult {
  updates: Record<string, Partial<KPI>>;
  appliedCount: number;
  skipped: string[];
}

// Parses raw sheet rows into a ready-to-save updates map, merging multiple imported cells for
// the same KPI (e.g. Semaine 29 and Semaine 30 in one file) into a single accumulated edit
// rather than committing to React state per-cell, which would race against itself.
export function parseImportRows(
  parsed: { headers: string[]; rows: string[][] },
  kpis: KPI[],
  existingEdits: Record<string, Partial<KPI>> = {}
): ImportParseResult {
  const { headers, rows } = parsed;
  const idIdx = headers.indexOf('ID KPI');
  const siteIdx = headers.indexOf('Site');
  if (idIdx === -1 || siteIdx === -1) {
    throw new Error('Colonnes "ID KPI" ou "Site" introuvables dans le fichier.');
  }

  const periodStartIdx = headers.findIndex((h, i) => i > siteIdx && (h.startsWith('Semaine ') || MONTH_WEEK_RANGES.some(m => m.name === h)));
  if (periodStartIdx === -1) {
    throw new Error('Aucune colonne de période (Semaine ou mois) trouvée dans le fichier.');
  }
  const isWeekly = headers[periodStartIdx].startsWith('Semaine ');

  const acc: Record<string, Partial<KPI>> = {};
  const skipped: string[] = [];
  let appliedCount = 0;

  rows.forEach(cells => {
    const kpiId = (cells[idIdx] || '').trim();
    const siteLabel = (cells[siteIdx] || '').trim();
    const kpi = kpis.find(k => k.id === kpiId);

    if (!kpi) { skipped.push(`${kpiId || '(vide)'} : KPI introuvable`); return; }

    const rowType = siteLabelToRowType(siteLabel);
    if (!isRowEditable(kpi, rowType)) {
      const reason = kpi.isCalculated ? 'calculé automatiquement' : 'Total calculé depuis Site 1 + Site 2';
      skipped.push(`${kpi.name}${rowType !== 'total' ? ` (${SITE_LABEL[rowType]})` : ''} : ${reason}, ignoré`);
      return;
    }

    for (let i = periodStartIdx; i < headers.length; i++) {
      const raw = cells[i];
      if (raw === undefined || raw.trim() === '') continue;
      const num = Number(raw);
      if (isNaN(num)) continue;

      // Only create/touch the accumulator entry once there's an actual value to apply — an
      // editable row with every period cell blank (i.e. nothing changed) must not appear in
      // `updates`, or it would flag that KPI as modified for no reason.
      if (!acc[kpi.id]) acc[kpi.id] = { ...(existingEdits[kpi.id] || {}) };
      applyImportedValue(acc[kpi.id], kpi, rowType, headers[i], isWeekly, num);
      appliedCount++;
    }
  });

  return { updates: acc, appliedCount, skipped };
}
