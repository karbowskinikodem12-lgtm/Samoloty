import { openAirport, updateConstruction } from '../src/engine/actions';
import { CITY_COUNTRY } from '../src/engine/countries';
import type { GameState } from '../src/engine/types';

/** Natychmiast kończy wszystkie trwające budowy lotnisk (ułatwienie dla testów). */
export function finishConstruction(s: GameState): void {
  for (const ap of Object.values(s.airports)) if (ap.buildEnd !== undefined) ap.buildEnd = s.time;
  updateConstruction(s);
}

/** Oznacza kraj miasta jako odkryty (ułatwienie dla testów). */
export function discover(s: GameState, cityId: string): void {
  const id = CITY_COUNTRY[cityId];
  if (!s.discovered.includes(id)) s.discovered.push(id);
}

/** Otwiera lotnisko (odkrywając jego kraj, jeśli trzeba) i od razu kończy budowę. */
export function openAirportNow(s: GameState, cityId: string) {
  discover(s, cityId);
  const res = openAirport(s, cityId);
  finishConstruction(s);
  return res;
}
