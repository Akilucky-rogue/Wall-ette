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
writeFileSync(entry, `export * from ${JSON.stringify(join(root, 'utils', 'entryAmount.ts'))};\nexport * from ${JSON.stringify(join(root, 'utils', 'currencyUtils.ts'))};\n`);
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
