import type { GameState } from './types';

/** Deterministyczny generator (mulberry32). Stan trzymany w GameState.rng, więc zapis gry zachowuje sekwencję. */
export function random(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(s: GameState, min: number, max: number): number {
  return min + random(s) * (max - min);
}

export function pickWeighted<T>(s: GameState, items: T[], weight: (item: T) => number): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return null;
  let r = random(s) * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}
