import { CITY_BY_ID } from '../data/cities';
import type { GameState } from './types';

/**
 * Zagregowane modyfikatory aktywnych wydarzeń. Liczone raz na zmianę listy wydarzeń (eventRev)
 * i używane przez symulację (popyt, ceny, koszty, obsługa naziemna, zamknięcia lotnisk).
 */
export interface Modifiers {
  ref: GameState;
  rev: number;
  demandCity: Record<string, number>;
  demandRegion: Record<string, number>;
  demandGlobal: number;
  fareRegion: Record<string, number>;
  fareGlobal: number;
  fuel: number;
  upkeep: number;
  revenue: number;
  turnaroundCity: Record<string, number>;
  turnaroundRegion: Record<string, number>;
  turnaroundGlobal: number;
  closed: Set<string>;
  closedRegions: Set<string>;
}

let cached: Modifiers | null = null;

const mul = (rec: Record<string, number>, key: string, v: number) => {
  rec[key] = (rec[key] ?? 1) * v;
};

export function getModifiers(s: GameState): Modifiers {
  if (cached && cached.ref === s && cached.rev === s.eventRev) return cached;
  const m: Modifiers = {
    ref: s,
    rev: s.eventRev,
    demandCity: {},
    demandRegion: {},
    demandGlobal: 1,
    fareRegion: {},
    fareGlobal: 1,
    fuel: 1,
    upkeep: 1,
    revenue: 1,
    turnaroundCity: {},
    turnaroundRegion: {},
    turnaroundGlobal: 1,
    closed: new Set(),
    closedRegions: new Set(),
  };
  for (const ev of s.events) {
    const x = ev.mods;
    if (!x) continue;
    const t = ev.targetId;
    const scope = t ? ev.scope : 'global';
    if (x.demand !== undefined) {
      if (scope === 'city') mul(m.demandCity, t!, x.demand);
      else if (scope === 'region') mul(m.demandRegion, t!, x.demand);
      else m.demandGlobal *= x.demand;
    }
    if (x.fare !== undefined) {
      if (scope === 'region') mul(m.fareRegion, t!, x.fare);
      else if (scope === 'city') mul(m.fareRegion, CITY_BY_ID[t!]?.region ?? '', x.fare);
      else m.fareGlobal *= x.fare;
    }
    if (x.turnaround !== undefined) {
      if (scope === 'city') mul(m.turnaroundCity, t!, x.turnaround);
      else if (scope === 'region') mul(m.turnaroundRegion, t!, x.turnaround);
      else m.turnaroundGlobal *= x.turnaround;
    }
    if (x.fuel !== undefined) m.fuel *= x.fuel;
    if (x.upkeep !== undefined) m.upkeep *= x.upkeep;
    if (x.revenue !== undefined) m.revenue *= x.revenue;
    if (x.closed && t) {
      if (scope === 'region') m.closedRegions.add(t);
      else m.closed.add(t);
    }
  }
  if (m.closedRegions.size) {
    for (const id of Object.keys(s.airports)) if (m.closedRegions.has(CITY_BY_ID[id].region)) m.closed.add(id);
  }
  cached = m;
  return m;
}

/** Mnożnik popytu dla miasta (miasto × region × globalnie). */
export function demandModifier(m: Modifiers, cityId: string): number {
  return (m.demandCity[cityId] ?? 1) * (m.demandRegion[CITY_BY_ID[cityId].region] ?? 1) * m.demandGlobal;
}

/** Mnożnik ceny biletu dla odcinka wylatującego z danego miasta. */
export function fareModifier(m: Modifiers, cityId: string): number {
  return (m.fareRegion[CITY_BY_ID[cityId].region] ?? 1) * m.fareGlobal;
}

/** Mnożnik czasu obsługi naziemnej w danym mieście (opóźnienia, ograniczenia). */
export function turnaroundModifier(m: Modifiers, cityId: string): number {
  return (m.turnaroundCity[cityId] ?? 1) * (m.turnaroundRegion[CITY_BY_ID[cityId].region] ?? 1) * m.turnaroundGlobal;
}
