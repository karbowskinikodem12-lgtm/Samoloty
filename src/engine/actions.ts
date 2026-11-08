import { AIRCRAFT_BY_ID } from '../data/aircraft';
import { airportLevel, MAX_AIRPORT_LEVEL } from '../data/airportLevels';
import { CITY_BY_ID } from '../data/cities';
import { REGION_BY_ID } from '../data/regions';
import { CONFIG } from './config';
import { airportOpenCost, planeResale, regionUnlockInfo, routeOpenCost } from './economy';
import { cityDistance } from './geo';
import { buildDays, buildMinutes, isBuilding, maxLevelFor, startLevel } from './cities';
import { countryOfCity, isCityDiscovered, updateDiscovery } from './countries';
import { routeBetween, routesOf } from './network';
import { dropUnreachable } from './passengers';
import type { ActionResult, Airport, GameState, Plane, Route, SimSink } from './types';
import { dayOf, log, nextId } from './util';

/**
 * Akcje gracza. Każda akcja ma funkcję check* (zwraca powód blokady albo null — używane
 * przez UI do wyłączania przycisków) oraz funkcję wykonującą, która mutuje stan.
 */

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const money = (v: number) => `${Math.round(v).toLocaleString('pl-PL')} $`;

/** Wywoływane po każdej zmianie, która wpływa na to, które trasy są obsługiwane. */
export function networkChanged(s: GameState): void {
  s.netRev++;
  dropUnreachable(s);
}

function spend(s: GameState, amount: number): void {
  s.money -= amount;
  s.today.investment += amount;
}

export function newAirport(cityId: string, day: number, level = 1): Airport {
  const blank = { spawned: 0, lost: 0, departed: 0 };
  return { cityId, level, waiting: {}, spawnAcc: 0, openedDay: day, today: { ...blank }, yesterday: { ...blank } };
}

const blankRouteStats = () => ({ flights: 0, pax: 0, seats: 0, revenue: 0, cost: 0 });

// ---------- Lotniska ----------

export function checkOpenAirport(s: GameState, cityId: string): string | null {
  const city = CITY_BY_ID[cityId];
  if (!city) return 'Nieznane miasto.';
  if (isBuilding(s.airports[cityId])) return 'Lotnisko jest w budowie.';
  if (s.airports[cityId]) return 'Lotnisko już działa.';
  if (!s.unlockedRegions.includes(city.region)) return `Region ${REGION_BY_ID[city.region].name} jest zablokowany.`;
  if (!isCityDiscovered(s, cityId)) return `Najpierw odkryj kraj: ${countryOfCity(cityId).name}.`;
  const cost = airportOpenCost(cityId);
  if (s.money < cost) return `Brakuje środków (${money(cost)}).`;
  return null;
}

export function openAirport(s: GameState, cityId: string): ActionResult {
  const err = checkOpenAirport(s, cityId);
  if (err) return fail(err);
  const city = CITY_BY_ID[cityId];
  spend(s, airportOpenCost(cityId));
  const ap = newAirport(cityId, dayOf(s.time), startLevel(city));
  ap.buildStart = s.time;
  ap.buildEnd = s.time + buildMinutes(city);
  s.airports[cityId] = ap;
  const days = buildDays(city);
  log(s, 'info', `Rozpoczęto budowę lotniska ${city.name}`, `Otwarcie za ok. ${days.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} dnia.`);
  return { ok: true, id: cityId };
}

/** Kończy budowy, których termin minął. Wywoływane w każdym kroku symulacji. */
export function updateConstruction(s: GameState, sink?: SimSink): void {
  for (const ap of Object.values(s.airports)) {
    if (ap.buildEnd === undefined || s.time < ap.buildEnd) continue;
    delete ap.buildEnd;
    delete ap.buildStart;
    ap.openedDay = dayOf(s.time);
    log(s, 'good', `Lotnisko ${CITY_BY_ID[ap.cityId].name} otwarte`, 'Połącz je trasą z inną częścią sieci.', sink);
    updateDiscovery(s, sink);
  }
}

export function checkUpgradeAirport(s: GameState, cityId: string): string | null {
  const ap = s.airports[cityId];
  if (!ap) return 'Najpierw otwórz lotnisko.';
  if (isBuilding(ap)) return 'Lotnisko jest jeszcze w budowie.';
  if (ap.level >= MAX_AIRPORT_LEVEL) return 'Lotnisko ma maksymalny poziom.';
  if (ap.level >= maxLevelFor(s, cityId)) return 'To najwyższy poziom możliwy w tym mieście.';
  const cost = airportLevel(ap.level + 1).upgradeCost;
  if (s.money < cost) return `Brakuje środków (${money(cost)}).`;
  return null;
}

export function upgradeAirport(s: GameState, cityId: string, sink?: SimSink): ActionResult {
  const err = checkUpgradeAirport(s, cityId);
  if (err) return fail(err);
  const ap = s.airports[cityId];
  spend(s, airportLevel(ap.level + 1).upgradeCost);
  ap.level++;
  log(s, 'info', `Rozbudowano lotnisko ${CITY_BY_ID[cityId].name}`, `Poziom ${ap.level}`);
  updateDiscovery(s, sink);
  return { ok: true };
}

export function freeSlots(s: GameState, cityId: string): number {
  const ap = s.airports[cityId];
  if (!ap) return 0;
  return airportLevel(ap.level).slots - routesOf(s, cityId).length;
}

// ---------- Trasy ----------

export function checkOpenRoute(s: GameState, a: string, b: string): string | null {
  if (a === b) return 'Wybierz dwa różne lotniska.';
  if (!s.airports[a] || !s.airports[b]) return 'Oba miasta muszą mieć otwarte lotniska.';
  for (const id of [a, b]) if (isBuilding(s.airports[id])) return `Lotnisko ${CITY_BY_ID[id].name} jest jeszcze w budowie.`;
  if (routeBetween(s, a, b)) return 'Ta trasa już istnieje.';
  if (freeSlots(s, a) <= 0) return `Brak wolnych slotów w ${CITY_BY_ID[a].name} — rozbuduj lotnisko.`;
  if (freeSlots(s, b) <= 0) return `Brak wolnych slotów w ${CITY_BY_ID[b].name} — rozbuduj lotnisko.`;
  const cost = routeOpenCost(cityDistance(a, b));
  if (s.money < cost) return `Brakuje środków (${money(cost)}).`;
  return null;
}

export function openRoute(s: GameState, a: string, b: string): ActionResult {
  const err = checkOpenRoute(s, a, b);
  if (err) return fail(err);
  const distance = cityDistance(a, b);
  const cost = routeOpenCost(distance);
  spend(s, cost);
  const route: Route = {
    id: nextId(s, 'r'), a, b, distance, openedDay: dayOf(s.time), openCost: cost,
    today: blankRouteStats(), yesterday: blankRouteStats(), loads: [],
  };
  s.routes[route.id] = route;
  s.netRev++;
  log(s, 'info', `Nowa trasa ${CITY_BY_ID[a].name} – ${CITY_BY_ID[b].name}`, `${distance.toLocaleString('pl-PL')} km`);
  return { ok: true, id: route.id };
}

export function closeRoute(s: GameState, routeId: string): ActionResult {
  const r = s.routes[routeId];
  if (!r) return fail('Nie ma takiej trasy.');
  for (const p of planesOnRoute(s, routeId)) sendToHangar(p);
  delete s.routes[routeId];
  const refund = Math.round(r.openCost * CONFIG.ROUTE_REFUND);
  s.money += refund;
  s.today.bonus += refund;
  networkChanged(s);
  log(s, 'info', `Zamknięto trasę ${CITY_BY_ID[r.a].name} – ${CITY_BY_ID[r.b].name}`);
  return { ok: true };
}

export function planesOnRoute(s: GameState, routeId: string): Plane[] {
  return Object.values(s.planes).filter((p) => p.routeId === routeId);
}

// ---------- Samoloty ----------

/** Czy dany typ może latać na trasie (zasięg, poziom lotnisk). */
export function checkTypeForRoute(s: GameState, typeId: string, routeId: string): string | null {
  const t = AIRCRAFT_BY_ID[typeId];
  const r = s.routes[routeId];
  if (!t || !r) return 'Nieprawidłowy wybór.';
  if (r.distance > t.range) return `Za mały zasięg (${t.range.toLocaleString('pl-PL')} km).`;
  const minLvl = Math.min(s.airports[r.a]?.level ?? 0, s.airports[r.b]?.level ?? 0);
  if (minLvl < t.minAirportLevel) return `Wymaga lotnisk poz. ${t.minAirportLevel}.`;
  return null;
}

export function checkBuyPlane(s: GameState, typeId: string, routeId?: string): string | null {
  const t = AIRCRAFT_BY_ID[typeId];
  if (!t) return 'Nieznany typ samolotu.';
  if (s.level < t.minLevel) return `Wymaga poziomu linii ${t.minLevel}.`;
  if (routeId) {
    const e = checkTypeForRoute(s, typeId, routeId);
    if (e) return e;
    if (planesOnRoute(s, routeId).length >= CONFIG.MAX_PLANES_PER_ROUTE) return 'Trasa ma maksymalną liczbę samolotów.';
  }
  if (s.money < t.price) return `Brakuje środków (${money(t.price)}).`;
  return null;
}

export function addPlane(s: GameState, typeId: string): Plane {
  const id = nextId(s, 'p');
  const plane: Plane = {
    id, typeId, reg: `CT-${100 + Object.keys(s.planes).length + 1}`, routeId: null, status: 'idle',
    from: s.startCity, to: s.startCity, progress: 0, timer: 0, cargo: {}, leaving: false,
    flights: 0, revenue: 0, boughtDay: dayOf(s.time),
  };
  s.planes[plane.id] = plane;
  return plane;
}

export function buyPlane(s: GameState, typeId: string, routeId?: string): ActionResult {
  const err = checkBuyPlane(s, typeId, routeId);
  if (err) return fail(err);
  spend(s, AIRCRAFT_BY_ID[typeId].price);
  const plane = addPlane(s, typeId);
  log(s, 'info', `Zakupiono samolot ${AIRCRAFT_BY_ID[typeId].name}`, plane.reg);
  if (routeId) assignPlane(s, plane.id, routeId);
  return { ok: true, id: plane.id };
}

export function checkAssignPlane(s: GameState, planeId: string, routeId: string): string | null {
  const p = s.planes[planeId];
  if (!p) return 'Nie ma takiego samolotu.';
  if (p.routeId === routeId) return 'Samolot już obsługuje tę trasę.';
  if (p.routeId && p.status === 'flying') return 'Samolot jest w powietrzu — poczekaj na lądowanie.';
  if (planesOnRoute(s, routeId).length >= CONFIG.MAX_PLANES_PER_ROUTE) return 'Trasa ma maksymalną liczbę samolotów.';
  return checkTypeForRoute(s, p.typeId, routeId);
}

export function assignPlane(s: GameState, planeId: string, routeId: string): ActionResult {
  const err = checkAssignPlane(s, planeId, routeId);
  if (err) return fail(err);
  const p = s.planes[planeId];
  const r = s.routes[routeId];
  // Samolot startuje z tego końca trasy, na którym aktualnie jest mniej maszyn.
  const others = planesOnRoute(s, routeId);
  const atA = others.filter((o) => o.from === r.a).length;
  const atB = others.length - atA;
  const start = p.from === r.b && atB <= atA ? r.b : atA <= atB ? r.a : r.b;
  p.routeId = routeId;
  p.status = 'boarding';
  p.from = start;
  p.to = start === r.a ? r.b : r.a;
  p.progress = 0;
  p.timer = airportLevel(s.airports[start].level).turnaround;
  p.cargo = {};
  p.leaving = false;
  networkChanged(s);
  return { ok: true };
}

/** Natychmiast przenosi samolot do hangaru (pasażerowie na pokładzie przepadają). */
function sendToHangar(p: Plane): void {
  p.routeId = null;
  p.status = 'idle';
  p.cargo = {};
  p.progress = 0;
  p.leaving = false;
}

/** Zdejmuje samolot z trasy: na ziemi od razu, w powietrzu — po wylądowaniu. */
export function unassignPlane(s: GameState, planeId: string): ActionResult {
  const p = s.planes[planeId];
  if (!p || !p.routeId) return fail('Samolot nie obsługuje żadnej trasy.');
  if (p.status === 'flying') p.leaving = true;
  else sendToHangar(p);
  networkChanged(s);
  return { ok: true };
}

export function sellPlane(s: GameState, planeId: string): ActionResult {
  const p = s.planes[planeId];
  if (!p) return fail('Nie ma takiego samolotu.');
  if (p.status === 'flying') return fail('Samolot jest w powietrzu — poczekaj na lądowanie.');
  const value = planeResale(p.typeId);
  delete s.planes[planeId];
  if (p.routeId) networkChanged(s);
  s.money += value;
  s.today.bonus += value;
  log(s, 'info', `Sprzedano samolot ${p.reg}`, money(value));
  return { ok: true };
}

// ---------- Regiony ----------

export function checkUnlockRegion(s: GameState, regionId: string): string | null {
  if (!REGION_BY_ID[regionId]) return 'Nieznany region.';
  if (s.unlockedRegions.includes(regionId)) return 'Region jest już odblokowany.';
  const info = regionUnlockInfo(s);
  if (!info) return 'Brak kolejnych licencji.';
  if (s.level < info.level) return `Wymaga poziomu linii ${info.level}.`;
  if (s.money < info.cost) return `Brakuje środków (${money(info.cost)}).`;
  return null;
}

export function unlockRegion(s: GameState, regionId: string): ActionResult {
  const err = checkUnlockRegion(s, regionId);
  if (err) return fail(err);
  spend(s, regionUnlockInfo(s)!.cost);
  s.unlockedRegions.push(regionId);
  log(s, 'good', `Licencja: ${REGION_BY_ID[regionId].name}`, 'Możesz otwierać lotniska w nowym regionie.');
  return { ok: true };
}
