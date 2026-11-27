#!/usr/bin/env node
/**
 * Currencies (utils/currencyUtils.ts).
 *
 * Checks that:
 *   - INR keeps Indian grouping (₹1,23,456.78) and every other currency
 *     shows with its own symbol and decimal places (¥ none, KWD three)
 *   - whole-unit and compact formats round as the screens expect
 *   - the picker lists only real currencies with a rate, common ones first
 *   - quick amounts in another currency round to figures people type
 *
 * Usage (after `npm ci`):
 *   node scripts/check-currency.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-currency-'));
const bundle = join(tmp, 'currency.mjs');
await build({
  entryPoints: [join(root, 'utils', 'currencyUtils.ts')],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
});
const C = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const nb = s => s.replace(/ | /g, ' ');

// ── Formatting ─────────────────────────────────────────────────────────────
eq('INR: Indian grouping', nb(C.getCurrencyFormatter('INR').format(123456.78)), '₹1,23,456.78');
eq('INR: whole', nb(C.getWholeCurrencyFormatter('INR').format(123456.78)), '₹1,23,457');
eq('INR: compact lakh', nb(C.getCompactCurrencyFormatter('INR').format(185707)), '₹1.9L');
eq('INR: compact under a thousand has no decimal', nb(C.getCompactCurrencyFormatter('INR').format(299)), '₹299');
eq('INR: compact zero', nb(C.getCompactCurrencyFormatter('INR').format(0)), '₹0');
eq('INR: compact round thousands', nb(C.getCompactCurrencyFormatter('INR').format(2000)), '₹2K');
{
  // Indian units written out, the same in every WebView (older locale data says ₹2.5T).
  const f = C.getCompactCurrencyFormatter('INR');
  eq('INR: compact thousands are K', f.format(2529), '₹2.5K');
  eq('INR: compact keeps one decimal', [f.format(85707), f.format(299.5), f.format(999.94)], ['₹85.7K', '₹299.5', '₹999.9']);
  eq('INR: compact crore', f.format(12345678), '₹1.2Cr');
  eq('INR: compact rounds up into the next unit like Intl', [f.format(999.96), f.format(99960), f.format(9996000)], ['₹1K', '₹1L', '₹1Cr']);
  eq('INR: compact stays in its unit just below', [f.format(99940), f.format(9994000)], ['₹99.9K', '₹99.9L']);
  eq('INR: compact negatives', [f.format(-2529), f.format(-0.04)], ['-₹2.5K', '₹0']);
  eq('INR: compact matches the screens\' minus handling', nb(f.format(-185707)), '-₹1.9L');
}
eq('USD: compact keeps one decimal when there is one', nb(C.getCompactCurrencyFormatter('USD').format(4500)), '$4.5K');
eq('USD: English grouping', nb(C.getCurrencyFormatter('USD').format(1234.5)), '$1,234.50');
eq('EUR: symbol first in English', nb(C.getCurrencyFormatter('EUR').format(1234.5)), '€1,234.50');
eq('JPY: no decimals', nb(C.getCurrencyFormatter('JPY').format(1234.5)), '¥1,235');
eq('KWD: three decimals', nb(C.getCurrencyFormatter('KWD').format(1.5)), 'KWD 1.500');
eq('AED: whole', nb(C.getWholeCurrencyFormatter('AED').format(4310.6)), 'AED 4,311');
eq('minor digits', [C.minorDigits('INR'), C.minorDigits('JPY'), C.minorDigits('KWD')], [2, 0, 3]);
eq('symbols', ['INR', 'USD', 'EUR', 'GBP'].map(C.getSymbol), ['₹', '$', '€', '£']);
eq('names', [C.currencyName('INR'), C.currencyName('AED')], ['Indian Rupee', 'United Arab Emirates Dirham']);
eq('locale', [C.localeFor('INR'), C.localeFor('USD')], ['en-IN', 'en-US']);

// ── Codes and the picker ───────────────────────────────────────────────────
eq('codes', ['INR', 'usd', 'US', 'AED', 42, null].map(C.isCurrencyCode), [true, false, false, true, false, false]);
const rates = { INR: 1, ZAR: 0.2, USD: 0.0108, XDR: 0.008, AED: 0.0396, CLF: 0.0003, BAD: 0, EUR: 0.0098, ALL: 1.06 };
eq('picker: common first, then by name, no units of account or zero rates',
  C.currencyChoices(rates), ['INR', 'USD', 'EUR', 'AED', 'ZAR', 'ALL']);
eq('fallback rates cover the first four', Object.keys(C.FALLBACK_RATES), ['INR', 'USD', 'EUR', 'GBP']);

// ── Quick amounts ──────────────────────────────────────────────────────────
eq('nice amounts', [1.08, 2.16, 5.4, 10.8, 21.6, 54].map(C.niceAmount), [1, 2, 5, 10, 20, 50]);
eq('nice amounts, larger', [17.1, 171, 342, 855, 1710, 4310].map(C.niceAmount), [15, 150, 300, 750, 1500, 4000]);
eq('nice amount of nothing', C.niceAmount(0), 0);

console.log(`${checks - failures}/${checks} currency checks passed`);
if (failures) process.exit(1);
