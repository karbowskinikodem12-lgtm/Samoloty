import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { START_CITIES } from '../src/data/cities';
import { MIN_PER_DAY } from '../src/engine/config';
import { newGame } from '../src/engine/setup';
import { advance } from '../src/engine/simulation';
import { botTurn } from './bot';

const VERBOSE = !!process.env.BALANCE;
const DAYS = VERBOSE ? 40 : 15;

describe('balans', () => {
  for (const city of VERBOSE ? START_CITIES : ['warsaw', 'new_york']) {
    it(`bot rozwija linię startując z ${city}`, () => {
      const s = newGame(city, 1234);
      const rows: string[] = [];
      for (let d = 0; d < DAYS; d++) {
        for (let h = 0; h < 24; h += 3) {
          botTurn(s);
          advance(s, 180);
        }
        const y = s.history[s.history.length - 1];
        const profit = y.revenue - y.flightCost - y.planeUpkeep - y.airportUpkeep;
        rows.push(
          `d${String(d + 1).padStart(2)} $${(s.money / 1000).toFixed(0).padStart(6)}k  zysk ${(profit / 1000).toFixed(0).padStart(5)}k  ` +
            `pax ${String(y.pax).padStart(5)} lost ${String(y.lost).padStart(4)}  lvl ${s.level}  rep ${s.reputation.toFixed(0)}  ` +
            `ap ${Object.keys(s.airports).length} rt ${Object.keys(s.routes).length} pl ${Object.keys(s.planes).length} reg ${s.unlockedRegions.length}`,
        );
      }
      if (VERBOSE) appendFileSync(process.env.BALANCE_OUT ?? 'balance-report.txt', `\n== ${city} ==\n` + rows.join('\n') + '\n');
      expect(s.gameOver).toBe(false);
      expect(s.level).toBeGreaterThanOrEqual(2);
      expect(Object.keys(s.airports).length).toBeGreaterThanOrEqual(3);
      void MIN_PER_DAY;
    });
  }
});
