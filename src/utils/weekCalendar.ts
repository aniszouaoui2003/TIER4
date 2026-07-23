/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The app's single modeled exercise year, and its 52-week axis grouped into 12 months
// (4 or 5 weeks each, summing to 52) — shared by every weekly/monthly tracking view
// (Saisie TeamGuru, Suivi Présence, Suivi Gemba HSE) so they never drift out of sync.
export const CURRENT_YEAR = 2026;
export const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
export const WEEKS_PER_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5];

export interface MonthWeekRange {
  name: string;
  weeks: number[];
}

export const MONTH_WEEK_RANGES: MonthWeekRange[] = (() => {
  let start = 1;
  return MONTH_NAMES.map((name, i) => {
    const count = WEEKS_PER_MONTH[i];
    const weeks = Array.from({ length: count }, (_, k) => start + k);
    start += count;
    return { name, weeks };
  });
})();

// Standard ISO-8601 week number for a given date (week containing that date's Thursday).
export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// The "current" week is today's real date, not a value frozen at any demo's seed date.
export const CURRENT_WEEK = getISOWeek(new Date());

export const getWeekNum = (label: string): number => parseInt(label.replace(/\D/g, ''), 10) || 0;

export const getMonthIndexForWeek = (week: number): number =>
  MONTH_WEEK_RANGES.findIndex(m => m.weeks.includes(week));
