import { CITY_BY_ID } from './cities';
import { discoveredPlayable } from '../engine/countries';
import type { GameState, GoalDef } from '../engine/types';

/** Liczą się tylko działające lotniska (bez tych w budowie). */
const airports = (s: GameState) => Object.values(s.airports).filter((a) => a.buildEnd === undefined);
const routes = (s: GameState) => Object.values(s.routes);
const regionsServed = (s: GameState) => new Set(airports(s).map((a) => CITY_BY_ID[a.cityId].region)).size;
const lastDayProfit = (s: GameState) => {
  const d = s.history[s.history.length - 1];
  if (!d) return 0;
  return d.revenue - d.flightCost - d.planeUpkeep - d.airportUpkeep;
};

/**
 * Cele (kamienie milowe). Gracz widzi kilka pierwszych nieukończonych celów naraz.
 * Kolejność na liście = kolejność odkrywania. Nagroda trafia od razu na konto.
 */
export const GOALS: GoalDef[] = [
  { id: 'first_route', title: 'Pierwsze połączenie', description: 'Otwórz pierwszą trasę.', reward: 40_000, target: 1, progress: (s) => routes(s).length },
  { id: 'pax_100', title: 'Pierwsza setka', description: 'Dowieź do celu 100 pasażerów.', reward: 50_000, target: 100, progress: (s) => s.totals.pax },
  { id: 'airports_3', title: 'Mała siatka', description: 'Prowadź 3 lotniska.', reward: 60_000, target: 3, progress: (s) => airports(s).length },
  { id: 'fleet_3', title: 'Rosnąca flota', description: 'Posiadaj 3 samoloty.', reward: 80_000, target: 3, progress: (s) => Object.keys(s.planes).length },
  { id: 'upgrade_2', title: 'Lepszy terminal', description: 'Rozbuduj dowolne lotnisko do poziomu 2.', reward: 60_000, target: 2, progress: (s) => Math.max(0, ...airports(s).map((a) => a.level)) },
  { id: 'pax_1000', title: 'Tysiąc podróży', description: 'Dowieź do celu 1 000 pasażerów.', reward: 120_000, target: 1000, progress: (s) => s.totals.pax },
  { id: 'routes_5', title: 'Pajęczyna', description: 'Utrzymuj 5 tras jednocześnie.', reward: 150_000, target: 5, progress: (s) => routes(s).length },
  { id: 'region_2', title: 'Za granicę regionu', description: 'Obsługuj lotniska w 2 regionach.', reward: 250_000, target: 2, progress: regionsServed },
  { id: 'profit_100k', title: 'Rentowność', description: 'Zakończ dzień z zyskiem operacyjnym 100 tys. $.', reward: 150_000, target: 100_000, format: 'money', progress: lastDayProfit },
  { id: 'countries_10', title: 'Odkrywca', description: 'Odkryj 10 krajów.', reward: 200_000, target: 10, progress: (s) => discoveredPlayable(s) },
  { id: 'long_haul', title: 'Długi dystans', description: 'Otwórz trasę dłuższą niż 4 000 km.', reward: 200_000, target: 4000, format: 'km', progress: (s) => Math.max(0, ...routes(s).map((r) => r.distance)) },
  { id: 'upgrade_4', title: 'Port przesiadkowy', description: 'Rozbuduj lotnisko do poziomu 4.', reward: 300_000, target: 4, progress: (s) => Math.max(0, ...airports(s).map((a) => a.level)) },
  { id: 'airports_10', title: 'Sieć regionalna', description: 'Prowadź 10 lotnisk.', reward: 400_000, target: 10, progress: (s) => airports(s).length },
  { id: 'pax_10000', title: 'Dziesięć tysięcy', description: 'Dowieź do celu 10 000 pasażerów.', reward: 500_000, target: 10000, progress: (s) => s.totals.pax },
  { id: 'countries_25', title: 'Podróżnik', description: 'Odkryj 25 krajów.', reward: 600_000, target: 25, progress: (s) => discoveredPlayable(s) },
  { id: 'region_4', title: 'Linia międzykontynentalna', description: 'Obsługuj lotniska w 4 regionach.', reward: 1_000_000, target: 4, progress: regionsServed },
  { id: 'fleet_15', title: 'Duży przewoźnik', description: 'Posiadaj 15 samolotów.', reward: 800_000, target: 15, progress: (s) => Object.keys(s.planes).length },
  { id: 'profit_1m', title: 'Milion dziennie', description: 'Zakończ dzień z zyskiem operacyjnym 1 mln $.', reward: 1_500_000, target: 1_000_000, format: 'money', progress: lastDayProfit },
  { id: 'countries_60', title: 'Kartograf świata', description: 'Odkryj 60 krajów.', reward: 2_000_000, target: 60, progress: (s) => discoveredPlayable(s) },
  { id: 'upgrade_7', title: 'Hub globalny', description: 'Rozbuduj lotnisko do poziomu 7.', reward: 3_000_000, target: 7, progress: (s) => Math.max(0, ...airports(s).map((a) => a.level)) },
  { id: 'region_7', title: 'Globalny gracz', description: 'Obsługuj lotniska we wszystkich 7 regionach.', reward: 5_000_000, target: 7, progress: regionsServed },
  { id: 'pax_100000', title: 'Legenda przestworzy', description: 'Dowieź do celu 100 000 pasażerów.', reward: 5_000_000, target: 100000, progress: (s) => s.totals.pax },
];

export const VISIBLE_GOALS = 3;
