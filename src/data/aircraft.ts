import type { AircraftDef } from '../engine/types';

/**
 * Typy samolotów. Wszystkie modele są fikcyjne.
 * - minLevel: wymagany poziom linii lotniczej,
 * - minAirportLevel: minimalny poziom obu lotnisk na trasie,
 * - costPerKm / costPerFlight: koszt jednego lotu (paliwo, załoga, opłaty),
 * - upkeep: stały koszt dzienny (leasing serwisu, ubezpieczenie).
 */
export const AIRCRAFT: AircraftDef[] = [
  {
    id: 't70', name: 'Strix T-70', category: 'Turbośmigłowy',
    seats: 70, speed: 520, range: 1800, price: 300_000,
    costPerKm: 3.0, costPerFlight: 600, upkeep: 500, minLevel: 1, minAirportLevel: 1,
  },
  {
    id: 'rj100', name: 'Vireo RJ-100', category: 'Regionalny odrzutowiec',
    seats: 100, speed: 780, range: 3300, price: 750_000,
    costPerKm: 4.2, costPerFlight: 900, upkeep: 1_100, minLevel: 2, minAirportLevel: 1,
  },
  {
    id: 'n180', name: 'Aquila N-180', category: 'Wąskokadłubowy',
    seats: 180, speed: 840, range: 6200, price: 1_900_000,
    costPerKm: 7.0, costPerFlight: 1_500, upkeep: 2_600, minLevel: 4, minAirportLevel: 2,
  },
  {
    id: 'w300', name: 'Cygnus W-300', category: 'Szerokokadłubowy',
    seats: 300, speed: 900, range: 12_500, price: 5_200_000,
    costPerKm: 11.5, costPerFlight: 3_000, upkeep: 6_500, minLevel: 6, minAirportLevel: 3,
  },
  {
    id: 'x420', name: 'Albatros X-420', category: 'Dalekiego zasięgu',
    seats: 420, speed: 920, range: 15_500, price: 9_000_000,
    costPerKm: 15.0, costPerFlight: 4_200, upkeep: 10_000, minLevel: 8, minAirportLevel: 4,
  },
];

export const AIRCRAFT_BY_ID: Record<string, AircraftDef> = Object.fromEntries(AIRCRAFT.map((a) => [a.id, a]));
