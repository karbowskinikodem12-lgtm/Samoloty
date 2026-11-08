import { AIRCRAFT } from '../src/data/aircraft';
import { airportLevel } from '../src/data/airportLevels';
import { CITIES, CITY_BY_ID } from '../src/data/cities';
import { REGIONS } from '../src/data/regions';
import {
  assignPlane, buyPlane, checkBuyPlane, checkOpenAirport, checkOpenRoute, checkTypeForRoute, checkUnlockRegion,
  checkUpgradeAirport, freeSlots, openAirport, openRoute, planesOnRoute, unlockRegion, upgradeAirport,
} from '../src/engine/actions';
import { airportOpenCost, routeOpenCost } from '../src/engine/economy';
import { cityDistance } from '../src/engine/geo';
import { waitingTotal } from '../src/engine/passengers';
import type { GameState } from '../src/engine/types';

/** Prosty gracz-bot używany do testów balansu. Raz na kilka godzin gry podejmuje decyzje. */
export function botTurn(s: GameState, reserve = 150_000): void {
  // 1. Wolne samoloty → trasa z największą kolejką.
  for (const p of Object.values(s.planes)) {
    if (p.routeId) continue;
    const best = Object.values(s.routes)
      .filter((r) => !checkTypeForRoute(s, p.typeId, r.id) && planesOnRoute(s, r.id).length < 6)
      .sort((x, y) => routePressure(s, y.id) - routePressure(s, x.id))[0];
    if (best) assignPlane(s, p.id, best.id);
  }
  // 2. Trasy bez samolotu albo z dużą kolejką → kup samolot.
  for (const r of Object.values(s.routes)) {
    const n = planesOnRoute(s, r.id).length;
    const pressure = routePressure(s, r.id);
    if (n === 0 || (pressure > 60 * n && n < 4)) {
      const type = [...AIRCRAFT].reverse().find((t) => !checkBuyPlane(s, t.id, r.id) && s.money - t.price > reserve && t.seats <= 120 + n * 60);
      if (type) buyPlane(s, type.id, r.id);
    }
  }
  // 3. Rozbudowa lotnisk bez wolnych slotów lub przepełnionych.
  for (const ap of Object.values(s.airports)) {
    const full = freeSlots(s, ap.cityId) <= 0 || waitingTotal(s, ap.cityId) > airportLevel(ap.level).capacity * 0.8;
    if (full && !checkUpgradeAirport(s, ap.cityId) && s.money - airportLevel(ap.level + 1).upgradeCost > reserve) upgradeAirport(s, ap.cityId);
  }
  // 4. Nowe lotnisko: najbliższe nieotwarte miasto do istniejącej sieci z wolnym slotem.
  const candidates: { city: string; from: string; score: number }[] = [];
  for (const c of CITIES) {
    if (checkOpenAirport(s, c.id)) continue;
    for (const from of Object.keys(s.airports)) {
      if (freeSlots(s, from) <= 0) continue;
      const d = cityDistance(c.id, from);
      if (d > 3200) continue;
      candidates.push({ city: c.id, from, score: Math.sqrt(c.pop) / (1 + d / 1500) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const idle = Object.values(s.planes).some((p) => !p.routeId);
  const totalCost = (c: { city: string; from: string }) =>
    airportOpenCost(c.city) + routeOpenCost(cityDistance(c.city, c.from)) + (idle ? 0 : 300_000);
  const pick = candidates.slice(0, 4).find((c) => s.money - totalCost(c) > reserve);
  if (pick) {
    {
      openAirport(s, pick.city);
      if (!checkOpenRoute(s, pick.from, pick.city)) openRoute(s, pick.from, pick.city);
    }
  }
  // 5. Nowy region, gdy stać nas z zapasem.
  for (const r of REGIONS) {
    if (!checkUnlockRegion(s, r.id) && s.money > 3_000_000) unlockRegion(s, r.id);
  }
  void CITY_BY_ID;
}

function routePressure(s: GameState, routeId: string): number {
  const r = s.routes[routeId];
  const a = s.airports[r.a];
  const b = s.airports[r.b];
  return (a ? waitingTotal(s, r.a) : 0) + (b ? waitingTotal(s, r.b) : 0);
}
