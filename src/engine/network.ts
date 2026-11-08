import { CITY_BY_ID } from '../data/cities';
import { CONFIG } from './config';
import { cityDistance } from './geo';
import type { GameState, Route } from './types';

/**
 * Graf sieci tras liczony z GameState i trzymany w cache do czasu zmiany netRev.
 * Uwzględnia tylko trasy obsługiwane przez co najmniej jeden samolot — pasażerowie nie
 * pojawiają się dla połączeń, którymi nic nie lata.
 * nextHop[a][dest] — do którego sąsiedniego lotniska pasażer z `a` jadący do `dest` powinien polecieć.
 */
export interface Network {
  rev: number;
  ref: GameState;
  /** Lotniska z co najmniej jedną obsługiwaną trasą. */
  nodes: string[];
  adjacency: Record<string, { to: string; route: Route }[]>;
  nextHop: Record<string, Record<string, string>>;
  /** Liczba przesiadek / długość ścieżki (do UI). */
  pathCost: Record<string, Record<string, number>>;
  reachable: Record<string, string[]>;
}

let cached: Network | null = null;

export function getNetwork(s: GameState): Network {
  if (cached && cached.ref === s && cached.rev === s.netRev) return cached;
  cached = buildNetwork(s);
  return cached;
}

function buildNetwork(s: GameState): Network {
  const adjacency: Network['adjacency'] = {};
  const served = new Set<string>();
  for (const p of Object.values(s.planes)) if (p.routeId && !p.leaving) served.add(p.routeId);
  for (const r of Object.values(s.routes)) {
    if (!served.has(r.id)) continue;
    (adjacency[r.a] ??= []).push({ to: r.b, route: r });
    (adjacency[r.b] ??= []).push({ to: r.a, route: r });
  }
  const nodes = Object.keys(adjacency);
  const nextHop: Network['nextHop'] = {};
  const pathCost: Network['pathCost'] = {};
  const reachable: Network['reachable'] = {};

  // Dijkstra z każdego węzła (sieć ma najwyżej kilkadziesiąt węzłów).
  for (const src of nodes) {
    const dist: Record<string, number> = { [src]: 0 };
    const first: Record<string, string> = {};
    const done = new Set<string>();
    for (;;) {
      let u: string | null = null;
      let best = Infinity;
      for (const n in dist) {
        if (!done.has(n) && dist[n] < best) {
          best = dist[n];
          u = n;
        }
      }
      if (u === null) break;
      done.add(u);
      for (const { to, route } of adjacency[u] ?? []) {
        const nd = best + route.distance + CONFIG.TRANSFER_PENALTY_KM;
        if (nd < (dist[to] ?? Infinity)) {
          dist[to] = nd;
          first[to] = u === src ? to : first[u];
        }
      }
    }
    delete dist[src];
    nextHop[src] = first;
    pathCost[src] = dist;
    reachable[src] = Object.keys(first);
  }
  return { rev: s.netRev, ref: s, nodes, adjacency, nextHop, pathCost, reachable };
}

export function routeBetween(s: GameState, a: string, b: string): Route | undefined {
  for (const r of Object.values(s.routes)) {
    if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
  }
  return undefined;
}

export function routesOf(s: GameState, cityId: string): Route[] {
  return Object.values(s.routes).filter((r) => r.a === cityId || r.b === cityId);
}

export function routeDistance(a: string, b: string): number {
  return cityDistance(a, b);
}

export function regionsInNetwork(s: GameState): Set<string> {
  const set = new Set<string>();
  for (const [id, ap] of Object.entries(s.airports)) if (ap.buildEnd === undefined) set.add(CITY_BY_ID[id].region);
  return set;
}
