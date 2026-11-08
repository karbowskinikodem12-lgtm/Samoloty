import { describe, expect, it } from 'vitest';
import { CITIES, START_CITIES } from '../src/data/cities';
import { checkOpenAirport, upgradeAirport } from '../src/engine/actions';
import { MIN_PER_DAY } from '../src/engine/config';
import {
  CITY_COUNTRY, COUNTRIES, PLAYABLE_COUNTRIES, checkExpedition, countryOfCity, discoveredPlayable, expeditionDays,
  isCityDiscovered, startExpedition,
} from '../src/engine/countries';
import { newGame } from '../src/engine/setup';
import { advance } from '../src/engine/simulation';
import { openAirportNow } from './helpers';

describe('kraje', () => {
  it('każde miasto ma kraj, a miasta jednego kraju mają spójną nazwę', () => {
    const problems: string[] = [];
    for (const c of CITIES) {
      const info = COUNTRIES[CITY_COUNTRY[c.id]];
      expect(info, c.id).toBeDefined();
      if (info.name !== c.country) problems.push(`${c.id}: ${c.country} → ${info.name}`);
    }
    if (process.env.SHOW_COUNTRIES) console.log(problems.join('\n'), PLAYABLE_COUNTRIES.length);
    // Kilka wyjątków jest dopuszczalnych (np. Hongkong w obrębie Chin), ale nie masowe błędy przypisania.
    expect(problems.length).toBeLessThanOrEqual(4);
    expect(PLAYABLE_COUNTRIES.length).toBeGreaterThan(90);
  });

  it('na starcie odkryte są tylko kraje w pobliżu bazy', () => {
    for (const id of START_CITIES) {
      const s = newGame(id, 1);
      const n = discoveredPlayable(s);
      expect(isCityDiscovered(s, id)).toBe(true);
      expect(n, id).toBeGreaterThanOrEqual(1);
      expect(n, id).toBeLessThan(25);
    }
  });

  it('nie można budować w nieodkrytym kraju; rozbudowa zwiększa zasięg; misja odkrywa kraj', () => {
    const s = newGame('warsaw', 1);
    s.money = 50_000_000;
    expect(isCityDiscovered(s, 'lisbon')).toBe(false);
    expect(checkOpenAirport(s, 'lisbon')).toMatch(/odkryj/);
    const before = discoveredPlayable(s);
    for (let i = 0; i < 3; i++) upgradeAirport(s, 'warsaw');
    expect(discoveredPlayable(s)).toBeGreaterThan(before);
    const pt = CITY_COUNTRY.lisbon;
    expect(checkExpedition(s, pt)).toBeNull();
    expect(startExpedition(s, pt).ok).toBe(true);
    expect(checkExpedition(s, pt)).toMatch(/trwa/);
    advance(s, Math.ceil(expeditionDays(s, pt) + 1) * MIN_PER_DAY);
    expect(isCityDiscovered(s, 'lisbon')).toBe(true);
    expect(countryOfCity('lisbon').name).toBe('Portugalia');
    expect(checkOpenAirport(s, 'lisbon')).toBeNull();
  });

  it('nowe lotnisko odkrywa sąsiednie kraje', () => {
    const s = newGame('warsaw', 1);
    s.money = 50_000_000;
    const before = discoveredPlayable(s);
    openAirportNow(s, 'berlin');
    expect(discoveredPlayable(s)).toBeGreaterThan(before);
  });
});
