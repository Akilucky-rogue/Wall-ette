#!/usr/bin/env node
/**
 * Duplicate and import id check (audit L1, L2, L3).
 *
 * Runs services/statementImport.ts on made-up narrations in IDFC's formats
 * and checks that:
 *   - bank references are read from UPI, IMPS, NEFT and RTGS narrations, also
 *     when a PDF line wrap splits one, and never from IFT, NACH or charges
 *   - a row has the same key in the PDF and the Excel export, and a different
 *     one when its date, direction or amount differ
 *   - the import check matches on the bank reference first, so same-day,
 *     same-amount payments to different payees are never taken for each
 *     other, while an entry typed in New Entry still matches its statement row
 *   - import ids are the same for a row in every statement and in either
 *     format, identical rows get different ids, and 20,000 different rows get
 *     20,000 ids
 *   - Fee Hunter's duplicate key groups a PDF and an Excel copy of a row, and
 *     leaves typed entries alone
 *
 * Given a folder of real statements, it also replays the audit's tests on
 * them, before and after this change, and prints counts only (no narrations,
 * names or amounts):
 *   - re-importing each statement into a wallet holding every other row (L1)
 *   - importing each statement into a wallet holding another that overlaps
 *     it, in the same or the other format
 *   - Fee Hunter's cleaner after importing both formats with "Include Anyway" (L3)
 *   - id collisions, and how many rows keep their id in the other format (L2)
 *
 * Usage (after `npm ci`):
 *   node scripts/check-duplicates.mjs                      made-up rows only
 *   node scripts/check-duplicates.mjs private/statements   and the replay
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';
if (!globalThis.crypto?.subtle) globalThis.crypto = (await import('node:crypto')).webcrypto; // Node 18

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pdfjs = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href;
const worker = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
const tmp = mkdtempSync(join(tmpdir(), 'wallette-dupes-'));
const bundle = join(tmp, 'dupes.mjs');
await build({
  stdin: {
    contents: [
      `export * from ${JSON.stringify(join(root, 'services', 'statementImport.ts'))};`,
      `export { cleanNarration } from ${JSON.stringify(join(root, 'services', 'categorize.ts'))};`,
      `export { normalizeMerchant } from ${JSON.stringify(join(root, 'services', 'analyticsService.ts'))};`,
      `export { parseIDFCStatement } from ${JSON.stringify(join(root, 'services', 'idfcParser.ts'))};`,
      `export { default as IDFCBankParser } from ${JSON.stringify(join(root, 'services', 'IDFCBankParser.ts'))};`,
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
const {
  bankReference, transactionKey, toTransactions, findDuplicates, fromExcel, walletCopies,
  cleanNarration, normalizeMerchant, parseIDFCStatement, IDFCBankParser,
} = await import(pathToFileURL(bundle).href);
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

// ── Made-up rows ────────────────────────────────────────────────────────────

// A narration as each format stores it: the PDF keeps the raw text (line
// wraps can add a space), the Excel parser cleans it and keeps a short note.
const pdfRow = (date, amount, type, raw, category = 'Uncategorized') =>
  ({ date, amount, type, category, merchant: raw.substring(0, 100), note: raw });
const excelRow = (date, amount, type, raw, category = 'Uncategorized') => {
  const description = cleanNarration(raw);
  const upi = description.match(/UPI[\/\-]([A-Z0-9]+)/i);
  return fromExcel([{ date, amount, type: type.toLowerCase(), category, description, notes: upi ? `UPI ID: ${upi[1]}` : '' }])[0];
};
const typed = (id, date, amount, merchant, type = 'EXPENSE') =>
  ({ id, date, amount, type, category: 'Food', merchant, note: '', createdAt: `${date}T10:00:00.000Z` });

// References
eq('ref: UPI/DR', bankReference('UPI/DR/615230407557/ZOMATO L/UTIB/zomatoo/UPI'), 'rrn:615230407557');
eq('ref: UPI/MOB', bankReference('UPI/MOB/615230407557/RENT FOR MAY'), 'rrn:615230407557');
eq('ref: split by a PDF wrap', bankReference('UPI/CREDIT ADJUSTMENT/6152304 07557/26-12-25'), 'rrn:615230407557');
eq('ref: IMPS-OPM', bankReference('IMPS-OPM/512345678901/Test Associates LLP/HDFC0001234/512345/'), 'rrn:512345678901');
eq('ref: IMPS fund transfer', bankReference('IMPS-OPM/Fund Trf/512345678901/123456ICIC/'), 'rrn:512345678901');
eq('ref: MMT/IMPS', bankReference('MMT/IMPS/512345678901/RAVI KUMAR/HDFC0001234'), 'rrn:512345678901');
eq('ref: NEFT', bankReference('NEFT/CMS123456789/ACME BROKING PVT LTD/ICIC0001234'), 'utr:CMS123456789');
eq('ref: NEFT/CR', bankReference('NEFT/CR/IN2263421789/ORBIT SOFTWARE PVT LTD/SALARY NOV 2026'), 'utr:IN2263421789');
eq('ref: RTGS', bankReference('RTGS/HDFCR52024010112345678/ACME LTD/HDFC0001234'), 'utr:HDFCR52024010112345678');
eq('ref: NEFT with only an IFSC', bankReference('NEFT/ICIC0001234/ACME BROKING'), null);
eq('ref: IFT has none', bankReference('IFT/10000123456/Mr. RAVI KUMAR SHAH/912345'), null);
eq('ref: NACH has none', bankReference('NACH/ACME INDUSTRIES DIVIDEND/123456'), null);
eq('ref: charges have none', bankReference('ATM WDL CHARGES/123456789012'), null);
eq('ref: short UPI number', bankReference('UPI/DR/1111111111/ZOMATO L/UTIB/zomatoo/UPI'), null);
eq('ref: typed payee', bankReference('Swiggy'), null);
eq('ref: nothing', bankReference(undefined), null);

// Keys: the same row in both formats, and rows that only look alike
const upiRaw = 'UPI/DR/631245781122/KAPOOR HOMES/HDFC/kapoorhomes@hdfcbank/RENT';
const upiWrapped = 'UPI/DR/631245781122/KAPOOR HOMES/HDFC/kapoorho mes@hdfcbank/RENT';
const iftRaw = 'IFT/10000123456/Mr. RAVI KUMAR SHAH & SONS/912345';
const longRaw = 'NACH/ACH-DR/ACME INSURANCE COMPANY OF INDIA (LIFE) LTD/POLICY PREMIUM FOR APRIL & MAY/UMRN HDFC7000000000123456/REF 9988';
const key = (r) => transactionKey({ ...r, type: r.type });
eq('key: UPI row, PDF (wrapped) vs Excel', key(pdfRow('2026-03-03', 24000, 'EXPENSE', upiWrapped)), key(excelRow('2026-03-03', 24000, 'EXPENSE', upiRaw)));
eq('key: IFT row, PDF vs Excel', key(pdfRow('2026-03-03', 30000, 'EXPENSE', iftRaw)), key(excelRow('2026-03-03', 30000, 'EXPENSE', iftRaw)));
eq('key: long narration, PDF vs Excel', key(pdfRow('2026-03-03', 2500, 'EXPENSE', longRaw)), key(excelRow('2026-03-03', 2500, 'EXPENSE', longRaw)));
eq('key: renamed payee keeps the PDF reference', key({ ...pdfRow('2026-03-03', 24000, 'EXPENSE', upiRaw), merchant: 'Rent' }), key(pdfRow('2026-03-03', 24000, 'EXPENSE', upiRaw)));
const base = key(pdfRow('2026-03-03', 24000, 'EXPENSE', upiRaw));
eq('key: other day', key(pdfRow('2026-03-04', 24000, 'EXPENSE', upiRaw)) === base, false);
eq('key: other amount', key(pdfRow('2026-03-03', 24000.5, 'EXPENSE', upiRaw)) === base, false);
eq('key: other direction (a reversal)', key(pdfRow('2026-03-03', 24000, 'INCOME', upiRaw)) === base, false);
eq('key: other reference', key(pdfRow('2026-03-03', 24000, 'EXPENSE', upiRaw.replace('631245781122', '631245781123'))) === base, false);

// Ids
const statement = [
  pdfRow('2026-03-08', 486, 'EXPENSE', 'UPI/DR/631245789012/SWIGGY/YESB/swiggy.upi@yesb/Payment'),
  pdfRow('2026-03-08', 486, 'EXPENSE', 'UPI/DR/631245789013/SWAMI STORES/YESB/swamistores@yesb/UPI'),
  pdfRow('2026-03-08', 59, 'EXPENSE', 'SMS CHARGES FOR FEB 2026'),
  pdfRow('2026-03-08', 59, 'EXPENSE', 'SMS CHARGES FOR FEB 2026'),
  pdfRow('2026-03-09', 30000, 'EXPENSE', iftRaw),
  pdfRow('2026-03-10', 85000, 'INCOME', 'NEFT/CMS123456789/ORBIT SOFTWARE PVT LTD/ICIC0001234'),
];
const asExcel = statement.map(r => excelRow(r.date, r.amount, r.type, r.note));
const ids = (await toTransactions(statement)).map(t => t.id);
eq('ids: one per row', new Set(ids).size, statement.length);
eq('ids: shape', ids.every(id => /^import-[0-9a-f]{32}$/.test(id)), true);
eq('ids: same again', (await toTransactions(statement)).map(t => t.id), ids);
eq('ids: same in the Excel export', (await toTransactions(asExcel)).map(t => t.id), ids);
eq('ids: same in a later statement that has the rows', (await toTransactions([pdfRow('2026-03-07', 120, 'EXPENSE', 'UPI/DR/631245780001/TEA STALL/YESB/tea@yesb/UPI'), ...statement])).map(t => t.id).slice(1), ids);
eq('ids: invalid rows dropped', (await toTransactions([
  { date: '2026-03-08', amount: 0, type: 'EXPENSE', merchant: 'x' },
  { date: '08-03-2026', amount: 10, type: 'EXPENSE', merchant: 'x' },
  { date: '2026-03-08', amount: 10, type: 'DEBIT', merchant: 'x' },
  { date: '2026-03-08', amount: 10, type: 'EXPENSE' },
  pdfRow('2026-03-08', 10, 'EXPENSE', 'SMS CHARGES'),
])).length, 1);
{
  const many = [];
  for (let i = 0; i < 20000; i++) {
    const day = `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
    many.push(pdfRow(day, 100 + (i % 97), 'EXPENSE', `UPI/DR/${String(600000000000 + i)}/SHOP ${i % 50}/YESB/shop@yesb/UPI`));
  }
  eq('ids: 20,000 different rows, 20,000 ids', new Set((await toTransactions(many)).map(t => t.id)).size, 20000);
}

// The import check
const wallet = await toTransactions([statement[0], statement[2], statement[4]]); // Swiggy, one SMS charge, the IFT
const incoming = await toTransactions(statement);
const flagged = findDuplicates(incoming, wallet);
eq('dupes: only the rows the wallet has', incoming.map(t => flagged.has(t.id)), [true, false, true, false, true, false]);
eq('dupes: Swami Stores is not taken for Swiggy (L1)', flagged.has(incoming[1].id), false);
eq('dupes: second identical charge stays new', flagged.has(incoming[3].id), false);
eq('dupes: the Excel export against a wallet of PDF rows',
  [...findDuplicates(await toTransactions(asExcel), incoming)].length, statement.length);
{
  const swiggy = incoming[0];
  eq('dupes: typed entry matches its statement row', findDuplicates([swiggy], [typed('txn-1', '2026-03-08', 486, 'Swiggy')]).size, 1);
  eq('dupes: typed entry with no payee matches', findDuplicates([swiggy], [typed('txn-2', '2026-03-08', 486, undefined)]).size, 1);
  eq('dupes: typed entry on another day does not', findDuplicates([swiggy], [typed('txn-3', '2026-03-09', 486, 'Swiggy')]).size, 0);
  eq('dupes: renamed payee still matches by reference', findDuplicates([swiggy], [{ ...swiggy, id: 'import-old', merchant: 'Dinner' }]).size, 1);
  const otherSwiggy = (await toTransactions([pdfRow('2026-03-08', 486, 'EXPENSE', 'UPI/DR/631245789099/SWIGGY/YESB/swiggy.upi@yesb/Payment')]))[0];
  eq('dupes: same payee, other reference stays new', findDuplicates([otherSwiggy], [swiggy]).size, 0);
}

// Fee Hunter's cleaner (components/FeeHunter.tsx)
const surplus = (list) => walletCopies(list).copies.length;
// Ids as 1.5.3 and earlier gave them: decimal, and never stable.
const older = (list, tag) => list.map((t, i) => ({ ...t, id: `import-${tag}${1000 + i}` }));
{
  const current = await toTransactions(statement);
  const currentExcel = await toTransactions(asExcel);
  eq('fee hunter: older PDF and Excel copies of each row', surplus([...older(current, 1), ...older(currentExcel, 2)]), statement.length + 1); // + the repeated SMS charge
  eq('fee hunter: an older copy next to a current row', walletCopies([...current, ...older(current.slice(0, 2), 3)]).copies.map(t => t.id), ['import-31000', 'import-31001']);
  eq('fee hunter: one current import flags nothing', surplus(current), 0); // the two SMS charges are both real
  eq('fee hunter: groups counted', walletCopies([...older(current, 1), ...older(currentExcel, 2)]).groups, statement.length - 1);
  eq('fee hunter: typed entries are left alone', surplus([typed('txn-a', '2026-03-08', 20, 'Tea'), typed('txn-b', '2026-03-08', 20, 'Tea')]), 0);
}

console.log(`${checks - failures}/${checks} made-up checks pass`);

// ── Real statements ─────────────────────────────────────────────────────────

const folder = process.argv[2] ? resolve(process.argv[2]) : null;
if (folder) await replay(folder);

if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}

async function replay(dir) {
  const paise = (n) => Math.round((Number(n) || 0) * 100);
  async function quietly(fn) {
    const log = console.log;
    console.log = (...m) => { if (!String(m[0]).startsWith('Warning:')) log(...m); };
    try { return await fn(); } finally { console.log = log; }
  }

  // Before this change (components/ImportStatement.tsx and FeeHunter.tsx in 1.5.3)
  const legacyNorm = (m) => m.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d+/g, '').trim();
  const legacyMatch = (a, b) => {
    if (a.length > 3 && b.length > 3) {
      if (a.includes(b) || b.includes(a)) return true;
      if (a.substring(0, 6) === b.substring(0, 6)) return true;
    }
    return a === b;
  };
  const legacyDuplicates = (inc, existing) => {
    const index = new Map();
    for (const t of existing) {
      const k = `${t.date}|${t.type}`;
      if (!index.has(k)) index.set(k, []);
      index.get(k).push({ amount: t.amount, merchant: t.merchant ? legacyNorm(t.merchant) : null, used: false });
    }
    const found = new Set();
    for (const tx of inc) {
      const bucket = index.get(`${tx.date}|${tx.type}`);
      if (!bucket) continue;
      const m = legacyNorm(tx.merchant || '');
      let hit = bucket.find(c => !c.used && Math.abs(tx.amount - c.amount) <= 0.01 && c.merchant !== null && c.merchant === m);
      if (!hit) hit = bucket.find(c => !c.used && Math.abs(tx.amount - c.amount) <= 0.01 && (c.merchant === null || legacyMatch(m, c.merchant)));
      if (hit) { hit.used = true; found.add(tx.id); }
    }
    return found;
  };
  const legacyIds = (list) => list.map((t, index) => {
    const clean = (t.merchant || 'unknown').replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
    const s = `${t.date}-${t.amount}-${clean}-${t.type}-${index}`;
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h; }
    return `import-${Math.abs(h)}`;
  });
  const legacyFeeSurplus = (list) => {
    const groups = new Map();
    for (const t of list) {
      const k = `${t.date.slice(0, 10)}|${t.type}|${t.amount.toFixed(2)}|${normalizeMerchant(t.merchant || '')}|${(t.merchant || '').slice(0, 60)}`;
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    let surplus = 0;
    for (const n of groups.values()) surplus += n - 1;
    return surplus;
  };

  const files = readdirSync(dir).filter((f) => /\.(pdf|xlsx|xls)$/i.test(f)).sort();
  const statements = [];
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    const isPdf = extname(f).toLowerCase() === '.pdf';
    let raw;
    try {
      if (isPdf) {
        const r = await quietly(() => parseIDFCStatement(buf.toString('base64')));
        raw = r.transactions.map(t => ({ ...t, pair: `${t.date}|${paise(t.amount)}|${t.type}|${paise(t.balance)}` }));
      } else {
        const r = await IDFCBankParser.parseExcel(new File([buf], f));
        const mapped = fromExcel(r.transactions);
        raw = mapped.map((t, i) => ({ ...t, pair: `${t.date}|${paise(t.amount)}|${t.type}|${paise(r.transactions[i].balance)}` }));
      }
    } catch (e) {
      console.log(`  statement ${statements.length + 1}: could not parse (${e?.message ?? e})`);
      failures++;
      continue;
    }
    const txs = await toTransactions(raw);
    if (txs.length !== raw.length) {
      console.log(`  statement ${statements.length + 1}: ${raw.length - txs.length} rows dropped as invalid`);
      failures++;
      continue;
    }
    const dates = raw.map(t => t.date).sort();
    statements.push({ n: statements.length + 1, isPdf, raw, txs, legacy: legacyIds(raw), from: dates[0], to: dates[dates.length - 1] });
  }
  if (statements.length === 0) {
    console.log(`No statements read from ${dir}`);
    failures++;
    return;
  }

  console.log('\nStatements (counts only)');
  const total = { rows: 0, refs: 0, repeats: 0, collisions: 0, legacyCollisions: 0, fp: 0, miss: 0, lfp: 0, lmiss: 0 };
  for (const s of statements) {
    const refs = s.txs.filter(t => bankReference(t.merchant) ?? bankReference(t.note)).length;
    const keys = new Set(s.txs.map(transactionKey));
    const repeats = s.txs.length - keys.size;
    const collisions = s.txs.length - new Set(s.txs.map(t => t.id)).size;
    const legacyCollisions = s.txs.length - new Set(s.legacy).size;
    // L1: re-import into a wallet holding every other row
    const walletRows = s.txs.filter((_, i) => i % 2 === 0);
    const flagged = findDuplicates(s.txs, walletRows);
    const lflagged = legacyDuplicates(s.txs, walletRows);
    let fp = 0, miss = 0, lfp = 0, lmiss = 0;
    s.txs.forEach((t, i) => {
      const dup = i % 2 === 0;
      if (dup && !flagged.has(t.id)) miss++;
      if (!dup && flagged.has(t.id)) fp++;
      if (dup && !lflagged.has(t.id)) lmiss++;
      if (!dup && lflagged.has(t.id)) lfp++;
    });
    if (collisions) failures++;
    if (fp || miss) failures++;
    console.log(`  ${String(s.n).padStart(2)} ${s.isPdf ? 'PDF  ' : 'Excel'} ${s.from}..${s.to} ${String(s.txs.length).padStart(5)} rows, ` +
      `${String(refs).padStart(4)} with a bank reference, ${repeats} repeated keys, ids: ${collisions} collisions (was ${legacyCollisions}); ` +
      `re-import into every other row: ${fp} new rows flagged, ${miss} copies missed (was ${lfp} and ${lmiss})`);
    for (const k of ['rows', 'refs', 'repeats', 'collisions', 'legacyCollisions', 'fp', 'miss', 'lfp', 'lmiss']) {
      total[k] += { rows: s.txs.length, refs, repeats, collisions, legacyCollisions, fp, miss, lfp, lmiss }[k];
    }
  }
  console.log(`  all: ${total.rows} rows, ${total.refs} with a bank reference, ${total.repeats} repeated keys; ` +
    `${total.collisions} id collisions (was ${total.legacyCollisions}); re-import: ${total.fp} new rows flagged, ` +
    `${total.miss} copies missed (was ${total.lfp} and ${total.lmiss})`);

  // Rows two statements share, matched on date, amount, direction and running balance.
  const shared = (a, b) => {
    const left = new Map();
    a.raw.forEach((t, i) => { if (!left.has(t.pair)) left.set(t.pair, []); left.get(t.pair).push(i); });
    const pairs = [];
    b.raw.forEach((t, j) => { const q = left.get(t.pair); if (q?.length) pairs.push([q.shift(), j]); });
    return pairs;
  };

  console.log('\nOne statement imported into a wallet holding another that overlaps it');
  const cross = { pairs: 0, rows: 0, fp: 0, miss: 0, lfp: 0, lmiss: 0, sameId: 0, legacySameId: 0, formatRows: 0 };
  const fee = { copies: 0, found: 0, repeats: 0, currentRepeats: 0, legacyFound: 0 };
  for (const a of statements) {
    for (const b of statements) {
      if (a === b) continue;
      const pairs = shared(a, b);
      if (pairs.length === 0) continue;
      cross.pairs++;
      const dupOf = new Set(pairs.map(([, j]) => j));
      const flagged = findDuplicates(b.txs, a.txs);
      const lflagged = legacyDuplicates(b.txs, a.txs);
      b.txs.forEach((t, j) => {
        const dup = dupOf.has(j);
        if (dup && !flagged.has(t.id)) cross.miss++;
        if (!dup && flagged.has(t.id)) cross.fp++;
        if (dup && !lflagged.has(t.id)) cross.lmiss++;
        if (!dup && lflagged.has(t.id)) cross.lfp++;
      });
      cross.rows += b.txs.length;
      if (a.isPdf !== b.isPdf && a.n < b.n) {
        // L2: a row keeps its id in the other format
        cross.formatRows += pairs.length;
        for (const [i, j] of pairs) {
          if (a.txs[i].id === b.txs[j].id) cross.sameId++;
          if (a.legacy[i] === b.legacy[j]) cross.legacySameId++;
        }
        // L3: both formats imported with "Include Anyway" before 1.5.4, so the
        // copies have older ids. (From 1.5.4 a shared row keeps its id, and
        // the import skips it.)
        const both = [...older(a.txs, 'a'), ...older(b.txs, 'b')];
        fee.copies += pairs.length;
        fee.found += surplus(both);
        fee.repeats += surplus(older(a.txs, 'a')) + surplus(older(b.txs, 'b'));
        fee.currentRepeats += surplus(a.txs) + surplus(b.txs);
        fee.legacyFound += legacyFeeSurplus(both);
      }
    }
  }
  if (cross.fp || cross.miss) failures++;
  console.log(`  ${cross.pairs} overlapping pairs, ${cross.rows} rows imported: ${cross.fp} new rows flagged, ` +
    `${cross.miss} copies missed (was ${cross.lfp} and ${cross.lmiss})`);
  if (cross.formatRows) {
    console.log(`  across formats: ${cross.sameId} of ${cross.formatRows} shared rows keep their id (was ${cross.legacySameId})`);
    console.log(`  Fee Hunter after importing both formats: ${fee.found} flagged for ${fee.copies} copies ` +
      `(was ${fee.legacyFound}); identical rows within one statement: ${fee.repeats} flagged with older ids, ` +
      `${fee.currentRepeats} with current ids`);
    if (fee.found < fee.copies || fee.currentRepeats) failures++;
  }
}
