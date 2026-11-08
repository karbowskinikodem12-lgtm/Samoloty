import { airportLevel } from '../data/airportLevels';
import { CITY_BY_ID } from '../data/cities';
import { CONFIG } from './config';
import { marketGrowth, reputationFactor } from './economy';
import { demandModifier, getModifiers } from './events';
import { getNetwork } from './network';
import { random } from './rng';
import type { GameState } from './types';
import { clamp, sumValues } from './util';

interface DestTable {
  ref: GameState;
  key: string;
  /** origin → [celów, skumulowane wagi] */
  table: Record<string, { dests: string[]; cum: number[] }>;
}

let destCache: DestTable | null = null;

function destinations(s: GameState): DestTable['table'] {
  const key = `${s.netRev}:${s.eventRev}`;
  if (destCache && destCache.ref === s && destCache.key === key) return destCache.table;
  const net = getNetwork(s);
  const mods = getModifiers(s);
  const table: DestTable['table'] = {};
  for (const origin of net.nodes) {
    const dests = net.reachable[origin];
    const cum: number[] = [];
    let total = 0;
    for (const d of dests) {
      const dist = net.pathCost[origin][d];
      total += (CITY_BY_ID[d].pop ** CONFIG.DEST_POP_EXP / (1 + dist / CONFIG.DEST_DIST_SCALE)) * demandModifier(mods, d);
      cum.push(total);
    }
    table[origin] = { dests, cum };
  }
  destCache = { ref: s, key, table };
  return table;
}

/** Popyt (pasażerów na godzinę) generowany przez lotnisko. */
export function demandPerHour(s: GameState, cityId: string): number {
  const ap = s.airports[cityId];
  if (!ap) return 0;
  const net = getNetwork(s);
  const reach = net.reachable[cityId]?.length ?? 0;
  if (reach === 0) return 0;
  const connectivity = Math.min(CONFIG.CONNECTIVITY_MAX, CONFIG.CONNECTIVITY_BASE + CONFIG.CONNECTIVITY_PER_DEST * reach);
  return (
    CONFIG.DEMAND_BASE *
    Math.sqrt(CITY_BY_ID[cityId].pop) *
    airportLevel(ap.level).demand *
    reputationFactor(s) *
    marketGrowth(s) *
    connectivity *
    demandModifier(getModifiers(s), cityId)
  );
}

export function waitingTotal(s: GameState, cityId: string): number {
  const ap = s.airports[cityId];
  return ap ? sumValues(ap.waiting) : 0;
}

/** Dodaje pasażerów do terminalu z kontrolą pojemności. Zwraca liczbę tych, którzy się nie zmieścili. */
export function addWaiting(s: GameState, cityId: string, dest: string, count: number): number {
  const ap = s.airports[cityId];
  if (!ap || count <= 0) return count;
  const room = Math.max(0, airportLevel(ap.level).capacity - sumValues(ap.waiting));
  const accepted = Math.min(room, count);
  if (accepted > 0) ap.waiting[dest] = (ap.waiting[dest] ?? 0) + accepted;
  return count - accepted;
}

export function losePassengers(s: GameState, cityId: string, count: number): void {
  if (count <= 0) return;
  const ap = s.airports[cityId];
  if (ap) ap.today.lost += count;
  s.today.lost += count;
  s.totals.lost += count;
}

/** Docelowa reputacja wynikająca z jakości obsługi w ostatniej dobie (lub null, gdy brak danych). */
export function serviceTarget(s: GameState): number | null {
  let served = 0;
  let lost = 0;
  for (const ap of Object.values(s.airports)) {
    served += ap.today.departed + ap.yesterday.departed;
    lost += ap.today.lost + ap.yesterday.lost;
  }
  if (served + lost < 30) return null;
  const ratio = served / (served + lost * CONFIG.REP_LOST_WEIGHT);
  return CONFIG.REP_TARGET_MIN + (CONFIG.REP_TARGET_MAX - CONFIG.REP_TARGET_MIN) * ratio;
}

export function updateReputation(s: GameState, dt: number): void {
  const target = serviceTarget(s);
  if (target === null) return;
  const k = Math.min(1, dt / (CONFIG.REP_TIME_CONSTANT_H * 60));
  s.reputation = clamp(s.reputation + (target - s.reputation) * k, 0, 100);
}

/** Generuje nowych pasażerów we wszystkich lotniskach za `dt` minut. */
export function spawnPassengers(s: GameState, dt: number): void {
  const table = destinations(s);
  for (const ap of Object.values(s.airports)) {
    const entry = table[ap.cityId];
    if (!entry || entry.dests.length === 0) {
      ap.spawnAcc = 0;
      continue;
    }
    ap.spawnAcc += (demandPerHour(s, ap.cityId) * dt) / 60;
    const n = Math.floor(ap.spawnAcc);
    if (n <= 0) continue;
    ap.spawnAcc -= n;
    const total = entry.cum[entry.cum.length - 1];
    let lost = 0;
    for (let i = 0; i < n; i++) {
      const r = random(s) * total;
      let k = 0;
      while (k < entry.cum.length - 1 && entry.cum[k] < r) k++;
      lost += addWaiting(s, ap.cityId, entry.dests[k], 1);
    }
    ap.today.spawned += n;
    losePassengers(s, ap.cityId, lost);
  }
}

/** Usuwa pasażerów, którzy nie mają już jak dotrzeć do celu (np. po zamknięciu trasy). */
export function dropUnreachable(s: GameState): void {
  const net = getNetwork(s);
  for (const ap of Object.values(s.airports)) {
    const hops = net.nextHop[ap.cityId] ?? {};
    for (const dest of Object.keys(ap.waiting)) {
      if (!hops[dest]) delete ap.waiting[dest];
    }
  }
}
