#!/usr/bin/env node
/**
 * Phone notifications (services/phoneNotifications.ts).
 *
 * Plans them from made-up wallets and checks that:
 *   - a bill gets a reminder the evening before it's due, or that morning once
 *     the evening has passed, and none once the morning has passed too; bills
 *     more than a week away wait
 *   - the same bill planned twice gets the same number, so it replaces itself
 *   - the bell's budget and daily-limit notes become alerts that open the
 *     same screens, each shown once; records of shown alerts are pruned
 *   - the switch and the record live under keys ending in `_<uid>`, which
 *     sign-out removes
 *
 * Usage (after `npm ci`):
 *   node scripts/check-phone-notifications.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-phone-'));
const bundle = join(tmp, 'phone.mjs');
await build({
  entryPoints: [join(root, 'services', 'phoneNotifications.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});
const P = await import(pathToFileURL(bundle).href);
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
const ok = (label, value) => eq(label, !!value, true);

const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
let seq = 0;
const out = (date, amount, category, merchant) =>
  ({ id: `t${++seq}`, date, type: 'EXPENSE', amount, category, merchant, note: '' });
const hhmm = d => d && `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

// ── Numbers ────────────────────────────────────────────────────────────────
{
  const a = P.notificationNumber('bill:netflix:2026-11-22');
  eq('number: stable', P.notificationNumber('bill:netflix:2026-11-22'), a);
  ok('number: a positive 31-bit int', Number.isInteger(a) && a > 0 && a <= 0x7fffffff);
  const keys = Array.from({ length: 500 }, (_, i) => `budget:Cat${i}:2026-11:over`);
  eq('number: 500 keys, 500 numbers', new Set(keys.map(P.notificationNumber)).size, 500);
}

// ── Bills ──────────────────────────────────────────────────────────────────
const netflix = n => `UPI/DR/62${n}00000000/NETFLIX COM/ICIC/netflix@icici/UPI`;
const rent = n => `IMPS/P2A/51${n}0000000/SUNRISE HOMES/ICIC0000456`;
const gym = n => `NACH/DR/6${n}/IRONHOUSE GYM`;
const list = [
  ...['2026-08-22', '2026-09-22', '2026-10-22'].map((d, i) => out(d, 649, 'Streaming', netflix(i))), // due 22 Nov
  ...['2026-08-25', '2026-09-25', '2026-10-25'].map((d, i) => out(d, 22000, 'Rent', rent(i))), // due 25 Nov
  ...['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map((d, i) => out(d, 1800, 'Fitness', gym(i))), // due 1 Dec
];
{
  const now = new Date(2026, 10, 20, 12, 0); // Fri 20 Nov, noon
  const r = P.billReminders(list, now, money);
  eq('bills: this week, soonest first; the gym on 1 Dec waits', r.map(b => [b.title, hhmm(b.at)]), [
    ['Netflix.com is due tomorrow', '21 18:00'],
    ['Sunrise Homes is due tomorrow', '24 18:00'],
  ]);
  eq('bills: body', r[0]?.body, 'Usually about ₹649, going by your past payments.');
  eq('bills: open Recurring', [r[0]?.screen, r[0]?.kind], ['PULSE_RECURRING', 'bill']);
  ok('bills: key names the payee and day', /^bill:.+:2026-11-22$/.test(r[0]?.key ?? ''));
  eq('bills: planned again, same numbers', P.billReminders(list, new Date(2026, 10, 20, 15), money).map(b => b.id), r.map(b => b.id));

  const eveningGone = P.billReminders(list, new Date(2026, 10, 21, 19, 0), money);
  eq('bills: evening before gone, that morning instead', eveningGone.map(b => [b.title, hhmm(b.at)])[0], ['Netflix.com is due today', '22 9:00']);
  const morningGone = P.billReminders(list, new Date(2026, 10, 22, 10, 0), money);
  eq('bills: due today, morning gone: nothing for it', morningGone.map(b => b.title), ['Sunrise Homes is due tomorrow']);
  const later = P.billReminders(list, new Date(2026, 10, 26, 10, 0), money);
  // Monthly on the 1st, 31 days apart at most: expected 2 Dec.
  eq('bills: a week ahead, the gym', later.map(b => [b.title, hhmm(b.at)]), [['Ironhouse Gym is due tomorrow', '1 18:00']]);

  const many = Array.from({ length: 12 }, (_, k) =>
    ['2026-08-23', '2026-09-23', '2026-10-23'].map((d, i) => out(d, 100 + k, 'Bills', `NACH/DR/7${k}${i}/PAYEE ${String.fromCharCode(65 + k)} LTD`))).flat();
  eq('bills: at most 8 waiting', P.billReminders(many, now, money).length, 8);
}

// ── Alerts ─────────────────────────────────────────────────────────────────
{
  const now = new Date(2026, 10, 20, 18, 30);
  const month = [
    out('2026-11-03', 3200, 'Dining', 'A'), out('2026-11-12', 3000, 'Dining', 'B'),
    out('2026-11-05', 6500, 'Groceries', 'C'),
    out('2026-11-20', 2340, 'Shopping', 'D'),
  ];
  const alerts = P.currentAlerts({ counted: month, budgets: { Dining: 5000, Groceries: 8000 }, dailyLimit: 1500, now, money });
  eq('alerts: the bell\'s budget and limit notes', alerts.map(a => a.key), ['budget:Dining:2026-11:over', 'budget:Groceries:2026-11:near', 'limit:2026-11-20']);
  eq('alerts: shown now', alerts.map(a => a.at), [null, null, null]);
  eq('alerts: a budget opens Flow on Goals', [alerts[0].screen, alerts[0].section], ['INCOME_INSIGHTS', 'goals']);
  eq('alerts: the limit opens Pulse', alerts[2].screen, 'ANALYSIS');
  eq('alerts: title', alerts[0].title, 'Dining is over budget');

  const t0 = now.getTime();
  let shown = P.markShown({}, ['budget:Dining:2026-11:over'], t0);
  eq('alerts: each shown once', P.newAlerts(alerts, shown).map(a => a.key), ['budget:Groceries:2026-11:near', 'limit:2026-11-20']);
  shown = P.markShown(shown, ['limit:2026-11-20'], t0 + 1000);
  eq('alerts: first time kept', shown['budget:Dining:2026-11:over'], t0);
  const later = P.markShown(shown, [], t0 + 61 * 24 * 60 * 60 * 1000);
  eq('alerts: records older than two months dropped', Object.keys(later), []);
}

// ── The switch and the record ──────────────────────────────────────────────
{
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  eq('switch: off at first', P.phoneNotificationsOn('u1', storage), false);
  P.setPhoneNotificationsOn('u1', true, storage);
  eq('switch: on', P.phoneNotificationsOn('u1', storage), true);
  eq('switch: per account', P.phoneNotificationsOn('u2', storage), false);
  P.saveShown('u1', { 'limit:2026-11-20': 5 }, storage);
  eq('record: read back', P.loadShown('u1', storage), { 'limit:2026-11-20': 5 });
  ok('keys end in _<uid>, so sign-out removes them', [...mem.keys()].every(k => k.endsWith('_u1')));
  P.setPhoneNotificationsOn('u1', false, storage);
  eq('switch: off again', P.phoneNotificationsOn('u1', storage), false);
  mem.set(P.phoneKeys('u1').shown, '{not json');
  eq('record: unreadable is empty', P.loadShown('u1', storage), {});
}

console.log(`${checks - failures}/${checks} phone notification checks passed`);
if (failures) process.exit(1);
