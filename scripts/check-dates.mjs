#!/usr/bin/env node
/**
 * Transaction date check (audit H4).
 *
 * Runs utils/dates.ts in several time zones and checks that:
 *   - days are made and read back in local time, across month ends and DST
 *   - dates saved by earlier versions (UTC timestamps from New Entry and the
 *     old Edit dialog) map to the day the person picked
 *   - opening Edit and saving without changes keeps the day
 *   - analytics put a day in that day's bucket, west of Greenwich too
 *
 * Usage (after `npm ci`):
 *   node scripts/check-dates.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-dates-'));
const bundle = join(tmp, 'dates.mjs');
await build({
  stdin: {
    contents: [
      `export * from ${JSON.stringify(join(root, 'utils', 'dates.ts'))};`,
      `export { monthDailyStats } from ${JSON.stringify(join(root, 'services', 'analyticsService.ts'))};`,
    ].join('\n'),
    resolveDir: root,
    loader: 'ts',
  },
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});
const { addDays, byNewest, fromTimestamp, isDay, localDay, monthDailyStats, parseDay, toDay } =
  await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}: got ${a}, expected ${e}`);
  }
};

// IST first (the phone), then UTC, west and east of it, and two DST zones.
const ZONES = ['Asia/Kolkata', 'UTC', 'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London', 'Pacific/Auckland'];

for (const zone of ZONES) {
  process.env.TZ = zone; // Node re-reads the zone on assignment
  const before = failures;

  // Making and reading days
  eq('localDay at 00:30', localDay(new Date(2026, 10, 17, 0, 30)), '2026-11-17');
  eq('localDay at 23:59', localDay(new Date(2026, 10, 16, 23, 59)), '2026-11-16');
  const d = parseDay('2026-11-16');
  eq('parseDay is local midnight', [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 16, 0]);
  for (const day of ['2026-01-01', '2026-03-08', '2026-03-29', '2026-10-25', '2026-11-01', '2026-12-31']) {
    eq(`round trip ${day}`, localDay(parseDay(day)), day);
  }
  eq('addDays over a month end', addDays('2026-10-31', 1), '2026-11-01');
  eq('addDays over a year end', addDays('2026-12-31', 1), '2027-01-01');
  eq('addDays back over US DST', addDays('2026-11-02', -1), '2026-11-01');
  eq('addDays back over EU DST', addDays('2026-03-30', -1), '2026-03-29');
  eq('addDays -89', addDays('2026-11-17', -89), '2026-08-20');
  eq('isDay', [isDay('2026-11-16'), isDay('2026-11-16T00:00:00.000Z'), isDay(''), isDay(undefined)], [true, false, false, false]);

  // Dates saved by earlier versions (each written here the way the old code
  // wrote it, in this zone)
  const nowEntry = new Date(2026, 10, 17, 3, 0).toISOString(); // New Entry, "now" at 03:00
  eq('old "now" entry', fromTimestamp(nowEntry), { date: '2026-11-17', createdAt: nowEntry });
  const picked = new Date('2026-11-16T00:00:00').toISOString(); // New Entry calendar pick
  eq('old calendar pick', fromTimestamp(picked), { date: '2026-11-16' });
  const lastWeek = new Date(2026, 10, 10, 14, 32).toISOString(); // "Last Week" quick pick
  eq('old quick pick', fromTimestamp(lastWeek), { date: '2026-11-10', createdAt: lastWeek });
  const edited = new Date('2026-11-15').toISOString(); // old Edit dialog, form day 15 Nov
  eq('old Edit save', fromTimestamp(edited), { date: '2026-11-15' });
  eq('day is not a timestamp', fromTimestamp('2026-11-16'), null);
  eq('junk is left alone', [fromTimestamp('not a date'), toDay('not a date')], [null, 'not a date']);
  eq('toDay', [toDay('2026-11-16'), toDay(picked), toDay(nowEntry)], ['2026-11-16', '2026-11-16', '2026-11-17']);

  // Edit: open shows the stored day, Save without changes keeps it
  for (const stored of ['2026-11-16', toDay(picked)]) {
    const shown = toDay(stored);
    const saved = isDay(shown) ? shown : stored;
    eq(`Edit keeps ${stored}`, [shown, saved], [stored, stored]);
  }

  // New Entry: the day picked is the day saved
  eq('New Entry calendar pick', localDay(parseDay('2026-11-16')), '2026-11-16');
  eq('New Entry "now" at 00:30', localDay(new Date(2026, 10, 17, 0, 30)), '2026-11-17');

  // Newest first, then by time added
  const list = [
    { id: 'a', date: '2026-11-15' },
    { id: 'b', date: '2026-11-16' },
    { id: 'c', date: '2026-11-16', createdAt: '2026-11-16T09:00:00.000Z' },
    { id: 'd', date: '2026-11-16', createdAt: '2026-11-16T05:00:00.000Z' },
  ];
  eq('byNewest', [...list].sort(byNewest).map(t => t.id), ['c', 'd', 'b', 'a']);

  // Analytics: 1 Nov lands on 1 Nov, and a Monday on a Monday
  const stats = monthDailyStats([{ date: '2026-11-01', amount: 10 }, { date: '2026-11-30', amount: 5 }], new Date(2026, 10, 1));
  eq('month buckets', [stats.daily[0], stats.daily[29], stats.weekdayAvg[0] > 0, stats.weekdayAvg[1] > 0], [10, 5, true, true]);

  console.log(`${failures === before ? 'ok  ' : 'FAIL'} ${zone}`);
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
process.exit(failures > 0 ? 1 : 0);
