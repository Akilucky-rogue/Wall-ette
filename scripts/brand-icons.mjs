#!/usr/bin/env node
/**
 * Wall·ette's icon, drawn once and rendered at every size it ships in.
 *
 * The drawing is traced from the approved icon in the brand kit
 * (04 App/icon-sage.png): a sage head with an ivory band, a dark mask with
 * two eyes, and a leaf, on forest green. It is kept here as SVG, in a
 * 300-unit square, and composed into:
 *
 * - Android: the adaptive icon's layers (foreground, the gradient behind it,
 *   and a one-colour layer for themed icons), square and round icons for
 *   Android 7, and the launch screen's icon (styles.xml).
 * - Google Play (512) and App Store (1024) icons, in store-assets/.
 * - The iOS app icon and launch image (ios/App/App/Assets.xcassets).
 * - The web app's favicon and home-screen icon (public/), and the
 *   website's (site/public/).
 * - The app's own copies: the icon tile and the face (assets/brand), and
 *   the tile as a string for the statement report (utils/brandIcon.ts).
 *
 * Needs rsvg-convert (librsvg) on the PATH, and ImageMagick's `convert` for
 * the iOS icons, which must have no alpha channel.
 *
 * Usage: node scripts/brand-icons.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-icons-'));

// ── The drawing ─────────────────────────────────────────────────────────────
const f = (n) => +n.toFixed(2);
const rad = (d) => (d * Math.PI) / 180;

/** A rounded blob: an ellipse whose top and bottom halves can differ in
 *  height and fullness (k = 0.5523 is a true ellipse; more is squarer). */
function blob(cx, cy, a, bTop, bBot, kTop, kBot) {
  return `M${f(cx - a)} ${f(cy)}` +
    `C${f(cx - a)} ${f(cy - kTop * bTop)} ${f(cx - kTop * a)} ${f(cy - bTop)} ${f(cx)} ${f(cy - bTop)}` +
    `C${f(cx + kTop * a)} ${f(cy - bTop)} ${f(cx + a)} ${f(cy - kTop * bTop)} ${f(cx + a)} ${f(cy)}` +
    `C${f(cx + a)} ${f(cy + kBot * bBot)} ${f(cx + kBot * a)} ${f(cy + bBot)} ${f(cx)} ${f(cy + bBot)}` +
    `C${f(cx - kBot * a)} ${f(cy + bBot)} ${f(cx - a)} ${f(cy + kBot * bBot)} ${f(cx - a)} ${f(cy)}Z`;
}

/** A smooth curve through points (Catmull-Rom as cubic Béziers). */
function spline(pts, move = true) {
  let s = move ? `M${f(pts[0][0])} ${f(pts[0][1])}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    s += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return s;
}

/** The mask: a circle round each eye, joined by a bridge with a soft waist. */
function maskPath() {
  const L = { x: 111.5, y: 172, r: 41 }, R = { x: 206.5, y: 172, r: 32 };
  const at = (c, deg) => [c.x + c.r * Math.cos(rad(deg)), c.y + c.r * Math.sin(rad(deg))];
  const tangent = (deg) => [-Math.sin(rad(deg)), Math.cos(rad(deg))];
  const pull = 10;
  const [p1, p2, p3, p4] = [at(L, -50), at(R, -130), at(R, 130), at(L, 50)];
  const [t1, t2, t3, t4] = [tangent(-50), tangent(-130), tangent(130), tangent(50)];
  const c1 = [p1[0] + pull * t1[0], p1[1] + pull * t1[1]], c2 = [p2[0] - pull * t2[0], p2[1] - pull * t2[1]];
  const c3 = [p3[0] + pull * t3[0], p3[1] + pull * t3[1]], c4 = [p4[0] - pull * t4[0], p4[1] - pull * t4[1]];
  return `M${f(p1[0])} ${f(p1[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}` +
    `A${R.r} ${R.r} 0 1 1 ${f(p3[0])} ${f(p3[1])}` +
    `C${f(c3[0])} ${f(c3[1])} ${f(c4[0])} ${f(c4[1])} ${f(p4[0])} ${f(p4[1])}` +
    `A${L.r} ${L.r} 0 1 1 ${f(p1[0])} ${f(p1[1])}Z`;
}

const HEAD = blob(150, 179, 121.5, 108, 83.5, 0.5523, 0.64);
const BAND = blob(152.5, 175, 102, 62, 62, 0.64, 0.64);
const MASK = maskPath();
const LEAF = spline([[164.6, 89], [165.4, 81], [167.0, 71], [168.6, 58.5], [173.2, 46.5], [181.5, 37], [194.5, 29.8], [212.2, 25.4], [234.0, 22.8]]) +
  spline([[234.0, 22.8], [231.0, 35.5], [224.0, 48.5], [212.2, 58.8], [196.0, 66.2], [181.0, 70.6], [172.2, 74.2], [169.4, 81.0], [167.6, 89]], false) + 'Z';
const VEIN = spline([[172.6, 72.2], [177.5, 63.5], [187.5, 53.6], [201.5, 44.6], [219.5, 36.8]]) +
  spline([[219.5, 36.8], [209.5, 47.8], [195.0, 58.4], [181.0, 66.6], [172.6, 72.2]], false) + 'Z';
const LEFT = { x: 112.5, y: 172.5, ring: 32, pupil: 21.5 };
const RIGHT = { x: 207, y: 171.5, iris: 23.5, pupil: 11.5 };
const circle = (cx, cy, r) => `M${f(cx + r)} ${f(cy)}A${r} ${r} 0 1 0 ${f(cx - r)} ${f(cy)}A${r} ${r} 0 1 0 ${f(cx + r)} ${f(cy)}Z`;
const irisLines = Array.from({ length: 20 }, (_, i) => {
  const a = rad(18 * i + 7), r0 = RIGHT.pupil + 0.5, r1 = RIGHT.iris - 0.8;
  return `M${f(RIGHT.x + r0 * Math.cos(a))} ${f(RIGHT.y + r0 * Math.sin(a))}L${f(RIGHT.x + r1 * Math.cos(a))} ${f(RIGHT.y + r1 * Math.sin(a))}`;
}).join('');
const ringShine = (() => {
  const r = 27.5, p = (d) => `${f(LEFT.x + r * Math.cos(rad(d)))} ${f(LEFT.y + r * Math.sin(rad(d)))}`;
  return `M${p(195)}A${r} ${r} 0 0 1 ${p(268)}`;
})();

export const COLOURS = {
  bgTop: '#82975E', bgBottom: '#55703A',
  headTop: '#9EB075', headBottom: '#93A76A', band: '#F5E6D2', mask: '#2D2F1E',
  ring: '#97AD6D', ringShine: '#D2DFB8', iris: '#93AB6B', irisLine: '#6B8449',
  pupil: '#2A2C1C', shine: '#F7F5F0', leaf: '#F7F5E9', leafOnCream: '#6E9549',
  cream: '#F9F3ED',
};
const C = COLOURS;

/** The head, eyes and leaf in the 300-unit square. `leaf` sets the leaf's
 *  colour: pale on the green icon, green on cream. `id` keeps gradient ids
 *  apart when one SVG holds the drawing twice. */
function face({ leaf = 'pale', id = 'w' } = {}) {
  const leafFill = leaf === 'pale' ? `fill="${C.leaf}" fill-opacity="0.86"` : `fill="${C.leafOnCream}"`;
  return `<defs><linearGradient id="${id}-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.headTop}"/><stop offset="1" stop-color="${C.headBottom}"/></linearGradient></defs>` +
    `<path d="${HEAD}" fill="url(#${id}-head)"/>` +
    `<path d="${LEAF}${VEIN}" ${leafFill} fill-rule="evenodd"/>` +
    `<path d="${BAND}" fill="${C.band}"/>` +
    `<path d="${MASK}" fill="${C.mask}"/>` +
    `<circle cx="${LEFT.x}" cy="${LEFT.y}" r="${LEFT.ring}" fill="${C.ring}"/>` +
    `<path d="${ringShine}" fill="none" stroke="${C.ringShine}" stroke-width="5" stroke-linecap="round" opacity="0.9"/>` +
    `<circle cx="${LEFT.x}" cy="${LEFT.y + 0.5}" r="${LEFT.pupil}" fill="${C.pupil}"/>` +
    `<circle cx="122.5" cy="163" r="6" fill="${C.shine}"/>` +
    `<circle cx="${RIGHT.x}" cy="${RIGHT.y}" r="${RIGHT.iris}" fill="${C.iris}"/>` +
    `<path d="${irisLines}" stroke="${C.irisLine}" stroke-width="1.3"/>` +
    `<circle cx="${RIGHT.x}" cy="${RIGHT.y}" r="${RIGHT.pupil}" fill="${C.pupil}"/>` +
    `<circle cx="211" cy="166.5" r="4" fill="${C.shine}"/>`;
}

/** The same face in one colour (Android's themed icons): what is drawn
 *  shows in the tint, the band, eye rings and vein are left open. */
function faceMono() {
  return `<path d="${HEAD}${BAND}" fill-rule="evenodd"/>` +
    `<path d="${MASK}${circle(LEFT.x, LEFT.y, LEFT.ring - 2)}${circle(RIGHT.x, RIGHT.y, RIGHT.iris - 1.5)}" fill-rule="evenodd"/>` +
    `<circle cx="${LEFT.x}" cy="${LEFT.y + 0.5}" r="${LEFT.pupil}"/>` +
    `<circle cx="${RIGHT.x}" cy="${RIGHT.y}" r="${RIGHT.pupil + 1}"/>` +
    `<path d="${LEAF}${VEIN}" fill-rule="evenodd"/>`;
}

const gradient = (id) => `<linearGradient id="${id}" x1="0.25" y1="0" x2="0.75" y2="1"><stop offset="0" stop-color="${C.bgTop}"/><stop offset="1" stop-color="${C.bgBottom}"/></linearGradient>`;

// ── Compositions ────────────────────────────────────────────────────────────
// Android's adaptive icon is a 108-unit square; launchers show the middle
// 72 and promise the middle 66 (a circle) on every shape. The drawing's
// 300-unit square goes 66 wide, a little low, so the leaf's tip stays inside.
const ADAPTIVE = 'translate(21 22) scale(0.22)';
const svg = (viewBox, body, w = null) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${w ? ` width="${w}" height="${w}"` : ''}>${body}</svg>`;

const ICON = {
  foreground: () => svg('0 0 108 108', `<g transform="${ADAPTIVE}">${face()}</g>`),
  monochrome: () => svg('0 0 108 108', `<g transform="${ADAPTIVE}" fill="#000">${faceMono()}</g>`),
  /** The icon as launchers draw it, cut to a shape: `square` (rounded) or `round`. */
  shaped: (shape) => {
    const clip = shape === 'round'
      ? '<circle cx="54" cy="54" r="36"/>'
      : '<rect x="18" y="18" width="72" height="72" rx="15.5"/>';
    return svg('16.5 16.5 75 75',
      `<defs>${gradient('bg')}<clipPath id="shape">${clip}</clipPath></defs>` +
      `<g clip-path="url(#shape)"><rect width="108" height="108" fill="url(#bg)"/><g transform="${ADAPTIVE}">${face()}</g></g>`);
  },
  /** Full-bleed square: the stores and iOS round the corners themselves. */
  square: () => svg('18 18 72 72',
    `<defs>${gradient('bg')}</defs><rect width="108" height="108" fill="url(#bg)"/><g transform="${ADAPTIVE}">${face()}</g>`),
  /** iOS launch image: the rounded icon on cream. */
  launch: () => svg('0 0 2732 2732',
    `<defs>${gradient('bg')}<clipPath id="shape"><rect x="18" y="18" width="72" height="72" rx="16"/></clipPath></defs>` +
    `<rect width="2732" height="2732" fill="${C.cream}"/>` +
    `<g transform="translate(1126 1126) scale(6.667) translate(-18 -18)"><g clip-path="url(#shape)"><rect width="108" height="108" fill="url(#bg)"/><g transform="${ADAPTIVE}">${face()}</g></g></g>`),
};

// Favicons are seen at 16-48 px: the drawing fills more of the square there.
const FAVICON = svg('0 0 300 300',
  `<defs>${gradient('bg')}</defs><rect width="300" height="300" rx="66" fill="url(#bg)"/>` +
  `<g transform="translate(12 16) scale(0.92)">${face()}</g>`);

// ── Rendering ───────────────────────────────────────────────────────────────
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
let count = 0;

let drawn = 0;
function render(svgText, out, size, { opaque = false } = {}) {
  const src = join(tmp, `${drawn++}.svg`);
  writeFileSync(src, svgText);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, src]);
  if (opaque) execFileSync('convert', [out, '-background', C.cream, '-alpha', 'remove', '-alpha', 'off', out]);
  if (!out.startsWith(tmp)) count++;
}

function write(out, text) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  count++;
}

/** A .ico holding PNGs (Windows Vista and every browser read these). */
function writeIco(out, pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  write(out, Buffer.concat([header, ...pngs.map(p => p.data)]));
}

const res = join(root, 'android/app/src/main/res');
for (const [d, x] of Object.entries(DENSITIES)) {
  render(ICON.foreground(), join(res, `mipmap-${d}/ic_launcher_foreground.png`), 108 * x);
  render(ICON.monochrome(), join(res, `mipmap-${d}/ic_launcher_monochrome.png`), 108 * x);
  render(ICON.shaped('square'), join(res, `mipmap-${d}/ic_launcher.png`), 48 * x);
  render(ICON.shaped('round'), join(res, `mipmap-${d}/ic_launcher_round.png`), 48 * x);
  // The launch screen's icon (drawable/splash_icon.xml): the round icon,
  // 176dp, inside the 192dp circle Android shows it in.
  render(ICON.shaped('round'), join(res, `drawable-${d}/splash_mark.png`), 176 * x);
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- Wall·ette's icon (scripts/brand-icons.mjs): the face over a forest-green
     gradient, and a one-colour face for themed icons (Android 13+). -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
write(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
write(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
write(join(res, 'drawable/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- The icon's background layer: forest green, lighter at the top
     (scripts/brand-icons.mjs). -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:type="linear"
                android:startX="27"
                android:startY="0"
                android:endX="81"
                android:endY="108">
                <item android:offset="0" android:color="#FF${C.bgTop.slice(1)}"/>
                <item android:offset="1" android:color="#FF${C.bgBottom.slice(1)}"/>
            </gradient>
        </aapt:attr>
    </path>
</vector>
`);
write(join(res, 'drawable/splash_icon.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- The launch screen's icon (styles.xml). Android draws it in a 288dp
     square and shows the middle 192dp circle; the round icon is 176dp. -->
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/splash_mark"
    android:inset="56dp" />
`);

// Stores and iOS.
render(ICON.square(), join(root, 'store-assets/icon-512.png'), 512);
render(ICON.square(), join(root, 'store-assets/icon-ios-1024.png'), 1024, { opaque: true });
const ios = join(root, 'ios/App/App/Assets.xcassets');
render(ICON.square(), join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png'), 1024, { opaque: true });
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  render(ICON.launch(), join(ios, 'Splash.imageset', name), 2732, { opaque: true });
}

// The web app (served at /app) and the website.
write(join(root, 'public/favicon.svg'), FAVICON + '\n');
render(ICON.square(), join(root, 'public/apple-touch-icon.png'), 180, { opaque: true });
const site = join(root, 'site/public');
write(join(site, 'favicon.svg'), FAVICON + '\n');
render(FAVICON, join(site, 'favicon.png'), 64);
render(ICON.square(), join(site, 'apple-touch-icon.png'), 180, { opaque: true });
render(ICON.square(), join(site, 'icon-192.png'), 192, { opaque: true });
const icoSizes = [16, 32, 48];
icoSizes.forEach(s => render(FAVICON, join(tmp, `ico-${s}.png`), s));
writeIco(join(site, 'favicon.ico'), icoSizes.map(size => ({ size, data: readFileSync(join(tmp, `ico-${size}.png`)) })));

// The app's own copies (assets/brand): the icon tile, and the face alone
// with a green leaf for light surfaces; and the tile as a string for pages
// built as text (the statement report).
write(join(root, 'assets/brand/icon.svg'), FAVICON + '\n');
write(join(root, 'assets/brand/mark.svg'), svg('22 14 256 256', face({ leaf: 'green', id: 'm' })) + '\n');
write(join(root, 'utils/brandIcon.ts'), `// Generated by scripts/brand-icons.mjs: Wall·ette's icon as SVG markup,
// for pages built as strings (the statement report).
export const BRAND_ICON_SVG = ${JSON.stringify(FAVICON)};
`);

rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${count} icon files.`);
