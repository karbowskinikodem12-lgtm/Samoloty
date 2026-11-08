import type { AirportLevelDef } from '../engine/types';

/**
 * Poziomy rozbudowy lotniska. Indeks 0 = poziom 1.
 * slots — maksymalna liczba tras, capacity — ilu pasażerów może czekać w terminalu,
 * demand — mnożnik popytu, turnaround — czas obsługi samolotu (min), upkeep — koszt dzienny,
 * upgradeCost — koszt wejścia na ten poziom.
 */
export const AIRPORT_LEVELS: AirportLevelDef[] = [
  { level: 1, slots: 2, capacity: 90, demand: 1.0, turnaround: 45, upkeep: 600, upgradeCost: 0 },
  { level: 2, slots: 3, capacity: 170, demand: 1.15, turnaround: 40, upkeep: 1_500, upgradeCost: 180_000 },
  { level: 3, slots: 4, capacity: 290, demand: 1.3, turnaround: 35, upkeep: 3_200, upgradeCost: 450_000 },
  { level: 4, slots: 6, capacity: 460, demand: 1.45, turnaround: 30, upkeep: 6_000, upgradeCost: 1_100_000 },
  { level: 5, slots: 8, capacity: 720, demand: 1.6, turnaround: 25, upkeep: 10_000, upgradeCost: 2_400_000 },
];

export const MAX_AIRPORT_LEVEL = AIRPORT_LEVELS.length;
export const airportLevel = (level: number): AirportLevelDef => AIRPORT_LEVELS[Math.max(0, Math.min(AIRPORT_LEVELS.length - 1, level - 1))];
