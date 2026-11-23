#!/usr/bin/env node
/**
 * Data Studio's statement report and spreadsheet (services/statementReport.ts).
 *
 * Checks, on a worked example and on 200 random wallets, that:
 *   - the period's money in, money out, money moved, what came in, what was
 *     spent and what was kept are exact
 *   - every month, the bills / everyday / one-offs split and the categories
 *     add up to the period's spending, with shares adding up to 100
 *   - each month in the report is Pulse's own figure for that month
 *   - payee, category and note text is escaped in the page (no markup or
 *     script from a statement narration gets in)
 *   - the spreadsheet lists every entry of the period once, in date order,
 *     with rupees to the paisa that add up, and writes formula-like text as
 *     text (CSV injection)
 *
 * Usage (after `npm ci`):
 *   node scripts/check-report.mjs
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
const tmp = mkdtempSync(join(tmpdir(), 'wallette-report-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export * from ${JSON.stringify(join(root, 'services', 'statementReport.ts'))};\nexport { analyzePulse } from ${JSON.stringify(join(root, 'services', 'pulseAnalysis.ts'))};\n`);
const bundle = join(tmp, 'report.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const R = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 30) console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const near = (label, actual, expected, tol = 0.005) => {
  checks++;
  if (!(Math.abs(actual - expected) <= tol)) { failures++; if (failures <= 30) console.log(`  FAIL ${label}: got ${actual}, expected ${expected}`); }
};

const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
let seq = 0;
const tx = (date, type, amount, category, merchant, note = '') => ({ id: `t${++seq}`, date, type, amount, category, merchant, note });
const MOVED = new Set(['Investment', 'Transfer Out', 'Transfer In']);
const isMoved = t => MOVED.has(t.category);

// ── A worked example ───────────────────────────────────────────────────────
const NOW = new Date(2026, 10, 20, 12);
const list = [
  tx('2026-09-01', 'INCOME', 85000, 'Salary', 'NEFT/NORTHWIND LABS'),
  tx('2026-09-03', 'EXPENSE', 22000, 'Rent', 'IMPS/P2A/SUNRISE HOMES'),
  tx('2026-09-10', 'EXPENSE', 3000, 'Dining', 'UPI/DR/CAFE'),
  tx('2026-10-01', 'INCOME', 85000, 'Salary', 'NEFT/NORTHWIND LABS'),
  tx('2026-10-03', 'EXPENSE', 22000, 'Rent', 'IMPS/P2A/SUNRISE HOMES'),
  tx('2026-10-12', 'EXPENSE', 4000, 'Dining', 'UPI/DR/CAFE'),
  tx('2026-10-18', 'EXPENSE', 10000, 'Investment', 'NACH/DR/MF SIP'),
  tx('2026-11-01', 'INCOME', 85000, 'Salary', 'NEFT/NORTHWIND LABS'),
  tx('2026-11-03', 'EXPENSE', 22000, 'Rent', 'IMPS/P2A/SUNRISE HOMES'),
  tx('2026-11-06', 'EXPENSE', 3100.5, 'Dining', 'UPI/DR/CAFE'),
  tx('2026-11-14', 'EXPENSE', 45000, 'Electronics', 'UPI/DR/<img src=x onerror=alert(1)>'),
  tx('2026-11-15', 'INCOME', 2000, 'Transfer In', 'IMPS/OWN ACCOUNT'),
];
const q = R.buildStatementHtml({ transactions: list, isMoved, period: 'QUARTER', now: NOW, money, currency: 'INR', openingBalance: 1000 });
const d = q.data;
eq('quarter: months', d.months.map(m => [m.key, m.cameIn, m.spent]), [['2026-09', 85000, 25000], ['2026-10', 85000, 26000], ['2026-11', 85000, 70100.5]]);
eq('quarter: in, spent, kept', [d.cameIn, d.spent, d.kept, d.keptPct], [255000, 121100.5, 133899.5, 53]);
eq('quarter: cash flow with money moved', [d.moneyIn, d.moneyOut, d.movedIn, d.movedOut], [257000, 131100.5, 2000, 10000]);
eq('balance: opening + all in − all out', d.balance, 1000 + 257000 - 131100.5);
eq('quarter: entries', [d.entries, d.from, d.to], [12, '2026-09-01', '2026-11-15']);
eq('split adds up', d.split.bills + d.split.everyday + d.split.oneOffs, d.spent);
eq('split shares', d.split.shares.reduce((s, v) => s + v, 0), 100);
eq('categories', d.categories.map(c => [c.name, c.amount, c.count]), [['Rent', 66000, 3], ['Electronics', 45000, 1], ['Dining', 10100.5, 3]]);
eq('category shares add up to 100', d.categories.reduce((s, c) => s + c.share, 0), 100);
eq('no markup from a narration', q.html.includes('<img src=x'), false);
eq('…it is shown as text', q.html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
eq('no scripts at all', /<script/i.test(q.html), false);
const month = R.buildStatementHtml({ transactions: list, isMoved, period: 'MONTH', now: NOW, money, currency: 'INR', openingBalance: 0 }).data;
const pulse = R.analyzePulse({ counted: list.filter(t => !isMoved(t)), month: NOW, now: NOW, money });
eq('this month matches Pulse', [month.spent, month.cameIn, month.split.bills, month.split.everyday, month.split.oneOffs], [pulse.spent, pulse.cameIn, pulse.split.bills, pulse.split.everyday, pulse.split.oneOffs]);
eq("this month's insights are Pulse's", month.insights.map(i => i.id), pulse.insights.map(i => i.id));

const sheet = R.transactionsCsv([...list, tx('2026-11-16', 'EXPENSE', 99.99, 'Other', '=HYPERLINK("http://x")', '+1 note')], isMoved, 'MONTH', NOW);
const lines = sheet.csv.split('\n');
eq('csv: header', lines[0], 'Date,Payee,Category,Type,Amount (INR),Counts as,Note');
eq('csv: rows this month, oldest first', lines.slice(1).map(l => l.slice(0, 10)), ['2026-11-01', '2026-11-03', '2026-11-06', '2026-11-14', '2026-11-15', '2026-11-16']);
eq('csv: paise kept', lines[3].includes(',3100.50,'), true);
eq('csv: money moved says so', lines[5].includes('Money moved'), true);
eq('csv: formula written as text', lines[6].includes(`"'=HYPERLINK(""http://x"")"`) && lines[6].endsWith(`"'+1 note"`), true);

// ── Random wallets ─────────────────────────────────────────────────────────
let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = xs => xs[Math.floor(rand() * xs.length)];
const CATS = ['Rent', 'Groceries', 'Dining', 'Shopping', 'Electricity', 'Streaming', 'Electronics', 'Investment', 'Transfer Out', 'Other'];
const PAYEES = ['UPI/DR/ALPHA', 'UPI/DR/BETA', 'IMPS/P2A/LANDLORD', 'UPI/DR/POWER', 'UPI/DR/"QUOTED"', 'NEFT/A&B', ''];
const pad = n => String(n).padStart(2, '0');
for (let run = 0; run < 200; run++) {
  const txs = [];
  const now = new Date(2026, 10, 1 + Math.floor(rand() * 29), 9);
  for (let m = 3 + Math.floor(rand() * 6); m <= 10; m++) {
    const last = m === 10 ? now.getDate() : new Date(2026, m + 1, 0).getDate();
    if (rand() < 0.9) txs.push(tx(`2026-${pad(m + 1)}-01`, 'INCOME', Math.round(rand() * 8000000) / 100 + 500, rand() < 0.1 ? 'Transfer In' : 'Salary', 'NEFT/EMPLOYER'));
    for (let i = Math.floor(rand() * 20); i > 0; i--) {
      txs.push(tx(`2026-${pad(m + 1)}-${pad(1 + Math.floor(rand() * last))}`, 'EXPENSE', Math.round(rand() * 500000) / 100 + 1, pick(CATS), pick(PAYEES)));
    }
  }
  for (const period of ['MONTH', 'QUARTER', 'ALL']) {
    const { data: r, html } = R.buildStatementHtml({ transactions: txs, isMoved, period, now, money, currency: 'INR', openingBalance: 0 });
    const tag = `run ${run} ${period}`;
    const startKey = period === 'MONTH' ? `2026-11` : period === 'QUARTER' ? '2026-09' : txs.reduce((m, t) => (t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m), '2026-11');
    const mine = txs.filter(t => t.date.slice(0, 7) >= startKey);
    const sum = f => mine.filter(f).reduce((s, t) => s + t.amount, 0);
    near(`${tag} spent`, r.spent, sum(t => t.type === 'EXPENSE' && !isMoved(t)));
    near(`${tag} came in`, r.cameIn, sum(t => t.type === 'INCOME' && !isMoved(t)));
    near(`${tag} moved out`, r.movedOut, sum(t => t.type === 'EXPENSE' && isMoved(t)));
    near(`${tag} money in`, r.moneyIn, sum(t => t.type === 'INCOME'));
    near(`${tag} months add up`, r.months.reduce((s, m) => s + m.spent, 0), r.spent);
    near(`${tag} split adds up`, r.split.bills + r.split.everyday + r.split.oneOffs, r.spent);
    near(`${tag} categories add up`, r.categories.reduce((s, c) => s + c.amount, 0), r.spent);
    eq(`${tag} split shares`, r.split.shares.reduce((s, v) => s + v, 0), r.spent > 0 ? 100 : 0);
    eq(`${tag} category shares`, r.categories.reduce((s, c) => s + c.share, 0), r.spent > 0 ? 100 : 0);
    eq(`${tag} kept %`, r.keptPct, r.cameIn > 0 ? Math.round(((r.cameIn - r.spent) / r.cameIn) * 100) : null);
    eq(`${tag} quotes escaped`, html.includes('"QUOTED"'), false);
    const { csv, rows } = R.transactionsCsv(txs, isMoved, period, now);
    eq(`${tag} csv rows`, rows, period === 'ALL' ? txs.length : mine.length);
    const csvTotal = csv.split('\n').slice(1).reduce((s, l) => s + parseFloat(l.split(',').at(-3)), 0);
    near(`${tag} csv rupees add up`, csvTotal, period === 'ALL' ? txs.reduce((s, t) => s + t.amount, 0) : mine.reduce((s, t) => s + t.amount, 0), 0.05);
  }
}

console.log(`${checks - failures}/${checks} report checks passed`);
if (failures) process.exit(1);
