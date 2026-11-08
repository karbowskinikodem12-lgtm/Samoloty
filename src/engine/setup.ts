import { CITY_BY_ID } from '../data/cities';
import { addPlane, newAirport } from './actions';
import { CONFIG } from './config';
import type { DayStats, GameState } from './types';
import { log } from './util';

export const SAVE_VERSION = 1;

export function blankDay(day: number): DayStats {
  return { day, revenue: 0, flightCost: 0, planeUpkeep: 0, airportUpkeep: 0, bonus: 0, investment: 0, financing: 0, pax: 0, lost: 0 };
}

export function newGame(startCity: string, seed = Date.now() % 2147483647, airlineName = 'Contrail'): GameState {
  const city = CITY_BY_ID[startCity];
  if (!city) throw new Error(`Nieznane miasto startowe: ${startCity}`);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    time: 8 * 60, // start o 8:00 pierwszego dnia (pełny dzień)
    money: CONFIG.START_MONEY,
    reputation: CONFIG.START_REPUTATION,
    xp: 0,
    level: 1,
    startCity,
    airlineName,
    unlockedRegions: [city.region],
    airports: { [startCity]: newAirport(startCity, 0) },
    routes: {},
    planes: {},
    nextId: 0,
    netRev: 0,
    eventRev: 0,
    events: [],
    nextEventAt: CONFIG.FIRST_EVENT_H * 60,
    pendingEvents: [],
    nextMajorAt: 0,
    eventCooldowns: {},
    loans: [],
    goalsDone: [],
    today: blankDay(0),
    history: [],
    totals: { pax: 0, revenue: 0, lost: 0, flights: 0 },
    log: [],
    negativeDays: 0,
    gameOver: false,
  };
  const plane = addPlane(s, CONFIG.START_PLANE);
  plane.from = plane.to = startCity;
  log(s, 'info', `Witamy w ${airlineName}`, `Twoja baza to ${city.name}. W hangarze czeka pierwszy samolot.`);
  return s;
}
