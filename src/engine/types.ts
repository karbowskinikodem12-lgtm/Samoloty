/**
 * Model danych gry. Cały GameState to zwykły JSON — można go zapisać w localStorage,
 * sklonować i odtworzyć. Definicje (miasta, samoloty, wydarzenia...) są statyczne
 * i żyją w src/data; stan przechowuje tylko identyfikatory.
 */

// ---------- Definicje statyczne ----------

export interface RegionDef {
  id: string;
  name: string;
  short: string;
}

export interface CityDef {
  id: string;
  name: string;
  country: string;
  /** Kod lotniska wyświetlany na mapie (IATA). */
  code: string;
  region: string;
  lat: number;
  lon: number;
  /** Populacja aglomeracji w milionach. */
  pop: number;
  /** Ważny międzynarodowy port przesiadkowy (lepsza infrastruktura, wyższy limit rozbudowy). */
  hub?: boolean;
  /** Mnożnik atrakcyjności turystycznej (domyślnie 1). */
  tourism?: number;
}

export interface AircraftDef {
  id: string;
  name: string;
  category: string;
  seats: number;
  /** km/h */
  speed: number;
  /** km */
  range: number;
  price: number;
  costPerKm: number;
  costPerFlight: number;
  upkeep: number;
  minLevel: number;
  minAirportLevel: number;
}

export interface AirportLevelDef {
  level: number;
  slots: number;
  capacity: number;
  demand: number;
  turnaround: number;
  upkeep: number;
  upgradeCost: number;
}

/** Modyfikatory, jakie może nałożyć wydarzenie na cel (miasto, region lub cały świat). */
export interface EventEffects {
  /** Mnożnik popytu w mieście / regionie / globalnie. */
  demand?: number;
  /** Mnożnik kosztów lotów (globalnie). */
  fuel?: number;
  /** Mnożnik cen biletów (globalnie). */
  fare?: number;
  /** Lotnisko zamknięte — samoloty nie startują z niego ani do niego. */
  closed?: boolean;
  /** Jednorazowa zmiana środków (może zależeć od stanu). */
  cash?: number | ((s: GameState) => number);
  /** Jednorazowa zmiana reputacji. */
  reputation?: number;
}

export type EventTarget = 'city' | 'region' | 'global';
export type Tone = 'good' | 'bad' | 'neutral';

export interface EventDef {
  id: string;
  title: string;
  /** Szablon opisu; {city}, {region} są podmieniane. */
  text: string;
  target: EventTarget;
  tone: Tone;
  weight: number;
  /** Czas trwania w godzinach [min, max]; 0 = wydarzenie natychmiastowe. */
  duration: [number, number];
  effects: EventEffects;
  /** Opcjonalny warunek wystąpienia. */
  condition?: (s: GameState) => boolean;
}

export interface GoalDef {
  id: string;
  title: string;
  description: string;
  reward: number;
  target: number;
  progress: (s: GameState) => number;
  /** Jak sformatować postęp (np. pieniądze). */
  format?: 'number' | 'money' | 'km';
}

// ---------- Stan gry ----------

export interface Airport {
  cityId: string;
  level: number;
  /** Pasażerowie czekający w terminalu, wg celu podróży (id miasta → liczba). */
  waiting: Record<string, number>;
  /** Ułamkowy akumulator generowania pasażerów. */
  spawnAcc: number;
  openedDay: number;
  /** Lotnisko w budowie: czas gry (min), w którym rozpoczęto i zakończy się budowa. Brak pól = lotnisko działa. */
  buildStart?: number;
  buildEnd?: number;
  /** Statystyki bieżącego dnia. */
  today: { spawned: number; lost: number; departed: number };
  yesterday: { spawned: number; lost: number; departed: number };
}

export interface RouteDayStats {
  flights: number;
  pax: number;
  seats: number;
  revenue: number;
  cost: number;
}

export interface Route {
  id: string;
  a: string;
  b: string;
  distance: number;
  openedDay: number;
  openCost: number;
  today: RouteDayStats;
  yesterday: RouteDayStats;
  /** Obłożenie ostatnich lotów (0..1), najnowsze na końcu. */
  loads: number[];
}

export type PlaneStatus = 'idle' | 'boarding' | 'flying';

export interface Plane {
  id: string;
  typeId: string;
  reg: string;
  routeId: string | null;
  status: PlaneStatus;
  /** Lotnisko, na którym stoi / z którego wyleciał. */
  from: string;
  /** Lotnisko docelowe bieżącego odcinka. */
  to: string;
  /** Postęp lotu 0..1. */
  progress: number;
  /** Minuty do końca obsługi naziemnej. */
  timer: number;
  /** Pasażerowie na pokładzie wg celu podróży. */
  cargo: Record<string, number>;
  /** Po wylądowaniu wraca do hangaru. */
  leaving: boolean;
  flights: number;
  revenue: number;
  boughtDay: number;
}

export interface ActiveEvent {
  uid: number;
  defId: string;
  targetId: string | null;
  start: number;
  end: number;
}

export interface DayStats {
  day: number;
  revenue: number;
  flightCost: number;
  planeUpkeep: number;
  airportUpkeep: number;
  /** Jednorazowe wpływy (nagrody, dotacje). */
  bonus: number;
  /** Inwestycje (zakupy, rozbudowy). */
  investment: number;
  pax: number;
  lost: number;
}

export type LogKind = 'info' | 'good' | 'bad' | 'goal' | 'level' | 'event';

export interface LogEntry {
  id: number;
  time: number;
  kind: LogKind;
  title: string;
  text?: string;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  /** Czas gry w minutach od startu. */
  time: number;
  money: number;
  /** 0..100 */
  reputation: number;
  /** Doświadczenie = pasażerowie dowiezieni do celu. */
  xp: number;
  level: number;
  startCity: string;
  airlineName: string;
  unlockedRegions: string[];
  airports: Record<string, Airport>;
  routes: Record<string, Route>;
  planes: Record<string, Plane>;
  nextId: number;
  /** Zwiększany przy każdej zmianie sieci tras — unieważnia cache tras. */
  netRev: number;
  /** Zwiększany przy zmianie aktywnych wydarzeń — unieważnia cache modyfikatorów. */
  eventRev: number;
  events: ActiveEvent[];
  nextEventAt: number;
  goalsDone: string[];
  today: DayStats;
  history: DayStats[];
  totals: { pax: number; revenue: number; lost: number; flights: number };
  log: LogEntry[];
  /** Kolejne dni zakończone z ujemnym saldem. */
  negativeDays: number;
  gameOver: boolean;
}

// ---------- Wynik akcji i zdarzenia dla warstwy wizualnej ----------

export type ActionResult = { ok: true; id?: string } | { ok: false; reason: string };

/** Zdarzenia generowane przez symulację dla renderera (nie są zapisywane). */
export interface SimSink {
  arrivals: { cityId: string; amount: number }[];
  notices: LogEntry[];
}
