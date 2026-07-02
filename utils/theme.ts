// Theme engine — Wall-ette themes.
// Every color in the app resolves through CSS variables set here on <html>.
// Tailwind's palette (tailwind.config.cjs) reads the `--c-*` channel vars so
// utility classes (bg-white, text-sage, …) follow the active theme, and
// inline SVG/chart colors read the `--*` hex aliases directly.
import { Capacitor } from '@capacitor/core';
import { log } from './log';

export type ThemeId = 'sage' | 'midnight' | 'slate' | 'terra' | 'techie' | 'custom';
export type ThemeMode = ThemeId | 'auto';

export interface CustomTheme {
  accent: string; // hex like #9BAE93
  dark: boolean;
}

type Palette = Record<string, string>; // css alias -> hex

const MODE_KEY = 'walletThemeMode';
const CUSTOM_KEY = 'walletThemeCustom';

// ── Neutral bases ──────────────────────────────────────────────────────────
const LIGHT_BASE: Palette = {
  'bg': '#FAF9F6', 'card': '#FFFFFF', 'card-alt': '#FDFBF7',
  'ink': '#333333', 'ink-2': '#4A4947', 'mut': '#8E8D8A', 'mut-2': '#B9B7B2',
  'line': '#EFEDE8', 'line-2': '#E8E5DE',
  'rose': '#D4A5A5', 'rose-2': '#E8A5A5', 'rose-3': '#C98989', 'rose-strong': '#E57373', 'rose-soft': '#F5E6E6',
  'sand': '#D6C6B2', 'sand-soft': '#F4EFE9', 'gold-1': '#C4A98E', 'gold-2': '#D4B896',
  'amber': '#FBBF24', 'amber-2': '#F5D485', 'amber-3': '#F59E42',
  'lavender': '#B8B5D0', 'lavender-soft': '#EBEAF2',
  'ocean': '#9CB5C1', 'ocean-soft': '#E6EEF2',
  'bluez': '#A7BBC7', 'bluez-soft': '#E6EEF2',
};

const DARK_BASE: Palette = {
  'bg': '#141413', 'card': '#1E1E1C', 'card-alt': '#242422',
  'ink': '#ECEAE4', 'ink-2': '#D6D4CE', 'mut': '#98968F', 'mut-2': '#6E6C66',
  'line': '#2B2B28', 'line-2': '#32322E',
  'rose': '#D4A5A5', 'rose-2': '#E8A5A5', 'rose-3': '#C98989', 'rose-strong': '#E57373', 'rose-soft': '#3A2A2A',
  'sand': '#C9B69C', 'sand-soft': '#312B22', 'gold-1': '#C4A98E', 'gold-2': '#D4B896',
  'amber': '#E0B33C', 'amber-2': '#C9A94F', 'amber-3': '#E09A50',
  'lavender': '#B4B0CE', 'lavender-soft': '#2C2A38',
  'ocean': '#96B0BD', 'ocean-soft': '#253035',
  'bluez': '#A0B5C2', 'bluez-soft': '#253035',
};

// ── Preset accents (sage-* aliases are the app's "accent" slots) ──────────
interface ThemeDef { name: string; dark: boolean; vars: Palette; }

export const THEMES: Record<Exclude<ThemeId, 'custom'>, ThemeDef> = {
  sage: {
    name: 'Sage', dark: false,
    vars: {
      'sage': '#9BAE93', 'sage-2': '#8B9E82', 'sage-3': '#A8B89E',
      'sage-deep': '#7D937A', 'sage-soft': '#E3EAE0', 'sage-line': '#D1DDCB',
    },
  },
  midnight: {
    name: 'Midnight', dark: true,
    vars: {
      'sage': '#9BAE93', 'sage-2': '#86997E', 'sage-3': '#B4C4AB',
      'sage-deep': '#B9CCB0', 'sage-soft': '#273226', 'sage-line': '#39463A',
    },
  },
  slate: {
    name: 'Slate', dark: false,
    vars: {
      'bg': '#F7F8FA', 'card-alt': '#FBFCFD', 'ink': '#24272B', 'ink-2': '#3A3F45',
      'mut': '#7C838C', 'line': '#ECEEF1', 'line-2': '#E3E6EA',
      'sage': '#647E9C', 'sage-2': '#54708E', 'sage-3': '#7E94AE',
      'sage-deep': '#4E6884', 'sage-soft': '#E4EAF2', 'sage-line': '#CDD9E6',
    },
  },
  terra: {
    name: 'Terra', dark: false,
    vars: {
      'bg': '#FBF6F0', 'card-alt': '#FDF9F4', 'ink': '#3A3230', 'ink-2': '#4E4542',
      'mut': '#97897F', 'line': '#F0E7DC', 'line-2': '#EADFD2',
      'sage': '#C0764F', 'sage-2': '#A9633F', 'sage-3': '#D08F6C',
      'sage-deep': '#9C5A38', 'sage-soft': '#F4E2D6', 'sage-line': '#E8CDBC',
      'sand': '#D2A65B', 'sand-soft': '#F6ECD9',
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
  'sand', 'sand-soft', 'ocean', 'ocean-soft', 'bluez', 'bluez-soft',
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
  const a = /^#[0-9a-fA-F]{6}$/.test(c.accent) ? c.accent : '#9BAE93';
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
  return { accent: '#9BAE93', dark: false };
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
  root.setAttribute('data-theme-dark', dark ? '1' : '0');
  root.style.colorScheme = dark ? 'dark' : 'light';

  // Browser chrome (web) — theme-color meta.
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = palette['bg'];

  // Android status bar (native) — best-effort, never blocks the UI.
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => {
        StatusBar.setBackgroundColor({ color: palette['bg'] }).catch(() => {});
        // Style.Dark = light icons for dark backgrounds, and vice versa.
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      })
      .catch(() => log.warn('StatusBar plugin unavailable'));
  }
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
