// Theme engine — Wall·ette themes.
// Every color in the app resolves through CSS variables set here on <html>.
// Tailwind's palette (tailwind.config.cjs) reads the `--c-*` channel vars so
// utility classes (bg-white, text-sage, …) follow the active theme, and
// inline SVG/chart colors read the `--*` hex aliases directly.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export type ThemeId = 'sage' | 'midnight' | 'teal' | 'terra' | 'slate' | 'techie' | 'custom';
export type ThemeMode = ThemeId | 'auto';

export interface CustomTheme {
  accent: string; // hex like #49693E
  dark: boolean;
}

type Palette = Record<string, string>; // css alias -> hex

const MODE_KEY = 'walletThemeMode';
const CUSTOM_KEY = 'walletThemeCustom';

// ── Neutral bases ──────────────────────────────────────────────────────────
const LIGHT_BASE: Palette = {
  'bg': '#FAF9F6', 'card': '#FFFFFF', 'card-alt': '#FDFBF7',
  // Secondary text at 4.6:1 or more on the page, cards and pale cards (WCAG
  // AA); the audits found the earlier #8E8D8A too pale at 3.2:1.
  'ink': '#333333', 'ink-2': '#4A4947', 'mut': '#72716E', 'mut-2': '#B9B7B2',
  'line': '#EFEDE8', 'line-2': '#E8E5DE',
  // Money out and warnings: the brand's clay (the website's "spend"), dark
  // enough to read as text and behind white text (the pastel pink before
  // reached 2.1:1).
  'rose': '#A35B48', 'rose-2': '#C98A79', 'rose-3': '#8E4C3B', 'rose-strong': '#E57373', 'rose-soft': '#F6E4DE',
  'sand': '#D6C6B2', 'sand-soft': '#F4EFE9', 'sand-ink': '#806030', 'gold-1': '#C4A98E', 'gold-2': '#D4B896',
  'amber': '#FBBF24', 'amber-2': '#F5D485', 'amber-3': '#F59E42',
  'lavender': '#B8B5D0', 'lavender-soft': '#EBEAF2',
  'ocean': '#9CB5C1', 'ocean-soft': '#E6EEF2',
  'bluez': '#A7BBC7', 'bluez-soft': '#E6EEF2',
  // Charts (components/charts): an ocean teal for money in, clay for money
  // out with its three steps (bills, everyday, one-offs), and the clay's
  // quiet step for the month before. Earthy like the themes, and checked
  // with the dataviz palette validator against the card in each mode
  // (colour-blind separation, contrast); the same in every theme.
  'viz-in': '#1D7AA3', 'viz-out': '#C0714A', 'viz-out-1': '#8A4A2C', 'viz-out-3': '#E2A685', 'viz-ctx': '#E2A685',
};

const DARK_BASE: Palette = {
  'bg': '#141413', 'card': '#1E1E1C', 'card-alt': '#242422',
  'ink': '#ECEAE4', 'ink-2': '#D6D4CE', 'mut': '#98968F', 'mut-2': '#6E6C66',
  'line': '#2B2B28', 'line-2': '#32322E',
  'rose': '#D4A5A5', 'rose-2': '#E8A5A5', 'rose-3': '#C98989', 'rose-strong': '#E57373', 'rose-soft': '#3A2A2A',
  'sand': '#C9B69C', 'sand-soft': '#312B22', 'sand-ink': '#D9B98A', 'gold-1': '#C4A98E', 'gold-2': '#D4B896',
  'amber': '#E0B33C', 'amber-2': '#C9A94F', 'amber-3': '#E09A50',
  'lavender': '#B4B0CE', 'lavender-soft': '#2C2A38',
  'ocean': '#96B0BD', 'ocean-soft': '#253035',
  'bluez': '#A0B5C2', 'bluez-soft': '#253035',
  'viz-in': '#3D98BC', 'viz-out': '#C8744D', 'viz-out-1': '#A35A37', 'viz-out-3': '#E2A584', 'viz-ctx': '#A35A37',
};

// ── Preset themes (sage-* aliases are the app's "accent" slots) ───────────
// Sage and Midnight are Wall·ette's own look, light and dark: Midnight is
// the dark base with sage-green accents, as it has been since it shipped,
// and "Match system theme" uses it in dark mode, so it stays green. The
// brand kit's navy palette is not a theme. Teal and Terracotta are the
// kit's other palettes (05 Palette Variations). All are set so text, the
// accent as text and behind text, and money out reach 4.5:1
// (scripts/check-contrast.mjs).
// Terracotta's accent is the clay money out uses elsewhere, so it takes a
// berry for money out. `wallet` and `wallet-2` colour Home's wallet; without
// them it is a deep shade of the accent.
interface ThemeDef { name: string; dark: boolean; vars: Palette; }

export const THEMES: Record<Exclude<ThemeId, 'custom'>, ThemeDef> = {
  sage: {
    name: 'Sage', dark: false,
    vars: {
      'bg': '#F9F3ED', 'card': '#FFFDFA', 'card-alt': '#FCF8F2',
      'ink': '#282C20', 'ink-2': '#3E4334', 'mut': '#646859',
      'line': '#EEE7DC', 'line-2': '#E6DDD0',
      'sage': '#49693E', 'sage-2': '#3D5934', 'sage-3': '#97A96D',
      'sage-deep': '#345640', 'sage-soft': '#E5EBD6', 'sage-line': '#CCD8B6',
      'sand': '#DCC39A', 'sand-soft': '#F9EEDD', 'sand-ink': '#8A6423', 'gold-1': '#BF9240', 'gold-2': '#D3AE62',
      'wallet': '#5B7543', 'wallet-2': '#3E5430',
    },
  },
  midnight: {
    name: 'Midnight', dark: true,
    vars: {
      'sage': '#9BAE93', 'sage-2': '#86997E', 'sage-3': '#B4C4AB',
      'sage-deep': '#B9CCB0', 'sage-soft': '#273226', 'sage-line': '#39463A',
    },
  },
  teal: {
    name: 'Teal', dark: false,
    vars: {
      'bg': '#F4F3EF', 'card': '#FFFFFF', 'card-alt': '#FAF9F6',
      'ink': '#22302E', 'ink-2': '#384744', 'mut': '#5C6866',
      'line': '#E9E7E1', 'line-2': '#E0DDD5',
      'sage': '#1C706D', 'sage-2': '#165C59', 'sage-3': '#86BF9F',
      'sage-deep': '#134F4C', 'sage-soft': '#DCEDE6', 'sage-line': '#BCDBCF',
      'sand': '#E6C9A4', 'sand-soft': '#F6ECDF', 'sand-ink': '#8A6233', 'gold-1': '#C9A57A', 'gold-2': '#DDBE96',
      'wallet': '#1F6E6A', 'wallet-2': '#154F4C',
    },
  },
  terra: {
    name: 'Terracotta', dark: false,
    vars: {
      'bg': '#FBF6F1', 'card': '#FFFFFF', 'card-alt': '#FDF9F5',
      'ink': '#3A2C30', 'ink-2': '#4F3F43', 'mut': '#76666A',
      'line': '#F0E6DE', 'line-2': '#E9DDD3',
      'sage': '#A05A4A', 'sage-2': '#8E4F40', 'sage-3': '#CD9087',
      'sage-deep': '#644150', 'sage-soft': '#F9EDE8', 'sage-line': '#EAC9BE',
      'sand': '#E4C3A3', 'sand-soft': '#FBE6D2', 'sand-ink': '#8A5A35', 'gold-1': '#C99A6E', 'gold-2': '#DDB48C',
      'rose': '#8A3F55', 'rose-2': '#B97A8B', 'rose-3': '#73344A', 'rose-soft': '#F4E1E6',
      'wallet': '#9A5A4A', 'wallet-2': '#644150',
    },
  },
  slate: {
    name: 'Slate', dark: false,
    vars: {
      'bg': '#F7F8FA', 'card-alt': '#FBFCFD', 'ink': '#24272B', 'ink-2': '#3A3F45',
      'mut': '#6B7179', 'line': '#ECEEF1', 'line-2': '#E3E6EA',
      'sage': '#52698A', 'sage-2': '#465C7B', 'sage-3': '#7E94AE',
      'sage-deep': '#3F5674', 'sage-soft': '#E4EAF2', 'sage-line': '#CDD9E6',
    },
  },
  techie: {
    name: 'Techie', dark: true,
    vars: {
      'bg': '#0C100D', 'card': '#141A15', 'card-alt': '#1A211B',
      'ink': '#E2EAE2', 'ink-2': '#C6D2C6', 'mut': '#7E8B7E', 'mut-2': '#5C665C',
      'line': '#222B23', 'line-2': '#293429',
      'sage': '#3FD97F', 'sage-2': '#2FB368', 'sage-3': '#6BE8A0',
      'sage-deep': '#8CEFB4', 'sage-soft': '#12301F', 'sage-line': '#1E4230',
      'rose-strong': '#FF6B6B', 'amber': '#E5C07B',
      'ocean': '#56B6C2', 'ocean-soft': '#1C2E33',
    },
  },
};

// Aliases that Tailwind consumes as `--c-*` r g b channel triplets.
const CHANNEL_KEYS = [
  'bg', 'card', 'card-alt', 'ink', 'ink-2', 'mut', 'line', 'line-2',
  'sage', 'sage-soft', 'sage-line',
  'rose', 'rose-soft', 'lavender', 'lavender-soft',
  'sand', 'sand-soft', 'sand-ink', 'ocean', 'ocean-soft', 'bluez', 'bluez-soft',
] as const;

// ── Color math (custom theme derivation) ───────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Mix `a` toward `b` by t (0..1). */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function deriveCustomVars(c: CustomTheme): Palette {
  const base = c.dark ? DARK_BASE : LIGHT_BASE;
  const a = /^#[0-9a-fA-F]{6}$/.test(c.accent) ? c.accent : '#49693E';
  return {
    'sage': a,
    'sage-2': mix(a, '#000000', 0.15),
    'sage-3': mix(a, '#FFFFFF', 0.18),
    'sage-deep': c.dark ? mix(a, '#FFFFFF', 0.3) : mix(a, '#000000', 0.28),
    'sage-soft': c.dark ? mix(a, base['bg'], 0.82) : mix(a, '#FFFFFF', 0.78),
    'sage-line': c.dark ? mix(a, base['bg'], 0.68) : mix(a, '#FFFFFF', 0.62),
  };
}

// ── Persistence ────────────────────────────────────────────────────────────
export function getThemeMode(): ThemeMode {
  const m = localStorage.getItem(MODE_KEY) as ThemeMode | null;
  if (m === 'auto' || m === 'custom' || (m && m in THEMES)) return m;
  return 'sage';
}
export function getCustomTheme(): CustomTheme {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.accent === 'string' && typeof p.dark === 'boolean') return p;
    }
  } catch { /* fall through */ }
  return { accent: '#49693E', dark: false };
}

// ── Apply ──────────────────────────────────────────────────────────────────
function resolve(mode: ThemeMode, custom: CustomTheme): { palette: Palette; dark: boolean } {
  let id: ThemeId = mode === 'auto'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'midnight' : 'sage')
    : mode;
  if (id === 'custom') {
    const base = custom.dark ? DARK_BASE : LIGHT_BASE;
    return { palette: { ...base, ...deriveCustomVars(custom) }, dark: custom.dark };
  }
  const def = THEMES[id] ?? THEMES.sage;
  const base = def.dark ? DARK_BASE : LIGHT_BASE;
  return { palette: { ...base, ...def.vars }, dark: def.dark };
}

function applyPalette(palette: Palette, dark: boolean) {
  const root = document.documentElement;
  for (const [alias, hex] of Object.entries(palette)) {
    root.style.setProperty(`--${alias}`, hex);
  }
  for (const key of CHANNEL_KEYS) {
    const [r, g, b] = hexToRgb(palette[key]);
    root.style.setProperty(`--c-${key}`, `${r} ${g} ${b}`);
  }
  // Light and depth (styles.css, tailwind shadows): shadows in the page's
  // own tone, a highlight on top edges, cards a touch lighter at the top, and
  // the wallet on Home in a deep shade of the accent.
  const accent = palette['sage'];
  const depth: Record<string, string> = dark ? {
    'shadow-rgb': '0 0 0', 'edge-hi': 'rgb(255 255 255 / 0.05)',
    'card-top': palette['card-alt'], 'card-bottom': palette['card'],
    'wallet': palette['wallet'] ?? mix(palette['card-alt'], accent, 0.2), 'wallet-2': palette['wallet-2'] ?? mix(palette['card'], accent, 0.1),
    'wallet-ink': palette['ink'], 'wallet-mut': 'rgb(236 234 228 / 0.72)', 'wallet-stitch': 'rgb(255 255 255 / 0.14)',
  } : {
    'shadow-rgb': '62 52 40', 'edge-hi': 'rgb(255 255 255 / 0.9)',
    'card-top': palette['card'], 'card-bottom': palette['card-alt'],
    'wallet': palette['wallet'] ?? mix(accent, '#1A1A18', 0.48), 'wallet-2': palette['wallet-2'] ?? mix(accent, '#1A1A18', 0.62),
    'wallet-ink': '#FBFAF6', 'wallet-mut': 'rgb(251 250 246 / 0.85)', 'wallet-stitch': 'rgb(255 255 255 / 0.24)',
  };
  for (const [name, value] of Object.entries(depth)) root.style.setProperty(`--${name}`, value);

  root.setAttribute('data-theme-dark', dark ? '1' : '0');
  root.style.colorScheme = dark ? 'dark' : 'light';
  // The page gardens repaint in the new colours (components/ui/Garden.tsx).
  window.dispatchEvent(new Event('wallette:theme'));

  // Browser chrome (web) — theme-color meta.
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = palette['bg'];

  // Native system bars — best-effort, never blocks the UI. SystemBars sets
  // the icon colour (Dark = light icons, for a dark bar) and keeps it on
  // rotation. A bar is only dark if the theme is dark AND the bar shows the
  // page; the cream behind padded older WebViews keeps dark icons.
  if (Capacitor.isNativePlatform()) {
    const darkBars = dark && barBackgrounds() === 'page';
    SystemBars.setStyle({ style: darkBars ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

/**
 * What shows behind the system bars (audit H6). The app draws edge to edge on
 * every Android version (MainActivity calls EdgeToEdge.enable, as Android 15+
 * does by itself):
 * - 'page': the page, painted by index.html in the theme colour. iOS, and
 *   Android with WebView 140 or newer, where Capacitor hands the insets to CSS.
 * - 'cream': the window background (#F9F3ED, styles.xml). Older WebViews get
 *   the insets as padding around the page instead, and that shows through.
 */
function barBackgrounds(): 'page' | 'cream' {
  if (Capacitor.getPlatform() !== 'android') return 'page';
  const webView = Number(/Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? 0);
  return webView >= 140 ? 'page' : 'cream';
}

let systemListener: ((e: MediaQueryListEvent) => void) | null = null;

function syncSystemListener(mode: ThemeMode) {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return;
  if (systemListener) {
    mq.removeEventListener('change', systemListener);
    systemListener = null;
  }
  if (mode === 'auto') {
    systemListener = () => {
      const { palette, dark } = resolve('auto', getCustomTheme());
      applyPalette(palette, dark);
    };
    mq.addEventListener('change', systemListener);
  }
}

/** Set + persist the theme. Pass `custom` when mode === 'custom'. */
export function setThemeMode(mode: ThemeMode, custom?: CustomTheme) {
  localStorage.setItem(MODE_KEY, mode);
  if (custom) localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  const { palette, dark } = resolve(mode, custom ?? getCustomTheme());
  applyPalette(palette, dark);
  syncSystemListener(mode);
}

/** Called once at boot (index.tsx) before React renders. */
export function initTheme() {
  const mode = getThemeMode();
  const { palette, dark } = resolve(mode, getCustomTheme());
  applyPalette(palette, dark);
  syncSystemListener(mode);
}

/** Swatch data for the picker UI. */
/** A preset theme's full palette, base and accent together (scripts/check-contrast.mjs reads it). */
export function themePalette(id: Exclude<ThemeId, 'custom'>): Palette {
  const def = THEMES[id];
  return { ...(def.dark ? DARK_BASE : LIGHT_BASE), ...def.vars };
}

export function themeSwatches(): { id: ThemeId; name: string; accent: string; bg: string; ink: string; dark: boolean }[] {
  const entries = (Object.keys(THEMES) as (keyof typeof THEMES)[]).map(id => {
    const def = THEMES[id];
    const base = def.dark ? DARK_BASE : LIGHT_BASE;
    const p = { ...base, ...def.vars };
    return { id: id as ThemeId, name: def.name, accent: p['sage'], bg: p['bg'], ink: p['ink'], dark: def.dark };
  });
  const c = getCustomTheme();
  const cBase = c.dark ? DARK_BASE : LIGHT_BASE;
  entries.push({ id: 'custom', name: 'Custom', accent: c.accent, bg: cBase['bg'], ink: cBase['ink'], dark: c.dark });
  return entries;
}
