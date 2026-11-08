import { MIN_PER_DAY } from '../engine/config';
import { MAP_DAY, MAP_DUSK, MAP_EVENING, MAP_NIGHT, THEME, type MapPalette } from '../render/theme';
import { CSS_DAY, CSS_DUSK, CSS_EVENING, CSS_NIGHT } from './cssPalette';

/**
 * Cykl dnia i nocy.
 *
 * Problem prostego mieszania: gdy tło i tekst zmieniają kolor jednocześnie, w połowie przejścia
 * oba są szare i nic nie widać. Dlatego przejście ma dwie warstwy:
 *
 * 1. „Postęp nocy” p (0..1) wynika z zegara gry i zmienia się powoli przez kilka godzin gry.
 *    Do p = 0,5 obowiązuje jasny motyw, którego tło stopniowo przygasa (dzień → zmierzch);
 *    od p = 0,5 ciemny motyw, który stopniowo się pogłębia (wczesna noc → noc).
 *    W obu połowach tekst ma pełny kontrast z tłem.
 * 2. Zamiana jasnego motywu na ciemny („swap”) odbywa się w czasie rzeczywistym w ok. 1,2 s,
 *    niezależnie od prędkości gry i pauzy — nigdy nie zatrzymuje się w nieczytelnym punkcie.
 */

export type ThemeMode = 'auto' | 'light' | 'dark';

/** Godziny przejść (w minutach doby). Zmierzch 5 h, świt 4 h czasu gry. */
const DUSK_START = 16 * 60 + 30;
const DUSK_END = 21 * 60 + 30;
const DAWN_START = 3 * 60 + 30;
const DAWN_END = 7 * 60 + 30;

/** Punkt, w którym jasny motyw zamienia się w ciemny. */
export const SWAP_POINT = 0.5;

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

const minuteOfDay = (time: number) => ((time % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;

/** Postęp nocy: 0 = pełny dzień, 1 = pełna noc, wartości pośrednie podczas zmierzchu i świtu. */
export function nightFactor(time: number): number {
  const m = minuteOfDay(time);
  if (m >= DAWN_END && m < DUSK_START) return 0;
  if (m >= DUSK_START && m < DUSK_END) return smooth((m - DUSK_START) / (DUSK_END - DUSK_START));
  if (m >= DAWN_START && m < DAWN_END) return 1 - smooth((m - DAWN_START) / (DAWN_END - DAWN_START));
  return 1;
}

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';

export function dayPhase(time: number): DayPhase {
  const m = minuteOfDay(time);
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

/** Cztery etapy palety: dzień, zmierzch (jasny), wczesna noc (ciemny), noc. */
type Stages = [RGBA, RGBA, RGBA, RGBA];

const mapStages: [keyof MapPalette, Stages][] = (Object.keys(MAP_DAY) as (keyof MapPalette)[]).map((k) => [
  k,
  [parse(MAP_DAY[k]), parse(MAP_DUSK[k]), parse(MAP_EVENING[k]), parse(MAP_NIGHT[k])],
]);
const cssStages: [string, Stages][] = Object.keys(CSS_DAY).map((k) => [
  k,
  [parse(CSS_DAY[k]), parse(CSS_DUSK[k]), parse(CSS_EVENING[k]), parse(CSS_NIGHT[k])],
]);

/** Kolor dla postępu nocy `p` i stanu zamiany motywu `swap` (0 = jasny, 1 = ciemny). */
function blend(st: Stages, p: number, swap: number): RGBA {
  const light = mix(st[0], st[1], Math.min(1, p / SWAP_POINT));
  const dark = mix(st[2], st[3], Math.max(0, (p - SWAP_POINT) / (1 - SWAP_POINT)));
  if (swap <= 0) return light;
  if (swap >= 1) return dark;
  return mix(light, dark, smooth(swap));
}

let appliedKey = '';

/** Ustawia kolory mapy i interfejsu. */
export function applyTheme(p: number, swap: number): void {
  const pv = Math.round(Math.max(0, Math.min(1, p)) * 500) / 500;
  const sv = Math.round(Math.max(0, Math.min(1, swap)) * 200) / 200;
  const key = `${pv}|${sv}`;
  if (key === appliedKey) return;
  appliedKey = key;
  for (const [k, st] of mapStages) THEME[k] = css(blend(st, pv, sv));
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  for (const [k, st] of cssStages) {
    const c = blend(st, pv, sv);
    root.setProperty(k, k === '--shadow-rgb' ? `${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}` : css(c));
  }
  const dark = sv > 0.5;
  root.setProperty('color-scheme', dark ? 'dark' : 'light');
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
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
