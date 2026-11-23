#!/usr/bin/env node
/**
 * Spending rule check (audit H3, M8, M9).
 *
 * Runs services/spend.ts and the income and recurring detectors on made-up
 * narrations in IDFC's formats and checks that:
 *   - payees are read from UPI, IFT, NEFT and IMPS narrations, and boilerplate
 *     ("UPI", "Fund Trf", "PAY REQUEST") is not taken for a payee
 *   - payee rules decide first (most specific wins, whole words only, "Mr."
 *     and "Pvt Ltd" ignored); investments and adjustments are money moved by
 *     default; everything else counts as spending or income
 *   - transfers no rule covers are suggested for sorting, and drop out once sorted
 *   - recurring charges leave money moved out, and a pay stream is a guess to
 *     confirm until a rule says so
 *
 * Usage (after `npm ci`):
 *   node scripts/check-spend.mjs
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
const tmp = mkdtempSync(join(tmpdir(), 'wallette-spend-'));
const bundle = join(tmp, 'spend.mjs');
await build({
  stdin: {
    contents: [
      `export * from ${JSON.stringify(join(root, 'services', 'spend.ts'))};`,
      `export { analyzeIncome, detectRecurringCharges, prettyMerchant } from ${JSON.stringify(join(root, 'services', 'analyticsService.ts'))};`,
      `export { tidyName, paymentRail } from ${JSON.stringify(join(root, 'utils', 'names.ts'))};`,
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
const { analyzeIncome, detectRecurringCharges, flowClassifier, matchText, payeeName, paymentRail, prettyMerchant, suggestPayees, tidyName } =
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

let n = 0;
const tx = (date, type, amount, category, merchant) =>
  ({ id: `t${++n}`, date, type, amount, category, merchant, note: '' });
const out = (date, amount, category, merchant) => tx(date, 'EXPENSE', amount, category, merchant);
const inc = (date, amount, category, merchant) => tx(date, 'INCOME', amount, category, merchant);
const flows = (rules, list) => {
  const flowOf = flowClassifier(rules);
  return list.map(t => { const f = flowOf(t); return f.moved ? `${f.flow}:${f.moved}` : f.flow; });
};

// ── Payees in narrations ───────────────────────────────────────────────────
eq('payee: UPI/DR', payeeName('UPI/DR/615230407557/ZOMATO L/UTIB/zomatoo/UPI'), 'ZOMATO L');
eq('payee: UPI/MOB note', payeeName('UPI/MOB/615230407557/RENT FOR MAY'), 'RENT FOR MAY');
eq('payee: IFT', payeeName('IFT/10000123456/Mr. RAVI KUMAR SHAH/912345'), 'Mr. RAVI KUMAR SHAH');
eq('payee: NEFT', payeeName('NEFT/CMS123456789/ACME BROKING PVT LTD/ICIC0001234'), 'ACME BROKING PVT LTD');
eq('payee: IMPS', payeeName('IMPS-OPM/512345678901/Test Associates LLP/HDFC0001234/512345/'), 'Test Associates LLP');
eq('payee: none in boilerplate', [
  payeeName('UPI/MOB/615230407557/UPI'),
  payeeName('IMPS-OPM/Fund Trf/512345678901/123456ICIC/'),
  payeeName('UPI/MOB/615230407557/PAY REQUEST'),
  payeeName('UPI/CREDIT ADJUSTMENT/615230407557/26-12-25'),
  payeeName('Dad'),
], [null, null, null, null, null]);
eq('matchText drops filler', [matchText('Mr. RAVI/KUMAR'), matchText('TEST AND SONS PVT LTD')], ['ravi kumar', 'test sons']);

// ── Defaults: investments and adjustments move; everything else counts ─────
const base = [
  out('2026-03-02', 450, 'Food Delivery', 'UPI/DR/1111111111/ZOMATO L/UTIB/zomatoo/UPI'),
  out('2026-03-03', 30000, 'Transfer Out', 'IFT/10000123456/Mr. RAVI KUMAR SHAH/912345'),
  out('2026-03-04', 5000, 'Investment', 'UPI/MOB/2222222222/ZERODHA BROKING'),
  out('2026-03-05', 200, 'Adjustment', 'Balance adjustment'),
  inc('2026-03-06', 80000, 'Transfer In', 'NEFT/CMS123456789/CHOICE EQUITY BROKING PVT LTD/ICIC0001234'),
  inc('2026-03-07', 2500, 'Investment Returns', 'NEFT/HDFCH123456/ICICI PRUDENTIAL M F REDEMPTION POOL/HDFC0001234'),
  inc('2026-03-08', 1200, 'Transfer In', 'NACH/ACME INDUSTRIES DIVIDEND/123456'),
  inc('2026-03-09', 300, 'Adjustment', 'Balance adjustment'),
];
eq('defaults', flows([], base), [
  'spend', 'spend', 'moved:investment', 'moved:adjustment',
  'moved:investment', 'moved:investment', 'income', 'moved:adjustment',
]);

// ── Rules decide first ─────────────────────────────────────────────────────
const people = [
  out('2026-03-10', 30000, 'Transfer Out', 'IFT/10000123456/Mr. RAVI KUMAR SHAH/912345'),
  out('2026-03-11', 25000, 'Transfer Out', 'IMPS-OPM/512345678901/RAVI KUMAR/HDFC0001234/512345/'),
  inc('2026-03-12', 500000, 'Transfer In', 'IFT/MB/IFT Mr. RAVI SHAH SELF/912345'),
  out('2026-03-13', 900, 'Transfer Out', 'UPI/MOB/3333333333/DAD'),
  out('2026-03-14', 80, 'Transfer Out', 'UPI/DR/4444444444/DADAR ST/YESB/dadar/UPI'),
  out('2026-03-15', 5000, 'Investment', 'UPI/MOB/2222222222/GOLD JEWELLERS'),
  out('2026-03-16', 12000, 'Transfer Out', 'IMPS-OPM/512345678901/Test & Sons Private Limited/HDFC0001234/'),
];
const rules = [
  { id: 'r1', match: 'ravi', kind: 'family' },
  { id: 'r2', match: 'Mr. Ravi Shah Self', kind: 'mine' },
  { id: 'r3', match: 'dad', kind: 'family' },
  { id: 'r4', match: 'gold jewellers', kind: 'counts' },
  { id: 'r5', match: 'TEST AND SONS PVT LTD', kind: 'ignore' },
];
eq('rules', flows(rules, people), [
  'moved:family', 'moved:family', 'moved:mine', 'moved:family', 'spend', 'spend', 'moved:ignore',
]);
eq('a rule shorter than two letters is ignored', flows([{ id: 'x', match: 'a', kind: 'ignore' }], [people[4]]), ['spend']);

// ── Suggestions: unsorted transfers, gone once sorted ──────────────────────
const sugg = suggestPayees([...base, ...people], flowClassifier([]));
eq('suggested payees', sugg.map(s => [s.name, s.out, s.in, s.count]), [
  ['IFT Mr. RAVI SHAH SELF', 0, 500000, 1],
  ['Mr. RAVI KUMAR SHAH', 60000, 0, 2],
  ['RAVI KUMAR', 25000, 0, 1],
  ['Test & Sons Private Limited', 12000, 0, 1],
]);
eq('sorted payees are not suggested', suggestPayees([...base, ...people], flowClassifier(rules)).length, 0);

// ── Recurring charges leave money moved out (M8) ───────────────────────────
const monthly = [];
for (const m of ['01', '02', '03', '04']) {
  monthly.push(out(`2026-${m}-05`, 30000, 'Transfer Out', 'IFT/10000123456/Mr. RAVI KUMAR SHAH/912345'));
  monthly.push(out(`2026-${m}-07`, 649, 'Streaming', 'UPI/DR/5555555555/NETFLIX/HDFC/netflix/UPI'));
}
const now = new Date(2026, 3, 20);
const recurringNames = (list, r) => {
  const flowOf = flowClassifier(r);
  return detectRecurringCharges(list.filter(t => flowOf(t).flow !== 'moved'), now).map(c => c.name);
};
eq('recurring before sorting', recurringNames(monthly, []).length, 2);
eq('recurring after sorting family', recurringNames(monthly, [{ id: 'f', match: 'ravi', kind: 'family' }]),
  ['UPI/DR/5555555555/NETFLIX/HDFC/netflix/UPI']);

// ── Pay is confirmed, not guessed (M8) ─────────────────────────────────────
const credits = [];
for (const m of ['01', '02', '03', '04']) {
  credits.push(inc(`2026-${m}-01`, 50000, 'Transfer In', `NEFT/CMS12345678${m}/ACME TECH SOLUTIONS/ICIC0001234`));
  credits.push(inc(`2026-${m}-15`, 900, 'Transfer In', `UPI/CR/66666666${m}/FRIEND A/SBIN/friend/UPI`));
}
const pay = r => {
  const flowOf = flowClassifier(r);
  const counted = credits.filter(t => flowOf(t).flow !== 'moved');
  const s = analyzeIncome(counted, now, t => {
    const rule = flowOf(t).rule;
    if (rule?.kind === 'salary' || t.category === 'Salary') return true;
    return rule ? false : null;
  }).salary;
  return s && [s.payee, s.confirmed];
};
eq('pay: a guess to confirm', pay([]), ['ACME TECH SOLUTIONS', false]);
eq('pay: confirmed', pay([{ id: 's', match: 'ACME TECH SOLUTIONS', kind: 'salary' }]), ['ACME TECH SOLUTIONS', true]);
eq('pay: ruled out', pay([{ id: 's', match: 'ACME TECH SOLUTIONS', kind: 'counts' }]), null);

// ── Names as the screens show them ─────────────────────────────────────────
eq('show: UPI payee, not the handle', prettyMerchant('UPI/DR/62000000001/NETFLIX COM/ICIC/netflix@icici/UPI'), 'Netflix.com');
eq('show: UPI payee in capitals', prettyMerchant('UPI/DR/615230407557/ZOMATO L/UTIB/zomatoo/UPI'), 'Zomato L');
eq('show: NEFT company', prettyMerchant('NEFT/CMS123456789/ACME BROKING PVT LTD/ICIC0001234'), 'Acme Broking Pvt Ltd');
eq('show: HDFC dashes, not the note', prettyMerchant('UPI-RAVI KUMAR-ravi@okicici-ICIC0000000-615200000000-PAYMENT FROM PHONE'), 'Ravi Kumar');
eq('show: short codes give way to a name', prettyMerchant('NACH/DR/MF SIP/BLUECHIP FUND'), 'Bluechip Fund');
eq('show: Mr. and capitals', prettyMerchant('IFT/10000123456/Mr. RAVI KUMAR SHAH/912345'), 'Mr. Ravi Kumar Shah');
eq('show: a bank charge', prettyMerchant('SMS ALERT CHARGES QTR SEP'), 'SMS Alert Charges Qtr Sep');
eq('show: typed names stay as typed', prettyMerchant('Starbucks Bandra'), 'Starbucks Bandra');
eq('show: nothing but codes stays raw', prettyMerchant('UPI/DR/123456789012/UPI'), 'UPI/DR/123456789012/UPI');
eq('show: only a handle', prettyMerchant('UPI/DR/123456789012/kirana@ybl'), 'kirana');
eq('tidy: acronyms and initials stay', tidyName('SBI LIFE KV TRADERS'), 'SBI Life KV Traders');
eq('tidy: small words', tidyName('THE BANK OF INDIA'), 'The Bank Of India');
eq('rail: from the first field', ['UPI/DR/1/X', 'NEFT/2/Y', 'MB/IMPS/3/Z', 'POS 1234 STORE', 'ATW/5/6', 'IFT/7/Z', 'Coffee'].map(paymentRail),
  ['UPI', 'NEFT', 'IMPS', 'Card', 'ATM', 'Transfer', null]);

console.log(`${checks - failures}/${checks} checks passed.`);
process.exit(failures > 0 ? 1 : 0);
