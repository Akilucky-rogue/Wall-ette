#!/usr/bin/env node
/**
 * Import, end to end: from the statement file to the wallet's balance.
 *
 * Runs what the Import screen runs, in the same order: the app's statement
 * readers (parseStatementPdf for PDFs, IDFCBankParser.parseExcel and
 * fromExcel for Excel), then toTransactions, findDuplicates, importTally and
 * mergeImport (services/statementImport.ts; WalletContext.importTransactions
 * is mergeImport plus saving). For every statement in the folders given it
 * checks that:
 *   - every row with money on it becomes a transaction (none dropped) and no
 *     row is unreadable
 *   - debits and credits after that step match the bank's totals, to the
 *     paisa, and opening + credits - debits = closing
 *   - every day is a real day, inside the statement's period when printed
 *   - ids are unique, amounts positive and to the paisa
 *   - into an empty wallet, the balance is the bank's closing and the
 *     balance check on the review says it matches; the statement's own check
 *     (opening + rows = closing, each row in once) passes
 *   - importing it again adds nothing, and the review flags every row
 * and, for each account with more than one statement, that importing them
 * in every order (all of them for up to five statements, else date order,
 * reverse and random orders) always ends at the latest statement's closing
 * balance, with each row once and the very same entries whatever the order,
 * and the check never reads "off" on the way; and that leaving one out,
 * bridging the gap with an
 * adjustment, then importing it, ends with the same balance and no adjustment.
 *
 * With statements from more than one account (each read with its bank and
 * the last four digits of its number), it also imports all of them into one
 * wallet, oldest first and newest first: the balance must end at the sum of
 * each account's latest closing, with every account's check matching.
 *
 * Then made-up cases real statements may not have: gaps on either side,
 * bridged and filled; a new account opening at 0; a wallet from before
 * balance anchors; an entry typed by hand that the statement also has; two
 * identical payments on one day; a row with no narration; a row with no
 * debit/credit side; a wallet holding two accounts and cash, where the check
 * reads as a note, not "off"; rows left unticked, ticked twice or missed;
 * and, from 1.5.9, accounts: two accounts in any order; a statement imported
 * again setting a missing opening balance; wallets from 1.5.8 with one
 * account or two, whose opening balance goes to the right one; the account
 * number read from a statement's header.
 *
 * Usage (after `npm ci`):
 *   node scripts/check-import.mjs [folder ...]      default: private/statements
 *
 * Statements stay out of git. File names print with account numbers masked;
 * results are counts and differences, never balances, payees or narrations.
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata'; // as on the phone

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folders = (process.argv.length > 2 ? process.argv.slice(2) : [join(root, 'private', 'statements')]).map(f => resolve(f));
const pdfjs = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href;
const worker = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

const tmp = mkdtempSync(join(tmpdir(), 'wallette-import-'));
const bundle = join(tmp, 'import.mjs');
await build({
  stdin: {
    contents: [
      `export { parseStatementPdf } from ${JSON.stringify(join(root, 'services', 'idfcParser.ts'))};`,
      `export { default as IDFCBankParser } from ${JSON.stringify(join(root, 'services', 'IDFCBankParser.ts'))};`,
      `export * from ${JSON.stringify(join(root, 'services', 'statementImport.ts'))};`,
      `export * from ${JSON.stringify(join(root, 'services', 'accounts.ts'))};`,
    ].join('\n'),
    resolveDir: root,
    loader: 'ts',
  },
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
  define: { 'import.meta.env.PROD': 'true' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  plugins: [{
    name: 'node-pdfjs',
    setup(b) {
      b.onResolve({ filter: /^pdfjs-dist(\/legacy\/build\/pdf\.mjs)?$/ }, () => ({ path: pdfjs, external: true }));
      b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'worker-url' }));
      b.onLoad({ filter: /.*/, namespace: 'worker-url' }, () => ({ contents: `export default ${JSON.stringify(worker)};`, loader: 'js' }));
    },
  }],
});
const I = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const paise = (n) => Math.round((Number(n) || 0) * 100);
const mask = (name) => name.replace(/\d{6,}/g, (d) => `…${d.slice(-2)}`);
const EMPTY = { transactions: [], openingBalance: 0, openingBalanceAsOf: null };
let failures = 0;
let checks = 0;
const ok = (cond, problems, label) => { checks++; if (!cond) { failures++; problems.push(label); } };

// A small seeded random, so a failing order can be replayed.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (list, rand) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// pdf.js prints "Warning: …" lines in Node.
async function quietly(fn) {
  const log = console.log, warn = console.warn;
  console.log = (...m) => { if (!String(m[0]).startsWith('Warning:')) log(...m); };
  console.warn = () => {};
  try { return await fn(); } finally { console.log = log; console.warn = warn; }
}

/**
 * One import step, as the review does it by default: every row the wallet
 * doesn't already have, the statement's account when it shows its number,
 * and the suggested answer to whose the opening balance from before 1.5.9
 * is (`legacy` overrides it). `pick` changes the ticks, as a person can.
 */
function importStep(wallet, s, { bridge = false, pick, legacy, accounts = true } = {}) {
  const dupes = I.findDuplicates(s.staged, wallet.transactions);
  const selected = pick ? pick(s.staged, dupes) : s.staged.filter(t => !dupes.has(t.id));
  const known = accounts && s.last4 && s.bank && s.bank !== 'Generic (auto-detected)' ? { bank: s.bank, last4: s.last4 } : null;
  const suggested = known ? I.suggestLegacy({ wallet, account: known, rows: s.staged, minDate: s.minDate, maxDate: s.maxDate, opening: s.opening, closing: s.closing }) : null;
  const choice = suggested ? (legacy ?? suggested) : null;
  const account = known ? { ...known, ...(choice ? { legacy: choice } : {}) } : undefined;
  const rowIds = new Set(s.staged.map(t => t.id));
  const tally = I.importTally({ wallet, selected, rows: s.staged, duplicates: dupes, minDate: s.minDate, maxDate: s.maxDate, opening: s.opening, closing: s.closing, bridge, account });
  const incoming = bridge && tally?.gap ? [I.bridgeAdjustment(tally.gap), ...selected] : selected;
  const stale = tally ? tally.stale : I.staleAdjustments(I.accountView(wallet, account, { rows: s.staged, from: s.minDate, to: s.maxDate }).transactions, s.minDate, s.maxDate);
  const r = I.mergeImport(wallet, incoming, { opening: s.opening, statementStart: s.minDate, removeIds: stale, account, rowIds });
  const tone = tally ? I.tallyTone(tally, bridge) : null;
  return { wallet: I.afterMerge(wallet, r), tally, tone, dupes, suggested, added: r.added.length, removed: r.removed.length, retagged: r.retagged.length, account: r.account };
}

// ── Statements on disk ────────────────────────────────────────────────────

async function read(path) {
  const buf = readFileSync(path);
  if (extname(path).toLowerCase() === '.pdf') {
    const r = await quietly(() => I.parseStatementPdf(buf.toString('base64')));
    return {
      raw: r.transactions,
      opening: r.header.openingKnown ? r.header.openingBalance : undefined,
      closing: r.header.closingKnown ? r.header.closingBalance : undefined,
      totalDebit: r.header.totalDebit || undefined,
      totalCredit: r.header.totalCredit || undefined,
      period: r.header.statementPeriod,
      account: r.header.accountNumber,
      last4: r.header.accountLast4 ?? undefined,
      bank: r.header.bankName,
    };
  }
  const r = await quietly(() => I.IDFCBankParser.parseExcel(new File([buf], basename(path))));
  return {
    raw: I.fromExcel(r.transactions),
    opening: r.summary.openingKnown ? r.summary.openingBalance : undefined,
    closing: r.summary.closingKnown ? r.summary.closingBalance : undefined,
    // Totals only when the statement prints them (not worked out from the rows).
    totalDebit: r.summary.openingKnown && r.balancesFrom !== 'rows' ? r.summary.totalDebit : undefined,
    totalCredit: r.summary.openingKnown && r.balancesFrom !== 'rows' ? r.summary.totalCredit : undefined,
    account: r.summary.accountNumber,
    last4: r.account ?? undefined,
    bank: r.bank,
    // Balances worked out from the rows' running balance (Equitas prints none).
    balancesFromRows: r.balancesFrom === 'rows',
  };
}

const files = [];
let skipped = 0;
for (const folder of folders) {
  if (!existsSync(folder)) { console.log(`(no folder ${mask(folder)})`); continue; }
  for (const f of readdirSync(folder).filter(f => /\.(pdf|xlsx|xls)$/i.test(f)).sort()) files.push(join(folder, f));
}

const statements = [];
for (const path of files) {
  const name = mask(basename(path));
  const problems = [];
  let s;
  try {
    s = await read(path);
  } catch (e) {
    const message = String(e?.message ?? e);
    // A PDF that is a picture of a statement has no text to read; Import
    // says so and asks for the bank's own PDF or Excel. Expected, not wrong.
    if (/picture of a statement/.test(message)) {
      console.log(`skip  ${name.padEnd(48)} a picture with no text: Import asks for the bank's own file`);
      skipped++;
      continue;
    }
    failures++; checks++;
    console.log(`FAIL  ${name.padEnd(48)} couldn't be read: ${message.slice(0, 80)}`);
    continue;
  }
  s.name = name;
  s.file = basename(path); // for grouping by account only; never printed
  s.staged = await I.toTransactions(s.raw);
  const unreadable = I.unreadableRows(s.raw);
  const withMoney = s.raw.filter(t => Number(t.amount) > 0).length;
  ok(unreadable === 0, problems, `${unreadable} unreadable rows`);
  ok(s.staged.length === withMoney, problems, `${withMoney - s.staged.length} rows dropped`);

  let debit = 0, credit = 0;
  for (const t of s.staged) {
    if (t.type === 'INCOME') credit += paise(t.amount); else debit += paise(t.amount);
    ok(t.amount > 0 && Math.abs(t.amount * 100 - Math.round(t.amount * 100)) < 1e-6, problems, 'an amount not positive or not to the paisa');
  }
  if (s.totalDebit !== undefined) ok(debit === paise(s.totalDebit), problems, `debits differ by ${(debit - paise(s.totalDebit))} paise`);
  if (s.totalCredit !== undefined) ok(credit === paise(s.totalCredit), problems, `credits differ by ${(credit - paise(s.totalCredit))} paise`);
  if (s.opening !== undefined && s.closing !== undefined) {
    ok(paise(s.opening) + credit - debit === paise(s.closing), problems, `opening + credits - debits misses closing by ${paise(s.opening) + credit - debit - paise(s.closing)} paise`);
  }
  const days = s.staged.map(t => t.date).sort();
  s.minDate = days[0];
  s.maxDate = days[days.length - 1];
  ok(days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00`).getTime())), problems, 'a date that is not a real day');
  if (s.period?.from && s.period?.to) ok(s.minDate >= s.period.from && s.maxDate <= s.period.to, problems, 'a row outside the printed period');
  ok(new Set(s.staged.map(t => t.id)).size === s.staged.length, problems, 'repeated ids');

  // Into an empty wallet.
  const first = importStep(EMPTY, s);
  if (s.closing !== undefined) {
    ok(paise(I.ledgerBalance(first.wallet)) === paise(s.closing), problems, `balance after import misses closing by ${paise(I.ledgerBalance(first.wallet)) - paise(s.closing)} paise`);
    ok(first.tally?.matched === true && first.tone === 'ok', problems, "review's balance check doesn't say it matches");
  }
  if (s.opening !== undefined && s.closing !== undefined) {
    ok(first.tally?.statement?.complete === true, problems, "review's statement check doesn't pass");
  }
  ok(first.added === s.staged.length, problems, `${s.staged.length - first.added} rows not added`);
  // Again.
  const again = importStep(first.wallet, s);
  ok(again.added === 0, problems, `re-import added ${again.added}`);
  ok(again.dupes.size === s.staged.length, problems, `re-import flagged ${again.dupes.size} of ${s.staged.length}`);
  if (s.closing !== undefined) ok(again.tone === 'ok', problems, `re-import: the check reads ${again.tone}`);

  if (problems.length === 0) statements.push(s);
  console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${name.padEnd(48)} ${String(s.staged.length).padStart(5)} rows  ${s.bank ?? ''}${problems.length ? `  ${problems.join('; ')}` : ''}`);
}

// ── Per account: any order, gaps bridged then filled ──────────────────────

// The account: the statement's own number, else the one banks put in the
// file name ("…statement_<account>_…"); statements with neither stand alone.
const accountOf = (s) => `${s.bank ?? '?'}|${s.account || /statement_?(\d{4,})/i.exec(s.file)?.[1] || s.file}`;
const byAccount = new Map();
for (const s of statements) {
  if (s.opening === undefined || s.closing === undefined) continue;
  const k = accountOf(s);
  byAccount.set(k, [...(byAccount.get(k) ?? []), s]);
}

let accountNo = 0;
for (const [, list] of byAccount) {
  if (list.length < 2) continue;
  accountNo++;
  const problems = [];
  const chrono = [...list].sort((a, b) => (a.minDate === b.minDate ? (a.maxDate < b.maxDate ? -1 : 1) : a.minDate < b.minDate ? -1 : 1));
  const latest = chrono.reduce((a, b) => (b.maxDate > a.maxDate ? b : a));
  const distinct = new Set(list.flatMap(s => s.staged.map(t => t.id))).size;
  const rand = rng(20261124 + accountNo);
  // Every order for up to five statements (120 of them); beyond that, a sample.
  const permutations = a => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));
  const orders = list.length <= 5
    ? permutations(chrono).map((o, i) => [i === 0 ? 'date order' : `order ${i + 1}`, o])
    : [['date order', chrono], ['reverse', [...chrono].reverse()], ...Array.from({ length: 6 }, (_, i) => [`random ${i + 1}`, shuffled(chrono, rand)])];
  let firstIds = null;
  for (const [label, order] of orders) {
    let w = EMPTY;
    for (const s of order) {
      const step = importStep(w, s);
      // Every row of a real account matches, so the check never reads 'off'.
      ok(step.tone !== 'off' && step.tally?.statement?.complete === true, problems, `${label}: a step's check reads ${step.tone}`);
      w = step.wallet;
    }
    ok(paise(I.ledgerBalance(w)) === paise(latest.closing), problems, `${label}: balance misses the latest closing by ${paise(I.ledgerBalance(w)) - paise(latest.closing)} paise`);
    ok(w.transactions.length === distinct, problems, `${label}: ${w.transactions.length} entries for ${distinct} distinct rows`);
    const ids = w.transactions.map(t => t.id).sort().join(',');
    firstIds ??= ids;
    ok(ids === firstIds, problems, `${label}: different entries than in date order`);
  }
  // Leave out a statement no other one overlaps, bridge the gap, then import it.
  const lone = chrono.filter((m, i) => i > 0 && i < chrono.length - 1 && chrono.every(o => o === m || o.maxDate < m.minDate || o.minDate > m.maxDate));
  for (const m of lone) {
    let w = EMPTY;
    let bridged = 0;
    for (const s of chrono.filter(s => s !== m)) {
      const step = importStep(w, s, { bridge: true });
      if (step.tally?.gap) bridged++;
      w = step.wallet;
    }
    const before = w.transactions.filter(t => t.id.startsWith('adjust-')).length;
    const last = importStep(w, m);
    w = last.wallet;
    ok(bridged === 0 || before > 0, problems, 'a gap was found but no adjustment entered');
    ok(w.transactions.every(t => !t.id.startsWith('adjust-')), problems, 'an adjustment stayed after its period was imported');
    ok(paise(I.ledgerBalance(w)) === paise(latest.closing), problems, `gap filled: balance misses the latest closing by ${paise(I.ledgerBalance(w)) - paise(latest.closing)} paise`);
    ok(last.tally?.matched === true, problems, "filling the gap: the review's balance check doesn't match");
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '}  account ${accountNo}: ${list.length} statements, ${distinct} distinct rows, ${orders.length} orders${lone.length ? `, ${lone.length} gap(s) bridged and filled` : ''}${problems.length ? `  ${problems.join('; ')}` : ''}`);
}

// ── Every account in one wallet ───────────────────────────────────────────

// Statements that name their account, by account. Imported together, oldest
// first and newest first, the wallet ends at the sum of each account's latest
// closing, and each account's own check matches on the way.
{
  const keyOf = (s) => `${s.bank}:${s.last4}`;
  const named = statements.filter(s => s.last4 && s.bank && s.opening !== undefined && s.closing !== undefined);
  const accounts = new Map();
  for (const s of named) accounts.set(keyOf(s), [...(accounts.get(keyOf(s)) ?? []), s]);
  if (accounts.size >= 2) {
    const problems = [];
    const latest = [...accounts.values()].map(list => list.reduce((a, b) => (b.maxDate > a.maxDate ? b : a)));
    const expected = latest.reduce((sum, s) => sum + paise(s.closing), 0);
    const oldest = [...named].sort((a, b) => (a.minDate < b.minDate ? -1 : a.minDate > b.minDate ? 1 : 0));
    for (const [label, order] of [['oldest first', oldest], ['newest first', [...oldest].reverse()], ['one account after another', [...accounts.values()].flat()], ['the other way round', [...accounts.values()].reverse().flat()]]) {
      let w = EMPTY;
      for (const s of order) {
        const step = importStep(w, s);
        ok(step.tally?.matched === true || !!step.tally?.gap, problems, `${label}: an account's check doesn't match (${step.tone})`);
        w = step.wallet;
      }
      ok(paise(I.ledgerBalance(w)) === expected, problems, `${label}: balance misses the sum of closings by ${paise(I.ledgerBalance(w)) - expected} paise`);
      ok(Object.keys(w.accounts ?? {}).length === accounts.size && w.openingBalance === 0, problems, `${label}: ${Object.keys(w.accounts ?? {}).length} account openings for ${accounts.size} accounts`);
      ok(w.transactions.every(t => t.account || t.id.startsWith('adjust-')), problems, `${label}: an entry without its account`);
    }
    // As 1.5.8 left it: every statement imported without its account, then
    // each one imported again (all rows already there) in 1.5.9.
    for (const [label, order] of [['oldest first', oldest], ['newest first', [...oldest].reverse()]]) {
      let w = order.reduce((acc, s) => importStep(acc, { ...s, opening: s.balancesFromRows ? undefined : s.opening }, { accounts: false }).wallet, EMPTY);
      const total = w.transactions.length;
      for (const s of latest) {
        const step = importStep(w, s);
        ok(step.added === 0, problems, `1.5.8 wallet, ${label}: importing again added ${step.added}`);
        ok(step.tone === 'ok', problems, `1.5.8 wallet, ${label}: importing again, the check reads ${step.tone}`);
        w = step.wallet;
      }
      ok(paise(I.ledgerBalance(w)) === expected, problems, `1.5.8 wallet, ${label}: after importing each account again, balance misses the sum of closings by ${paise(I.ledgerBalance(w)) - expected} paise`);
      ok(w.transactions.length === total, problems, `1.5.8 wallet, ${label}: entries changed in number`);
    }
    console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${accounts.size} accounts in one wallet: ${named.length} statements, every order ends at the sum of closings${problems.length ? `  ${problems.join('; ')}` : ''}`);
  }
}

// ── Made-up cases ─────────────────────────────────────────────────────────

let ref = 615230400000;
const upi = (payee) => `UPI/DR/${ref++}/${payee}/YESB/x@yesb/UPI`;
const row = (date, amount, type, merchant) => ({ date, amount, type, merchant, category: 'Shopping', note: merchant });
/** A made-up statement: rows, and its opening and closing to the paisa. */
async function made(opening, rows) {
  const staged = await I.toTransactions(rows);
  const net = I.netPaise(staged);
  const days = staged.map(t => t.date).sort();
  return { name: 'made-up', raw: rows, staged, opening, closing: (paise(opening) + net) / 100, minDate: days[0], maxDate: days[days.length - 1] };
}
const synth = [];
const eq = (label, actual, expected) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { failures++; synth.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); }
};

const jan = await made(10000, [row('2026-01-03', 22000, 'EXPENSE', 'IMPS/P2A/512300000001/SUNRISE HOMES'), row('2026-01-01', 85000.5, 'INCOME', 'NEFT/CMS000111/NORTHWIND LABS'), row('2026-01-14', 249, 'EXPENSE', upi('SWIGGY')), row('2026-01-31', 1999.99, 'EXPENSE', upi('CROMA'))]);
const feb = await made(jan.closing, [row('2026-02-01', 85000.5, 'INCOME', 'NEFT/CMS000222/NORTHWIND LABS'), row('2026-02-03', 22000, 'EXPENSE', 'IMPS/P2A/512300000002/SUNRISE HOMES'), row('2026-02-03', 249, 'EXPENSE', upi('SWIGGY')), row('2026-02-20', 0.01, 'EXPENSE', 'ACCOUNT CHARGES')]);
const mar = await made(feb.closing, [row('2026-03-01', 85000.5, 'INCOME', 'NEFT/CMS000333/NORTHWIND LABS'), row('2026-03-03', 22000, 'EXPENSE', 'IMPS/P2A/512300000003/SUNRISE HOMES'), row('2026-03-09', 3100.1, 'EXPENSE', upi('THE CURRY LEAF'))]);
const bal = (w) => paise(I.ledgerBalance(w));
const run = (order, opts) => order.reduce((w, s) => importStep(w, s, opts).wallet, EMPTY);

for (const [label, order] of [['in order', [jan, feb, mar]], ['reverse', [mar, feb, jan]], ['middle first', [feb, mar, jan]], ['ends first', [jan, mar, feb]], ['last first', [mar, jan, feb]]]) {
  const w = run(order);
  eq(`made-up, ${label}: ends at March's closing`, bal(w), paise(mar.closing));
  eq(`made-up, ${label}: every row once`, w.transactions.length, jan.staged.length + feb.staged.length + mar.staged.length);
}

// A gap after the wallet (February missing), bridged, then February arrives.
{
  let w = run([jan]);
  const step = importStep(w, mar, { bridge: true });
  eq('gap after: found', [step.tally.gap?.direction, step.tally.gap?.from, step.tally.gap?.to], ['after', '2026-01-31', '2026-03-01']);
  eq('gap after: its amount is February', paise(step.tally.gap.amount), paise(feb.closing) - paise(feb.opening));
  eq('gap after: bridged, the check matches', step.tally.matched, true);
  w = step.wallet;
  eq('gap after: bridged balance is March closing', bal(w), paise(mar.closing));
  const fill = importStep(w, feb);
  eq('gap after: February replaces the adjustment', [fill.tally.stale.length, fill.removed, fill.tally.matched], [1, 1, true]);
  eq('gap after: no adjustment left, balance right', [fill.wallet.transactions.some(t => t.id.startsWith('adjust-')), bal(fill.wallet)], [false, paise(mar.closing)]);
}
// A gap before the wallet (statements arrive newest first).
{
  let w = run([mar]);
  const step = importStep(w, jan, { bridge: true });
  eq('gap before: found', [step.tally.gap?.direction, step.tally.gap?.from, step.tally.gap?.to], ['before', '2026-01-31', '2026-03-01']);
  eq('gap before: bridged, the check matches', step.tally.matched, true);
  w = step.wallet;
  eq('gap before: opening moves to January', [w.openingBalance, w.openingBalanceAsOf], [10000, '2026-01-01']);
  const fill = importStep(w, feb);
  eq('gap before: February replaces the adjustment', [fill.removed, fill.tally.matched, bal(fill.wallet)], [1, true, paise(mar.closing)]);
}
// Unbridged gap: the check says so, and filling it puts the balance right.
{
  const step = importStep(run([jan]), mar);
  eq('gap left open: the check does not match', step.tally.matched, false);
  eq('gap left open: filled later', bal(importStep(step.wallet, feb).wallet), paise(mar.closing));
}
// A new account: opening 0.00 is a real balance, also out of order.
{
  const first = await made(0, [row('2025-12-05', 5000, 'INCOME', 'NEFT/CMS000099/OPENING DEPOSIT'), row('2025-12-20', 1200, 'EXPENSE', upi('BOOKSHOP'))]);
  const second = await made(first.closing, jan.raw);
  const w = run([second, first]);
  eq('opening at zero: the earlier statement sets it', [w.openingBalance, w.openingBalanceAsOf], [0, '2025-12-05']);
  eq('opening at zero: balance', bal(w), paise(second.closing));
}
// A wallet from before balance anchors (no as-of day).
{
  const legacy = { transactions: feb.staged, openingBalance: feb.opening, openingBalanceAsOf: null };
  const w = importStep(legacy, jan).wallet;
  eq('legacy wallet: an earlier statement sets the opening', [w.openingBalance, bal(w)], [10000, paise(feb.closing)]);
  const later = importStep(legacy, mar).wallet;
  eq('legacy wallet: a later one leaves it', [later.openingBalance, bal(later)], [feb.opening, paise(mar.closing)]);
}
// An entry typed by hand that the statement also has.
{
  const typed = { id: 'txn-1', date: '2026-02-03', amount: 249, type: 'EXPENSE', category: 'Food', merchant: 'Swiggy', createdAt: '2026-02-03T13:00:00.000Z' };
  const w0 = run([jan]);
  const withTyped = { ...w0, transactions: [typed, ...w0.transactions] };
  const step = importStep(withTyped, feb);
  eq('typed entry: the statement row is flagged', step.dupes.size, 1);
  eq('typed entry: counted once, balance right', [step.wallet.transactions.length, bal(step.wallet)], [jan.staged.length + feb.staged.length, paise(feb.closing)]);
}
// Two identical payments on one day are both real.
{
  const twice = await made(0, [row('2026-04-02', 10, 'EXPENSE', 'TEA STALL'), row('2026-04-02', 10, 'EXPENSE', 'TEA STALL')]);
  eq('identical rows: both kept, different ids', [twice.staged.length, new Set(twice.staged.map(t => t.id)).size], [2, 2]);
  eq('identical rows: both imported', importStep(EMPTY, twice).added, 2);
}
// A row with no narration is kept; one with no side is reported.
{
  const rows = [row('2026-05-01', 500, 'INCOME', ''), { date: '2026-05-02', amount: 75, type: '', merchant: 'X' }, row('2026-05-03', 0, 'EXPENSE', 'ZERO'), { date: '2026-02-30', amount: 5, type: 'EXPENSE', merchant: 'BAD DAY' }];
  const staged = await I.toTransactions(rows);
  eq('no narration: kept as Unknown', staged.map(t => [t.merchant, t.amount]), [['Unknown', 500]]);
  eq('no side or no real day: reported, zero rows ignored', I.unreadableRows(rows), 2);
}
// Amounts keep the paisa through every step.
{
  const odd = await made(0.1, [row('2026-06-01', 0.1, 'INCOME', 'A'), row('2026-06-01', 0.2, 'INCOME', 'B'), row('2026-06-02', 0.3, 'EXPENSE', 'C')]);
  eq('paise: 0.1 + 0.2 - 0.3 from 0.10 is 0.10', bal(importStep(EMPTY, odd).wallet), 10);
}
// Removing an adjustment and adding rows happen together.
{
  const adj = I.bridgeAdjustment({ amount: -500, from: '2026-01-31', to: '2026-03-01', at: '2026-03-01', direction: 'after' });
  const w = { transactions: [adj, ...jan.staged], openingBalance: 10000, openingBalanceAsOf: '2026-01-01' };
  const r = I.mergeImport(w, feb.staged, { removeIds: I.staleAdjustments(w.transactions, feb.minDate, feb.maxDate) });
  eq('one step: adjustment out, rows in', [r.removed, r.added.length, r.transactions.some(t => t.id === adj.id)], [[adj.id], feb.staged.length, false]);
  eq('stale only when the period overlaps', [I.staleAdjustments([adj], '2026-01-01', '2026-01-31'), I.staleAdjustments([adj], '2026-03-01', '2026-03-31')], [[], []]);
}
// A wallet with two accounts and cash: its total can't equal one account's
// closing, so when every row matches the check reads as a note, never "off",
// whether the second account's statement overlaps, follows or precedes.
{
  const cash = { id: 'txn-cash', date: '2026-02-10', amount: 1500, type: 'EXPENSE', category: 'Dining', merchant: 'Cash lunch', createdAt: '2026-02-10T08:00:00.000Z' };
  const savings = run([jan, feb, mar]);
  const wallet = { ...savings, transactions: [cash, ...savings.transactions] };
  const overlapping = await made(52000, [row('2026-02-04', 1200, 'EXPENSE', upi('METRO CARD')), row('2026-02-15', 30000, 'INCOME', 'NEFT/CMS000444/FREELANCE CLIENT'), row('2026-03-02', 4999, 'EXPENSE', upi('AMAZON'))]);
  const step = importStep(wallet, overlapping);
  eq('two accounts: the second checks out, as a note', [step.tally.statement.complete, step.tally.matched, step.tally.gap, step.tone], [true, false, null, 'note']);
  eq('two accounts: all its rows in, once', step.added, overlapping.staged.length);
  const newer = await made(52000, [row('2026-04-04', 1200, 'EXPENSE', upi('METRO CARD')), row('2026-04-15', 30000, 'INCOME', 'NEFT/CMS000555/FREELANCE CLIENT')]);
  const after = importStep(wallet, newer);
  eq('two accounts, a newer statement: the gap is a note', [after.tally.gap?.direction, after.tally.statement.complete, after.tone], ['after', true, 'note']);
  const older = await made(52000, [row('2025-11-04', 1200, 'EXPENSE', upi('METRO CARD')), row('2025-11-15', 30000, 'INCOME', 'NEFT/CMS000666/FREELANCE CLIENT')]);
  const before = importStep(wallet, older);
  eq('two accounts, an older statement: the gap is a note', [before.tally.gap?.direction, before.tally.statement.complete, before.tone], ['before', true, 'note']);
  eq('two accounts, bridged anyway: matches the bank, reads ok', importStep(wallet, newer, { bridge: true }).tone, 'ok');
}
// The import itself short: a row left unticked, a row the wallet has ticked
// again, rows that don't add up to the closing. Each reads "off", by name.
{
  const w0 = run([jan]);
  const leftOut = importStep(w0, feb, { pick: (rows) => rows.slice(1) });
  eq('left out: the unticked row is counted, check off', [leftOut.tally.statement.leftOut.count, paise(leftOut.tally.statement.leftOut.net), leftOut.tone], [1, I.netPaise(feb.staged.slice(0, 1)), 'off']);
  const typed = { id: 'txn-2', date: '2026-02-03', amount: 249, type: 'EXPENSE', category: 'Food', merchant: 'Swiggy', createdAt: '2026-02-03T13:00:00.000Z' };
  const twice = importStep({ ...w0, transactions: [typed, ...w0.transactions] }, feb, { pick: (rows) => rows });
  eq('ticked again: would count twice, check off', [twice.dupes.size, twice.tally.statement.twice.count, twice.tone], [1, 1, 'off']);
  const missed = importStep(w0, { ...feb, staged: feb.staged.slice(1) });
  eq('a row the reader missed: off by that row', [missed.tally.statement.addsUp, paise(missed.tally.statement.unexplained), missed.tone], [false, I.netPaise(feb.staged.slice(0, 1)), 'off']);
  const noOpening = importStep(w0, { ...feb, opening: undefined });
  eq('no opening printed: the wallet check decides', [noOpening.tally.statement, noOpening.tally.matched, noOpening.tone], [null, true, 'ok']);
}

// ── Accounts (1.5.9), made up ─────────────────────────────────────────────
const asAccount = (s, bank, last4) => ({ ...s, bank, last4 });
const kJan = asAccount(jan, 'Kotak Mahindra Bank', '1111');
const kFeb = asAccount(feb, 'Kotak Mahindra Bank', '1111');
const kMar = asAccount(mar, 'Kotak Mahindra Bank', '1111');
const h1 = asAccount(await made(52000, [row('2026-01-05', 1200, 'EXPENSE', upi('METRO CARD')), row('2026-01-15', 30000, 'INCOME', 'NEFT/CMS000801/FREELANCE CLIENT'), row('2026-02-12', 4999, 'EXPENSE', upi('AMAZON'))]), 'HDFC Bank', '2222');
const h2 = asAccount(await made(h1.closing, [row('2026-03-04', 800, 'EXPENSE', upi('METRO CARD')), row('2026-03-15', 30000, 'INCOME', 'NEFT/CMS000802/FREELANCE CLIENT')]), 'HDFC Bank', '2222');
const KOTAK = 'kotak-mahindra-bank:1111';
const HDFC = 'hdfc-bank:2222';
const both = paise(kMar.closing) + paise(h2.closing);
const runSteps = (w, steps) => steps.reduce((acc, [s, opts]) => importStep(acc, s, opts).wallet, w);
const tagged = (w) => w.transactions.every(t => t.account || t.createdAt || t.id.startsWith('adjust-'));

// Two accounts, in any order: each keeps its own opening balance.
for (const [label, order] of [['one after another', [kJan, kFeb, kMar, h1, h2]], ['interleaved', [h1, kJan, h2, kFeb, kMar]], ['newest first', [h2, kMar, kFeb, h1, kJan]], ['mixed', [kFeb, h2, kJan, kMar, h1]]]) {
  let w = EMPTY;
  const tones = [];
  for (const s of order) { const step = importStep(w, s); tones.push(step.tone); w = step.wallet; }
  eq(`two accounts, ${label}: balance is both closings`, bal(w), both);
  eq(`two accounts, ${label}: an opening each, none left over`, [Object.keys(w.accounts).sort(), w.accounts[KOTAK].opening, w.accounts[HDFC].opening, w.openingBalance], [[HDFC, KOTAK], 10000, 52000, 0]);
  eq(`two accounts, ${label}: the check is never off`, tones.includes('off'), false);
  eq(`two accounts, ${label}: every entry has its account`, tagged(w), true);
}
// The second account's first statement checks against its own entries only.
{
  const step = importStep(runSteps(EMPTY, [[kJan], [kFeb]]), h1);
  eq('second account: its check matches, not a note', [step.tally.matched, step.tone, step.tally.gap], [true, 'ok', null]);
  eq('second account: new, with its own opening', [step.account?.key, step.account?.anchor.opening, step.tally.accountOpening?.isNew], [HDFC, 52000, true]);
}
// A statement whose rows are all in the wallet still sets its account's
// missing opening balance (1.5.8 read no opening from Equitas's Excel).
{
  const w0 = importStep(EMPTY, { ...kJan, opening: undefined }, { accounts: false }).wallet;
  eq('again, no opening before: the wallet missed it', [w0.openingBalance, bal(w0)], [0, paise(jan.closing) - 1000000]);
  const step = importStep(w0, kJan);
  eq('again: nothing added, the opening set, its entries marked', [step.added, step.account?.anchor.opening, step.retagged, bal(step.wallet)], [0, 10000, jan.staged.length, paise(jan.closing)]);
  eq('again: the check matches', step.tone, 'ok');
}
// A wallet from 1.5.8 with one account: its opening balance is the account's.
{
  const w158 = runSteps(EMPTY, [[jan, { accounts: false }], [feb, { accounts: false }]]);
  const next = importStep(w158, kMar);
  eq('1.5.8, one account, next month: the opening is this account\'s', [next.suggested, next.tone, bal(next.wallet)], ['same', 'ok', paise(mar.closing)]);
  eq('… it moves to the account, nothing left over', [next.wallet.openingBalance, next.wallet.accounts[KOTAK]], [0, { bank: 'Kotak Mahindra Bank', last4: '1111', opening: 10000, asOf: '2026-01-01', legacy: true }]);
  const again = importStep(w158, kJan);
  eq('1.5.8, one account, imported again: the same, its rows marked', [again.suggested, again.added, again.retagged, again.tone, bal(again.wallet)], ['same', 0, jan.staged.length, 'ok', paise(feb.closing)]);
  const dec = asAccount(await made(4000, [row('2025-12-10', 6000, 'INCOME', 'NEFT/CMS000803/BONUS')]), 'Kotak Mahindra Bank', '1111');
  const earlier = importStep(w158, dec);
  eq('1.5.8, one account, the month before: the same, the opening moves back', [earlier.suggested, earlier.wallet.accounts[KOTAK]?.opening, earlier.wallet.accounts[KOTAK]?.asOf, bal(earlier.wallet)], ['same', 4000, '2025-12-10', paise(feb.closing)]);
  const typed = { id: 'txn-typed', date: '2026-02-03', amount: 249, type: 'EXPENSE', category: 'Food', merchant: 'Swiggy', createdAt: '2026-02-03T13:00:00.000Z' };
  const withTyped = importStep({ ...w158, transactions: [typed, ...w158.transactions] }, kFeb).wallet;
  eq('1.5.8, one account: an entry typed in keeps no account', withTyped.transactions.find(t => t.id === typed.id).account, undefined);
}
// A wallet from 1.5.8 with two accounts: the opening balance it kept goes to
// the account it came from, whichever is imported again first.
{
  // Kotak's opening applied in 1.5.8; HDFC's didn't (it starts after Kotak's first entry).
  const w = runSteps(EMPTY, [[kJan, { accounts: false }], [kFeb, { accounts: false }], [h1, { accounts: false }]]);
  eq('1.5.8, two accounts: it kept Kotak\'s opening only', [w.openingBalance, w.openingBalanceAsOf], [10000, '2026-01-01']);
  const hFirst = importStep(w, h1);
  eq('… HDFC again first: another account\'s, so its own opening', [hFirst.suggested, hFirst.tone, hFirst.wallet.openingBalance, hFirst.wallet.accounts[HDFC]?.opening], ['separate', 'ok', 10000, 52000]);
  const thenK = importStep(hFirst.wallet, kJan);
  eq('… then Kotak: the kept opening is its own', [thenK.suggested, thenK.tone, thenK.wallet.openingBalance, thenK.wallet.accounts[KOTAK]?.opening], ['same', 'ok', 0, 10000]);
  eq('… balance is both closings, every entry marked', [bal(importStep(thenK.wallet, kFeb).wallet), tagged(importStep(thenK.wallet, kFeb).wallet)], [paise(feb.closing) + paise(h1.closing), true]);
  const kFirst = importStep(w, kJan);
  eq('… Kotak again first: the same', [kFirst.suggested, kFirst.tone], ['same', 'ok']);
  const thenH = importStep(kFirst.wallet, h1);
  eq('… then HDFC: no question, its own opening', [thenH.suggested, bal(thenH.wallet)], [null, paise(feb.closing) + paise(h1.closing)]);
}
{
  // HDFC first in 1.5.8 (its opening kept), Kotak without an opening (as Equitas read then).
  const w = runSteps(EMPTY, [[h1, { accounts: false }], [{ ...kJan, opening: undefined }, { accounts: false }], [{ ...kFeb, opening: undefined }, { accounts: false }]]);
  eq('1.5.8, HDFC first: it kept HDFC\'s opening', [w.openingBalance, bal(w)], [52000, paise(h1.closing) + paise(feb.closing) - 1000000]);
  const k = importStep(w, kJan);
  eq('… Kotak again (it covers the day that opening is from): another account\'s', [k.suggested, k.tone, k.wallet.accounts[KOTAK]?.opening, k.wallet.openingBalance], ['separate', 'ok', 10000, 52000]);
  const h = importStep(k.wallet, h1);
  eq('… then HDFC: the kept opening is its own', [h.suggested, h.wallet.openingBalance, bal(h.wallet)], ['same', 0, paise(h1.closing) + paise(feb.closing)]);
}
{
  // Kept opening from an account whose statement starts after this one ends:
  // nothing in the wallet tells them apart, so it suggests 'same'; either
  // answer ends right once both accounts are imported again.
  const w = runSteps(EMPTY, [[h2, { accounts: false }]]);
  const guess = importStep(w, kJan);
  eq('wholly before, nothing to tell: suggests the same account', guess.suggested, 'same');
  const separate = importStep(w, kJan, { legacy: 'separate' });
  eq('… answered "another account": right at once', [bal(separate.wallet), separate.wallet.openingBalance], [paise(h2.closing) + paise(jan.closing) - (paise(h1.closing) - paise(h2.opening)), h1.closing]);
  for (const [label, first] of [['as suggested', guess.wallet], ['answered', separate.wallet]]) {
    const end = importStep(first, h2).wallet;
    eq(`… ${label}, then the other account again: both closings`, bal(end), paise(h2.closing) + paise(jan.closing));
  }
}
// A statement that doesn't show its number, in a wallet whose accounts are known:
// it keeps its own opening balance and checks against the entries no account claims.
{
  const numberless = await made(5000, [row('2026-02-06', 700, 'EXPENSE', upi('BOOKSHOP')), row('2026-02-21', 2500, 'INCOME', 'NEFT/CMS000804/REFUND')]);
  const step = importStep(runSteps(EMPTY, [[kJan], [kFeb], [kMar]]), numberless);
  eq('no number, known accounts beside it: its own opening, its check matches', [step.wallet.openingBalance, step.tone, bal(step.wallet)], [5000, 'ok', paise(kMar.closing) + paise(numberless.closing)]);
}
// A statement's account number, from its header only.
{
  eq('account number: last four digits', [
    I.accountLast4('Account No : 12345678901234'),
    I.accountLast4('A/C No. XXXXXXXX1234'),
    I.accountLast4('Account Number: 000123456789'),
    I.accountLast4('Acct # 9876543210'),
    I.accountLast4('Account No   :   9876XXXX5678'),
  ], ['1234', '1234', '6789', '3210', '5678']);
  eq('account number: none to read', [I.accountLast4('Account No : XXXXXXXX'), I.accountLast4('Account Statement for the period'), I.accountLast4('A/C 12345')], [null, null, null]);
  eq('account number: a narration further down is not the header', I.headerLast4(`${'Statement of account '.repeat(250)}TRANSFER TO A/C 123456789012`), null);
  eq('account keys', [I.accountKey('HDFC Bank', '1234'), I.accountKey('Equitas Small Finance Bank', '5678'), I.accountLabel({ bank: 'HDFC Bank', last4: '1234' })], ['hdfc-bank:1234', 'equitas-small-finance-bank:5678', 'HDFC Bank ••1234']);
  eq('openings add to the paisa', I.totalOpening(0.1, { a: { bank: 'A', last4: '1111', opening: 0.2, asOf: null } }), 0.3);
}
// Balances from the running balance (Excel without printed balances).
{
  const rowsOf = (list) => list.map(([amount, type, balance]) => ({ amount, type, balance }));
  const forward = rowsOf([[100, 'expense', 900], [50.5, 'income', 950.5], [0.5, 'expense', 950]]);
  eq('running balance, oldest first', I.IDFCBankParser.balancesFromRows(forward), { opening: 1000, closing: 950 });
  eq('running balance, newest first', I.IDFCBankParser.balancesFromRows([...forward].reverse()), { opening: 1000, closing: 950 });
  eq('running balance, broken: none', I.IDFCBankParser.balancesFromRows(rowsOf([[100, 'expense', 900], [50, 'income', 999]])), null);
  eq('running balance, a row without one: none', I.IDFCBankParser.balancesFromRows([{ amount: 5, type: 'expense' }]), null);
}

for (const s of synth) console.log(`FAIL  ${s}`);
console.log(`${synth.length ? 'FAIL' : 'ok  '}  made-up cases: gaps both sides bridged and filled, opening at 0, legacy wallet, typed entry, repeated rows, unreadable rows, paise, two accounts and cash, rows left out or twice; accounts in any order, an opening set on importing again, 1.5.8 wallets with one account or two, account numbers, running balances`);
console.log(`${checks - failures}/${checks} import checks passed (${statements.length} of ${files.length - skipped} statement files clean${skipped ? `, ${skipped} picture PDF${skipped > 1 ? 's' : ''} skipped` : ''})`);
if (failures) process.exit(1);
