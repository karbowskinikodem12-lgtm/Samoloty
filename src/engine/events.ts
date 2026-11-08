import { CITY_BY_ID } from '../data/cities';
import { EVENT_BY_ID, EVENTS } from '../data/events';
import { REGION_BY_ID } from '../data/regions';
import { CONFIG } from './config';
import { regionsInNetwork } from './network';
import { pickWeighted, randRange } from './rng';
import type { ActiveEvent, EventDef, GameState, SimSink } from './types';
import { clamp, log } from './util';

/** Zagregowane modyfikatory aktywnych wydarzeń. */
export interface Modifiers {
  ref: GameState;
  rev: number;
  demandCity: Record<string, number>;
  demandRegion: Record<string, number>;
  demandGlobal: number;
  fuel: number;
  fare: number;
  closed: Set<string>;
}

let cached: Modifiers | null = null;

export function getModifiers(s: GameState): Modifiers {
  if (cached && cached.ref === s && cached.rev === s.eventRev) return cached;
  const m: Modifiers = {
    ref: s, rev: s.eventRev, demandCity: {}, demandRegion: {}, demandGlobal: 1, fuel: 1, fare: 1, closed: new Set(),
  };
  for (const ev of s.events) {
    const def = EVENT_BY_ID[ev.defId];
    if (!def) continue;
    const e = def.effects;
    if (e.demand !== undefined) {
      if (def.target === 'city' && ev.targetId) m.demandCity[ev.targetId] = (m.demandCity[ev.targetId] ?? 1) * e.demand;
      else if (def.target === 'region' && ev.targetId) m.demandRegion[ev.targetId] = (m.demandRegion[ev.targetId] ?? 1) * e.demand;
      else m.demandGlobal *= e.demand;
    }
    if (e.fuel !== undefined) m.fuel *= e.fuel;
    if (e.fare !== undefined) m.fare *= e.fare;
    if (e.closed && ev.targetId) m.closed.add(ev.targetId);
  }
  cached = m;
  return m;
}

/** Mnożnik popytu dla miasta (miasto × region × globalnie). */
export function demandModifier(m: Modifiers, cityId: string): number {
  return (m.demandCity[cityId] ?? 1) * (m.demandRegion[CITY_BY_ID[cityId].region] ?? 1) * m.demandGlobal;
}

export function describeEvent(def: EventDef, targetId: string | null): string {
  let text = def.text;
  if (targetId && def.target === 'city') text = text.replaceAll('{city}', CITY_BY_ID[targetId]?.name ?? targetId);
  if (targetId && def.target === 'region') text = text.replaceAll('{region}', REGION_BY_ID[targetId]?.name ?? targetId);
  return text;
}

export function eventTargetName(def: EventDef, targetId: string | null): string {
  if (!targetId) return 'Cały świat';
  if (def.target === 'city') return CITY_BY_ID[targetId]?.name ?? targetId;
  if (def.target === 'region') return REGION_BY_ID[targetId]?.name ?? targetId;
  return 'Cały świat';
}

/** Wygasza zakończone wydarzenia i co jakiś czas losuje nowe. */
export function updateEvents(s: GameState, sink: SimSink): void {
  const before = s.events.length;
  s.events = s.events.filter((e) => e.end > s.time);
  if (s.events.length !== before) s.eventRev++;

  if (s.time < s.nextEventAt) return;
  s.nextEventAt = s.time + randRange(s, CONFIG.EVENT_INTERVAL_H[0], CONFIG.EVENT_INTERVAL_H[1]) * 60;
  triggerRandomEvent(s, sink);
}

export function triggerRandomEvent(s: GameState, sink: SimSink, forcedId?: string): ActiveEvent | null {
  const cities = Object.keys(s.airports).filter((id) => s.airports[id].buildEnd === undefined);
  if (cities.length < 2 && !forcedId) return null;
  const active = new Set(s.events.map((e) => e.defId));
  const pool = forcedId
    ? EVENTS.filter((e) => e.id === forcedId)
    : EVENTS.filter((e) => !active.has(e.id) && (!e.condition || e.condition(s)));
  const def = pickWeighted(s, pool, (e) => e.weight);
  if (!def) return null;

  let targetId: string | null = null;
  if (def.target === 'city') {
    const busy = new Set(s.events.map((e) => e.targetId));
    targetId = pickWeighted(s, cities.filter((c) => !busy.has(c)), (c) => Math.sqrt(CITY_BY_ID[c].pop)) ?? null;
    if (!targetId) return null;
  } else if (def.target === 'region') {
    targetId = pickWeighted(s, [...regionsInNetwork(s)], () => 1) ?? null;
    if (!targetId) return null;
  }

  const e = def.effects;
  if (e.cash !== undefined) {
    const amount = Math.round(typeof e.cash === 'function' ? e.cash(s) : e.cash);
    s.money += amount;
    s.today.bonus += amount;
  }
  if (e.reputation !== undefined) s.reputation = clamp(s.reputation + e.reputation, 0, 100);

  const hours = randRange(s, def.duration[0], def.duration[1]);
  let ev: ActiveEvent | null = null;
  if (hours > 0) {
    ev = { uid: ++s.nextId, defId: def.id, targetId, start: s.time, end: s.time + hours * 60 };
    s.events.push(ev);
    s.eventRev++;
  }
  log(s, def.tone === 'bad' ? 'bad' : 'event', def.title, describeEvent(def, targetId), sink);
  return ev;
}
