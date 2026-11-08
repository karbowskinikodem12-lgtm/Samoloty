import { openAirport, updateConstruction } from '../src/engine/actions';
import type { GameState } from '../src/engine/types';

/** Natychmiast kończy wszystkie trwające budowy lotnisk (ułatwienie dla testów). */
export function finishConstruction(s: GameState): void {
  for (const ap of Object.values(s.airports)) if (ap.buildEnd !== undefined) ap.buildEnd = s.time;
  updateConstruction(s);
}

/** Otwiera lotnisko i od razu kończy jego budowę. */
export function openAirportNow(s: GameState, cityId: string) {
  const res = openAirport(s, cityId);
  finishConstruction(s);
  return res;
}
