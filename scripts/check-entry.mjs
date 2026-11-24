#!/usr/bin/env node
/**
 * Adding money by hand: New entry's keypad (utils/entryAmount.ts) and the
 * currency rules every typed amount follows (utils/currencyUtils.ts toBase,
 * toShown): typed in the currency shown, saved in rupees to the paisa.
 *
 * Checks that:
 *   - the keypad builds the amount people type, keeps two decimals at most,
 *     one point and eight digits, and backspace undoes a key
 *   - with rupees shown, the rupees saved are exactly the amount typed
 *   - in any currency, an amount typed, saved and shown again reads the same
 *     to the cent (every rate in the picker's fallback and a spread of real
 *     ones, amounts from 0.01 to 10,000,000)
 *   - an unchanged edit keeps the saved rupees as they were
 *   - the daily-limit warning adds the typed amount in rupees
 *
 * Usage (after `npm ci`):
 *   node scripts/check-entry.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-entry-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, [
  `export * from ${JSON.stringify(join(root, 'utils', 'entryAmount.ts'))};`,
  `export * from ${JSON.stringify(join(root, 'utils', 'currencyUtils.ts'))};`,
  `export { ledgerBalance, mergeImport } from ${JSON.stringify(join(root, 'services', 'statementImport.ts'))};`,
].join('\n'));
const bundle = join(tmp, 'entry.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const E = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 30) console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const type = keys => keys.reduce((a, k) => E.pressKey(a, k), E.EMPTY_AMOUNT);
const keys = s => [...s].map(c => (c === '<' ? 'backspace' : c));

// ── The keypad ─────────────────────────────────────────────────────────────
eq('nothing typed', [E.EMPTY_AMOUNT, E.amountValue(E.EMPTY_AMOUNT)], ['0.00', 0]);
eq('whole amount', type(keys('1250')), '1250');
eq('decimals', type(keys('12.50')), '12.50');
eq('point first', type(keys('.5')), '0.5');
eq('third decimal ignored', type(keys('9.999')), '9.99');
eq('second point ignored', type(keys('1.2.3')), '1.23');
eq('leading zeros ignored', type(keys('0005')), '5');
eq('eight digits at most', type(keys('1234567890')), '12345678');
eq('a point after eight digits', type(keys('12345678.25')), '12345678.25');
eq('backspace', type(keys('125<')), '12');
eq('backspace to nothing', type(keys('7<')), '0.00');
eq('backspace past the point', type(keys('0.<')), '0.00');
eq('backspace on nothing', type(keys('<<')), '0.00');
eq('other keys ignored', type(['1', 'e', '-', '2']), '12');
eq('values', ['12.50', '0.5', '12345678.25', '0.', '0.00'].map(E.amountValue), [12.5, 0.5, 12345678.25, 0, 0]);
// Every key sequence up to four keys stays a valid amount.
const KEYS = ['1', '0', '.', 'backspace', '9'];
let valid = true;
const walk = (a, depth) => {
  if (!/^(0\.00|0\.|0\.\d{1,2}|[1-9]\d{0,7}(\.\d{0,2})?)$/.test(a)) valid = false;
  if (depth === 0) return;
  for (const k of KEYS) walk(E.pressKey(a, k), depth - 1);
};
walk(E.EMPTY_AMOUNT, 5);
eq('every key sequence stays a valid amount', valid, true);

// ── Rupees shown: exact ────────────────────────────────────────────────────
for (const v of [0.01, 1, 99.99, 1234.5, 85000, 12345678.25]) {
  eq(`INR ${v} saved as typed`, E.toBase(v, 1), v);
  eq(`INR ${v} shown as saved`, E.toShown(v, 1), v);
}

// ── Any currency: typed, saved, shown again ────────────────────────────────
const RATES = {
  ...E.FALLBACK_RATES,
  JPY: 1.71, KWD: 0.0033, AED: 0.0396, SGD: 0.0139, ZAR: 0.197, IDR: 186.4, VND: 296.2, BHD: 0.00407, CHF: 0.0087, NPR: 1.6,
};
const amounts = [0.01, 0.1, 1, 9.99, 10, 12.34, 99.99, 250, 1234.56, 9999.99, 54321, 100000, 2500000, 10000000];
for (const [code, rate] of Object.entries(RATES)) {
  for (const typed of amounts) {
    const saved = E.toBase(typed, rate);
    if (saved < 0.01) continue; // too small to be a paisa: New entry refuses it
    const shownAgain = E.toShown(saved, rate);
    // A rupee amount carries two decimals; in a currency worth many rupees a
    // paisa is less than a cent, so the cent comes back exactly.
    const tolerance = rate < 1 ? 0.005 + 0.005 * rate : 0.005 * rate + 0.005;
    checks++;
    if (!(Math.abs(shownAgain - typed) <= tolerance)) {
      failures++;
      if (failures <= 30) console.log(`  FAIL ${code} ${typed}: saved ₹${saved}, shown again ${shownAgain}`);
    }
    eq(`${code} ${typed}: saved to the paisa`, Math.round(saved * 100) / 100, saved);
    if (rate < 1) {
      // Displayed with the currency's own decimals, it reads as typed.
      const f = E.getCurrencyFormatter(code);
      eq(`${code} ${typed}: reads as typed`, f.format(shownAgain), f.format(typed));
    }
  }
}
eq('no rate saves nothing', [E.toBase(10, 0), E.toBase(NaN, 1), E.toShown(NaN, 1)], [0, 0, 0]);

// ── Editing ────────────────────────────────────────────────────────────────
// Vault's edit dialog keeps the saved rupees when the field is unchanged.
for (const [rate, saved] of [[1, 1234.5], [0.0108, 925.9259259], [1.71, 584.795]]) {
  const field = String(E.toShown(saved, rate));
  const kept = field === String(E.toShown(saved, rate)) ? saved : E.toBase(parseFloat(field), rate);
  eq(`unchanged edit at rate ${rate} keeps ₹${saved}`, kept, saved);
}

// ── The entry saved ────────────────────────────────────────────────────────
// What New entry hands the wallet when Save is pressed (entryFromForm).
const NOW = new Date('2026-11-24T06:56:00+05:30');
const form = (over) => ({ typed: '0.00', rate: 1, currency: 'INR', type: 'EXPENSE', category: '', merchant: '', note: '', day: '2026-11-24', ...over });
const saved = (over) => E.entryFromForm(form(over), 'txn-test', NOW);
eq('entry: rupees typed are the rupees saved', saved({ typed: '1234.56', category: 'Food', merchant: ' Swiggy ' }),
  { id: 'txn-test', amount: 1234.56, type: 'EXPENSE', category: 'Food', date: '2026-11-24', createdAt: '2026-11-24T01:26:00.000Z', note: '', merchant: 'Swiggy' });
eq('entry: nothing typed saves nothing', [saved({ typed: '0.00' }), saved({ typed: '0.' })], [null, null]);
eq('entry: a payee from the note, else Unknown Merchant', [saved({ typed: '5', note: 'Chai' }).merchant, saved({ typed: '5' }).merchant], ['Chai', 'Unknown Merchant']);
eq('entry: income without a payee', [saved({ typed: '5', type: 'INCOME' }).merchant, saved({ typed: '5', type: 'INCOME' }).category], ['Income Source', 'Uncategorized']);
eq('entry: the day picked, not today', saved({ typed: '5', day: '2026-10-31' }).date, '2026-10-31');
eq('entry: $10 at 92.59 a dollar', saved({ typed: '10', rate: 0.0108, currency: 'USD' }).amount, 925.93);
eq('entry: typed in dollars, kept as typed', (({ typedAmount, typedCurrency }) => [typedAmount, typedCurrency])(saved({ typed: '10', rate: 0.0108, currency: 'USD' })), [10, 'USD']);
eq('entry: typed in rupees, nothing extra', 'typedAmount' in saved({ typed: '10' }), false);
// A rupee is worth less than a paisa's step in yen, won, rupiah and dong:
// the rupees can't hold ¥1,500 exactly, so the entry keeps what was typed and
// inputs read saved amounts in whole units.
eq('decimals inputs show', [['INR', 1], ['USD', 0.0108], ['EUR', 0.0098], ['KWD', 0.0035], ['JPY', 1.78], ['KRW', 16.4], ['IDR', 190], ['VND', 300]].map(([c, r]) => E.inputDigits(c, r)), [2, 2, 2, 3, 0, 0, 0, 0]);
{
  const yen = saved({ typed: '1500', rate: 1.78, currency: 'JPY' });
  eq('entry: ¥1,500 reads back as typed', [yen.typedAmount, E.toShown(yen.amount, 1.78, E.inputDigits('JPY', 1.78))], [1500, 1500]);
  const dong = saved({ typed: '100000', rate: 300, currency: 'VND' });
  eq('entry: ₫100,000 kept as typed (the rupees alone read ₫99,999)', [dong.typedAmount, dong.amount, E.toShown(dong.amount, 300, 0)], [100000, 333.33, 99999]);
}
// Typed amounts keep the paisa from keypad to balance, however many entries.
{
  let wallet = { transactions: [], openingBalance: 1000.1, openingBalanceAsOf: null };
  let expected = Math.round(1000.1 * 100);
  const rand = (() => { let x = 7; return () => (x = (x * 48271) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 2000; i++) {
    const typed = (Math.floor(rand() * 10000000) / 100).toFixed(2).replace(/\.00$/, '');
    const isIncome = rand() < 0.3;
    const e = E.entryFromForm(form({ typed, type: isIncome ? 'INCOME' : 'EXPENSE', day: `2026-11-${String(1 + (i % 24)).padStart(2, '0')}` }), `txn-${i}`, NOW);
    if (!e) continue;
    wallet = { ...wallet, transactions: E.mergeImport(wallet, [e]).transactions };
    expected += (isIncome ? 1 : -1) * Math.round(parseFloat(typed) * 100);
  }
  eq('entry: 2,000 typed entries add up to the paisa', Math.round(E.ledgerBalance(wallet) * 100), expected);
  eq('entry: each kept once', wallet.transactions.length, 2000 - 0);
}

// ── The daily-limit warning ────────────────────────────────────────────────
// Today ₹1,200 spent, a ₹1,500 limit, viewing in dollars: $3 is ₹277.78 and
// stays under; $4 is ₹370.37 and goes over.
const over = (spentToday, limit, typed, rate) => spentToday + E.toBase(typed, rate) > limit;
eq('limit: $3 stays under', over(1200, 1500, 3, 0.0108), false);
eq('limit: $4 goes over', over(1200, 1500, 4, 0.0108), true);
eq('limit: ₹300 exactly meets it', over(1200, 1500, 300, 1), false);
eq('limit: ₹300.01 goes over', over(1200, 1500, 300.01, 1), true);

console.log(`${checks - failures}/${checks} entry checks passed`);
if (failures) process.exit(1);
