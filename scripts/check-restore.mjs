#!/usr/bin/env node
/**
 * Data Studio's full backup and Restore (services/backup.ts).
 *
 * Checks, on made-up wallets, that:
 *   - a backup read back gives every entry and setting exactly as saved,
 *     amounts to the paisa and entries typed in other currencies included
 *   - a restore adds only the entries the wallet lacks, so restoring the same
 *     file twice adds nothing, and a 1.5.7 (version 1) backup still restores
 *   - files that aren't backups, from a newer version, or far too big are
 *     refused with the right reason, and malformed rows are counted and left
 *     out: bad ids (a "/" would make a Firestore path), amounts, types and
 *     days, half-typed currencies, repeated ids
 *   - only an entry's own fields come back (nothing else from the file), and
 *     __reserved__ or prototype names never become budget categories
 *   - 20,000 entries read and plan in well under two seconds
 *
 * Usage (after `npm ci`):
 *   node scripts/check-restore.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-restore-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export * from ${JSON.stringify(join(root, 'services', 'backup.ts'))};\n`);
const bundle = join(tmp, 'backup.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const B = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 30) console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const ok = (label, cond) => {
  checks++;
  if (!cond) { failures++; if (failures <= 30) console.log(`  FAIL ${label}`); }
};

// ── A made-up wallet ─────────────────────────────────────────────────────────
let seed = 42;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pad = n => String(n).padStart(2, '0');
const day = i => { const d = new Date(2025, 3, 1 + (i % 600)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const CATS = ['Groceries', 'Dining', 'Rent', 'Salary', 'Transport', 'Subscriptions'];

function wallet(n) {
  const transactions = [];
  for (let i = 0; i < n; i++) {
    const income = i % 9 === 0;
    const t = {
      id: i % 3 === 0 ? `import-${(i * 2654435761 >>> 0).toString(16).padStart(32, '0').slice(0, 32)}` : `entry-${i}`,
      amount: Math.round(rand() * 5_000_000) / 100,
      type: income ? 'INCOME' : 'EXPENSE',
      category: CATS[i % CATS.length],
      date: day(i),
      merchant: `Payee ${i % 37}`,
      note: i % 4 === 0 ? `UPI/${100000000000 + i}/Payee ${i % 37}` : '',
    };
    if (i % 11 === 0) t.createdAt = new Date(2025, 5, 1, 10, i % 60).toISOString();
    if (i % 13 === 0) { t.typedAmount = Math.round(rand() * 50000) / 100; t.typedCurrency = 'USD'; }
    transactions.push(t);
  }
  return {
    transactions,
    openingBalance: 3734.62,
    openingBalanceAsOf: '2025-04-01',
    budgets: { Dining: 5000, Groceries: 8000.5 },
    savingsGoal: 15000,
    dailyLimit: 1500,
    payeeRules: [
      { id: 'rule-1', match: 'ravi kumar', kind: 'family' },
      { id: 'rule-2', match: 'zerodha', kind: 'investment' },
    ],
  };
}

// ── Round trip ───────────────────────────────────────────────────────────────
console.log('Round trip');
{
  const w = wallet(2000);
  const file = JSON.stringify(B.buildBackup(w, new Date('2026-11-25T06:30:00Z')), null, 2);
  const r = B.readBackup(file);
  ok('reads its own backup', r.ok);
  eq('version', r.backup.version, 2);
  eq('saved when', r.backup.exportedAt, '2026-11-25T06:30:00.000Z');
  const canon = list => list.map(t => Object.fromEntries(Object.entries(t).sort(([a], [b]) => a.localeCompare(b))));
  eq('every entry, every field, in order', canon(r.backup.entries), canon(w.transactions));
  eq('nothing left out', [r.backup.unreadable, r.backup.repeated], [0, 0]);
  eq('settings', r.backup.settings, {
    openingBalance: w.openingBalance, openingBalanceAsOf: w.openingBalanceAsOf, budgets: w.budgets,
    savingsGoal: w.savingsGoal, dailyLimit: w.dailyLimit, payeeRules: w.payeeRules,
  });
  const paise = list => list.reduce((s, t) => s + Math.round(t.amount * 100), 0);
  eq('total to the paisa', paise(r.backup.entries), paise(w.transactions));
  const typed = r.backup.entries.filter(t => t.typedCurrency);
  eq('typed in another currency, kept as typed', typed.map(t => [t.typedAmount, t.typedCurrency]), w.transactions.filter(t => t.typedCurrency).map(t => [t.typedAmount, t.typedCurrency]));

  const intoEmpty = B.planRestore(r.backup, new Set());
  eq('an empty wallet gets every entry', [intoEmpty.add.length, intoEmpty.already], [2000, 0]);
  ok('… and the settings', intoEmpty.hasSettings);
  const days = w.transactions.map(t => t.date).sort();
  eq('date range', [intoEmpty.from, intoEmpty.to], [days[0], days[days.length - 1]]);

  const again = B.planRestore(r.backup, new Set(w.transactions.map(t => t.id)));
  eq('restoring into the same wallet adds nothing', [again.add.length, again.already], [0, 2000]);

  const half = new Set(w.transactions.filter((_, i) => i % 2 === 0).map(t => t.id));
  const partial = B.planRestore(r.backup, half);
  eq('a wallet with half the entries gets the other half, in order', partial.add.map(t => t.id), w.transactions.filter((_, i) => i % 2 === 1).map(t => t.id));
  eq('… and counts the half it has', partial.already, 1000);
}

// ── A backup from 1.5.7 (version 1) ──────────────────────────────────────────
console.log('Version 1 files');
{
  const w = wallet(50);
  const v1 = { app: 'Wall-ette', version: 1, exportedAt: '2026-11-20T10:00:00.000Z', openingBalance: 2500.25, transactionCount: 50, transactions: w.transactions };
  const r = B.readBackup(JSON.stringify(v1));
  ok('reads', r.ok);
  eq('entries', r.backup.entries.length, 50);
  eq('the opening balance is its only setting', r.backup.settings, { openingBalance: 2500.25 });
  const plan = B.planRestore(r.backup, new Set());
  ok('has a setting to restore', plan.hasSettings);
  const zero = B.readBackup(JSON.stringify({ ...v1, openingBalance: 0 }));
  ok('an opening balance of 0 with no day is nothing to restore', !B.planRestore(zero.backup, new Set()).hasSettings);
}

// ── Files that aren't backups ────────────────────────────────────────────────
console.log('Refused files');
{
  const good = JSON.stringify(B.buildBackup(wallet(3)));
  eq('not JSON', B.readBackup('%PDF-1.7 …'), { ok: false, problem: 'not-json' });
  eq('a JSON list', B.readBackup('[1,2,3]'), { ok: false, problem: 'not-backup' });
  eq('another app', B.readBackup(JSON.stringify({ app: 'Other', version: 1, transactions: [] })), { ok: false, problem: 'not-backup' });
  eq('no entries list', B.readBackup(JSON.stringify({ app: 'Wall-ette', version: 2 })), { ok: false, problem: 'not-backup' });
  eq('version as text', B.readBackup(JSON.stringify({ app: 'Wall-ette', version: '2', transactions: [] })), { ok: false, problem: 'not-backup' });
  eq('a newer version', B.readBackup(JSON.stringify({ app: 'Wall-ette', version: 3, transactions: [] })), { ok: false, problem: 'newer-version' });
  eq('far too big', B.readBackup(good, 100), { ok: false, problem: 'too-big' });
  eq('nothing in it', B.readBackup(JSON.stringify({ app: 'Wall-ette', version: 2, transactions: [], settings: {} })), { ok: false, problem: 'empty' });
  const settingsOnly = B.readBackup(JSON.stringify({ app: 'Wall-ette', version: 2, transactions: [], settings: { savingsGoal: 9000 } }));
  ok('settings and no entries still restore', settingsOnly.ok && B.planRestore(settingsOnly.backup, new Set()).hasSettings);
  for (const p of ['too-big', 'not-json', 'not-backup', 'newer-version', 'empty']) ok(`a message for ${p}`, typeof B.PROBLEM_TEXT[p] === 'string' && B.PROBLEM_TEXT[p].length > 10);
}

// ── Malformed rows ───────────────────────────────────────────────────────────
console.log('Malformed rows');
{
  const base = { id: 'entry-ok', amount: 120.5, type: 'EXPENSE', category: 'Dining', date: '2026-11-03' };
  const rows = [
    base,
    { ...base, id: undefined },
    { ...base, id: '' },
    { ...base, id: 'users/other/transactions/x' },
    { ...base, id: '__name__' },
    { ...base, id: '..' },
    { ...base, id: 'x'.repeat(301) },
    { ...base, id: 'b', amount: -5 },
    { ...base, id: 'c', amount: '120.50' },
    { ...base, id: 'd', amount: Number.NaN },
    { ...base, id: 'e', amount: 1e13 },
    { ...base, id: 'f', type: 'TRANSFER' },
    { ...base, id: 'g', date: '2026-02-30' },
    { ...base, id: 'h', date: '03/11/2026' },
    { ...base, id: 'i', typedAmount: 10 },
    { ...base, id: 'j', typedAmount: 10, typedCurrency: 'usd' },
    'not an object',
    null,
    { ...base, id: 'entry-ok' },            // repeats the first id
    { ...base, id: 'old-time', date: '2025-06-01T18:30:00.000Z' },
    { ...base, id: 'no-cat', category: '' },
    { ...base, id: 'extra', userId: 'someone-else', evil: '<script>', isAdmin: true },
  ];
  const r = B.readBackup(JSON.stringify({ app: 'Wall-ette', version: 2, transactions: rows }));
  ok('reads the good rows', r.ok);
  eq('kept', r.backup.entries.map(t => t.id), ['entry-ok', 'old-time', 'no-cat', 'extra']);
  eq('left out as invalid', r.backup.unreadable, 17);
  eq('left out as repeated ids', r.backup.repeated, 1);
  eq('an older entry with a time keeps its date as saved', r.backup.entries[1].date, '2025-06-01T18:30:00.000Z');
  eq('a missing category becomes Uncategorized', r.backup.entries[2].category, 'Uncategorized');
  eq('only an entry\'s own fields come back', Object.keys(r.backup.entries[3]).sort(), ['amount', 'category', 'date', 'id', 'type']);
  const plan = B.planRestore(r.backup, new Set());
  eq('the plan counts what was left out', [plan.unreadable, plan.repeated], [17, 1]);
}

// ── Settings from a file ─────────────────────────────────────────────────────
console.log('Settings');
{
  const raw = `{"app":"Wall-ette","version":2,"transactions":[],"settings":{
    "openingBalance": -1250.75, "openingBalanceAsOf": "2025-04-01",
    "budgets": {"Dining": 5000, "__proto__": 1, "constructor": 2, "__name__": 3, "Rent": -10, "Fuel": "900", "  Groceries ": 7000, "": 5},
    "savingsGoal": -5, "dailyLimit": 0,
    "payeeRules": [{"id":"rule-1","match":"ravi kumar","kind":"family"},{"id":"rule-2","match":"x","kind":"stolen"},{"id":"a/b","match":"bank","kind":"mine"},{"id":"rule-3","match":"   ","kind":"mine"},{"id":"rule-4","match":"sunrise chs","kind":"counts","category":"Rent"},{"id":"rule-5","match":"acme","kind":"counts","category":"<script>"},{"id":"rule-6","match":"zerodha","kind":"investment","category":"Rent"}]
  }}`;
  const r = B.readBackup(raw);
  ok('reads', r.ok);
  const s = r.backup.settings;
  eq('a negative opening balance is kept (overdrawn accounts)', [s.openingBalance, s.openingBalanceAsOf], [-1250.75, '2025-04-01']);
  eq('only real budgets, by trimmed name', s.budgets, { Dining: 5000, Groceries: 7000 });
  ok('no budget can reach the prototype', Object.getPrototypeOf(s.budgets) === Object.prototype && !('polluted' in {}));
  eq('a negative goal and a zero limit are nothing to restore', [s.savingsGoal, s.dailyLimit], [undefined, undefined]);
  eq('only valid Money moved rules; a category only on a rule that counts, and only a plain name', s.payeeRules, [
    { id: 'rule-1', match: 'ravi kumar', kind: 'family' },
    { id: 'rule-4', match: 'sunrise chs', kind: 'counts', category: 'Rent' },
    { id: 'rule-5', match: 'acme', kind: 'counts' },
    { id: 'rule-6', match: 'zerodha', kind: 'investment' },
  ]);
}

// ── Size ─────────────────────────────────────────────────────────────────────
console.log('Size');
{
  const w = wallet(20000);
  const file = JSON.stringify(B.buildBackup(w));
  const t0 = performance.now();
  const r = B.readBackup(file);
  const plan = B.planRestore(r.backup, new Set(w.transactions.slice(0, 5000).map(t => t.id)));
  const ms = performance.now() - t0;
  eq('20,000 entries: 15,000 to add', plan.add.length, 15000);
  ok(`… read and planned in ${Math.round(ms)} ms (under 2,000)`, ms < 2000);
  console.log(`  file ${(file.length / 1024 / 1024).toFixed(1)} MB, ${Math.round(ms)} ms`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
