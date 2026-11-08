import type { AirportLevelDef } from '../engine/types';

/**
 * Poziomy rozbudowy lotniska. Indeks 0 = poziom 1.
 * slots — maksymalna liczba tras, capacity — ilu pasażerów może czekać w terminalu,
 * demand — mnożnik popytu, turnaround — czas obsługi samolotu (min), upkeep — koszt dzienny,
 * upgradeCost — koszt wejścia na ten poziom. Najwyższy poziom dostępny w danym mieście
 * zależy od jego wielkości (engine/cities.ts → maxLevel).
 */
export const AIRPORT_LEVELS: AirportLevelDef[] = [
  { level: 1, name: 'Port lokalny', slots: 2, capacity: 90, demand: 1.0, turnaround: 45, upkeep: 600, upgradeCost: 0 },
  { level: 2, name: 'Lotnisko regionalne', slots: 3, capacity: 170, demand: 1.15, turnaround: 40, upkeep: 1_500, upgradeCost: 180_000 },
  { level: 3, name: 'Lotnisko krajowe', slots: 4, capacity: 290, demand: 1.3, turnaround: 35, upkeep: 3_200, upgradeCost: 450_000 },
  { level: 4, name: 'Port międzynarodowy', slots: 6, capacity: 460, demand: 1.45, turnaround: 30, upkeep: 6_000, upgradeCost: 1_100_000 },
  { level: 5, name: 'Duży port międzynarodowy', slots: 8, capacity: 720, demand: 1.6, turnaround: 25, upkeep: 10_000, upgradeCost: 2_400_000 },
  { level: 6, name: 'Hub kontynentalny', slots: 10, capacity: 1_000, demand: 1.75, turnaround: 22, upkeep: 15_000, upgradeCost: 4_200_000 },
  { level: 7, name: 'Hub globalny', slots: 12, capacity: 1_350, demand: 1.9, turnaround: 19, upkeep: 21_000, upgradeCost: 6_800_000 },
  { level: 8, name: 'Megahub', slots: 15, capacity: 1_800, demand: 2.1, turnaround: 16, upkeep: 29_000, upgradeCost: 10_500_000 },
];

export const MAX_AIRPORT_LEVEL = AIRPORT_LEVELS.length;
export const airportLevel = (level: number): AirportLevelDef => AIRPORT_LEVELS[Math.max(0, Math.min(AIRPORT_LEVELS.length - 1, level - 1))];
