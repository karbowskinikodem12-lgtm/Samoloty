import { describe, expect, it } from 'vitest';
import { EVENT_VARIANT_COUNT, EVENTS } from '../src/data/events';
import { assignPlane, buyPlane, openRoute } from '../src/engine/actions';
import { MIN_PER_DAY } from '../src/engine/config';
import { createEventInstance, getModifiers, resolvePendingEvent, triggerEvent } from '../src/engine/events';
import { newGame } from '../src/engine/setup';
import { advance } from '../src/engine/simulation';
import type { GameState } from '../src/engine/types';
import { emptySink } from '../src/engine/util';
import { openAirportNow } from './helpers';

/** Gra w środkowej fazie: kilka lotnisk, tras, samolotów i historia przychodów. */
function midGame(seed = 11): GameState {
  const s = newGame('warsaw', seed);
  s.money = 20_000_000;
  s.level = 6;
  s.totals.flights = 200;
  for (const c of ['berlin', 'prague', 'vienna', 'krakow']) openAirportNow(s, c);
  const pairs = [['warsaw', 'berlin'], ['berlin', 'prague'], ['warsaw', 'krakow'], ['krakow', 'vienna']];
  pairs.forEach(([a, b], i) => {
    const r = openRoute(s, a, b);
    if (!r.ok) throw new Error(r.reason);
    if (i === 0) assignPlane(s, Object.keys(s.planes)[0], r.id!);
    else buyPlane(s, 't70', r.id);
  });
  advance(s, MIN_PER_DAY * 3);
  s.pendingEvents = [];
  s.loans.push({ id: 999, title: 'Test', perDay: 20_000, daysLeft: 20 });
  return s;
}

describe('katalog wydarzeń', () => {
  it('ma wszystkie kategorie, poziomy ważności i setki wariantów', () => {
    const cats = new Set(EVENTS.map((e) => e.category));
    expect(cats).toEqual(new Set(['economy', 'investors', 'competition', 'local', 'international', 'infrastructure']));
    const sev = new Set(EVENTS.map((e) => e.severity));
    expect(sev).toEqual(new Set(['minor', 'major', 'critical']));
    expect(new Set(EVENTS.map((e) => e.tone))).toEqual(new Set(['good', 'bad', 'neutral']));
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    expect(EVENTS.length).toBeGreaterThanOrEqual(60);
    expect(EVENT_VARIANT_COUNT).toBeGreaterThanOrEqual(200);
    expect(EVENTS.filter((e) => e.choices).length).toBeGreaterThanOrEqual(25);
  });

  it('każde wydarzenie i każda decyzja działa i ma opisane konsekwencje', () => {
    for (const def of EVENTS) {
      const base = midGame();
      const inst = createEventInstance(base, def);
      expect(inst, def.id).not.toBeNull();
      if (def.choices) {
        expect(inst!.choices!.length).toBe(def.choices.length);
        def.choices.forEach((_, i) => {
          const s = structuredClone(base);
          const fired = triggerEvent(s, def.id, emptySink(), inst!.targetId)!;
          expect(s.pendingEvents).toHaveLength(1);
          expect(fired.choices![i].lines.length, `${def.id}#${i}`).toBeGreaterThan(0);
          expect(resolvePendingEvent(s, fired.uid, i)).toBe(true);
          expect(s.pendingEvents).toHaveLength(0);
          expect(Number.isFinite(s.money)).toBe(true);
          advance(s, 600);
        });
      } else {
        const s = structuredClone(base);
        const sink = emptySink();
        const fired = triggerEvent(s, def.id, sink, inst!.targetId)!;
        expect(fired.lines!.length, def.id).toBeGreaterThan(0);
        if (def.severity === 'minor') expect(sink.notices.length, def.id).toBe(1);
        else expect(s.pendingEvents.length, def.id).toBe(1);
        expect(Number.isFinite(s.money)).toBe(true);
      }
    }
  });
});

describe('skutki wydarzeń', () => {
  it('kredyt wypłaca kwotę od razu i pobiera raty o północy', () => {
    const s = midGame();
    s.loans = [];
    const inst = triggerEvent(s, 'inv_bank_loan', emptySink())!;
    const before = s.money;
    resolvePendingEvent(s, inst.uid, 0);
    const loan = inst.choices![0].effects.loan!;
    expect(s.money).toBeCloseTo(before + loan.amount, 0);
    expect(s.loans).toHaveLength(1);
    const days = s.loans[0].daysLeft;
    advance(s, MIN_PER_DAY);
    expect(s.loans[0].daysLeft).toBe(days - 1);
    expect(s.history[s.history.length - 1].financing).toBeGreaterThanOrEqual(loan.perDay);
  });

  it('udział inwestora zmniejsza przychody, a opóźnienia wydłużają obsługę', () => {
    const s = midGame();
    s.events.push({ uid: 1, defId: 't', title: 't', tone: 'bad', category: 'investors', targetId: null, scope: 'global', start: s.time, end: s.time + 6000, mods: { revenue: 0.9, turnaround: 2 } });
    s.eventRev++;
    const m = getModifiers(s);
    expect(m.revenue).toBeCloseTo(0.9);
    expect(m.turnaroundGlobal).toBe(2);
  });

  it('zamknięcie regionu zamyka wszystkie jego lotniska', () => {
    const s = midGame();
    triggerEvent(s, 'int_airspace', emptySink(), 'europe');
    const m = getModifiers(s);
    expect(m.closed.has('warsaw')).toBe(true);
    expect(m.closed.has('vienna')).toBe(true);
  });

  it('ważne wydarzenia czekają w kolejce, drobne trafiają do powiadomień', () => {
    const s = midGame();
    const sink = emptySink();
    triggerEvent(s, 'loc_festival', sink);
    expect(sink.notices).toHaveLength(1);
    expect(s.pendingEvents).toHaveLength(0);
    triggerEvent(s, 'eco_global_boom', sink);
    expect(s.pendingEvents).toHaveLength(1);
  });

  it('w długiej grze pojawiają się wydarzenia różnych kategorii', () => {
    const s = midGame(3);
    const seen = new Set<string>();
    for (let d = 0; d < 40; d++) {
      advance(s, MIN_PER_DAY);
      for (const e of s.pendingEvents) seen.add(e.category);
      for (const e of [...s.pendingEvents]) resolvePendingEvent(s, e.uid, 0);
      for (const e of s.events) seen.add(e.category);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});
