#!/usr/bin/env node
/**
 * Text contrast in every theme (utils/theme.ts).
 *
 * The audits found secondary text too pale (3.2:1 in the light themes).
 * Checks that main text (ink), second text (ink-2) and secondary text (mut)
 * reach 4.5:1 (WCAG AA for body text) on the page, cards and pale cards of
 * every preset theme. A custom theme changes only the accent of the light or
 * dark base, which Sage and Midnight cover.
 *
 * Then the colours that carry meaning, at 4.5:1 too: the accent as text on
 * the page and cards (money in, links), text on the accent (buttons; Tailwind's
 * `white` is the card colour), the accent on its own tint (chips), money out
 * (rose) as text and behind text, and the sand chips' ink.
 *
 * Usage (after `npm ci`): node scripts/check-contrast.mjs
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-contrast-'));
const bundle = join(tmp, 'theme.mjs');
await build({
  entryPoints: [join(root, 'utils', 'theme.ts')],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
});
const T = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let checks = 0, failures = 0;
const palettes = Object.keys(T.THEMES).map(id => [id, T.themePalette(id)]);
for (const [name, p] of palettes) {
  const worst = [];
  for (const text of ['ink', 'ink-2', 'mut']) {
    for (const surface of ['bg', 'card', 'card-alt']) {
      if (!p[text] || !p[surface]) continue;
      checks++;
      const r = ratio(p[text], p[surface]);
      if (r < 4.5) { failures++; worst.push(`${text} on ${surface} ${r.toFixed(2)}:1`); }
    }
  }
  const mutWorst = Math.min(...['bg', 'card', 'card-alt'].filter(s => p[s]).map(s => ratio(p['mut'], p[s])));
  console.log(`${worst.length ? 'FAIL' : 'ok  '}  ${name.padEnd(14)} secondary text ${mutWorst.toFixed(2)}:1 at worst${worst.length ? `  ${worst.join('; ')}` : ''}`);
}

console.log('');
for (const [name, p] of palettes) {
  const pairs = {
    'accent on page': [p['sage'], p['bg']], 'accent on card': [p['sage'], p['card']],
    'text on accent': [p['card'], p['sage']], 'accent on its tint': [p['sage'], p['sage-soft']],
    'money out on card': [p['rose'], p['card']], 'text on money out': [p['card'], p['rose']],
    'sand ink on sand': [p['sand-ink'], p['sand-soft']],
  };
  const worst = [];
  for (const [label, [a, b]] of Object.entries(pairs)) {
    checks++;
    const r = ratio(a, b);
    if (r < 4.5) { failures++; worst.push(`${label} ${r.toFixed(2)}:1`); }
  }
  console.log(`${worst.length ? 'FAIL' : 'ok  '}  ${name.padEnd(14)} accent and money colours${worst.length ? `  ${worst.join('; ')}` : ''}`);
}

console.log(`\n${checks - failures}/${checks} contrast checks passed`);
process.exit(failures ? 1 : 0);
