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
 *   - (1.5.8) a transfer nobody sorted reads "To review"; a payee sorted as
 *     counting shows under its rule's category; the label never becomes
 *     data; the review's guesses from a name; a payment and its reversal
 *     (same reference and amount) cancel out, and only an exact pair does;
 *     fund redemptions are money coming back, not income
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
      `export * from ${JSON.stringify(join(root, 'services', 'review.ts'))};`,
      `export { reversalPairs } from ${JSON.stringify(join(root, 'services', 'reversals.ts'))};`,
      `export { categorizeNarration } from ${JSON.stringify(join(root, 'services', 'categorize.ts'))};`,
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
const { analyzeIncome, detectRecurringCharges, flowClassifier, matchText, payeeName, paymentRail, prettyMerchant, suggestPayees, tidyName,
  shownCategory, withShownCategories, categoryToStore, suggestChoice, reviewPayees, toReviewTotal, REVIEW_CHOICES, reversalPairs, categorizeNarration } =
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

const ok = (label, cond) => {
  checks++;
  if (!cond) { failures++; console.log(`  FAIL ${label}`); }
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
// 1.5.8: a short code read as the payee (the audits found one shown as a four-letter fragment)
eq('payee: IMPS with the bank\'s code before the payee', payeeName('IMPS/DR/612345678901/HDFC/RENT AUG 2026/KAPOOR HOMES'), 'KAPOOR HOMES');
eq('payee: a UPI payee called like a code is still the payee', payeeName('UPI/DR/612345678902/UBER/YESB/uber@ybl/UPI'), 'UBER');
eq('payee: HDFC UPI Lite top-up', payeeName('UPI-LITE-12345678901234-612345678903-ADD MONEY'), 'UPI Lite top-up');
eq('payee: a gateway, then the shop', payeeName('UPI-PAYU-POWERACCESS.PAYUPAYMENTS@AXISBANK-UTIB0000000-612345678904-ACME FOLKS PRIV'), 'ACME FOLKS PRIV');
eq('payee: a gateway and nothing after it', payeeName('UPI-ACWO-ACWO.BDPG@HDFCBANK-HDFC0MERUPI-612345678905-PAY'), 'ACWO');
eq('shown: the gateway by name', [prettyMerchant('UPI-ACWO-ACWO.BDPG@HDFCBANK-HDFC0MERUPI-612345678905-PAY'), prettyMerchant('UPI-PAYU-POWERACCESS.PAYUPAYMENTS@AXISBANK-UTIB0000000-612345678904-ACME FOLKS PRIV'), prettyMerchant('IMPS/DR/612345678901/HDFC/RENT AUG 2026/KAPOOR HOMES')],
  ['BillDesk payment', 'Acme Folks Priv', 'Kapoor Homes']);
eq('shown: a payee field that is only a number gives the rail', prettyMerchant('UPI/DR/612345678906/98765432/BARB/9876543/UPI'), 'UPI payment');
eq('payee: HDFC funds transfer', payeeName('FT- 1234567890-12345678901234 - ACME MUTUAL FUND - COMMON REDEMPTION A/C -'), 'ACME MUTUAL FUND');
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
eq('show: nothing but codes gives the rail (the narration stays under "From the bank")', prettyMerchant('UPI/DR/123456789012/UPI'), 'UPI payment');
eq('show: only a handle', prettyMerchant('UPI/DR/123456789012/kirana@ybl'), 'kirana');
eq('tidy: acronyms and initials stay', tidyName('SBI LIFE KV TRADERS'), 'SBI Life KV Traders');
eq('tidy: small words', tidyName('THE BANK OF INDIA'), 'The Bank Of India');
eq('rail: from the first field', ['UPI/DR/1/X', 'NEFT/2/Y', 'MB/IMPS/3/Z', 'POS 1234 STORE', 'ATW/5/6', 'IFT/7/Z', 'Coffee'].map(paymentRail),
  ['UPI', 'NEFT', 'IMPS', 'Card', 'ATM', 'Transfer', null]);

// ── To review (1.5.8) ──────────────────────────────────────────────────────
{
  const e = (id, merchant, amount, category = 'Transfer Out', date = '2026-11-10') => ({ id, date, type: 'EXPENSE', amount, category, merchant, note: merchant });
  const i = (id, merchant, amount, category = 'Transfer In', date = '2026-11-12') => ({ id, date, type: 'INCOME', amount, category, merchant, note: merchant });
  const soc = e('soc', 'UPI/DR/612300000001/SUNRISE CHS/YESB/sunrisechs@ybl/UPI', 18000);
  const fund = e('fund', 'NEFT/N312000000901/BLUECHIP MUTUAL FUND/HDFC0000123', 150000);
  const typed = e('typed', 'Paid Ravi for tickets', 900);           // a transfer typed by hand: no payee to sort
  const shop = e('shop', 'UPI/DR/612300000005/KAVYA TRADERS/UTIB/kavya@axis/UPI', 2500, 'Shopping');
  const back = i('back', 'IMPS/P2A/612300000006/SUNRISE CHS/ICIC0000456', 500);
  const none = flowClassifier([]);
  eq('to review: an unsorted transfer out', shownCategory(soc, none(soc)), 'To review');
  eq('… not one typed by hand (nothing to sort it by)', shownCategory(typed, none(typed)), 'Transfer Out');
  eq('… not a payment with a category of its own', shownCategory(shop, none(shop)), 'Shopping');
  eq('… not money in', shownCategory(back, none(back)), 'Transfer In');
  const rules = flowClassifier([
    { id: 'r1', match: 'sunrise chs', kind: 'counts', category: 'Rent' },
    { id: 'r2', match: 'bluechip mutual fund', kind: 'investment' },
  ]);
  eq('sorted as counting with a category: shown under it', shownCategory(soc, rules(soc)), 'Rent');
  eq('… and still spending', rules(soc).flow, 'spend');
  eq('… money in from the same payee keeps Transfer In', shownCategory(back, rules(back)), 'Transfer In');
  eq('sorted as an investment: moved, Transfer Out', [rules(fund).flow, shownCategory(fund, rules(fund))], ['moved', 'Transfer Out']);
  const keep = flowClassifier([{ id: 'r3', match: 'sunrise chs', kind: 'counts' }]);
  eq('counts with no category: Transfer Out', shownCategory(soc, keep(soc)), 'Transfer Out');
  const storedLabel = { ...soc, category: 'To review' };
  eq('"To review" saved by an old edit reads Transfer Out once sorted', shownCategory(storedLabel, rules(storedLabel)), 'Rent');
  eq('… and To review while not', shownCategory(storedLabel, none(storedLabel)), 'To review');
  const list = [soc, fund, typed, shop, back];
  const shown = withShownCategories(list, none);
  eq('the shown list relabels only what changes', shown.map(t => t.category), ['To review', 'To review', 'Transfer Out', 'Shopping', 'Transfer In']);
  ok('… keeps unchanged entries as the same objects', shown[2] === typed && shown[3] === shop);
  ok('… and never touches the stored ones', soc.category === 'Transfer Out' && fund.category === 'Transfer Out');
  eq('to review total: money out only', toReviewTotal(shown), { amount: 168000, count: 2 });
  eq('edit saved unchanged keeps the stored category', categoryToStore(soc, 'To review', 'To review'), 'Transfer Out');
  eq('edit to a new category stores it', categoryToStore(soc, 'To review', 'Rent'), 'Rent');

  eq('guesses', ['BLUECHIP MUTUAL FUND', 'ZERODHA BROKING LTD', 'SUNRISE CHS', 'Green Park Co-op Housing Society', 'GITHUB INC', 'OPENAI LLC', 'Mr. ANITA SHARMA', 'KABIR S', 'KAVYA TRADERS', 'ACME FOODS PVT LTD', 'X'].map(suggestChoice),
    ['investment', 'investment', 'rent', 'rent', 'software', 'software', 'family', 'family', null, null, null]);
  eq('the review offers six answers, rules first-class', REVIEW_CHOICES.map(c => [c.id, c.kind, c.category ?? null]),
    [['investment', 'investment', null], ['rent', 'counts', 'Rent'], ['software', 'counts', 'Software'], ['family', 'family', null], ['mine', 'mine', null], ['spend', 'counts', 'Other']]);
  const review = reviewPayees(shown, none);
  eq('review: payees with money out, largest first, with guesses', review.map(p => [p.name, p.out, p.in, p.suggestion]),
    [['BLUECHIP MUTUAL FUND', 150000, 0, 'investment'], ['SUNRISE CHS', 18000, 500, 'rent']]);
  eq('… limited to an import\'s rows, totals still cover every payment to the payee', reviewPayees(shown, none, new Set(['back'])).map(p => [p.name, p.out, p.in]),
    [['SUNRISE CHS', 18000, 500]]);
  eq('… gone once sorted', reviewPayees(withShownCategories(list, rules), rules).length, 0);

  // Reversals
  const paid = e('paid', 'UPI/DR/612399999991/ACME GADGETS/YESB/acme@ybl/UPI', 3200, 'Shopping', '2026-11-13');
  const rev = i('rev', 'UPI/REV/612399999991/ACME GADGETS/YESB/acme@ybl/UPI', 3200, 'Refunds', '2026-11-13');
  const revFirst = i('rev2', 'REV/UPI/612399999992/ACME GADGETS/YESB/acme@ybl/UPI', 450, 'Refunds', '2026-11-15');
  const paid2 = e('paid2', 'UPI/DR/612399999992/ACME GADGETS/YESB/acme@ybl/UPI', 450, 'Shopping', '2026-11-14');
  const hdfcPaid = e('hp', 'UPI-ZOMATO LTD-zomato@axis-UTIB0000000-612399999993-PAY', 299, 'Food Delivery');
  const hdfcRev = i('hr', 'REV-UPI-ZOMATO LTD-zomato@axis-UTIB0000000-612399999993-PAY', 299, 'Refunds');
  const otherAmount = i('oa', 'UPI/REV/612399999994/ACME GADGETS/YESB/acme@ybl/UPI', 100, 'Refunds');
  const paid4 = e('p4', 'UPI/DR/612399999994/ACME GADGETS/YESB/acme@ybl/UPI', 1000, 'Shopping');
  const notSaid = i('ns', 'UPI/CR/612399999995/ACME GADGETS/YESB/acme@ybl/UPI', 700);
  const paid5 = e('p5', 'UPI/DR/612399999995/ACME GADGETS/YESB/acme@ybl/UPI', 700, 'Shopping');
  const before = i('bf', 'UPI/REV/612399999996/ACME GADGETS/YESB/acme@ybl/UPI', 60, 'Refunds', '2026-11-01');
  const paid6 = e('p6', 'UPI/DR/612399999996/ACME GADGETS/YESB/acme@ybl/UPI', 60, 'Shopping', '2026-11-05');
  const pairs = reversalPairs([paid, rev, revFirst, paid2, hdfcPaid, hdfcRev, otherAmount, paid4, notSaid, paid5, before, paid6]);
  eq('reversals: paired by reference and amount (UPI/REV, REV/UPI, HDFC REV-UPI)', [...pairs].sort(), ['hp', 'hr', 'paid', 'paid2', 'rev', 'rev2'].sort());
  const withPairs = flowClassifier([], pairs);
  eq('… both sides are money moved, as Reversed', [withPairs(paid).moved, withPairs(rev).moved], ['reversal', 'reversal']);
  eq('… not a different amount, a credit that doesn\'t say reversed, or one before the payment',
    [withPairs(otherAmount).flow, withPairs(paid4).flow, withPairs(notSaid).flow, withPairs(before).flow], ['income', 'spend', 'income', 'income']);
  eq('… a payment pairs once', reversalPairs([paid, rev, { ...rev, id: 'rev-again' }]).size, 2);
  eq('… a reversal wins over a payee rule', flowClassifier([{ id: 'c', match: 'acme gadgets', kind: 'counts' }], pairs)(paid).moved, 'reversal');

  // Redemptions
  eq('a fund redemption is Redemption proceeds, not Investment Returns',
    ['NEFT/N312000000777/BLUECHIP MF REDEMPTION/HDFC0000123', 'ACH C- BLUECHIP MF DIVIDEND', 'NEFT/CR/123/ABC AMC REDEEM PROCEEDS'].map(n => categorizeNarration(n.toLowerCase(), 'income')),
    ['Redemption proceeds', 'Investment Returns', 'Redemption proceeds']);
  const red = i('red', 'Bluechip fund', 40000, 'Redemption proceeds');
  eq('… money moved even when typed by hand', none(red).moved, 'investment');
}

console.log(`${checks - failures}/${checks} checks passed.`);
process.exit(failures > 0 ? 1 : 0);
