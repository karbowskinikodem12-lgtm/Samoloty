import { AIRCRAFT_BY_ID } from '../data/aircraft';
import { airportLevel } from '../data/airportLevels';
import { fare, flightCost, flightMinutes } from './economy';
import { getModifiers } from './events';
import { getNetwork } from './network';
import { addWaiting, losePassengers } from './passengers';
import type { GameState, Plane, SimSink } from './types';
import { sumValues } from './util';

/** Wsiadanie: zabiera czekających, których następny odcinek prowadzi do `plane.to`. */
function board(s: GameState, plane: Plane): number {
  const ap = s.airports[plane.from];
  if (!ap) return 0;
  const seats = AIRCRAFT_BY_ID[plane.typeId].seats;
  const hops = getNetwork(s).nextHop[plane.from] ?? {};
  let free = seats - sumValues(plane.cargo);
  let boarded = 0;
  // Najpierw pasażerowie lecący bezpośrednio do celu, potem przesiadkowi.
  const dests = Object.keys(ap.waiting).filter((d) => hops[d] === plane.to);
  dests.sort((x, y) => (x === plane.to ? -1 : y === plane.to ? 1 : (ap.waiting[y] ?? 0) - (ap.waiting[x] ?? 0)));
  for (const d of dests) {
    if (free <= 0) break;
    const take = Math.min(free, ap.waiting[d]);
    if (take <= 0) continue;
    ap.waiting[d] -= take;
    if (ap.waiting[d] <= 0) delete ap.waiting[d];
    plane.cargo[d] = (plane.cargo[d] ?? 0) + take;
    free -= take;
    boarded += take;
  }
  ap.today.departed += boarded;
  return boarded;
}

function depart(s: GameState, plane: Plane): void {
  const route = s.routes[plane.routeId!];
  const type = AIRCRAFT_BY_ID[plane.typeId];
  const boarded = board(s, plane);
  const cost = flightCost(type, route.distance) * getModifiers(s).fuel;
  s.money -= cost;
  s.today.flightCost += cost;
  route.today.cost += cost;
  route.today.flights += 1;
  route.today.pax += boarded;
  route.today.seats += type.seats;
  route.loads.push(boarded / type.seats);
  if (route.loads.length > 12) route.loads.shift();
  s.totals.flights += 1;
  plane.flights += 1;
  plane.status = 'flying';
  plane.progress = 0;
}

function arrive(s: GameState, plane: Plane, sink: SimSink): void {
  const route = s.routes[plane.routeId!];
  const at = plane.to;
  const mods = getModifiers(s);
  const legFare = fare(route.distance) * mods.fare;
  const net = getNetwork(s);
  let revenue = 0;
  for (const [dest, count] of Object.entries(plane.cargo)) {
    revenue += legFare * count;
    if (dest === at) {
      s.xp += count;
      s.totals.pax += count;
      s.today.pax += count;
    } else if (net.nextHop[at]?.[dest]) {
      losePassengers(s, at, addWaiting(s, at, dest, count));
    } else {
      losePassengers(s, at, count);
    }
  }
  plane.cargo = {};
  s.money += revenue;
  s.today.revenue += revenue;
  s.totals.revenue += revenue;
  route.today.revenue += revenue;
  plane.revenue += revenue;
  if (revenue > 0) sink.arrivals.push({ cityId: at, amount: revenue });

  if (plane.leaving) {
    plane.routeId = null;
    plane.status = 'idle';
    plane.from = at;
    plane.to = at;
    plane.leaving = false;
    plane.progress = 0;
    return;
  }
  plane.from = at;
  plane.to = at === route.a ? route.b : route.a;
  plane.status = 'boarding';
  plane.progress = 0;
  plane.timer = airportLevel(s.airports[at]?.level ?? 1).turnaround;
}

/** Przesuwa wszystkie samoloty o `dt` minut. */
export function updatePlanes(s: GameState, dt: number, sink: SimSink): void {
  const closed = getModifiers(s).closed;
  for (const plane of Object.values(s.planes)) {
    if (!plane.routeId || plane.status === 'idle') continue;
    const route = s.routes[plane.routeId];
    if (!route) {
      plane.routeId = null;
      plane.status = 'idle';
      continue;
    }
    let remaining = dt;
    // Pętla obsługuje sytuację, gdy w jednym kroku samolot kończy obsługę i startuje.
    for (let guard = 0; guard < 4 && remaining > 0; guard++) {
      if (plane.status === 'boarding') {
        if (plane.timer > remaining) {
          plane.timer -= remaining;
          remaining = 0;
          break;
        }
        remaining -= Math.max(0, plane.timer);
        plane.timer = 0;
        if (closed.has(plane.from) || closed.has(plane.to)) {
          remaining = 0;
          break; // czeka na otwarcie lotniska
        }
        if (plane.leaving) {
          plane.routeId = null;
          plane.status = 'idle';
          plane.leaving = false;
          break;
        }
        depart(s, plane);
      } else if (plane.status === 'flying') {
        const total = flightMinutes(AIRCRAFT_BY_ID[plane.typeId], route.distance);
        const left = (1 - plane.progress) * total;
        if (left > remaining) {
          plane.progress += remaining / total;
          remaining = 0;
          break;
        }
        remaining -= left;
        plane.progress = 1;
        arrive(s, plane, sink);
        if ((plane.status as Plane['status']) !== 'boarding') break;
      } else break;
    }
  }
}
