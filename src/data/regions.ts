import type { RegionDef } from '../engine/types';

/**
 * Regiony świata. Kolejność nie ma znaczenia dla mechaniki — koszt odblokowania
 * zależy od liczby regionów, które gracz już posiada (patrz config.REGION_UNLOCK).
 * Aby dodać region: dopisz wpis tutaj i przypisz do niego miasta w cities.ts.
 */
export const REGIONS: RegionDef[] = [
  { id: 'europe', name: 'Europa', short: 'EU' },
  { id: 'north_america', name: 'Ameryka Północna', short: 'NA' },
  { id: 'south_america', name: 'Ameryka Południowa', short: 'SA' },
  { id: 'middle_east', name: 'Bliski Wschód', short: 'ME' },
  { id: 'africa', name: 'Afryka', short: 'AF' },
  { id: 'asia', name: 'Azja', short: 'AS' },
  { id: 'oceania', name: 'Oceania', short: 'OC' },
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
