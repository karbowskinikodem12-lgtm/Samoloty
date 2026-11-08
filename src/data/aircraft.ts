import type { AircraftDef } from '../engine/types';

/**
 * Typy samolotów. Wszystkie modele są fikcyjne.
 * - minLevel: wymagany poziom linii lotniczej,
 * - minAirportLevel: minimalny poziom obu lotnisk na trasie,
 * - costPerKm / costPerFlight: koszt jednego lotu (paliwo, załoga, opłaty),
 * - upkeep: stały koszt dzienny (serwis, ubezpieczenie),
 * - fareMult: mnożnik ceny biletu (np. naddźwiękowe połączenia premium).
 * Kolejność na liście = kolejność w katalogu.
 */
export const AIRCRAFT: AircraftDef[] = [
  {
    id: 'e19', name: 'Zephyr E-19', category: 'Elektryczny',
    seats: 19, speed: 400, range: 650, price: 140_000,
    costPerKm: 0.6, costPerFlight: 120, upkeep: 160, minLevel: 3, minAirportLevel: 1,
    note: 'Bardzo tani lot na krótkich trasach, mało miejsc.',
  },
  {
    id: 't50', name: 'Strix T-50', category: 'Turbośmigłowy',
    seats: 48, speed: 480, range: 1400, price: 200_000,
    costPerKm: 2.3, costPerFlight: 450, upkeep: 380, minLevel: 1, minAirportLevel: 1,
    note: 'Najtańszy start na małych trasach.',
  },
  {
    id: 't70', name: 'Strix T-70', category: 'Turbośmigłowy',
    seats: 70, speed: 520, range: 1800, price: 300_000,
    costPerKm: 3.0, costPerFlight: 600, upkeep: 500, minLevel: 1, minAirportLevel: 1,
  },
  {
    id: 'rj75', name: 'Vireo RJ-75', category: 'Regionalny odrzutowiec',
    seats: 76, speed: 800, range: 3700, price: 600_000,
    costPerKm: 3.6, costPerFlight: 750, upkeep: 900, minLevel: 2, minAirportLevel: 1,
    note: 'Szybki i daleki jak na swój rozmiar.',
  },
  {
    id: 'rj100', name: 'Vireo RJ-100', category: 'Regionalny odrzutowiec',
    seats: 100, speed: 780, range: 3300, price: 750_000,
    costPerKm: 4.2, costPerFlight: 900, upkeep: 1_100, minLevel: 2, minAirportLevel: 1,
  },
  {
    id: 'n150', name: 'Aquila N-150', category: 'Wąskokadłubowy',
    seats: 150, speed: 830, range: 5200, price: 1_400_000,
    costPerKm: 6.0, costPerFlight: 1_300, upkeep: 2_000, minLevel: 3, minAirportLevel: 2,
  },
  {
    id: 'n180', name: 'Aquila N-180', category: 'Wąskokadłubowy',
    seats: 180, speed: 840, range: 6200, price: 1_900_000,
    costPerKm: 7.0, costPerFlight: 1_500, upkeep: 2_600, minLevel: 4, minAirportLevel: 2,
  },
  {
    id: 'n220', name: 'Aquila N-220 LR', category: 'Wąskokadłubowy dalekiego zasięgu',
    seats: 220, speed: 840, range: 7400, price: 2_700_000,
    costPerKm: 8.2, costPerFlight: 1_800, upkeep: 3_400, minLevel: 5, minAirportLevel: 3,
    note: 'Pierwsze połączenia transatlantyckie bez dużej maszyny.',
  },
  {
    id: 'w250', name: 'Cygnus W-250', category: 'Szerokokadłubowy',
    seats: 250, speed: 890, range: 11_000, price: 4_000_000,
    costPerKm: 9.8, costPerFlight: 2_600, upkeep: 5_000, minLevel: 5, minAirportLevel: 3,
  },
  {
    id: 'w300', name: 'Cygnus W-300', category: 'Szerokokadłubowy',
    seats: 300, speed: 900, range: 12_500, price: 5_200_000,
    costPerKm: 11.5, costPerFlight: 3_000, upkeep: 6_500, minLevel: 6, minAirportLevel: 3,
  },
  {
    id: 'w350', name: 'Cygnus W-350 ER', category: 'Szerokokadłubowy',
    seats: 350, speed: 905, range: 14_000, price: 6_800_000,
    costPerKm: 12.8, costPerFlight: 3_500, upkeep: 8_200, minLevel: 7, minAirportLevel: 4,
  },
  {
    id: 'x420', name: 'Albatros X-420', category: 'Dalekiego zasięgu',
    seats: 420, speed: 920, range: 15_500, price: 9_000_000,
    costPerKm: 15.0, costPerFlight: 4_200, upkeep: 10_000, minLevel: 8, minAirportLevel: 4,
  },
  {
    id: 'x550', name: 'Albatros X-550', category: 'Superjumbo',
    seats: 550, speed: 910, range: 15_000, price: 13_000_000,
    costPerKm: 18.5, costPerFlight: 5_200, upkeep: 14_500, minLevel: 10, minAirportLevel: 6,
    note: 'Największa pojemność — tylko dla hubów kontynentalnych.',
  },
  {
    id: 's100', name: 'Meteor S-100', category: 'Naddźwiękowy',
    seats: 100, speed: 2_000, range: 7_500, price: 18_000_000,
    costPerKm: 22.0, costPerFlight: 6_000, upkeep: 20_000, minLevel: 11, minAirportLevel: 6, fareMult: 2.2,
    note: 'Lot ponad dwa razy szybszy, bilety 2,2× droższe.',
  },
];

export const AIRCRAFT_BY_ID: Record<string, AircraftDef> = Object.fromEntries(AIRCRAFT.map((a) => [a.id, a]));
