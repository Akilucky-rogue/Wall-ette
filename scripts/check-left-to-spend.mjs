#!/usr/bin/env node
/**
 * Left to spend (services/leftToSpend.ts).
 *
 * Builds made-up wallets and checks that:
 *   - with a confirmed pay, the period runs from the last pay to the next
 *   - what came in, spending, money sent to family or invested, bills still
 *     to come and the savings goal add up to what's left, per day
 *   - money between your own accounts is left out both ways
 *   - investing counts toward the savings goal, so it isn't set aside twice
 *   - a weekly bill counts each time it falls in the period; a bill a few
 *     days late still counts, a long-stopped one doesn't
 *   - without a known pay the period is the calendar month; a late pay gives
 *     one day left; nothing in yet gives nothing to show
 *   - a figure from entries several days old says so
 *
 * Usage (after `npm ci`):
 *   node scripts/check-left-to-spend.mjs
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
const tmp = mkdtempSync(join(tmpdir(), 'wallette-left-'));
const bundle = join(tmp, 'left.mjs');
await build({
  entryPoints: [join(root, 'services', 'leftToSpend.ts')],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
});
const { leftToSpend } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0, checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};

const NOW = new Date(2026, 10, 23, 18, 0); // Mon 23 Nov 2026
let seq = 0;
const tx = (date, type, amount, category, merchant) => ({ id: `t${++seq}`, date, type, amount, category, merchant, note: '' });
const out = (d, a, c, m) => tx(d, 'EXPENSE', a, c, m);
const inc = (d, a, c, m) => tx(d, 'INCOME', a, c, m);
// Made-up rules: "MOM" is family, Investments are invested, "SELF" is your own account.
const flowOf = t => {
  if ((t.merchant || '').includes('SELF')) return { flow: 'moved', moved: 'mine', rule: null };
  if ((t.merchant || '').includes('MOM')) return { flow: 'moved', moved: 'family', rule: null };
  if (t.category === 'Investments') return { flow: 'moved', moved: 'investment', rule: null };
  return { flow: t.type === 'INCOME' ? 'income' : 'spend', moved: null, rule: null };
};
const salary = d => inc(d, 85000, 'Salary', 'NEFT/N312/NORTHWIND LABS PVT LTD/HDFC0000123');
const netflix = d => out(d, 649, 'Streaming', 'UPI/DR/62000000001/NETFLIX COM/ICIC/netflix@icici/UPI');
const rent = d => out(d, 22000, 'Rent', 'IMPS/P2A/512000000005/SUNRISE HOMES/ICIC0000456');

// ── Pay to pay ─────────────────────────────────────────────────────────────
{
  const list = [
    salary('2026-09-01'), salary('2026-10-01'), salary('2026-11-01'),
    netflix('2026-08-25'), netflix('2026-09-25'), netflix('2026-10-25'),
    rent('2026-09-03'), rent('2026-10-03'), rent('2026-11-03'),
    out('2026-11-10', 6000, 'Groceries', 'UPI/DR/1/FRESHMART/x/y'),
    out('2026-11-20', 22000, 'Shopping', 'UPI/DR/2/DECATHLON/x/y'),
    out('2026-11-05', 10000, 'Family', 'UPI/DR/3/MOM/x/y'),
    out('2026-11-18', 5000, 'Investments', 'NACH/DR/MF SIP/BLUECHIP FUND'),
    out('2026-11-02', 20000, 'Transfer', 'IFT/4/SELF SAVINGS/1'),
    inc('2026-11-12', 20000, 'Transfer', 'IFT/5/SELF SAVINGS/1'),
    out('2026-10-28', 3000, 'Dining', 'UPI/DR/6/CAFE/x/y'), // before this pay
  ];
  const r = leftToSpend({ transactions: list, flowOf, savingsGoal: 20000, now: NOW });
  eq('pay: basis and period', [r.basis, r.from, r.until, r.daysLeft], ['pay', '2026-11-01', '2026-12-01', 8]);
  eq('pay: came in (own account left out)', r.cameIn, 85000);
  eq('pay: spent since pay', r.spent, 22000 + 6000 + 22000);
  eq('pay: sent to family and invested', [r.moved, r.invested], [15000, 5000]);
  eq('pay: bills to come (Netflix on the 25th, not rent on 3 Dec)', r.bills.map(b => [b.due, b.amount]), [['2026-11-25', 649]]);
  eq('pay: the goal less what was invested', r.toSetAside, 15000);
  eq('pay: left', r.left, 85000 - 50000 - 15000 - 649 - 15000);
  eq('pay: per day', Math.round(r.perDay), Math.round(4351 / 8));
  eq('pay: not behind, not late', [r.behind, r.payLate], [false, false]);
  eq('pay: share used', Math.round(r.used * 100), Math.round(((50000 + 15000 + 649 + 15000) / 85000) * 100));

  const noGoal = leftToSpend({ transactions: list, flowOf, savingsGoal: 0, now: NOW });
  eq('no goal: nothing set aside', [noGoal.toSetAside, noGoal.left], [0, 85000 - 50000 - 15000 - 649]);
  const smallGoal = leftToSpend({ transactions: list, flowOf, savingsGoal: 3000, now: NOW });
  eq('goal below what was invested: nothing more set aside', smallGoal.toSetAside, 0);

  const over = leftToSpend({ transactions: [...list, out('2026-11-22', 9000, 'Travel', 'UPI/DR/7/AIRLINE/x/y')], flowOf, savingsGoal: 20000, now: NOW });
  eq('over: negative, nothing per day', [over.left, over.perDay], [4351 - 9000, 0]);

  const behind = leftToSpend({ transactions: list.filter(t => t.date <= '2026-11-18'), flowOf, savingsGoal: 0, now: NOW });
  eq('behind: newest entry several days old', [behind.newest, behind.behind], ['2026-11-18', true]);
}

// ── Bills: weekly, late, stopped ───────────────────────────────────────────
{
  const maid = d => out(d, 1500, 'Household', 'UPI/DR/8/HOUSE HELP/x/y');
  const list = [
    salary('2026-10-01'), salary('2026-11-01'),
    ...['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map(maid), // weekly: next 23 Nov, then 30 Nov
    netflix('2026-08-20'), netflix('2026-09-20'), netflix('2026-10-20'), // due 20 Nov, 3 days late
    ...['2026-05-15', '2026-06-15', '2026-07-15'].map(d => out(d, 299, 'Streaming', 'UPI/DR/9/OLD SUB/x/y')), // stopped
  ];
  const r = leftToSpend({ transactions: list, flowOf, savingsGoal: 0, now: NOW });
  eq('bills: weekly twice, late one today, stopped one out', r.bills.map(b => [b.due, b.amount]),
    [['2026-11-23', 1500], ['2026-11-23', 649], ['2026-11-30', 1500]]);
}

// ── Without a known pay; pay late; nothing in ──────────────────────────────
{
  const freelance = [inc('2026-11-04', 30000, 'Freelance', 'NEFT/N9/CLIENT CO/HDFC0000001'), out('2026-11-06', 4000, 'Dining', 'x')];
  const m = leftToSpend({ transactions: freelance, flowOf, savingsGoal: 0, now: NOW });
  eq('month: no pay known', [m.basis, m.from, m.until, m.daysLeft, m.left], ['month', '2026-11-01', '2026-12-01', 8, 26000]);

  const latePay = [salary('2026-09-20'), salary('2026-10-20'), out('2026-11-01', 1000, 'Dining', 'x')];
  const l = leftToSpend({ transactions: latePay, flowOf, savingsGoal: 0, now: NOW });
  eq('late pay: one day left', [l.basis, l.payLate, l.daysLeft, l.until], ['pay', true, 1, '2026-11-24']);

  const early = [salary('2026-08-01'), salary('2026-09-01'), salary('2026-10-01'), salary('2026-10-30'), out('2026-11-03', 1000, 'Dining', 'x')];
  const e = leftToSpend({ transactions: early, flowOf, savingsGoal: 0, now: NOW });
  eq('early pay: still this month\'s', [e.payLate, e.from, e.until], [false, '2026-10-30', '2026-12-01']);

  eq('nothing in: nothing to show', leftToSpend({ transactions: [out('2026-11-06', 4000, 'Dining', 'x')], flowOf, savingsGoal: 0, now: NOW }), null);
  eq('empty wallet', leftToSpend({ transactions: [], flowOf, savingsGoal: 0, now: NOW }), null);
}

console.log(`${checks - failures}/${checks} left-to-spend checks passed`);
if (failures) process.exit(1);
