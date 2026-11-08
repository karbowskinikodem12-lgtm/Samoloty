import { CITY_BY_ID } from '../data/cities';
import { CONFIG, MIN_PER_DAY } from './config';
import type { Airport, CityDef, GameState } from './types';

/**
 * Cechy miast wyliczane z danych (populacja, hub, turystyka). Dzięki temu nowe miasto
 * wymaga tylko wpisu w data/cities.ts, a jego rola w grze wynika z wielkości.
 */

export type CityTier = 1 | 2 | 3 | 4;

export const TIER_NAMES: Record<CityTier, string> = {
  1: 'Lotnisko lokalne',
  2: 'Ośrodek regionalny',
  3: 'Duże miasto',
  4: 'Metropolia',
};

export function cityTier(c: CityDef): CityTier {
  let t: CityTier = c.pop >= 12 ? 4 : c.pop >= 4 ? 3 : c.pop >= 1 ? 2 : 1;
  if (c.hub && t < 3) t = 3;
  return t;
}

/** Poziom, na którym lotnisko startuje po otwarciu (istniejąca infrastruktura). */
export function startLevel(c: CityDef): number {
  const base = cityTier(c) >= 3 ? 2 : 1;
  return Math.min(3, base + (c.hub ? 1 : 0));
}

/** Najwyższy możliwy poziom rozbudowy w danym mieście. */
export function maxLevel(c: CityDef): number {
  if (c.hub) return 5;
  return [0, 2, 3, 4, 5][cityTier(c)];
}

/** Czas budowy i otwarcia lotniska w dniach gry. */
export function buildDays(c: CityDef): number {
  return CONFIG.BUILD_DAYS_BASE + CONFIG.BUILD_DAYS_PER_TIER * cityTier(c) + CONFIG.BUILD_DAYS_PER_LEVEL * (startLevel(c) - 1);
}

export const buildMinutes = (c: CityDef) => Math.round(buildDays(c) * MIN_PER_DAY);

/** Siła przyciągania podróżnych (używana dla popytu wylotowego). */
export function attraction(c: CityDef): number {
  return Math.sqrt(c.pop) * (c.tourism ?? 1);
}

/** Waga miasta jako celu podróży. */
export function destinationWeight(c: CityDef): number {
  return c.pop ** CONFIG.DEST_POP_EXP * (c.tourism ?? 1);
}

/** Bazowy potencjał pasażerów na dobę (przed reputacją, poziomem lotniska i efektem sieci). */
export function potentialPerDay(c: CityDef): number {
  return CONFIG.DEMAND_BASE * attraction(c) * 24;
}

export const isOpen = (ap: Airport | undefined): ap is Airport => !!ap && ap.buildEnd === undefined;
export const isBuilding = (ap: Airport | undefined): boolean => !!ap && ap.buildEnd !== undefined;

export function openAirports(s: GameState): Airport[] {
  return Object.values(s.airports).filter((a) => a.buildEnd === undefined);
}

/** Postęp budowy 0..1 i pozostały czas w minutach. */
export function buildProgress(s: GameState, ap: Airport): { ratio: number; left: number } {
  if (ap.buildEnd === undefined || ap.buildStart === undefined) return { ratio: 1, left: 0 };
  const total = Math.max(1, ap.buildEnd - ap.buildStart);
  return { ratio: Math.max(0, Math.min(1, (s.time - ap.buildStart) / total)), left: Math.max(0, ap.buildEnd - s.time) };
}

export const cityOf = (id: string) => CITY_BY_ID[id];
