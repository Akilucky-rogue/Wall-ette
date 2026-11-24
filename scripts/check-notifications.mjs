#!/usr/bin/env node
/**
 * In-app notifications (services/notifications.ts).
 *
 * Builds the bell's notifications from made-up wallets and checks that:
 *   - failed unlock attempts are reported, but not a wrong password fixed a
 *     moment later, nor old ones; a wrong code reads as a code
 *   - budgets nearly used and over budget, and today's limit, use this
 *     month's spending; a budget going over after nearing is news again
 *   - entries imported twice (removed in Vault) and price rises still
 *     being charged (Pulse → Recurring) are found
 *   - recurring charges due in the next three days are listed, later ones not
 *   - an import reminder appears once the newest entry is a month old, and
 *     last month's savings goal only once that month is complete
 *   - seen, dismissed and old records: "New", "Earlier", pruning, and a
 *     storage key that sign-out removes
 *
 * Usage (after `npm ci`):
 *   node scripts/check-notifications.mjs
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
const tmp = mkdtempSync(join(tmpdir(), 'wallette-notifications-'));
const bundle = join(tmp, 'notifications.mjs');
await build({
  entryPoints: [join(root, 'services', 'notifications.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});
const N = await import(pathToFileURL(bundle).href);
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

const NOW = new Date(2026, 10, 20, 18, 30); // Fri 20 Nov 2026, 18:30
const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
let seq = 0;
const tx = (date, type, amount, category, merchant, id) =>
  ({ id: id ?? `t${++seq}`, date, type, amount, category, merchant, note: '' });
const out = (date, amount, category, merchant, id) => tx(date, 'EXPENSE', amount, category, merchant, id);
const inc = (date, amount, category, merchant) => tx(date, 'INCOME', amount, category, merchant);

const base = (over = {}) => ({
  now: NOW,
  transactions: [],
  counted: [],
  budgets: {},
  dailyLimit: 0,
  savingsGoal: 0,
  unlocks: [],
  updateReady: false,
  release: { versionCode: 14, version: '1.5.6', first: null },
  money,
  ...over,
});
const build_ = over => {
  const input = base(over);
  if (over.transactions && !over.counted) input.counted = over.transactions;
  return N.buildNotifications(input);
};
const ids = list => list.map(n => n.id);
const byPrefix = (list, prefix) => list.filter(n => n.id.startsWith(prefix));

// ── Security log ───────────────────────────────────────────────────────────
{
  const at = (d, h, m) => new Date(2026, 10, d, h, m);
  const typo = [{ at: at(19, 9, 0), ok: false, method: 'PASSWORD' }, { at: at(19, 9, 1), ok: true, method: 'PASSWORD' }];
  eq('security: a typo fixed a minute later is not news', ids(build_({ unlocks: typo })), []);

  const old = [{ at: at(1, 22, 0), ok: false, method: 'PASSWORD' }];
  eq('security: older than two weeks is left out', ids(build_({ unlocks: old })), []);

  const tries = [
    { at: at(20, 2, 10), ok: false, method: 'PASSWORD' },
    { at: at(20, 2, 11), ok: false, method: 'PASSWORD' },
    { at: at(20, 8, 0), ok: true, method: 'BIOMETRIC' }, // hours later: the tries still count
    ...typo,
  ];
  const [s] = build_({ unlocks: tries });
  eq('security: id is the latest failed try', s?.id, `security:${at(20, 2, 11).getTime()}`);
  eq('security: title counts the tries', s?.title, '2 failed unlock attempts');
  eq('security: body', s?.body, "Wrong passwords were entered on the lock screen, most recently today at 02:11. If that wasn't you, tap to change your password.");
  eq('security: opens Account and security', s?.action, { kind: 'screen', screen: 'SELF_ACCOUNT' });
  eq('security: first in the list', s?.rank, 0);

  const [code] = build_({ unlocks: [{ at: at(19, 23, 14), ok: false, method: 'MFA' }] });
  eq('security: a wrong code', code?.body, "A wrong code was entered on the lock screen yesterday at 23:14. If that wasn't you, tap to change your password.");
  eq('security: one try', code?.title, 'Failed unlock attempt');
}

// ── Budgets and the daily limit ────────────────────────────────────────────
{
  const list = [
    out('2026-11-03', 4000, 'Dining', 'UPI/DR/1/CAFE ONE/x/y'),
    out('2026-11-15', 2200, 'Dining', 'UPI/DR/2/CAFE TWO/x/y'),
    out('2026-11-08', 6500, 'Groceries', 'UPI/DR/3/GREEN GROCER/x/y'),
    out('2026-11-09', 1000, 'Travel', 'UPI/DR/4/CAB CO/x/y'),
    out('2026-10-30', 9000, 'Travel', 'UPI/DR/5/AIRLINE/x/y'), // last month: doesn't count
    out('2026-11-20', 1640, 'Shopping', 'UPI/DR/6/SHOE SHOP/x/y'),
    out('2026-11-20', 700, 'Coffee', 'UPI/DR/7/BEAN BAR/x/y'),
  ];
  const budgets = { Dining: 5000, Groceries: 8000, Travel: 3000, Books: 0 };
  const got = build_({ transactions: list, budgets, dailyLimit: 1500 });
  const b = byPrefix(got, 'budget:');
  eq('budgets: over, then nearly used', ids(b), ['budget:Dining:2026-11:over', 'budget:Groceries:2026-11:near']);
  eq('budgets: over title', b[0]?.title, 'Dining is over budget');
  eq('budgets: over body', b[0]?.body, '₹6,200 spent in November against a ₹5,000 budget, ₹1,200 over.');
  eq('budgets: near title', b[1]?.title, 'Groceries budget 81% used');
  eq('budgets: near body', b[1]?.body, '₹6,500 of ₹8,000 spent, with 10 days left in November.');
  eq('budgets: open Flow on Goals', b[0]?.action, { kind: 'screen', screen: 'INCOME_INSIGHTS', section: 'goals' });
  const limit = byPrefix(got, 'limit:');
  eq('limit: over today', ids(limit), ['limit:2026-11-20']);
  eq('limit: body', limit[0]?.body, '₹2,340 spent today, ₹840 more than your ₹1,500 daily limit.');
  eq('limit: under the limit says nothing', ids(byPrefix(build_({ transactions: list, dailyLimit: 5000 }), 'limit:')), []);
  eq('order: over budget before over the limit before nearly used', ids(got).filter(id => /^(budget|limit)/.test(id)),
    ['budget:Dining:2026-11:over', 'limit:2026-11-20', 'budget:Groceries:2026-11:near']);

  const lastDay = build_({ transactions: [out('2026-11-30', 900, 'Dining', 'x')], budgets: { Dining: 1000 }, now: new Date(2026, 10, 30, 12) });
  eq('budgets: on the last day', lastDay[0]?.body, '₹900 of ₹1,000 spent, on the last day of November.');
}

// ── Entries imported twice; price rises ────────────────────────────────────
{
  const myntra = 'UPI/DR/631811223344/MYNTRA DESIGNS/YESB/myntra@ybl/UPI';
  const imported = 'NEFT/N123456789/ACME RENTALS/HDFC0001234';
  const spotify = n => `UPI/DR/61${n}00000000/SPOTIFY INDIA/HDFC/spotify@hdfc/UPI`;
  const list = [
    out('2026-11-14', 1299, 'Clothing', myntra),
    out('2026-11-14', 1299, 'Clothing', myntra), // the same day twice, typed: not a statement copy
    out('2026-11-06', 590, 'Bank Charges', 'DEBIT CARD ANNUAL FEE'),
    out('2026-11-05', 15000, 'Rent', imported, 'import-1'),
    out('2026-11-05', 15000, 'Rent', imported, 'import-2'), // the same statement row, imported twice
    ...['2026-06-05', '2026-07-05', '2026-08-05'].map((d, i) => out(d, 119, 'Streaming', spotify(i))),
    ...['2026-09-05', '2026-10-05', '2026-11-05'].map((d, i) => out(d, 139, 'Streaming', spotify(i + 3))),
  ];
  const got = build_({ transactions: list });
  const copies = byPrefix(got, 'copies:');
  eq('copies: found', ids(copies), ['copies:1:-15000']);
  eq('copies: title', copies[0]?.title, 'A transaction is in your wallet twice');
  eq('copies: body', copies[0]?.body, 'Usually from importing an overlapping statement. They change your balance by ₹15,000. Remove the extra copies in Vault.');
  eq('copies: opens Vault', copies[0]?.action, { kind: 'screen', screen: 'HISTORY' });
  eq('no double-charge or bank-charge notices', ids(got).filter(id => /^(double|fees):/.test(id)), []);
  const creep = byPrefix(got, 'creep:');
  eq('creep: the price rise', creep[0]?.title, 'Spotify India costs more');
  eq('creep: body', creep[0]?.body, 'Up from ₹119 to ₹139 a month, about ₹240 more a year.');
  eq('creep: opens Recurring', creep[0]?.action, { kind: 'screen', screen: 'PULSE_RECURRING' });

  const stopped = list.filter(t => !(t.merchant.includes('SPOTIFY') && t.date >= '2026-10-01'));
  eq('creep: not once the charges stopped weeks ago', ids(byPrefix(build_({ transactions: stopped, now: new Date(2026, 11, 28) }), 'creep:')), []);

  const thrice = [...list, out('2026-11-05', 15000, 'Rent', imported, 'import-3')];
  eq('copies: three of one row', byPrefix(build_({ transactions: thrice }), 'copies:')[0]?.title, 'A transaction is in your wallet more than once');
}

// ── Recurring charges due soon ─────────────────────────────────────────────
{
  const netflix = n => `UPI/DR/62${n}00000000/NETFLIX COM/ICIC/netflix@icici/UPI`;
  const gym = n => `NACH/DR/6${n}/IRONHOUSE GYM`;
  const list = [
    ...['2026-08-22', '2026-09-22', '2026-10-22'].map((d, i) => out(d, 649, 'Streaming', netflix(i))),
    ...['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map((d, i) => out(d, 1800, 'Fitness', gym(i))),
  ];
  const due = byPrefix(build_({ transactions: list }), 'due:');
  eq('due: Netflix in two days, not the gym in 11', ids(due), ['due:upidrnetflixcomicicnetflixiciciupi:2026-11-22']);
  eq('due: title', due[0]?.title, 'Netflix.com is due on 22 Nov');
  eq('due: body', due[0]?.body, 'Usually about ₹649 a month.');
  eq('due: opens Recurring', due[0]?.action, { kind: 'screen', screen: 'PULSE_RECURRING' });
  eq('due: tomorrow', byPrefix(build_({ transactions: list, now: new Date(2026, 10, 21, 9) }), 'due:')[0]?.title, 'Netflix.com is due tomorrow');
  eq('due: today', byPrefix(build_({ transactions: list, now: new Date(2026, 10, 22, 9) }), 'due:')[0]?.title, 'Netflix.com is due today');
  eq('due: not when it is already past', ids(byPrefix(build_({ transactions: list, now: new Date(2026, 10, 24, 9) }), 'due:')), []);
}

// ── How recent the data is; last month's savings ───────────────────────────
{
  const old = [out('2026-10-12', 500, 'Dining', 'x'), out('2026-09-30', 200, 'Dining', 'y')];
  const stale = byPrefix(build_({ transactions: old }), 'stale:');
  eq('stale: a month without entries', ids(stale), ['stale:2026-11']);
  eq('stale: body', stale[0]?.body, 'Your newest entry is from 12 Oct. Import your latest statement to keep Home, Pulse and Flow up to date.');
  eq('stale: opens Import', stale[0]?.action, { kind: 'screen', screen: 'IMPORT' });
  eq('stale: not within a month', ids(byPrefix(build_({ transactions: [out('2026-10-25', 500, 'Dining', 'x')] }), 'stale:')), []);
  eq('stale: nothing for an empty wallet', ids(build_({ transactions: [] })), []);

  const october = [inc('2026-10-01', 50000, 'Salary', 'ACME'), out('2026-10-10', 32000, 'Rent', 'x'), out('2026-11-02', 300, 'Coffee', 'y')];
  const met = byPrefix(build_({ transactions: october, savingsGoal: 15000 }), 'goal:');
  eq('goal: met', met[0]?.title, 'You met your savings goal in October');
  eq('goal: met body', met[0]?.body, '₹18,000 saved against a goal of ₹15,000.');
  eq('goal: tone', met[0]?.tone, 'good');
  eq('goal: opens Flow on Goals', met[0]?.action, { kind: 'screen', screen: 'INCOME_INSIGHTS', section: 'goals' });
  const short = byPrefix(build_({ transactions: october, savingsGoal: 20000 }), 'goal:');
  eq('goal: short', [short[0]?.title, short[0]?.body], ["October's savings: ₹18,000", '₹2,000 short of your ₹20,000 goal.']);
  eq('goal: not until the data reaches this month', ids(byPrefix(build_({ transactions: october.slice(0, 2), savingsGoal: 15000 }), 'goal:')), []);
}

// ── The app ────────────────────────────────────────────────────────────────
{
  const got = build_({ updateReady: true, release: { versionCode: 14, version: '1.5.6', first: 'The bell on Home tells you what needs a look.' } });
  eq('app: update and release notes', ids(got), ['update:14', 'release:14']);
  eq('app: restart action', got[0]?.action, { kind: 'restart' });
  eq('app: what is new', [got[1]?.title, got[1]?.action], ["What's new in 1.5.6", { kind: 'whatsNew' }]);
  const release = { versionCode: 14, version: '1.5.6', first: null };
  const available = build_({ updateAvailable: 15, release });
  eq('app: update on Play', [ids(available), available[0]?.title, available[0]?.action], [['update-available:15'], 'Update available', { kind: 'update' }]);
  eq('app: a downloaded update wins over one on Play', ids(build_({ updateReady: true, updateAvailable: 15, release })), ['update:14']);
  eq('app: nothing newer than this version', ids(build_({ updateAvailable: 14, release })), []);
  eq('app: a newer one is a new note', ids(build_({ updateAvailable: 16, release })), ['update-available:16']);
}

// ── Seen, dismissed, pruned ────────────────────────────────────────────────
{
  const day = 24 * 60 * 60 * 1000;
  const t0 = NOW.getTime();
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  let state = N.emptyState();
  eq('state: all new at first', N.arrange(list, state, t0).fresh.map(n => n.id), ['a', 'b', 'c']);
  state = N.markSeen(state, ['a', 'b'], t0);
  let view = N.arrange(list, state, t0 + day);
  eq('state: seen ones move to Earlier', [view.fresh.map(n => n.id), view.earlier.map(n => n.id)], [['c'], ['a', 'b']]);
  eq('state: seen time is kept', N.markSeen(state, ['a'], t0 + day).seen.a, t0);
  state = N.dismiss(state, 'b', t0 + day);
  view = N.arrange(list, state, t0 + day);
  eq('state: dismissed are hidden', [view.fresh.map(n => n.id), view.earlier.map(n => n.id)], [['c'], ['a']]);
  eq('state: Earlier keeps two weeks', N.arrange(list, state, t0 + 15 * day).earlier.map(n => n.id), []);
  const pruned = N.prune(state, ['a'], t0 + 62 * day);
  eq('state: prune keeps what still applies', [Object.keys(pruned.seen), Object.keys(pruned.dismissed)], [['a'], []]);

  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  N.saveState('uid123', state, storage);
  eq('state: saved and loaded', N.loadState('uid123', storage), state);
  eq('state: key ends in _<uid>, so sign-out removes it', N.storageKey('uid123').endsWith('_uid123'), true);
  store.set(N.storageKey('uid123'), '{not json');
  eq('state: damaged storage reads as empty', N.loadState('uid123', storage), N.emptyState());
}

// ── Everything together ────────────────────────────────────────────────────
{
  ok('whenSaid: another day', N.whenSaid(new Date(2026, 10, 12, 18, 40), NOW) === 'on 12 Nov at 18:40');
  const many = Array.from({ length: 30 }, (_, i) => out('2026-11-10', 100 + i, `Cat${i}`, `M${i}`));
  const budgets = Object.fromEntries(many.map(t => [t.category, 50]));
  eq('limit: at most 20', build_({ transactions: many, budgets }).length, 20);
}

console.log(`${checks - failures}/${checks} notification checks passed`);
if (failures) process.exit(1);
