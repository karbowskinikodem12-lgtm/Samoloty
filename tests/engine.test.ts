import { describe, expect, it } from 'vitest';
import { CITIES, CITY_BY_ID, START_CITIES } from '../src/data/cities';
import { EVENTS } from '../src/data/events';
import { REGIONS } from '../src/data/regions';
import {
  assignPlane, buyPlane, checkOpenRoute, closeRoute, openAirport, openRoute, sellPlane, unassignPlane, upgradeAirport,
} from '../src/engine/actions';
import { CONFIG, MIN_PER_DAY } from '../src/engine/config';
import { getModifiers, triggerRandomEvent } from '../src/engine/events';
import { cityDistance } from '../src/engine/geo';
import { getNetwork } from '../src/engine/network';
import { newGame } from '../src/engine/setup';
import { advance } from '../src/engine/simulation';
import { emptySink } from '../src/engine/util';

function basicGame() {
  const s = newGame('warsaw', 42);
  expect(openAirport(s, 'berlin').ok).toBe(true);
  const r = openRoute(s, 'warsaw', 'berlin');
  expect(r.ok).toBe(true);
  const plane = Object.values(s.planes)[0];
  expect(assignPlane(s, plane.id, r.ok ? r.id! : '').ok).toBe(true);
  return { s, routeId: r.ok ? r.id! : '', plane };
}

describe('dane', () => {
  it('miasta mają unikalne id i istniejące regiony', () => {
    const ids = new Set(CITIES.map((c) => c.id));
    expect(ids.size).toBe(CITIES.length);
    const regions = new Set(REGIONS.map((r) => r.id));
    for (const c of CITIES) expect(regions.has(c.region)).toBe(true);
    for (const id of START_CITIES) expect(CITY_BY_ID[id]).toBeDefined();
  });
  it('odległości są sensowne', () => {
    expect(cityDistance('warsaw', 'berlin')).toBeGreaterThan(480);
    expect(cityDistance('warsaw', 'berlin')).toBeLessThan(560);
    expect(cityDistance('london', 'new_york')).toBeGreaterThan(5400);
  });
});

describe('akcje', () => {
  it('nowa gra startuje z jednym lotniskiem i samolotem w hangarze', () => {
    const s = newGame('london', 1);
    expect(Object.keys(s.airports)).toEqual(['london']);
    expect(Object.values(s.planes)).toHaveLength(1);
    expect(Object.values(s.planes)[0].status).toBe('idle');
    expect(s.money).toBe(CONFIG.START_MONEY);
  });

  it('trasa bez samolotu nie generuje pasażerów', () => {
    const s = newGame('warsaw', 3);
    openAirport(s, 'berlin');
    openRoute(s, 'warsaw', 'berlin');
    advance(s, MIN_PER_DAY);
    expect(s.airports.warsaw.yesterday.spawned).toBe(0);
    expect(s.totals.lost).toBe(0);
  });

  it('nie pozwala otworzyć lotniska w zablokowanym regionie', () => {
    const s = newGame('warsaw', 1);
    const res = openAirport(s, 'new_york');
    expect(res.ok).toBe(false);
  });

  it('limit slotów blokuje kolejne trasy, rozbudowa go zwiększa', () => {
    const s = newGame('warsaw', 1);
    s.money = 10_000_000;
    for (const c of ['berlin', 'prague', 'vienna']) openAirport(s, c);
    expect(openRoute(s, 'warsaw', 'berlin').ok).toBe(true);
    expect(openRoute(s, 'warsaw', 'prague').ok).toBe(true);
    expect(checkOpenRoute(s, 'warsaw', 'vienna')).toMatch(/slot/);
    expect(upgradeAirport(s, 'warsaw').ok).toBe(true);
    expect(openRoute(s, 'warsaw', 'vienna').ok).toBe(true);
  });

  it('zasięg samolotu ogranicza przypisanie', () => {
    const s = newGame('madrid', 1);
    s.money = 10_000_000;
    openAirport(s, 'helsinki');
    const r = openRoute(s, 'madrid', 'helsinki');
    expect(r.ok).toBe(true);
    const plane = Object.values(s.planes)[0];
    const res = assignPlane(s, plane.id, r.ok ? r.id! : '');
    expect(res.ok).toBe(false);
  });

  it('zamknięcie trasy odsyła samoloty do hangaru', () => {
    const { s, routeId, plane } = basicGame();
    expect(closeRoute(s, routeId).ok).toBe(true);
    expect(plane.status).toBe('idle');
    expect(plane.routeId).toBeNull();
    expect(Object.keys(s.routes)).toHaveLength(0);
  });

  it('sprzedaż i zdejmowanie z trasy', () => {
    const { s, plane } = basicGame();
    expect(unassignPlane(s, plane.id).ok).toBe(true);
    expect(plane.status).toBe('idle');
    const before = s.money;
    expect(sellPlane(s, plane.id).ok).toBe(true);
    expect(s.money).toBeGreaterThan(before);
  });
});

describe('symulacja', () => {
  it('samoloty przewożą pasażerów i zarabiają', () => {
    const { s, routeId } = basicGame();
    const sink = advance(s, MIN_PER_DAY, emptySink());
    expect(s.routes[routeId].yesterday.flights).toBeGreaterThan(4);
    expect(s.totals.pax).toBeGreaterThan(50);
    expect(s.totals.revenue).toBeGreaterThan(0);
    expect(sink.arrivals.length).toBeGreaterThan(0);
    expect(s.history).toHaveLength(1);
  });

  it('pasażerowie przesiadają się w węźle', () => {
    const s = newGame('warsaw', 7);
    s.money = 10_000_000;
    openAirport(s, 'berlin');
    openAirport(s, 'prague');
    const r1 = openRoute(s, 'warsaw', 'berlin');
    const r2 = openRoute(s, 'berlin', 'prague');
    // Trasy bez samolotów nie tworzą sieci.
    expect(getNetwork(s).nodes).toHaveLength(0);
    const p1 = Object.values(s.planes)[0];
    assignPlane(s, p1.id, r1.ok ? r1.id! : '');
    buyPlane(s, 't70', r2.ok ? r2.id! : '');
    expect(getNetwork(s).nextHop['warsaw']['prague']).toBe('berlin');
    advance(s, MIN_PER_DAY * 2);
    expect(s.totals.pax).toBeGreaterThan(100);
    // Ktoś z Warszawy dotarł do Pragi przez Berlin — trasa Berlin–Praga wiozła pasażerów tranzytowych.
    expect(s.routes[r2.ok ? r2.id! : ''].yesterday.pax).toBeGreaterThan(0);
  });

  it('jest deterministyczna dla tego samego ziarna', () => {
    const a = basicGame().s;
    const b = basicGame().s;
    advance(a, MIN_PER_DAY * 3);
    advance(b, MIN_PER_DAY * 3);
    expect(a.money).toBeCloseTo(b.money, 6);
    expect(a.totals.pax).toBe(b.totals.pax);
  });

  it('zamknięte lotnisko wstrzymuje starty', () => {
    const { s, plane } = basicGame();
    s.events.push({ uid: 1, defId: 'strike', targetId: 'warsaw', start: s.time, end: s.time + 600 });
    s.eventRev++;
    expect(getModifiers(s).closed.has('warsaw')).toBe(true);
    advance(s, 300);
    expect(plane.status).toBe('boarding');
    expect(plane.flights).toBe(0);
  });

  it('wszystkie wydarzenia można wywołać', () => {
    for (const ev of EVENTS) {
      const { s } = basicGame();
      s.level = 5;
      s.totals.flights = 100;
      for (let i = 0; i < 3; i++) buyPlane(s, 't70');
      openAirport(s, 'prague');
      const sink = emptySink();
      triggerRandomEvent(s, sink, ev.id);
      expect(sink.notices.length, ev.id).toBe(1);
    }
  });

  it('długotrwałe ujemne saldo kończy grę', () => {
    const { s } = basicGame();
    s.money = -5_000_000;
    advance(s, MIN_PER_DAY * (CONFIG.BANKRUPTCY_DAYS + 1));
    expect(s.gameOver).toBe(true);
  });
});
