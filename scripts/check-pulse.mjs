#!/usr/bin/env node
/**
 * Pulse's analysis (services/pulseAnalysis.ts): its numbers must be exact.
 *
 * 1. A worked example, every figure worked out by hand in the comments:
 *    four months of made-up spending, read on 20 November (the live month),
 *    on 30 November when the entries stop on the 19th, and for October.
 * 2. A first month of data that starts on the 20th is left out of "usual".
 * 3. Invariants on 300 random wallets: categories, the bills/everyday/
 *    one-offs split, the days and the month's column all add up to the
 *    month's spending; shares add up to 100; the line, the comparison, the
 *    usual figures and what was kept match a separate, simple recount.
 *
 * Usage (after `npm ci`):
 *   node scripts/check-pulse.mjs
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
const tmp = mkdtempSync(join(tmpdir(), 'wallette-pulse-'));
const bundle = join(tmp, 'pulse.mjs');
await build({
  entryPoints: [join(root, 'services', 'pulseAnalysis.ts')],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
});
const P = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 40) console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const near = (label, actual, expected, tol = 0.005) => {
  checks++;
  if (!(Math.abs(actual - expected) <= tol)) { failures++; if (failures <= 40) console.log(`  FAIL ${label}: got ${actual}, expected ${expected}`); }
};

const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
let seq = 0;
const tx = (date, type, amount, category, merchant) => ({ id: `t${++seq}`, date, type, amount, category, merchant, note: '' });
const out = (date, amount, category, merchant) => tx(date, 'EXPENSE', amount, category, merchant);
const inc = (date, amount) => tx(date, 'INCOME', amount, 'Salary', 'NEFT/NORTHWIND LABS');

// ── 1. The worked example ──────────────────────────────────────────────────
const list = [];
for (const m of ['08', '09', '10', '11']) {
  list.push(inc(`2026-${m}-01`, 85000));
  list.push(out(`2026-${m}-03`, 22000, 'Rent', 'IMPS/P2A/SUNRISE HOMES'));
}
for (const m of ['08', '09', '10']) list.push(out(`2026-${m}-22`, 649, 'Streaming', 'UPI/DR/NETFLIX COM/netflix@icici'));
[['08', 3000], ['09', 3500], ['10', 4000]].forEach(([m, a]) => list.push(out(`2026-${m}-12`, a, 'Dining', 'UPI/DR/THE CURRY LEAF')));
[['08', 5000], ['09', 4000], ['10', 6000]].forEach(([m, a]) => list.push(out(`2026-${m}-15`, a, 'Shopping', 'UPI/DR/DECATHLON')));
// November: dining up, shopping down, a laptop, groceries on Saturdays, a coffee on the 19th
list.push(out('2026-11-06', 3100, 'Dining', 'UPI/DR/THE CURRY LEAF'));
list.push(out('2026-11-13', 3100, 'Dining', 'UPI/DR/THE CURRY LEAF'));
list.push(out('2026-11-10', 1000, 'Shopping', 'UPI/DR/DECATHLON'));
list.push(out('2026-11-14', 45000, 'Electronics', 'UPI/DR/CROMA'));
for (const d of ['07', '14']) list.push(out(`2026-11-${d}`, 1800, 'Groceries', 'UPI/DR/FRESHMART'));
list.push(out('2026-11-19', 250, 'Coffee', 'UPI/DR/BLUE TOKAI'));

const NOW = new Date(2026, 10, 20, 12, 0); // Fri 20 Nov 2026; 1 Nov is a Sunday
const r = P.analyzePulse({ counted: list, month: NOW, now: NOW, money, budgets: { Dining: 5000 } });

// Figures. November: 22,000 + 6,200 + 1,000 + 45,000 + 3,600 + 250.
const novSpent = 78050;
eq('month', [r.key, r.label, r.name, r.prevName, r.isCurrent], ['2026-11', 'November 2026', 'November', 'October', true]);
eq('spent, in, kept', [r.spent, r.cameIn, r.kept], [novSpent, 85000, 6950]);
eq('kept %: 6,950 / 85,000 = 8.18%', r.keptPct, 8);
eq('month before', [r.prevSpent, r.prevCameIn], [32649, 85000]); // 22,000 + 649 + 4,000 + 6,000
eq('six months, no data before August', r.months.map(m => [m.label, m.cameIn, m.spent, m.hasData, m.complete]), [
  ['Jun', 0, 0, false, false], ['Jul', 0, 0, false, false],
  ['Aug', 85000, 30649, true, true], ['Sept', 85000, 30149, true, true], ['Oct', 85000, 32649, true, true],
  ['Nov', 85000, novSpent, true, false],
]);

// Like for like: by day 20 October had rent, dining and shopping (Netflix is the 22nd).
eq('compared by the same day', r.compare, { kind: 'sameDay', day: 20, now: novSpent, before: 32000, change: 144 });

// The line: by day 14, everything but the coffee; nothing after today.
eq('pace: covers up to today', [r.pace.daysInMonth, r.pace.through, r.pace.today, r.pace.behind], [30, 20, 20, false]);
eq('pace: added up by day 14 and 20', [r.pace.now[13], r.pace.now[19]], [77800, novSpent]);
eq('pace: nothing after today', r.pace.now.slice(20).every(v => v === null), true);
eq('pace: October in full', [r.pace.before.length, r.pace.before[30]], [31, 32649]);

// The split: rent is a bill; the laptop is a one-off (median payment 3,100,
// so one-offs start at 9,300); the rest is everyday.
eq('split', [r.split.bills, r.split.everyday, r.split.oneOffs, r.split.billPayees], [22000, 11050, 45000, 1]);
eq('split shares add up to 100 (28.19, 14.16, 57.66)', r.split.shares, [28, 14, 58]);

// The projection: 78,050 so far; everyday 11,050 over 20 days = 552.5 a day
// for 10 more days = 5,525; Netflix (22nd) still due = 649. Rent and the
// laptop are not run forward.
eq('projection parts', r.pace.projection, { soFar: novSpent, everydayPerDay: 552.5, everydayToCome: 5525, billsToCome: 649 });
eq('projected', r.pace.projected, 84224);

// Usual, by day 20 of August to October: rent 22,000, dining 3,500, shopping 5,000.
const u = Object.fromEntries(r.usual.map(x => [x.category, [x.now, x.usual, x.delta]]));
eq('usual: a new category', u.Electronics, [45000, 0, 45000]);
eq('usual: dining up', u.Dining, [6200, 3500, 2700]);
eq('usual: shopping down', u.Shopping, [1000, 5000, -4000]);
eq('usual: rent as usual', u.Rent, [22000, 22000, 0]);
eq('usual: largest change first', r.usual.map(x => x.category), ['Electronics', 'Shopping', 'Groceries', 'Dining', 'Coffee', 'Rent']);

eq('payees', r.payees.map(p => [p.name, p.amount]), [['Croma', 45000], ['Sunrise Homes', 22000], ['The Curry Leaf', 6200], ['Freshmart', 3600], ['Decathlon', 1000]]);
eq('categories with shares adding up to 100', r.categories.map(c => [c.name, c.amount, c.share]), [
  ['Electronics', 45000, 58], ['Rent', 22000, 28], ['Dining', 6200, 8], ['Groceries', 3600, 5], ['Shopping', 1000, 1], ['Coffee', 250, 0],
]);
eq('daily adds up', r.daily.reduce((s, v) => s + v, 0), novSpent);
// Weekdays (everyday only, days 1–20): Saturdays 7 and 14 had groceries.
eq('weekdays: Saturdays', [r.weekdays[6].days, r.weekdays[6].avg], [2, 1800]);
eq('weekdays: Sundays (1, 8, 15) had nothing', [r.weekdays[0].days, r.weekdays[0].avg], [3, 0]);

// Insights: watch first (largest first), then good, then info.
const ids = r.insights.map(i => i.id.replace(/^oneoff:.*/, 'oneoff'));
eq('insights in order', ids, ['pace', 'above:Electronics', 'budget:Dining', 'below:Shopping', 'quiet', 'oneoff', 'bills', 'kept']);
const by = id => r.insights.find(i => i.id.startsWith(id));
eq('pace', [by('pace').tone, by('pace').title], ['watch', 'On course for ₹84,224 this month']);
eq('pace detail', by('pace').detail, "₹51,575 more than October's ₹32,649. That's ₹78,050 so far, everyday spending of about ₹553 a day for the rest of the month, and ₹649 of bills still due.");
eq('new category', [by('above:').title, by('above:').detail], ['₹45,000 on Electronics, new this month', 'Nothing went to Electronics by day 20 in the 3 months before.']);
eq('budget', [by('budget:').title, by('budget:').detail], ['Dining is ₹1,200 over budget', '₹6,200 spent against a ₹5,000 budget.']);
eq('below usual', [by('below:').title, by('below:').detail], ['Shopping is ₹4,000 below usual', '₹1,000 this month so far against ₹5,000 by day 20, on average over the 3 months before.']);
eq('kept, a month in progress is not judged', [by('kept').tone, by('kept').title, by('kept').detail], ['info', "You've kept 8% of what came in so far", '₹6,950 of ₹85,000.']);
eq('bills match the bar', by('bills').title, 'Bills take 28% of your spending');
eq('one-off', [by('oneoff').title, by('oneoff').detail], ['Biggest one-off: Croma', '₹45,000 on 14 Nov.']);
eq('quiet days', [by('quiet').title, by('quiet').detail], ['13 days without spending', 'So far this month, out of 20.']);
eq('actions open screens', [by('pace').action.screen, by('budget:').action.section], ['PULSE_TRENDS', 'goals']);

// Read on 30 November: the newest entry (19th) is 11 days old, so the month
// is read up to the 19th. Everyday 11,050 / 19 days × 11 days = 6,397.37.
const NOW2 = new Date(2026, 10, 30, 12, 0);
const late = P.analyzePulse({ counted: list, month: NOW2, now: NOW2, money, budgets: { Dining: 5000 } });
eq('behind: read up to the newest entry', [late.pace.through, late.pace.today, late.pace.behind], [19, 30, true]);
eq('behind: same-day comparison on the 19th', late.compare, { kind: 'sameDay', day: 19, now: novSpent, before: 32000, change: 144 });
near('behind: everyday to come', late.pace.projection.everydayToCome, 11050 / 19 * 11);
eq('behind: projected', late.pace.projected, 85096);
eq('behind: says so', late.insights.find(i => i.id === 'pace').detail.includes('(entries up to 19 Nov)'), true);

// October, a finished month: recurring payees as they stood on 31 October.
const oct = P.analyzePulse({ counted: list, month: new Date(2026, 9, 1), now: NOW, money });
eq('past month: no today, no projection', [oct.isCurrent, oct.pace.today, oct.pace.projected, oct.pace.through], [false, null, null, 31]);
eq('past month: whole-month comparison, 8% is too small for an insight', [oct.compare, oct.insights.some(i => i.id === 'change')], [{ kind: 'month', day: null, now: 32649, before: 30149, change: 8 }, false]);
eq('past month: Netflix is a bill', [oct.split.bills, oct.split.everyday, oct.split.oneOffs, oct.split.shares], [22649, 10000, 0, [69, 31, 0]]);
eq('past month: usual over August and September, whole months', oct.usual.find(x => x.category === 'Shopping'), { category: 'Shopping', now: 6000, usual: 4500, delta: 1500 });
eq('past month: every day added up', oct.pace.now.every(v => v !== null) && oct.pace.now[30] === 32649, true);

// Nothing yet
const empty = P.analyzePulse({ counted: [], month: NOW, now: NOW, money });
eq('empty: zeros and no insights', [empty.spent, empty.cameIn, empty.keptPct, empty.insights.length, empty.usual.length, empty.compare], [0, 0, null, 0, 0, null]);

// ── 2. A first month that starts late ──────────────────────────────────────
const lateStart = [
  inc('2026-08-20', 40000), out('2026-08-21', 900, 'Dining', 'UPI/DR/CAFE'),
  inc('2026-09-01', 85000), out('2026-09-10', 3000, 'Dining', 'UPI/DR/CAFE'),
  inc('2026-10-01', 85000), out('2026-10-10', 3200, 'Dining', 'UPI/DR/CAFE'),
  inc('2026-11-01', 85000), out('2026-11-10', 3400, 'Dining', 'UPI/DR/CAFE'),
];
const ls = P.analyzePulse({ counted: lateStart, month: new Date(2026, 10, 1), now: new Date(2026, 10, 30, 12), money });
eq('late start: August is partial', ls.months.find(m => m.key === '2026-08').complete, false);
eq('late start: usual over September and October only', ls.usual.find(x => x.category === 'Dining').usual, 3100);
const lsSep = P.analyzePulse({ counted: lateStart, month: new Date(2026, 8, 1), now: new Date(2026, 10, 30, 12), money });
eq('late start: September is not compared with a part August', lsSep.compare, null);

// ── 3. Random wallets ──────────────────────────────────────────────────────
let seed = 20261123;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = xs => xs[Math.floor(rand() * xs.length)];
const CATS = ['Rent', 'Groceries', 'Dining', 'Shopping', 'Electricity', 'Streaming', 'Fuel', 'Electronics', 'Transfer Out', 'Other', 'Healthcare', 'Gifts'];
const PAYEES = ['UPI/DR/ALPHA STORE', 'UPI/DR/BETA FOODS', 'IMPS/P2A/LANDLORD', 'UPI/DR/POWER CO', 'UPI/DR/STREAMFLIX', 'UPI/DR/GAMMA FUEL', 'UPI/DR/DELTA MART', 'NEFT/FRIEND', ''];
const pad = n => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

for (let run = 0; run < 300; run++) {
  const txs = [];
  const startMonth = Math.floor(rand() * 4); // Jul..Oct 2026
  const startDay = 1 + Math.floor(rand() * 20);
  const today = new Date(2026, 10, 1 + Math.floor(rand() * 30), 10);
  for (let m = 6 + startMonth; m <= 10; m++) {
    const last = m === 10 ? today.getDate() : daysIn(2026, m);
    const from = m === 6 + startMonth ? startDay : 1;
    if (rand() < 0.9) txs.push(tx(`2026-${pad(m + 1)}-${pad(Math.max(from, 1))}`, 'INCOME', Math.round(rand() * 9000000) / 100 + 1000, 'Salary', 'NEFT/EMPLOYER'));
    const n = Math.floor(rand() * 25);
    for (let i = 0; i < n; i++) {
      const d = from + Math.floor(rand() * (last - from + 1));
      txs.push(out(`2026-${pad(m + 1)}-${pad(d)}`, Math.round(rand() * (rand() < 0.1 ? 6000000 : 300000)) / 100 + 1, pick(CATS), pick(PAYEES)));
    }
    if (rand() < 0.8) txs.push(out(`2026-${pad(m + 1)}-${pad(Math.min(last, Math.max(from, 3)))}`, 18000, 'Rent', 'IMPS/P2A/LANDLORD'));
  }
  const budgets = rand() < 0.5 ? { Dining: 2000, Groceries: 5000 } : {};
  for (const monthDate of [today, new Date(2026, 9, 1), new Date(2026, 8, 1)]) {
    const res = P.analyzePulse({ counted: txs, month: monthDate, now: today, money, budgets });
    const tag = `run ${run} ${res.key}`;
    const mine = txs.filter(t => t.date.slice(0, 7) === res.key);
    const spent = mine.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const cameIn = mine.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    near(`${tag} spent`, res.spent, spent);
    near(`${tag} came in`, res.cameIn, cameIn);
    near(`${tag} categories add up`, res.categories.reduce((s, c) => s + c.amount, 0), spent);
    near(`${tag} split adds up`, res.split.bills + res.split.everyday + res.split.oneOffs, spent);
    near(`${tag} days add up`, res.daily.reduce((s, v) => s + v, 0), spent);
    near(`${tag} month column`, res.months[5].spent, spent);
    eq(`${tag} split shares`, res.split.shares.reduce((s, v) => s + v, 0), spent > 0 ? 100 : 0);
    eq(`${tag} category shares`, res.categories.reduce((s, c) => s + c.share, 0), spent > 0 ? 100 : 0);
    eq(`${tag} kept %`, res.keptPct, cameIn > 0 ? Math.round(((cameIn - spent) / cameIn) * 100) : null);
    const through = res.pace.through;
    if (through > 0) near(`${tag} line at its end`, res.pace.now[through - 1], res.daily.slice(0, through).reduce((s, v) => s + v, 0));
    eq(`${tag} line stops after ${through}`, res.pace.now.slice(through).every(v => v === null), true);
    if (!res.isCurrent) eq(`${tag} past month line covers the month`, through, res.pace.daysInMonth);
    if (res.pace.projected !== null) eq(`${tag} projection at least what's spent`, res.pace.projected >= Math.round(res.pace.now[through - 1]) - 1, true);
    eq(`${tag} unique insights`, new Set(res.insights.map(i => i.id)).size, res.insights.length);
    eq(`${tag} insights ordered`, res.insights.map(i => i.tone).join(','), [...res.insights.filter(i => i.tone === 'watch'), ...res.insights.filter(i => i.tone === 'good'), ...res.insights.filter(i => i.tone === 'info')].map(i => i.tone).join(','));
    // Usual, recounted: baseline months fully covered, same days in the live month.
    const first = txs.map(t => t.date).sort()[0];
    const newest = txs.map(t => t.date).sort().at(-1);
    const idx = +res.key.slice(0, 4) * 12 + (+res.key.slice(5) - 1);
    const keyAt = i => `${Math.floor(i / 12)}-${pad(i % 12 + 1)}`;
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
    const complete = k => txs.some(t => t.date.startsWith(k)) && k < todayKey
      && (k > first.slice(0, 7) || +first.slice(8) <= 7)
      && (k < newest.slice(0, 7) || +newest.slice(8) > daysIn(+k.slice(0, 4), +k.slice(5) - 1) - 7);
    const baseline = [1, 2, 3].map(n => keyAt(idx - n)).filter(k => complete(k) && txs.some(t => t.type === 'EXPENSE' && t.date.startsWith(k)));
    for (const row of res.usual) {
      const inBase = baseline.reduce((s, k) => s + txs.filter(t => t.type === 'EXPENSE' && t.category === row.category && t.date.startsWith(k) && +t.date.slice(8) <= through).reduce((a, t) => a + t.amount, 0), 0) / baseline.length;
      const now = mine.filter(t => t.type === 'EXPENSE' && t.category === row.category && +t.date.slice(8) <= through).reduce((a, t) => a + t.amount, 0);
      near(`${tag} usual ${row.category}`, row.usual, inBase);
      near(`${tag} now ${row.category}`, row.now, now);
    }
    // The comparison, recounted.
    const prevKey = keyAt(idx - 1);
    const prevOut = txs.filter(t => t.type === 'EXPENSE' && t.date.startsWith(prevKey));
    if (res.compare) {
      eq(`${tag} compare needs a full month before`, complete(prevKey), true);
      const upTo = res.compare.kind === 'sameDay' ? res.compare.day : 31;
      near(`${tag} compare before`, res.compare.before, prevOut.filter(t => +t.date.slice(8) <= upTo).reduce((s, t) => s + t.amount, 0));
      eq(`${tag} compare change`, res.compare.change, Math.round(((res.compare.now - res.compare.before) / res.compare.before) * 100));
    }
  }
}

// ── 4. Payments still to review stop the month comparison (1.5.8) ─────────
// The worked example's wallet, plus an unsorted ₹1,50,000 fund transfer on
// 10 Nov (shown as "To review", as WalletContext shows it): November is
// mostly money that wasn't spent, so the months aren't compared.
{
  const swamp = [...list, out('2026-11-10', 150000, 'To review', 'NEFT/N3120001/BLUECHIP MUTUAL FUND/HDFC0000123')];
  const rv = P.analyzePulse({ counted: swamp, month: NOW, now: NOW, money, budgets: { Dining: 5000 } });
  eq('review: set while a quarter or more of the month is to review', rv.review, { amount: 150000, prevAmount: 0 });
  eq('… no comparison with October', rv.compare, null);
  eq('… no "on course … more than October" finding', rv.insights.some(i => i.id === 'pace' || i.id === 'change'), false);
  eq('… the review finding comes first, to Money moved', [rv.insights[0].id, rv.insights[0].action.screen, rv.insights[0].action.label], ['review', 'MONEY_MOVED', 'Review payments']);
  eq('… its title', rv.insights[0].title, "₹1,50,000 of November's spending is still to review");
  eq('… spending still counts it', Math.round(rv.spent - r.spent), 150000);
  const small = [...list, out('2026-11-10', 999, 'To review', 'UPI/DR/612300000009/KAVYA TRADERS/UTIB/kavya@axis/UPI')];
  const rs = P.analyzePulse({ counted: small, month: NOW, now: NOW, money, budgets: { Dining: 5000 } });
  eq('a small payment to review changes nothing', [rs.review, rs.compare !== null], [null, r.compare !== null]);
  const dec = P.analyzePulse({ counted: swamp, month: new Date(2026, 11, 1), now: new Date(2026, 11, 20, 12), money });
  eq('the month after: the month before is swamped, so no comparison either', [dec.review?.prevAmount, dec.compare], [150000, null]);
  const empty2 = P.analyzePulse({ counted: [], month: NOW, now: NOW, money });
  eq('an empty month: no review, no "On course for ₹0"', [empty2.review, empty2.pace.projected], [null, null]);
}

console.log(`${checks - failures}/${checks} pulse checks passed`);
if (failures) process.exit(1);
