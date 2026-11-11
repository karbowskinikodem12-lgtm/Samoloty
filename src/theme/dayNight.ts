import { MIN_PER_DAY } from '../engine/config';
import { MAP_DAY, MAP_NIGHT, THEME, type MapPalette } from '../render/theme';
import { CSS_DAY, CSS_NIGHT } from './cssPalette';

/**
 * Cykl dnia i nocy.
 *
 * Każde płynne przejście, w którym tło i tekst jednocześnie zamieniają się kolorami (jasne ↔ ciemne),
 * w pewnym momencie daje szary tekst na szarym tle. Dlatego kolory są podzielone na dwie grupy:
 *
 * 1. Tło mapy (morze, ląd, granice, mgła, poświata) — mieszane płynnie przez cały zmierzch/świt
 *    według „postępu nocy” p (0 = dzień, 1 = noc). To daje długie, łagodne ściemnianie.
 * 2. Wszystko, co trzeba czytać (nazwy, lotniska, trasy, samoloty, panele interfejsu) — nigdy nie jest
 *    mieszane. Do połowy przejścia obowiązuje wersja dzienna (ciemne na jasnym), potem nocna (jasne
 *    na ciemnym). Obwódki nazw i lotnisk są liczone z bieżącego koloru lądu i odcinają tekst od tła
 *    w każdej chwili. Panele zmieniają motyw krótkim przejściem CSS (ok. 0,3 s).
 */

export type ThemeMode = 'auto' | 'light' | 'dark';

/** Godziny przejść (w minutach doby). Zmierzch 5 h, świt 4 h czasu gry. */
const DUSK_START = 16 * 60 + 30;
const DUSK_END = 21 * 60 + 30;
const DAWN_START = 3 * 60 + 30;
const DAWN_END = 7 * 60 + 30;

/** Postęp nocy, przy którym czytelne elementy przechodzą z wersji dziennej na nocną (z histerezą). */
export const SWAP_ON = 0.52;
export const SWAP_OFF = 0.48;

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

/** Klucze mapy mieszane płynnie (tło). Pozostałe przełączane w połowie przejścia. */
const MAP_BG_KEYS: (keyof MapPalette)[] = ['background', 'ocean', 'land', 'coast', 'borders', 'graticule', 'fog', 'glow'];
/** Zmienne CSS mieszane płynnie (tło strony za mapą). */
const CSS_BG_KEYS = ['--map', '--veil'];

const mapPairs = (Object.keys(MAP_DAY) as (keyof MapPalette)[]).map((k) => [k, parse(MAP_DAY[k]), parse(MAP_NIGHT[k])] as const);
const cssPairs = Object.keys(CSS_DAY).map((k) => [k, parse(CSS_DAY[k]), parse(CSS_NIGHT[k])] as const);
const WHITE: RGBA = [255, 255, 255, 1];
const INK: RGBA = [10, 15, 24, 1];

let appliedKey = '';
let appliedDark: boolean | null = null;
let animTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ustawia kolory mapy i interfejsu.
 * @param p postęp nocy 0..1 (tło mapy)
 * @param dark czy czytelne elementy są w wersji nocnej
 */
export function applyTheme(p: number, dark: boolean): void {
  const pv = Math.round(Math.max(0, Math.min(1, p)) * 500) / 500;
  const key = `${pv}|${dark}`;
  if (key === appliedKey) return;
  appliedKey = key;

  for (const [k, day, night] of mapPairs) {
    if (MAP_BG_KEYS.includes(k)) THEME[k] = css(mix(day, night, pv));
    else THEME[k] = css(dark ? night : day);
  }
  // Obwódki: kolor lądu rozjaśniony (wersja dzienna) albo przyciemniony (nocna) — zawsze kontrastują z tekstem.
  const land = parse(THEME.land);
  const halo = dark ? mix(land, INK, 0.45) : mix(land, WHITE, 0.7);
  THEME.halo = css(halo);
  THEME.labelHalo = css([halo[0], halo[1], halo[2], 0.94]);
  THEME.cityAvailableFill = css(halo);

  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (appliedDark !== null && appliedDark !== dark) {
    // Krótkie przejście kolorów paneli tylko w chwili zmiany motywu (nie spowalnia zwykłych interakcji).
    root.classList.add('theme-anim');
    if (animTimer) clearTimeout(animTimer);
    animTimer = setTimeout(() => root.classList.remove('theme-anim'), 450);
  }
  appliedDark = dark;
  for (const [k, day, night] of cssPairs) {
    const c = CSS_BG_KEYS.includes(k) ? mix(day, night, pv) : dark ? night : day;
    root.style.setProperty(k, k === '--shadow-rgb' ? `${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}` : css(c));
  }
  root.style.setProperty('color-scheme', dark ? 'dark' : 'light');
  root.dataset.theme = dark ? 'dark' : 'light';
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
