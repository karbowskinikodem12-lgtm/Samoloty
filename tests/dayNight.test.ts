import { describe, expect, it } from 'vitest';
import { fade, nightFactor } from '../src/theme/dayNight';

describe('cykl dnia i nocy', () => {
  it('dzień jest jasny, noc ciemna, a przejścia płynne', () => {
    expect(nightFactor(12 * 60)).toBe(0);
    expect(nightFactor(8 * 60)).toBe(0);
    expect(nightFactor(23 * 60)).toBe(1);
    expect(nightFactor(3 * 60)).toBe(1);
    const dusk = nightFactor(19 * 60);
    expect(dusk).toBeGreaterThan(0.2);
    expect(dusk).toBeLessThan(0.8);
    // Kolejny dzień zachowuje się tak samo.
    expect(nightFactor(1440 * 3 + 12 * 60)).toBe(0);
    // Monotoniczność zmierzchu.
    let prev = 0;
    for (let m = 16 * 60; m <= 22 * 60; m += 5) {
      const v = nightFactor(m);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('fade działa dla hex i rgba', () => {
    expect(fade('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.500)');
    expect(fade('rgba(10, 20, 30, 0.5)', 0.5)).toBe('rgba(10, 20, 30, 0.250)');
  });
});
