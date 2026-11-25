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

console.log(`\n${checks - failures}/${checks} contrast checks passed`);
process.exit(failures ? 1 : 0);
