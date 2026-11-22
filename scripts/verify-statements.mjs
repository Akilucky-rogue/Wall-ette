#!/usr/bin/env node
/**
 * Statement regression check.
 *
 * Runs the app's real parsers (services/idfcParser.ts for PDF, which hands
 * Kotak, Saraswat, Union Bank and SBI to services/bankPdfLayouts.ts, and
 * services/IDFCBankParser.ts for IDFC FIRST and HDFC Excel) over every
 * statement in a folder and checks each against the bank's own summary, to
 * the paisa (banks that print none are checked against the running balance):
 *   - debit total and credit total
 *   - opening + credits - debits = closing
 *   - the parser's own validation flag
 * When the folder holds both PDF and Excel exports covering the same rows, it
 * also checks that each row lands in the same category in both formats.
 *
 * Usage (after `npm ci`):
 *   node scripts/verify-statements.mjs [folder]     default: private/statements
 *
 * Statements stay out of git (*.pdf, *.xlsx and private/ are ignored); only
 * this script is committed. Exits with code 1 if any statement fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata'; // bucket dates in IST, as on the phone

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(process.argv[2] ?? join(root, 'private', 'statements'));
const pdfjs = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href;
const worker = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

// Bundle the real parser modules for Node. pdf.js comes from its legacy build
// (Node lacks browser APIs the modern build needs), and Vite's `?url` worker
// import is pointed at the matching legacy worker.
const tmp = mkdtempSync(join(tmpdir(), 'wallette-verify-'));
const bundle = join(tmp, 'parsers.mjs');
await build({
  stdin: {
    contents: [
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
const { parseIDFCStatement, IDFCBankParser } = await import(pathToFileURL(bundle).href);

const paise = (n) => Math.round((Number(n) || 0) * 100);
const rupees = (p) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const mask = (name) => name.replace(/\d{10,}/g, '…'); // keep account numbers out of logs

// pdf.js prints "Warning: …" lines in Node; keep the report readable.
async function quietly(fn) {
  const log = console.log;
  console.log = (...m) => { if (!String(m[0]).startsWith('Warning:')) log(...m); };
  try { return await fn(); } finally { console.log = log; }
}

async function check(file) {
  const buf = readFileSync(join(folder, file));
  let rows, head, valid;
  if (extname(file).toLowerCase() === '.pdf') {
    const r = await quietly(() => parseIDFCStatement(buf.toString('base64')));
    rows = r.transactions;
    head = r.header;
    valid = r.validationPassed;
  } else {
    const r = await IDFCBankParser.parseExcel(new File([buf], file));
    rows = r.transactions;
    head = r.summary;
    valid = r.validation.isValid;
  }
  let debit = 0, credit = 0;
  for (const t of rows) {
    if (String(t.type).toUpperCase() === 'INCOME') credit += paise(t.amount);
    else debit += paise(t.amount);
  }
  const closing = paise(head.openingBalance) + credit - debit;
  const problems = [];
  if (rows.length === 0) problems.push('no rows');
  if (debit !== paise(head.totalDebit)) problems.push(`debits ${rupees(debit)} vs bank ${rupees(paise(head.totalDebit))}`);
  if (credit !== paise(head.totalCredit)) problems.push(`credits ${rupees(credit)} vs bank ${rupees(paise(head.totalCredit))}`);
  if (closing !== paise(head.closingBalance)) problems.push(`closing ${rupees(closing)} vs bank ${rupees(paise(head.closingBalance))}`);
  if (!valid) problems.push('parser validation failed');
  const categorised = rows.filter((t) => t.category && t.category !== 'Uncategorized').length;
  // Pair rows across formats on date, amount, direction and running balance.
  const keyed = rows.map((t) => ({
    key: `${t.date}|${paise(t.amount)}|${String(t.type).toUpperCase()}|${paise(t.balance)}`,
    category: t.category || 'Uncategorized',
  }));
  return { rows: rows.length, categorised, problems, isPdf: extname(file).toLowerCase() === '.pdf', keyed };
}

const files = readdirSync(folder).filter((f) => /\.(pdf|xlsx|xls)$/i.test(f)).sort();
if (files.length === 0) {
  console.error(`No .pdf, .xlsx or .xls statements in ${folder}`);
  process.exit(1);
}
let failed = 0;
const results = [];
for (const f of files) {
  let line;
  try {
    const r = await check(f);
    results.push(r);
    if (r.problems.length) failed++;
    line = `${r.problems.length ? 'FAIL' : 'ok  '}  ${mask(f).padEnd(46)} ${String(r.rows).padStart(5)} rows  ${String(r.categorised).padStart(5)} categorised`;
    if (r.problems.length) line += `  ${r.problems.join('; ')}`;
  } catch (e) {
    failed++;
    line = `FAIL  ${mask(f).padEnd(46)} threw: ${e?.message ?? e}`;
  }
  console.log(line);
}
rmSync(tmp, { recursive: true, force: true });

// A row must land in the same category whether it came from a PDF or an
// Excel export (audit H2). Only category names are printed, never narrations.
const excelCategories = new Map();
for (const r of results) {
  if (r.isPdf) continue;
  for (const t of r.keyed) {
    if (!excelCategories.has(t.key)) excelCategories.set(t.key, new Set());
    excelCategories.get(t.key).add(t.category);
  }
}
let paired = 0, disagree = 0;
const kinds = new Map();
for (const r of results) {
  if (!r.isPdf) continue;
  for (const t of r.keyed) {
    const cats = excelCategories.get(t.key);
    if (!cats) continue;
    paired++;
    if (cats.has(t.category)) continue;
    disagree++;
    const kind = `Excel ${[...cats].join(' / ')}, PDF ${t.category}`;
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
}
if (paired) {
  console.log(`\nCategories: ${paired} PDF rows paired with Excel rows; ${disagree} disagree.`);
  for (const [kind, n] of kinds) console.log(`  ${String(n).padStart(5)} rows  ${kind}`);
}

console.log(`\n${files.length - failed} of ${files.length} statements match the bank to the paisa.`);
process.exit(failed || disagree ? 1 : 0);
