/**
 * The garden on every page: Wall·ette's eco motifs (components/ui/Decor.tsx
 * shapes: leaves, sprouts, lotuses, mandala dots, paisleys, rangoli
 * flourishes) scattered at random, as nature would, into the page's empty
 * space only: never under text, buttons, cards or the header, and never on
 * top of each other. components/ui/Garden.tsx measures the page and paints
 * them as the page's own background images, so nothing they touch can be
 * blocked. A new arrangement each time a page opens; the full-screen moments
 * (splash, sign-in, lock, a required update) keep the splash's own garden.
 *
 * The placing is pure (placeGarden), so scripts/check-garden.mjs can test it.
 */

export type Motif = 'leaf' | 'sprout' | 'lotus' | 'mandala' | 'paisley' | 'rangoli';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Placed extends Rect {
  motif: Motif;
  /** Degrees. */
  rotate: number;
  flip: boolean;
  opacity: number;
}

export interface GardenColors { leaf: string; lotus: string; sand: string }

const SIZE: Record<Motif, [number, number]> = {
  leaf: [20, 25], sprout: [20, 25], lotus: [30, 21], mandala: [32, 32], paisley: [22, 29], rangoli: [38, 38],
};
// How often each turns up: mostly leaves, now and then something else.
const WEIGHTS: [Motif, number][] = [['leaf', 34], ['sprout', 14], ['lotus', 16], ['mandala', 12], ['paisley', 10], ['rangoli', 14]];

/** A random number source: Math.random, or a seeded one in checks. */
export type Rand = () => number;

/** A seeded random source (mulberry32), for checks that must repeat. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rand: Rand, lo: number, hi: number) => lo + rand() * (hi - lo);

function pick(rand: Rand): Motif {
  const total = WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [m, w] of WEIGHTS) { if ((r -= w) < 0) return m; }
  return 'leaf';
}

function styleOf(motif: Motif, rand: Rand): Pick<Placed, 'rotate' | 'flip' | 'opacity'> {
  const flip = rand() < 0.5;
  switch (motif) {
    case 'leaf': return { rotate: between(rand, -55, 55), flip, opacity: between(rand, 0.55, 0.8) };
    case 'sprout': return { rotate: between(rand, -12, 12), flip, opacity: between(rand, 0.55, 0.8) };
    case 'lotus': return { rotate: between(rand, -8, 8), flip: false, opacity: between(rand, 0.55, 0.75) };
    case 'mandala': return { rotate: 0, flip: false, opacity: between(rand, 0.4, 0.55) };
    case 'paisley': return { rotate: between(rand, -40, 40), flip, opacity: between(rand, 0.5, 0.7) };
    case 'rangoli': return { rotate: Math.floor(rand() * 4) * 90, flip, opacity: between(rand, 0.5, 0.7) };
  }
}

const overlaps = (a: Rect, b: Rect, gap = 0) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** How many motifs a page of this size gets: about one per 30,000 px², 6 to 30. */
export const gardenSize = (width: number, height: number): number =>
  Math.max(6, Math.min(30, Math.round((width * height) / 30_000)));

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Motifs for a page `width` × `height`, in its empty space. `obstacles` are
 * what must stay clear (text, buttons and the header sitting on the page,
 * plus `margin` around each); `surfaces` are cards and panels a motif may
 * tuck behind, like a leaf half under a card, as long as most of it
 * (`visible`) still shows. Motifs keep `spacing` from each other. Motifs
 * already placed that still fit are kept, so a page that grows or loads more
 * doesn't rearrange its garden; new ones fill up to `count`.
 */
export function placeGarden(opts: {
  width: number;
  height: number;
  obstacles: readonly Rect[];
  surfaces?: readonly Rect[];
  existing?: readonly Placed[];
  count?: number;
  rand?: Rand;
  margin?: number;
  spacing?: number;
  visible?: number;
}): Placed[] {
  const { width, height, obstacles } = opts;
  const surfaces = opts.surfaces ?? [];
  const rand = opts.rand ?? Math.random;
  const margin = opts.margin ?? 8;
  const spacing = opts.spacing ?? 30;
  const visible = opts.visible ?? 0.5;
  const count = opts.count ?? gardenSize(width, height);
  const blocked = obstacles.map(o => ({ x: o.x - margin, y: o.y - margin, w: o.w + 2 * margin, h: o.h + 2 * margin }));
  const inside = (r: Rect) => r.x >= 2 && r.y >= 2 && r.x + r.w <= width - 2 && r.y + r.h <= height - 2;
  const shows = (r: Rect) => {
    const hidden = surfaces.reduce((sum, c) => sum + overlapArea(r, c), 0);
    return 1 - hidden / (r.w * r.h) >= visible;
  };
  const clear = (r: Rect, others: readonly Rect[]) =>
    inside(r) && !blocked.some(b => overlaps(r, b)) && shows(r) && !others.some(o => overlaps(r, o, spacing));

  const placed: Placed[] = [];
  for (const p of opts.existing ?? []) if (placed.length < count && clear(p, placed)) placed.push(p);

  // All around the page: each new motif looks first in its own band of the
  // page's height, mostly along the edges (where pages keep their margins),
  // then anywhere.
  const bands = Math.max(1, count);
  const bandH = height / bands;
  const filled = (band: number) => placed.some(p => Math.floor((p.y + p.h / 2) / bandH) === band);
  const order = Array.from({ length: bands }, (_, i) => i).sort(() => rand() - 0.5);
  const candidate = (w: number, h: number, band: number | null): Rect => {
    const edge = rand() < 0.65;
    const x = edge
      ? (rand() < 0.5 ? between(rand, 2, 36) : between(rand, width - w - 36, width - w - 2))
      : between(rand, 2, width - w - 2);
    const y = band === null ? between(rand, 2, height - h - 2) : between(rand, band * bandH, (band + 1) * bandH - h);
    return { x: Math.round(Math.max(2, Math.min(width - w - 2, x))), y: Math.round(Math.max(2, Math.min(height - h - 2, y))), w, h };
  };
  const tryPlace = (band: number | null, tries: number) => {
    const motif = pick(rand);
    const [w, h] = SIZE[motif];
    for (let t = 0; t < tries; t++) {
      const r = candidate(w, h, band);
      if (clear(r, placed)) { placed.push({ ...r, motif, ...styleOf(motif, rand) }); return true; }
    }
    return false;
  };
  for (const band of order) {
    if (placed.length >= count) break;
    if (!filled(band)) tryPlace(band, 40);
  }
  for (let round = 0; placed.length < count && round < count * 3; round++) tryPlace(null, 30);
  return placed;
}

// ── Drawing ──────────────────────────────────────────────────────────────────

const svgUrl = (w: number, h: number, inner: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' fill='none'>${inner}</svg>`)}")`;

const SHAPES: Record<Motif, (c: GardenColors) => { vw: number; vh: number; body: string }> = {
  leaf: c => ({ vw: 16, vh: 20, body: `
    <path d='M8 0C8 0 2 6 2 12C2 16 4.5 19 8 19C11.5 19 14 16 14 12C14 6 8 0 8 0Z' fill='${c.leaf}' fill-opacity='0.6'/>
    <path d='M8 4V16M5 8C5 8 8 10 11 8' stroke='${c.leaf}' stroke-width='0.5' stroke-opacity='0.8'/>` }),
  sprout: c => ({ vw: 16, vh: 20, body: `
    <path d='M8 20V10' stroke='${c.leaf}' stroke-width='1.5' stroke-linecap='round'/>
    <path d='M8 12C8 12 4 10 4 6C4 2 8 2 8 2' stroke='${c.leaf}' stroke-width='1.5' fill='${c.leaf}' fill-opacity='0.3'/>
    <path d='M8 8C8 8 12 6 12 3C12 0 8 2 8 2' stroke='${c.leaf}' stroke-width='1.5' fill='${c.leaf}' fill-opacity='0.3'/>` }),
  lotus: c => ({ vw: 30, vh: 21, body: `
    <ellipse cx='15' cy='14' rx='4' ry='8' fill='${c.lotus}' fill-opacity='0.7'/>
    <ellipse cx='9' cy='15' rx='3.5' ry='7' fill='${c.lotus}' fill-opacity='0.5' transform='rotate(-20 9 15)'/>
    <ellipse cx='5' cy='16' rx='3' ry='5' fill='${c.lotus}' fill-opacity='0.3' transform='rotate(-35 5 16)'/>
    <ellipse cx='21' cy='15' rx='3.5' ry='7' fill='${c.lotus}' fill-opacity='0.5' transform='rotate(20 21 15)'/>
    <ellipse cx='25' cy='16' rx='3' ry='5' fill='${c.lotus}' fill-opacity='0.3' transform='rotate(35 25 16)'/>
    <circle cx='15' cy='18' r='2' fill='${c.sand}' fill-opacity='0.8'/>` }),
  mandala: c => ({ vw: 32, vh: 32, body: `<circle cx='16' cy='16' r='2' fill='${c.leaf}' fill-opacity='0.5'/>` +
    [0, 45, 90, 135, 180, 225, 270, 315].map((a, i) =>
      `<circle cx='${(16 + 8 * Math.cos((a * Math.PI) / 180)).toFixed(2)}' cy='${(16 + 8 * Math.sin((a * Math.PI) / 180)).toFixed(2)}' r='1.5' fill='${c.leaf}' fill-opacity='${0.3 + (i % 2) * 0.2}'/>`).join('') }),
  paisley: c => ({ vw: 18, vh: 24, body: `
    <path d='M9 2C4 2 2 8 2 12C2 18 6 22 10 22C14 22 16 18 16 14C16 8 12 4 9 2Z' fill='${c.sand}' fill-opacity='0.25' stroke='${c.sand}' stroke-width='0.6' stroke-opacity='0.6'/>
    <circle cx='9' cy='14' r='2' fill='${c.sand}' fill-opacity='0.5'/>
    <path d='M9 8C9 8 7 10 7 14' stroke='${c.sand}' stroke-width='0.6' stroke-opacity='0.7'/>` }),
  rangoli: c => ({ vw: 40, vh: 40, body: `
    <circle cx='8' cy='8' r='2' fill='${c.leaf}' fill-opacity='0.5'/>
    <circle cx='16' cy='4' r='1.5' fill='${c.leaf}' fill-opacity='0.4'/>
    <circle cx='4' cy='16' r='1.5' fill='${c.leaf}' fill-opacity='0.4'/>
    <path d='M2 2Q20 2 20 20' stroke='${c.leaf}' stroke-width='0.7' stroke-opacity='0.55'/>
    <path d='M6 2Q20 6 20 20' stroke='${c.leaf}' stroke-width='0.7' stroke-opacity='0.45'/>
    <circle cx='12' cy='12' r='1' fill='${c.leaf}' fill-opacity='0.6'/>` }),
};

/** One placed motif as a CSS background image, turned and faded as placed. */
export function motifImage(p: Placed, colors: GardenColors): string {
  const { vw, vh, body } = SHAPES[p.motif](colors);
  const cx = vw / 2, cy = vh / 2;
  const turn = `rotate(${p.rotate.toFixed(1)} ${cx} ${cy})${p.flip ? ` translate(${vw} 0) scale(-1 1)` : ''}`;
  // A viewBox a little larger than the shape, so a turned shape isn't cut off.
  const pad = Math.ceil(Math.max(vw, vh) * 0.25);
  return svgUrl(vw + 2 * pad, vh + 2 * pad,
    `<g opacity='${p.opacity.toFixed(2)}' transform='translate(${pad} ${pad})'><g transform='${turn}'>${body}</g></g>`);
}

/** The page's background for its garden: images, positions and sizes, layer by layer. */
export function gardenBackground(placed: readonly Placed[], colors: GardenColors): { image: string; position: string; size: string } {
  if (placed.length === 0) return { image: 'none', position: '', size: '' };
  const layers = placed.map(p => {
    const { vw, vh } = SHAPES[p.motif](colors);
    const pad = Math.ceil(Math.max(vw, vh) * 0.25);
    // The image's scale: the shape drawn at the placed size, its padding around it.
    const sx = p.w / vw, sy = p.h / vh;
    return {
      image: motifImage(p, colors),
      position: `${Math.round(p.x - pad * sx)}px ${Math.round(p.y - pad * sy)}px`,
      size: `${Math.round((vw + 2 * pad) * sx)}px ${Math.round((vh + 2 * pad) * sy)}px`,
    };
  });
  return {
    image: layers.map(l => l.image).join(', '),
    position: layers.map(l => l.position).join(', '),
    size: layers.map(l => l.size).join(', '),
  };
}
