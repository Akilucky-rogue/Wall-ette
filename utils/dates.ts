/**
 * Transaction dates are local calendar days, 'YYYY-MM-DD' (audit H4).
 *
 * - Make a day from a Date's local getters (localDay), never toISOString():
 *   that is UTC, so in IST anything saved between 00:00 and 05:29, and any
 *   date picked at local midnight, lands on the day before.
 * - Read a day back as local midnight (parseDay), never new Date(day): that
 *   is UTC midnight, which is still the previous evening west of Greenwich.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UTC_MIDNIGHT = /^(\d{4}-\d{2}-\d{2})T00:00:00(\.000)?Z$/;

/** True for a 'YYYY-MM-DD' day. */
export const isDay = (value: unknown): value is string =>
  typeof value === 'string' && DAY.test(value);

/** The local calendar day of a moment (default: now). */
export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * A stored date as a Date: local midnight for a day. Anything else is parsed
 * as it is, so a timestamp from an earlier version still gives its local day.
 */
export const parseDay = (date: string): Date =>
  isDay(date)
    ? new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
    : new Date(date);

/** The day `n` days after `day` (before it, for a negative `n`). */
export const addDays = (day: string, n: number): string => {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
};

/**
 * The day and time an earlier version stored as a UTC timestamp, or null when
 * `stored` is already a day (or not a date at all).
 * - "...T00:00:00.000Z" was written by the old Edit dialog from the day picked
 *   there, so it is that day, with no time.
 * - Any other timestamp is the local day it falls on, and keeps its time
 *   unless that is local midnight (a day picked in New Entry's calendar).
 */
export const fromTimestamp = (stored: string): { date: string; createdAt?: string } | null => {
  if (isDay(stored)) return null;
  const utcMidnight = UTC_MIDNIGHT.exec(stored);
  if (utcMidnight) return { date: utcMidnight[1] };
  const d = new Date(stored);
  if (Number.isNaN(d.getTime())) return null;
  const atMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
  return atMidnight ? { date: localDay(d) } : { date: localDay(d), createdAt: d.toISOString() };
};

/** A stored date as a day (see fromTimestamp). */
export const toDay = (stored: string): string => fromTimestamp(stored)?.date ?? stored;

/** Sort order, newest first: by day, then by when the entry was added. */
export const byNewest = (
  a: { date: string; createdAt?: string },
  b: { date: string; createdAt?: string },
): number => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const ta = a.createdAt ?? '', tb = b.createdAt ?? '';
  return ta === tb ? 0 : ta < tb ? 1 : -1;
};
