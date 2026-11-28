#!/usr/bin/env node
/**
 * Wall·ette Wrapped check (1.6.1).
 *
 * Runs services/wrapped.ts on a made-up year and checks that:
 *   - money in and out come from the counted entries (money moved left out)
 *     while the entry count and the span take every entry
 *   - the top categories and payees are ranked by spending, with shares, and
 *     payments nobody sorted (To review), ATM cash and own-account moves
 *     never top the payees or the biggest spend
 *   - quiet days only cover the span the entries reach, and the longest
 *     quiet stretch runs between two days with spending
 *   - the busiest month and weekday, and the weekend share, add up
 *   - a year with income only, or no entries, says so instead of inventing
 *
 * Usage (after `npm ci`):
 *   node scripts/check-wrapped.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-wrapped-'));
const bundle = join(tmp, 'wrapped.mjs');
await build({
  entryPoints: [join(root, 'services', 'wrapped.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
  define: { 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false' },
});
const W = await import(pathToFileURL(bundle).href);
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
const near = (label, actual, expected) => eq(label, Math.round(actual * 1000) / 1000, expected);

// A made-up wallet: names and amounts are invented.
let n = 0;
const e = (date, amount, type, category, merchant) =>
  ({ id: `t${++n}`, date, amount, type, category, ...(merchant ? { merchant } : {}) });
const OUT = 'EXPENSE', IN = 'INCOME';
const all = [
  e('2025-12-30', 900, OUT, 'Dining', 'UPI/111/CURRY HOUSE'),            // last year
  e('2026-03-02', 50000, IN, 'Salary', 'NEFT/ACME LABS'),
  e('2026-03-02', 450, OUT, 'Food Delivery', 'UPI/201/SWIGGY'),
  e('2026-03-03', 300, OUT, 'Food Delivery', 'UPI/202/SWIGGY'),
  e('2026-03-07', 2400, OUT, 'Groceries', 'UPI/203/FRESHMART'),           // Saturday
  e('2026-03-08', 600, OUT, 'Food Delivery', 'UPI/204/SWIGGY'),           // Sunday
  e('2026-03-12', 9000, OUT, 'To review', 'UPI/205/A FRIEND'),            // unsorted: not a payee, not biggest
  e('2026-03-14', 3000, OUT, 'Cash Withdrawal', 'ATM/CASH MUMBAI'),        // Saturday
  e('2026-03-20', 20000, OUT, 'Investments', 'NEFT/MY BROKER'),           // money moved (left out of counted)
  e('2026-04-01', 50000, IN, 'Salary', 'NEFT/ACME LABS'),
  e('2026-04-05', 5200, OUT, 'Shopping', 'UPI/206/GADGET STORE'),        // Sunday
  e('2026-04-15', 250, OUT, 'Coffee', 'UPI/207/BLUE TOKAI'),
];
const moved = new Set(['t9']);
const counted = all.filter(t => !moved.has(t.id));
const today = new Date(2026, 10, 28);

console.log('A year');
{
  const y = W.wrapYear(all, counted, 2026, today);
  eq('it is this year, still going', y.current, true);
  eq('every entry of the year counts, money moved too', y.entries, 11);
  eq('the span the entries reach', [y.from, y.to], ['2026-03-02', '2026-04-15']);
  eq('came in', y.inc, 100000);
  eq('went out: money moved left out', y.out, 450 + 300 + 2400 + 600 + 9000 + 3000 + 5200 + 250);
  eq('kept and its rate', [y.kept, y.rate], [100000 - 21200, 79]);
  eq('top categories by spending', y.categories.map(c => [c.name, c.amount]), [['To review', 9000], ['Shopping', 5200], ['Cash Withdrawal', 3000]]);
  near('a category\'s share of spending', y.categories[0].share, 0.425);
  eq('top payees: unsorted, cash and moves left out', y.payees.map(p => [p.name, p.amount, p.count]), [['Gadget Store', 5200, 1], ['Freshmart', 2400, 1], ['Swiggy', 1350, 3]]);
  eq('the payee paid most often (three or more times)', y.regular, { name: 'Swiggy', count: 3 });
  eq('the biggest spend is a sorted payment', y.biggest, { amount: 5200, name: 'Gadget Store', date: '2026-04-05' });
  eq('spending by month', [y.months[2], y.months[3], y.months[10]], [15750, 5450, 0]);
  eq('the busiest month', y.busiestMonth, 2);
  // 7 and 14 Mar are Saturdays, 8 Mar and 5 Apr Sundays.
  near('the weekend\'s share', y.weekendShare, Math.round((2400 + 600 + 3000 + 5200) / 21200 * 1000) / 1000);
  eq('the busiest weekday is Thursday (12 Mar)', y.busiestWeekday, 4);
  // Spending on 2, 3, 7, 8, 12, 14 Mar and 5, 15 Apr; the span is 2 Mar–15 Apr (45 days).
  eq('no-spend days only within the span', y.noSpendDays, 45 - 8);
  eq('the longest quiet stretch, between two days with spending', y.quietest, { days: 21, from: '2026-03-15', to: '2026-04-04' });
}

console.log('Edges');
{
  eq('a year with no entries', W.wrapYear(all, counted, 2024, today), null);
  const last = W.wrapYear(all, counted, 2025, today);
  eq('an earlier year is over', last.current, false);
  eq('one day of spending: no quiet stretch', last.quietest, null);
  eq('…and no regular payee', last.regular, null);
  const onlyIn = [e('2026-05-01', 1000, IN, 'Salary', 'NEFT/ACME LABS')];
  const y = W.wrapYear(onlyIn, onlyIn, 2026, today);
  eq('income only: nothing out, no busiest month', [y.out, y.busiestMonth, y.weekendShare, y.biggest], [0, null, null, null]);
  eq('income only: every day of the span is quiet', y.noSpendDays, 1);
  const noneIn = [e('2026-05-01', 200, OUT, 'Coffee', 'UPI/1/BLUE TOKAI')];
  eq('nothing in: no rate', W.wrapYear(noneIn, noneIn, 2026, today).rate, null);
  eq('years with entries, newest first', W.wrappedYears(all), [2026, 2025]);
}

console.log('Words');
{
  eq('a share as a percent', W.percent(0.425), '43%');
  eq('a tiny share is not 0%', W.percent(0.001), '<1%');
  eq('a day in the year', W.shortDay('2026-03-15', 2026), '15 Mar');
  eq('a day of another year says the year', W.shortDay('2025-12-30', 2026), '30 Dec 2025');
}

console.log(failures ? `\n${failures} of ${checks} Wrapped checks failed` : `\nAll ${checks} Wrapped checks passed`);
process.exit(failures ? 1 : 0);
