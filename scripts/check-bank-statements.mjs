#!/usr/bin/env node
/**
 * Statement formats from banks other than IDFC FIRST.
 *
 * Runs the app's parsers on made-up statements in each bank's layout (no real
 * names, accounts or amounts) and checks that:
 *   - amounts read the way each bank writes them ("1,23,456.78", "99.00(Dr)",
 *     "25122 CR"), and reference numbers and counts aren't taken for money
 *   - the bank is told by the account's own IFSC, not a name in a narration
 *   - Kotak, Saraswat, Union Bank and SBI PDF rows come out with the right
 *     date, amount and direction (from the running balance), the narration
 *     put back together from lines above and below the date, and the bank's
 *     own totals checked; newest-first statements are read in date order;
 *     a balance that doesn't add up is reported
 *   - HDFC and IDFC FIRST Excel exports: columns found by name, day-first
 *     dates, the summary above or below the table, the running balance
 *   - payees and bank references come out of every bank's narration style,
 *     and the new banks' codes land in the right categories
 *   - a PDF with no text says how to get a usable one
 *
 * Real statements: node scripts/verify-statements.mjs <folder>.
 *
 * Usage (after `npm ci`):
 *   node scripts/check-bank-statements.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const XLSX = require('xlsx');
const pdfjs = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href;
const worker = pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

const tmp = mkdtempSync(join(tmpdir(), 'wallette-banks-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, [
  `export * from ${JSON.stringify(join(root, 'services/bankPdfLayouts.ts'))};`,
  `export { categorizeNarration, cleanNarration } from ${JSON.stringify(join(root, 'services/categorize.ts'))};`,
  `export { bankReference } from ${JSON.stringify(join(root, 'services/statementImport.ts'))};`,
  `export { payeeName } from ${JSON.stringify(join(root, 'services/spend.ts'))};`,
  `export { parseStatementPdf } from ${JSON.stringify(join(root, 'services/idfcParser.ts'))};`,
  `export { default as ExcelParser } from ${JSON.stringify(join(root, 'services/IDFCBankParser.ts'))};`,
].join('\n'));
const bundle = join(tmp, 'banks.mjs');
await build({
  entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
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
const m = await import(pathToFileURL(bundle).href);

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

// ── Amounts ─────────────────────────────────────────────────────────────────
const money = (t) => m.readMoney(t);
eq('Indian grouping', money('1,23,456.78'), { value: 123456.78, mark: null });
eq('Union debit', money('99.00(Dr)'), { value: 99, mark: 'DR' });
eq('Union credit', money('1234.50(Cr)'), { value: 1234.5, mark: 'CR' });
eq('Saraswat balance, whole', money('25122 CR'), { value: 25122, mark: 'CR' });
eq('Saraswat balance, one decimal', money('4.5 CR'), { value: 4.5, mark: 'CR' });
eq('SBI summary', money('9,999.99CR'), { value: 9999.99, mark: 'CR' });
eq('overdrawn', money('120.00 DR'), { value: 120, mark: 'DR' });
eq('minus sign', money('-120.00'), { value: -120, mark: null });
for (const not of ['12345', '2026', '1,250', 'UPI-612345678901', 'S12345678', '-', '01/10/2026', 'Rs500']) {
  eq(`not money: ${not}`, money(not), null);
}

// ── Which bank ──────────────────────────────────────────────────────────────
eq('Saraswat IFSC', m.detectBank('Branch IFSC Code : SRCB0000123'), 'saraswat');
eq('figures between label and code', m.detectBank('IFSC Code : 12345 SBIN0001234 400002001'), 'sbi');
eq('Kotak', m.detectBank('MICR 400485002 IFSC Code KKBK0000123'), 'kotak');
eq('Union', m.detectBank('Account Number 123 IFSC UBIN0531234'), 'union');
eq("an IDFC account's IFSC wins over a name", m.detectBank('IFSC : IDFB0080123 NEFT from State Bank of India'), null);
eq('IDFC without its IFSC', m.detectBank('IDFC FIRST Bank statement NEFT from State Bank of India'), null);
eq('HDFC goes to the general reader', m.detectBank('RTGS/NEFT IFSC : HDFC0001234 MICR'), null);
eq('name only', m.detectBank('Union Bank of India Savings Account'), 'union');
eq('unknown bank', m.detectBank('Some Bank Ltd statement'), null);

// ── PDF layouts ─────────────────────────────────────────────────────────────
// A line of positioned items: [x, text, width?]; width defaults to 6pt a character.
const line = (y, cells) => cells.map(([x, text, w]) => ({ x, y, text, w: w ?? text.length * 4 }));
const rows = (s) => s.rows.map(r => [r.date, r.type, r.amount, r.balance, r.narration]);

// Kotak: serial and date columns, narration wrapping below the date line.
const kotak = m.parseBankStatement('kotak', [[
  ...line(471, [[44, '#'], [75, 'Date'], [124, 'Description'], [280, 'Chq/Ref. No.'], [355, 'Withdrawal (Dr.)'], [429, 'Deposit (Cr.)'], [498, 'Balance']]),
  ...line(452, [[39, '-'], [70, '-'], [119, 'Opening Balance'], [275, '-'], [416, '-'], [485, '-'], [535, '1,000.00']]),
  ...line(438, [[39, '1'], [73, '01 Oct 2026'], [119, 'UPI/Asha Traders/YESB/612345678901/UPI'], [275, 'UPI-612345678901'], [401, '100.00', 20], [535, '900.00']]),
  ...line(424, [[39, '2'], [73, '02 Oct 2026'], [119, 'UPI/Ravi'], [275, 'UPI-612345678902'], [466, '50.00', 20], [535, '950.00']]),
  ...line(417, [[119, 'Kumar/SBIN/612345678902/UPI']]),
  ...line(16, [[36, 'Statement Generated on 31 Oct 2026, 10:00'], [519, 'Page 1 of'], [559, '2']]),
], [
  ...line(716, [[53, 'Particulars'], [286, 'Opening Balance'], [428, 'Closing Balance']]),
  ...line(693, [[44, 'Savings Account (SA):'], [365, '1,000.00'], [516, '950.00']]),
]]);
eq('Kotak rows', rows(kotak), [
  ['2026-10-01', 'EXPENSE', 100, 900, 'UPI/Asha Traders/YESB/612345678901/UPI'],
  ['2026-10-02', 'INCOME', 50, 950, 'UPI/Ravi Kumar/SBIN/612345678902/UPI'],
]);
eq('Kotak figures', [kotak.printed, kotak.errors], [{ opening: 1000, closing: 950 }, []]);

// Saraswat: opening in the header, totals at the end, lines cut mid-word.
const saraswat = m.parseBankStatement('saraswat', [[
  ...line(404, [[53, 'From Date'], [141, '01/10/2026'], [196, 'To Date :'], [241, '31/10/2026'], [290, 'Opening Balance As On 01/10/2026'], [450, ':'], [460, '5000']]),
  ...line(273, [[51, 'Date'], [125, 'Particulars'], [225, 'Instruments'], [317, 'Dr Amount'], [406, 'Cr Amount'], [488, 'Total Amount']]),
  ...line(255, [[30, '01-Oct-2026'], [93, 'NEFT/ICICN52026100112345'], [440, '2,000.00', 40], [502, '7000 CR']]),
  ...line(245, [[93, '67/ACME TRADING CO']]),
  ...line(235, [[30, '02-Oct-2026'], [93, 'MB/TRF FR/RAVI KUMAR'], [356, '1,500.50', 38], [505, '5499.5 CR']]),
  ...line(225, [[93, 'SHAH/']]),
  ...line(215, [[30, '03-Oct-2026'], [93, 'NFS:CW:+MAIN ROAD ATM'], [356, '499.50', 30], [505, '5000 CR']]),
  ...line(200, [[347, '2,000.00'], [436, '2,000.00'], [502, '5000 CR']]),
  ...line(198, [[36, 'Totals / Balance :-']]),
  ...line(181, [[529, '5000 CR']]),
  ...line(180, [[30, 'Closing Balance As On']]),
  ...line(130, [[246, '**** END OF STATEMENT ****']]),
]]);
eq('Saraswat rows', rows(saraswat), [
  ['2026-10-01', 'INCOME', 2000, 7000, 'NEFT/ICICN5202610011234567/ACME TRADING CO'],
  ['2026-10-02', 'EXPENSE', 1500.5, 5499.5, 'MB/TRF FR/RAVI KUMAR SHAH/'],
  ['2026-10-03', 'EXPENSE', 499.5, 5000, 'NFS:CW:+MAIN ROAD ATM'],
]);
eq('Saraswat figures', [saraswat.printed, saraswat.errors], [{ opening: 5000, totalDebit: 2000, totalCredit: 2000, closing: 5000 }, []]);

// Union Bank: remarks above and below the date line, newest first, no totals.
const union = m.parseBankStatement('union', [[
  ...line(398, [[177, 'UPIAR/612345678903/DR/ASHA']]),
  ...line(392, [[29, '03-10-2026'], [93, 'S12345678'], [371, '100.00(Dr)'], [512, '800.00(Cr)']]),
  ...line(386, [[177, '/YESB/asha@ybl']]),
  ...line(371, [[177, 'UPIAB/612345678902/CR/RAVI']]),
  ...line(365, [[29, '02-10-2026'], [97, 'S12345679'], [440, '400.00(Cr)'], [512, '900.00(Cr)']]),
  ...line(359, [[177, '/SBIN/ravi@sbi']]),
  ...line(345, [[177, 'UPIAR/612345678901/DR/SHOP']]),
  ...line(339, [[29, '01-10-2026'], [97, 'S12345680'], [376, '50.00(Dr)'], [512, '500.00(Cr)']]),
  ...line(333, [[177, '/ICIC/shop@icici']]),
  ...line(26, [[549, 'Page'], [566, '1'], [573, 'of'], [581, '1']]),
]]);
eq('Union rows, in date order', rows(union), [
  ['2026-10-01', 'EXPENSE', 50, 500, 'UPIAR/612345678901/DR/SHOP/ICIC/shop@icici'],
  ['2026-10-02', 'INCOME', 400, 900, 'UPIAB/612345678902/CR/RAVI/SBIN/ravi@sbi'],
  ['2026-10-03', 'EXPENSE', 100, 800, 'UPIAR/612345678903/DR/ASHA/YESB/asha@ybl'],
]);
eq('Union opening, from the first row', [union.opening, union.closing, union.errors], [550, 800, []]);

// SBI: "WDL TFR" above the date, narration below, branch details trimmed.
const sbiPage = (secondBalance) => [
  ...line(519, [[348, 'IFSC Code'], [442, ':'], [451, 'SBIN0001234']]),
  ...line(269, [[138, 'WDL TFR']]),
  ...line(262, [[27, '01/10/2026'], [82, '01/10/2026'], [138, 'UPI/DR/612345678901/GROC'], [304, '-'], [357, '250.00', 20], [446, '-'], [520, '750.00']]),
  ...line(251, [[138, 'ERY MART/YESB/q12345678']]),
  ...line(241, [[138, '/UPI']]),
  ...line(232, [[138, '1234567890123 AT 04567']]),
  ...line(222, [[138, 'MAIN BRANCH']]),
  ...line(209, [[138, 'DEP TFR']]),
  ...line(202, [[27, '02/10/2026'], [82, '02/10/2026'], [304, '-'], [366, '-'], [432, '1,250.00', 36], [514, secondBalance]]),
  ...line(200, [[138, 'NEFT/SBIN426123456789/']]),
  ...line(191, [[138, 'ACME PVT LTD']]),
  ...line(84, [[269, 'Page no.'], [313, '1']]),
];
const sbiSummary = [
  ...line(768, [[22, 'Brought Forward'], [99, '('], [111, ')'], [460, 'Closing Balance']]),
  ...line(766, [[124, 'Dr Count'], [179, 'Cr Count'], [243, 'Total Debits'], [339, 'Total Credits']]),
  ...line(739, [[49, '1,000.00CR'], [142, '1'], [197, '1'], [262, '250.00'], [363, '1,250.00'], [486, '2,000.00CR']]),
];
const sbi = m.parseBankStatement('sbi', [sbiPage('2,000.00'), sbiSummary]);
eq('SBI rows', rows(sbi), [
  ['2026-10-01', 'EXPENSE', 250, 750, 'UPI/DR/612345678901/GROCERY MART/YESB/q12345678/UPI'],
  ['2026-10-02', 'INCOME', 1250, 2000, 'NEFT/SBIN426123456789/ACME PVT LTD'],
]);
eq('SBI figures', [sbi.printed, sbi.errors], [{ opening: 1000, totalDebit: 250, totalCredit: 1250, closing: 2000 }, []]);

const broken = m.parseBankStatement('sbi', [sbiPage('2,000.01'), sbiSummary]);
eq('a balance that does not add up is reported', broken.errors.length > 0 && broken.errors[0].includes('row 2'), true);
eq('no rows means a clear error', (() => { try { m.parseBankStatement('kotak', [[]]); return 'no throw'; } catch (e) { return e.message; } })(),
  'No Kotak Mahindra Bank transactions found in this PDF.');

// ── Excel ───────────────────────────────────────────────────────────────────
const workbook = (aoa) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  return new File([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })], 'statement.xls');
};
const excelRows = (r) => r.transactions.map(t => [t.date, t.type, t.amount, t.balance]);

const hdfc = await m.ExcelParser.parseExcel(workbook([
  ['HDFC BANK Ltd.'],
  ['Statement From  :  01/10/2026   To  :  31/10/2026'],
  [],
  ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
  ['********', '********', '********', '********', '********', '********', '********'],
  ['01/10/26', 'UPI-ASHA TRADERS-asha@okaxis-UTIB0000123-612345678901-PAY', '0000612345678901', '01/10/26', '100.00', '', '900.00'],
  ['12/10/26', 'NEFT CR-YESB0000001-ACME PVT LTD-RAVI-YESBN12026101012345', 'YESBN12026101012345', '12/10/26', '', '1,250.50', '2,150.50'],
  ['********'],
  ['STATEMENT SUMMARY  :-'],
  ['Opening Balance', '', '', '', 'Debits', 'Credits', 'Closing Bal'],
  ['1,000.00', '', '', '', '100.00', '1,250.50', '2,150.50'],
  ['---  End Of Statement ---'],
]));
eq('HDFC rows, day first', excelRows(hdfc), [['2026-10-01', 'expense', 100, 900], ['2026-10-12', 'income', 1250.5, 2150.5]]);
eq('HDFC summary below the table', [hdfc.bank, hdfc.summary.openingBalance, hdfc.summary.totalDebit, hdfc.summary.totalCredit, hdfc.summary.closingBalance, hdfc.validation.isValid],
  ['HDFC Bank', 1000, 100, 1250.5, 2150.5, true]);

const idfcSheet = (lastBalance) => workbook([
  ['Account Statement'],
  ['Opening Balance', 'Total Debit', 'Total Credit', 'Closing Balance'],
  ['1,000.00', '100.00', '50.00', '950.00'],
  [],
  ['Transaction Date', 'Value Date', 'Particulars', 'Cheque No', 'Debit', 'Credit', 'Balance'],
  ['01-Oct-2026', '01-Oct-2026', 'UPI/DR/612345678901/ZOMATO/UTIB/z@axis/UPI', '', '100.00', '', '900.00'],
  ['02-Oct-2026', '02-Oct-2026', 'IFT/1000123/Mr RAVI/12', '', '', '50.00', lastBalance],
]);
const idfc = await m.ExcelParser.parseExcel(idfcSheet('950.00'));
eq('IDFC rows', excelRows(idfc), [['2026-10-01', 'expense', 100, 900], ['2026-10-02', 'income', 50, 950]]);
eq('IDFC summary above the table', [idfc.bank, idfc.summary.openingBalance, idfc.summary.closingBalance, idfc.validation.isValid], ['IDFC FIRST Bank', 1000, 950, true]);
const idfcBroken = await m.ExcelParser.parseExcel(idfcSheet('951.00'));
eq('a running balance that does not add up', idfcBroken.validation.errors.some(e => e.includes('running balance')), true);

// ── Payees, references, categories ──────────────────────────────────────────
const narrations = [
  // [narration, bank reference, payee]
  ['UPI-ASHA TRADERS-asha.traders@okaxis-UTIB0000123-612345678901-PAYMENT', 'rrn:612345678901', 'ASHA TRADERS'],
  ['NEFT CR-YESB0000001-ACME PVT LTD-RAVI KUMAR-YESBN12026101012345', 'utr:YESBN12026101012345', 'ACME PVT LTD'],
  ['ACH D- ZERODHA BROKING LTD-1234567', null, 'ZERODHA BROKING LTD'],
  ['INTEREST PAID TILL 30-SEP-2026', null, null],
  ['MB/NEFT/SRCB012345678901/RAVI SHAH/', 'utr:SRCB012345678901', 'RAVI SHAH'],
  ['MB/TRF FR/RAVI SHAH/', null, 'RAVI SHAH'],
  ['IMPS:612345678901:12345678901234:RAVI SHAH', 'rrn:612345678901', 'RAVI SHAH'],
  ['UPI/Asha Traders/YESB/612345678901/UPI', 'rrn:612345678901', 'Asha Traders'],
  ['NACH-MUT-DR-INDIAN CLEARING CORP-', null, 'INDIAN CLEARING CORP'],
  ['UPIAR/612345678901/DR/ASHA/YESB/asha@ybl', 'rrn:612345678901', 'ASHA'],
  ['UPI/DR/612345678901/GROCERY MART/YESB/q12345678/UPI', 'rrn:612345678901', 'GROCERY MART'],
  // IDFC FIRST, as before
  ['IMPS-OPM/512345678901/Test Associates LLP/x', 'rrn:512345678901', 'Test Associates LLP'],
  ['IFT/10000123456/Mr. RAVI KUMAR SHAH/912345', null, 'Mr. RAVI KUMAR SHAH'],
];
for (const [n, ref, payee] of narrations) {
  eq(`reference: ${n}`, m.bankReference(n), ref);
  eq(`payee: ${n}`, m.payeeName(n), payee);
}

const category = (n, type) => m.categorizeNarration(m.cleanNarration(n), type);
eq('Saraswat ATM', category('NFS:CW:+MAIN ROAD ATM', 'expense'), 'Cash Withdrawal');
eq('HDFC ATM', category('ATW-512345XXXXXX1234-S1ANMU12-MUMBAI', 'expense'), 'Cash Withdrawal');
eq('Union UPI', category('UPIAR/612345678901/DR/ASHA/YESB/asha@ybl', 'expense'), 'Transfer Out');
eq('Saraswat own-bank transfer', category('MB/TRF FR/RAVI SHAH/', 'expense'), 'Transfer Out');
eq('dividend by ACH', category('ACH C- ITC LIMITED-INT DIV 2026', 'income'), 'Investment Returns');
eq('Saraswat ACH credit', category('ACH Credit:HDFC LTD:1234567890', 'income'), 'Investment Returns');
eq('ET Money SIP', category('ACH D- ETMONEY-ETMONEY1234567', 'expense'), 'Investment');
eq('mutual fund NACH', category('NACH-MUT-DR-INDIAN CLEARING CORP-', 'expense'), 'Investment');
eq('a bank code ending in CB is not cashback', category('UPI/Ravi/SVCB/612345678901/UPI', 'income'), 'Transfer In');
eq('Kotak interest', category('Int.Pd:1234567890:01-07-2026 to 30-09-2026', 'income'), 'Interest Income');

// ── A PDF with no text ──────────────────────────────────────────────────────
const noText = Buffer.from([
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >> endobj',
  '4 0 obj << /Length 18 >> stream', '10 10 100 100 re f', 'endstream endobj',
  'trailer << /Root 1 0 R >>', '%%EOF',
].join('\n'));
const log = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith('Warning:')) log(...a); };
let noTextMessage;
try { await m.parseStatementPdf(noText.toString('base64')); noTextMessage = 'no error'; }
catch (e) { noTextMessage = e.message; }
console.log = log;
eq('a picture of a statement says what to do', noTextMessage.startsWith('This PDF is a picture of a statement'), true);

rmSync(tmp, { recursive: true, force: true });
console.log(`${checks - failures}/${checks} checks pass`);
if (failures) process.exit(1);
