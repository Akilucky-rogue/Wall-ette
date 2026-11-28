#!/usr/bin/env node
/**
 * The page garden check (1.6.1, utils/garden.ts).
 *
 * Places motifs on made-up pages and checks that:
 *   - no motif touches text, buttons or the header on the page, with the
 *     margin kept around each; a motif may tuck behind a card, but most of
 *     it always shows
 *   - no two motifs touch, and each keeps its distance from the others
 *   - every motif stays inside the page
 *   - a roomy page gets its full count, a page with no room gets none
 *   - motifs still clear are kept when the page grows, so it doesn't shuffle
 *   - each page opening gets its own arrangement
 *   - the background it paints has one image, position and size per motif
 *
 * Usage (after `npm ci`):
 *   node scripts/check-garden.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-garden-'));
const bundle = join(tmp, 'garden.mjs');
await build({ entryPoints: [join(root, 'utils', 'garden.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const G = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const overlaps = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

// A phone page: a header, a title and a button on the page (to stay clear
// of), and cards with 20px gutters (motifs may tuck half behind them).
const phone = {
  width: 390,
  height: 1500,
  obstacles: [
    { x: 0, y: 0, w: 390, h: 72 },        // the sticky header
    { x: 20, y: 320, w: 180, h: 24 },     // a section title on the page
    { x: 120, y: 1130, w: 150, h: 44 },   // a button
  ],
  surfaces: [
    { x: 20, y: 84, w: 350, h: 220 },     // the wallet card
    { x: 20, y: 356, w: 350, h: 300 },    // a card
    { x: 20, y: 680, w: 350, h: 420 },    // a card
  ],
};
const MARGIN = 8, SPACING = 48, VISIBLE = 0.55;
const hiddenShare = p => phone.surfaces.reduce((sum, c) =>
  sum + Math.max(0, Math.min(p.x + p.w, c.x + c.w) - Math.max(p.x, c.x)) * Math.max(0, Math.min(p.y + p.h, c.y + c.h) - Math.max(p.y, c.y)), 0) / (p.w * p.h);

console.log('Placing');
let bad = { onContent: 0, touching: 0, outside: 0, mostlyHidden: 0 };
let tucked = 0;
let short = 0;
for (let seed = 1; seed <= 300; seed++) {
  const placed = G.placeGarden({ ...phone, rand: G.seeded(seed) });
  if (placed.length < G.gardenSize(phone.width, phone.height)) short++;
  for (const p of placed) {
    if (phone.obstacles.some(o => overlaps(p, { x: o.x - MARGIN, y: o.y - MARGIN, w: o.w + 2 * MARGIN, h: o.h + 2 * MARGIN }))) bad.onContent++;
    if (p.x < 2 || p.y < 2 || p.x + p.w > phone.width - 2 || p.y + p.h > phone.height - 2) bad.outside++;
    if (1 - hiddenShare(p) < VISIBLE) bad.mostlyHidden++;
    if (hiddenShare(p) > 0) tucked++;
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) if (overlaps(placed[i], placed[j], SPACING)) bad.touching++;
}
eq('300 gardens: none on text or controls, none touching, none outside, none mostly hidden', bad, { onContent: 0, touching: 0, outside: 0, mostlyHidden: 0 });
eq('some motifs tuck behind a card, as leaves would', tucked > 0, true);
eq('a roomy page gets its full count (300 gardens)', short, 0);
eq('the count grows with the page, 3 to 16', [G.gardenSize(390, 300), G.gardenSize(390, 1500), G.gardenSize(1280, 2400)], [3, 7, 16]);

const full = { width: 390, height: 800, obstacles: [{ x: 0, y: 0, w: 390, h: 800 }] };
const cards = { width: 390, height: 800, obstacles: [], surfaces: [{ x: 0, y: 0, w: 390, h: 800 }] };
eq('a page with no room gets no garden', G.placeGarden({ ...full, rand: G.seeded(1) }).length, 0);
eq('a page all card gets none either: nothing would show', G.placeGarden({ ...cards, rand: G.seeded(1) }).length, 0);

console.log('Growing');
{
  const first = G.placeGarden({ ...phone, rand: G.seeded(7) });
  const grown = { ...phone, height: 2400, surfaces: [...phone.surfaces, { x: 20, y: 1500, w: 350, h: 500 }] };
  const after = G.placeGarden({ ...grown, existing: first, rand: G.seeded(8) });
  const kept = first.filter(p => after.includes(p));
  eq('motifs still clear stay where they were', kept.length, first.length);
  eq('…and new ones fill the new space', after.length, G.gardenSize(grown.width, grown.height));
  const covered = { ...phone, obstacles: [...phone.obstacles, { x: 0, y: 1100, w: 390, h: 400 }] };
  const trimmed = G.placeGarden({ ...covered, existing: first, rand: G.seeded(9) });
  eq('a motif now under content goes', trimmed.some(p => p.y + p.h > 1100 - MARGIN && first.includes(p)), false);
}

console.log('Each opening');
{
  const a = G.placeGarden({ ...phone, rand: G.seeded(11) }).map(p => [p.x, p.y]);
  const b = G.placeGarden({ ...phone, rand: G.seeded(12) }).map(p => [p.x, p.y]);
  eq('two openings, two arrangements', JSON.stringify(a) !== JSON.stringify(b), true);
  const kinds = new Set();
  for (let seed = 1; seed <= 40; seed++) for (const p of G.placeGarden({ ...phone, rand: G.seeded(seed) })) kinds.add(p.motif);
  eq('every kind of motif turns up', [...kinds].sort(), ['leaf', 'lotus', 'mandala', 'paisley', 'rangoli', 'sprout']);
}

console.log('Painting');
{
  const placed = G.placeGarden({ ...phone, rand: G.seeded(3) });
  const bg = G.gardenBackground(placed, { leaf: '#97A96D', lotus: '#C98A79', sand: '#D4B896' });
  const layers = s => s.split(/,\s*(?=url\()/).length;
  eq('one image per motif', layers(bg.image), placed.length);
  eq('one position and size per motif', [bg.position.split(',').length, bg.size.split(',').length], [placed.length, placed.length]);
  eq('the images are SVG', bg.image.startsWith('url("data:image/svg+xml,'), true);
  eq('no garden, no background', G.gardenBackground([], { leaf: '#000', lotus: '#000', sand: '#000' }).image, 'none');
}

console.log(failures ? `\n${failures} of ${checks} garden checks failed` : `\nAll ${checks} garden checks passed`);
process.exit(failures ? 1 : 0);
