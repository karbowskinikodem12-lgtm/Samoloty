import { GOALS, VISIBLE_GOALS } from '../data/goals';
import { CONFIG } from './config';
import { levelForXp } from './economy';
import type { GameState, GoalDef, SimSink } from './types';
import { log } from './util';

export function activeGoals(s: GameState): GoalDef[] {
  return GOALS.filter((g) => !s.goalsDone.includes(g.id)).slice(0, VISIBLE_GOALS);
}

/** Sprawdza ukończone cele i awans poziomu. */
export function updateProgression(s: GameState, sink?: SimSink): void {
  for (const g of activeGoals(s)) {
    if (g.progress(s) >= g.target) {
      s.goalsDone.push(g.id);
      s.money += g.reward;
      s.today.bonus += g.reward;
      log(s, 'goal', `Cel osiągnięty: ${g.title}`, `Nagroda: ${g.reward.toLocaleString('pl-PL')} $`, sink);
    }
  }
  const lvl = levelForXp(s.xp);
  while (s.level < lvl) {
    s.level++;
    const reward = CONFIG.LEVEL_REWARD_PER_LEVEL * s.level;
    s.money += reward;
    s.today.bonus += reward;
    log(s, 'level', `Awans na poziom ${s.level}`, `Premia: ${reward.toLocaleString('pl-PL')} $. Sprawdź nowe samoloty i regiony.`, sink);
  }
}
