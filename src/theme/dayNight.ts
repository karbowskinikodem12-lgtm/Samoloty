import { MIN_PER_DAY } from '../engine/config';
import { MAP_DAY, MAP_NIGHT, THEME, type MapPalette } from '../render/theme';
import { CSS_DAY, CSS_NIGHT } from './cssPalette';

/**
 * Cykl dnia i nocy. Pora dnia w grze wyznacza „noc” 0..1: dzień 0, noc 1, z płynnym
 * zmierzchem i świtem. Wartość miesza palety mapy i interfejsu.
 */

export type ThemeMode = 'auto' | 'light' | 'dark';

/** Godziny przejść (w minutach doby). */
const DUSK_START = 18 * 60 + 30;
const DUSK_END = 20 * 60;
const DAWN_START = 5 * 60 + 30;
const DAWN_END = 7 * 60;

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** 0 = pełny dzień, 1 = pełna noc. */
export function nightFactor(time: number): number {
  const m = ((time % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  if (m >= DAWN_END && m < DUSK_START) return 0;
  if (m >= DUSK_START && m < DUSK_END) return smooth((m - DUSK_START) / (DUSK_END - DUSK_START));
  if (m >= DAWN_START && m < DAWN_END) return 1 - smooth((m - DAWN_START) / (DAWN_END - DAWN_START));
  return 1;
}

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';

export function dayPhase(time: number): DayPhase {
  const m = ((time % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  if (m >= DAWN_END && m < DUSK_START) return 'day';
  if (m >= DUSK_START && m < DUSK_END) return 'dusk';
  if (m >= DAWN_START && m < DAWN_END) return 'dawn';
  return 'night';
}

// ---------- Mieszanie kolorów ----------

type RGBA = [number, number, number, number];

function parse(color: string): RGBA {
  const c = color.trim();
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/[\d.]+/g);
  if (!m) return [0, 0, 0, 1];
  const v = m.map(Number);
  return [v[0], v[1], v[2], v[3] ?? 1];
}

function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

const css = (c: RGBA) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${c[3].toFixed(3)})`;

const mapKeys = Object.keys(MAP_DAY) as (keyof MapPalette)[];
const mapPairs = mapKeys.map((k) => [k, parse(MAP_DAY[k]), parse(MAP_NIGHT[k])] as const);
const cssPairs = Object.keys(CSS_DAY).map((k) => [k, parse(CSS_DAY[k]), parse(CSS_NIGHT[k])] as const);

let applied = -1;

/** Ustawia kolory mapy i interfejsu dla danej wartości „nocy” (0..1). */
export function applyTheme(t: number): void {
  const v = Math.round(Math.max(0, Math.min(1, t)) * 400) / 400;
  if (v === applied) return;
  applied = v;
  for (const [k, a, b] of mapPairs) THEME[k] = css(mix(a, b, v));
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  for (const [k, a, b] of cssPairs) {
    const c = mix(a, b, v);
    root.setProperty(k, k === '--shadow-rgb' ? `${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}` : css(c));
  }
  root.setProperty('color-scheme', v > 0.5 ? 'dark' : 'light');
  document.documentElement.dataset.theme = v > 0.5 ? 'dark' : 'light';
}

/** Kolor z dodaną przezroczystością (działa dla #hex i rgba()). */
export function fade(color: string, alpha: number): string {
  const c = parse(color);
  return css([c[0], c[1], c[2], c[3] * alpha]);
}

const MODE_KEY = 'contrail-theme';

export function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* brak dostępu do localStorage */
  }
}
