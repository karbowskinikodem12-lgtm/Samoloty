import { describe, expect, it } from 'vitest';
import { CITIES, CITY_BY_ID, START_CITIES } from '../src/data/cities';
import { REGIONS } from '../src/data/regions';
import {
  assignPlane, buyPlane, checkOpenRoute, checkUpgradeAirport, closeRoute, openAirport, openRoute, sellPlane, unassignPlane, upgradeAirport,
} from '../src/engine/actions';
import { buildMinutes, cityTier, maxLevel, startLevel } from '../src/engine/cities';
import { finishConstruction, openAirportNow } from './helpers';
import { CONFIG, MIN_PER_DAY } from '../src/engine/config';
import { getModifiers } from '../src/engine/events';
import { cityDistance } from '../src/engine/geo';
import { getNetwork } from '../src/engine/network';
import { newGame } from '../src/engine/setup';
import { advance } from '../src/engine/simulation';
import { emptySink } from '../src/engine/util';

function basicGame() {
  const s = newGame('warsaw', 42);
  expect(openAirportNow(s, 'berlin').ok).toBe(true);
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
    openAirportNow(s, 'berlin');
    openRoute(s, 'warsaw', 'berlin');
    advance(s, MIN_PER_DAY);
    expect(s.airports.warsaw.yesterday.spawned).toBe(0);
    expect(s.totals.lost).toBe(0);
  });

  it('budowa lotniska trwa kilka dni i blokuje trasy do jej zakończenia', () => {
    const s = newGame('warsaw', 5);
    expect(openAirport(s, 'berlin').ok).toBe(true);
    const ap = s.airports.berlin;
    expect(ap.buildEnd).toBeGreaterThan(s.time + MIN_PER_DAY);
    expect(checkOpenRoute(s, 'warsaw', 'berlin')).toMatch(/budowie/);
    expect(checkUpgradeAirport(s, 'berlin')).toMatch(/budowie/);
    advance(s, buildMinutes(CITY_BY_ID.berlin) + 10);
    expect(ap.buildEnd).toBeUndefined();
    expect(s.log.some((l) => l.title.includes('Berlin otwarte'))).toBe(true);
    expect(openRoute(s, 'warsaw', 'berlin').ok).toBe(true);
  });

  it('wielkość miasta określa infrastrukturę lotniska', () => {
    expect(cityTier(CITY_BY_ID.tokyo)).toBe(4);
    expect(cityTier(CITY_BY_ID.queenstown)).toBe(1);
    expect(cityTier(CITY_BY_ID.dubai)).toBe(3); // hub
    expect(startLevel(CITY_BY_ID.tokyo)).toBe(3);
    expect(startLevel(CITY_BY_ID.krakow)).toBe(1);
    expect(maxLevel(CITY_BY_ID.queenstown)).toBe(2);
    expect(maxLevel(CITY_BY_ID.dubai)).toBe(8);
    expect(maxLevel(CITY_BY_ID.tokyo)).toBe(8);
    expect(maxLevel(CITY_BY_ID.krakow)).toBe(4);
    // Małe lotnisko nie da się rozbudować ponad swój limit.
    const s = newGame('warsaw', 2);
    s.money = 50_000_000;
    openAirportNow(s, 'rzeszow');
    expect(upgradeAirport(s, 'rzeszow').ok).toBe(true);
    expect(checkUpgradeAirport(s, 'rzeszow')).toMatch(/najwyższy/);
    expect(s.airports.rzeszow.level).toBe(maxLevel(CITY_BY_ID.rzeszow));
    // Lotnisko bazowe można rozbudować do najwyższego poziomu, niezależnie od wielkości miasta.
    for (let i = 0; i < 10; i++) upgradeAirport(s, 'warsaw');
    expect(s.airports.warsaw.level).toBe(8);
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
    finishConstruction(s);
    expect(openRoute(s, 'warsaw', 'berlin').ok).toBe(true);
    expect(openRoute(s, 'warsaw', 'prague').ok).toBe(true);
    expect(checkOpenRoute(s, 'warsaw', 'vienna')).toMatch(/slot/);
    expect(upgradeAirport(s, 'warsaw').ok).toBe(true);
    expect(openRoute(s, 'warsaw', 'vienna').ok).toBe(true);
  });

  it('zasięg samolotu ogranicza przypisanie', () => {
    const s = newGame('madrid', 1);
    s.money = 10_000_000;
    openAirportNow(s, 'helsinki');
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
    finishConstruction(s);
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
    s.events.push({ uid: 1, defId: 'test', title: 'Strajk', tone: 'bad', category: 'infrastructure', targetId: 'warsaw', scope: 'city', start: s.time, end: s.time + 600, mods: { closed: true } });
    s.eventRev++;
    expect(getModifiers(s).closed.has('warsaw')).toBe(true);
    advance(s, 300);
    expect(plane.status).toBe('boarding');
    expect(plane.flights).toBe(0);
  });

  it('długotrwałe ujemne saldo kończy grę', () => {
    const { s } = basicGame();
    s.money = -5_000_000;
    advance(s, MIN_PER_DAY * (CONFIG.BANKRUPTCY_DAYS + 1));
    expect(s.gameOver).toBe(true);
  });
});
