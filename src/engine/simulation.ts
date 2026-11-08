import { updateConstruction } from './actions';
import { CONFIG, MIN_PER_DAY } from './config';
import { dailyFixedCosts } from './economy';
import { chargeLoans, updateEvents } from './events';
import { updatePlanes } from './flights';
import { spawnPassengers, updateReputation } from './passengers';
import { updateProgression } from './progression';
import { blankDay } from './setup';
import type { GameState, SimSink } from './types';
import { dayOf, emptySink, log } from './util';

/**
 * Główna pętla symulacji. Przesuwa świat o `minutes` minut gry, dzieląc czas na małe kroki.
 * Kolejność w kroku: pasażerowie → samoloty → wydarzenia → koniec dnia → cele i poziomy.
 */
export function advance(s: GameState, minutes: number, sink: SimSink = emptySink()): SimSink {
  if (s.gameOver) return sink;
  let left = minutes;
  while (left > 0 && !s.gameOver) {
    const dt = Math.min(CONFIG.MAX_STEP, left);
    step(s, dt, sink);
    left -= dt;
  }
  return sink;
}

function step(s: GameState, dt: number, sink: SimSink): void {
  const prevDay = dayOf(s.time);
  s.time += dt;
  updateConstruction(s, sink);
  spawnPassengers(s, dt);
  updatePlanes(s, dt, sink);
  updateReputation(s, dt);
  updateEvents(s, sink);
  if (dayOf(s.time) !== prevDay) endOfDay(s, sink);
  updateProgression(s, sink);
}

function endOfDay(s: GameState, sink: SimSink): void {
  const fixed = dailyFixedCosts(s);
  s.money -= fixed.planes + fixed.airports;
  s.today.planeUpkeep += fixed.planes;
  s.today.airportUpkeep += fixed.airports;
  s.today.financing = (s.today.financing ?? 0) + chargeLoans(s, sink);

  s.history.push(s.today);
  if (s.history.length > CONFIG.HISTORY_DAYS) s.history.shift();
  s.today = blankDay(dayOf(s.time));

  for (const ap of Object.values(s.airports)) {
    ap.yesterday = ap.today;
    ap.today = { spawned: 0, lost: 0, departed: 0 };
  }
  for (const r of Object.values(s.routes)) {
    r.yesterday = r.today;
    r.today = { flights: 0, pax: 0, seats: 0, revenue: 0, cost: 0 };
  }

  if (s.money < 0) {
    s.negativeDays++;
    if (s.negativeDays >= CONFIG.BANKRUPTCY_DAYS) {
      s.gameOver = true;
      log(s, 'bad', 'Bankructwo', 'Linia zbyt długo miała ujemne saldo.', sink);
    } else {
      const left = CONFIG.BANKRUPTCY_DAYS - s.negativeDays;
      log(s, 'bad', 'Ujemne saldo', `Wyjdź na plus w ciągu ${left} ${left === 1 ? 'dnia' : 'dni'}, inaczej linia zbankrutuje. Sprzedaj samoloty albo zamknij nierentowne trasy.`, sink);
    }
  } else {
    s.negativeDays = 0;
  }
}

export const currentDay = (s: GameState) => dayOf(s.time) + 1;
export const clockMinutes = (s: GameState) => Math.floor(s.time % MIN_PER_DAY);
