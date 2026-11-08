import { AIRCRAFT_BY_ID } from '../data/aircraft';
import { airportLevel } from '../data/airportLevels';
import { CITY_BY_ID } from '../data/cities';
import { CONFIG } from './config';
import { startLevel } from './cities';
import { getModifiers } from './modifiers';
import type { AircraftDef, GameState } from './types';
import { dayOf } from './util';

/** Cena biletu za jeden odcinek. */
export function fare(distance: number): number {
  return CONFIG.FARE_BASE + CONFIG.FARE_PER_KM * distance;
}

export function flightCost(type: AircraftDef, distance: number): number {
  return type.costPerFlight + type.costPerKm * distance;
}

/** Czas lotu w minutach. */
export function flightMinutes(type: AircraftDef, distance: number): number {
  return CONFIG.FLIGHT_OVERHEAD_MIN + (distance / type.speed) * 60;
}

const round5k = (v: number) => Math.round(v / 5000) * 5000;

export function airportOpenCost(cityId: string): number {
  const c = CITY_BY_ID[cityId];
  return round5k(
    CONFIG.AIRPORT_BASE_COST +
      CONFIG.AIRPORT_COST_PER_MLN * c.pop ** CONFIG.AIRPORT_COST_EXP +
      CONFIG.AIRPORT_START_LEVEL_PREMIUM * (startLevel(c) - 1),
  );
}

export function routeOpenCost(distance: number): number {
  return round5k(CONFIG.ROUTE_BASE_COST + CONFIG.ROUTE_COST_PER_KM * distance);
}

export function regionUnlockInfo(s: GameState): { cost: number; level: number } | null {
  return CONFIG.REGION_UNLOCK[s.unlockedRegions.length] ?? null;
}

export function planeResale(typeId: string): number {
  return Math.round(AIRCRAFT_BY_ID[typeId].price * CONFIG.PLANE_RESALE);
}

export function marketGrowth(s: GameState): number {
  return 1 + CONFIG.MARKET_GROWTH_MAX * Math.min(1, dayOf(s.time) / CONFIG.MARKET_GROWTH_DAYS);
}

export function reputationFactor(s: GameState): number {
  return CONFIG.REP_DEMAND_MIN + ((CONFIG.REP_DEMAND_MAX - CONFIG.REP_DEMAND_MIN) * s.reputation) / 100;
}

/** Dzienne koszty stałe (samoloty + lotniska), z uwzględnieniem wydarzeń (inflacja, podwyżki). */
export function dailyFixedCosts(s: GameState): { planes: number; airports: number } {
  const k = getModifiers(s).upkeep;
  let planes = 0;
  for (const p of Object.values(s.planes)) planes += AIRCRAFT_BY_ID[p.typeId].upkeep;
  let airports = 0;
  for (const a of Object.values(s.airports)) if (a.buildEnd === undefined) airports += airportLevel(a.level).upkeep;
  return { planes: Math.round(planes * k), airports: Math.round(airports * k) };
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < CONFIG.LEVEL_XP.length; i++) if (xp >= CONFIG.LEVEL_XP[i]) lvl = i + 1;
  return lvl;
}

export function levelProgress(s: GameState): { current: number; next: number | null; ratio: number } {
  const current = CONFIG.LEVEL_XP[s.level - 1] ?? 0;
  const next = CONFIG.LEVEL_XP[s.level] ?? null;
  if (next === null) return { current, next, ratio: 1 };
  return { current, next, ratio: Math.max(0, Math.min(1, (s.xp - current) / (next - current))) };
}
