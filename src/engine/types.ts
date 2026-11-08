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

// ---------- Wydarzenia ----------

export type EventTarget = 'city' | 'region' | 'global';
export type Tone = 'good' | 'bad' | 'neutral';
export type EventCategory = 'economy' | 'investors' | 'competition' | 'local' | 'international' | 'infrastructure';
/** minor — powiadomienie w rogu; major — panel na środku ekranu; critical — panel na środku, najwyższa ważność. */
export type Severity = 'minor' | 'major' | 'critical';

/** Liczba albo przedział [min, max], z którego losowana jest wartość. */
export type Num = number | [number, number];

/** Kontekst wyliczania kwot wydarzenia. */
export interface EventContext {
  targetId: string | null;
  /** Skala gospodarki gracza: średni dzienny przychód z ostatnich dni (min. 60 tys. $). */
  scale: number;
}

/** Kwota stała, przedział albo funkcja stanu gry. */
export type Amount = Num | ((s: GameState, ctx: EventContext) => number);

/**
 * Deklaratywny opis skutków wydarzenia albo jednej z decyzji.
 * Pola natychmiastowe działają od razu, pola modyfikatorów — przez `hours` godzin gry.
 */
export interface EffectSpec {
  // natychmiastowe
  cash?: Amount;
  reputation?: Num;
  /** Kredyt: kwota wypłacana od razu, spłacana w ratach dziennych z odsetkami `rate` (np. 0.2 = 20%). */
  loan?: { amount: Amount; days: number; rate: number };
  /** Umorzenie części pozostałego zadłużenia (0..1). */
  debtRelief?: number;
  /** Darmowy samolot w hangarze (id typu). */
  grantPlane?: string;
  /** Rozbudowa lotniska będącego celem wydarzenia o jeden poziom. */
  upgradeAirport?: boolean;

  // czasowe modyfikatory
  hours?: Num;
  /** Zakres modyfikatorów (domyślnie zgodny z celem wydarzenia). */
  scope?: EventTarget;
  demand?: Num;
  fare?: Num;
  fuel?: Num;
  upkeep?: Num;
  revenue?: Num;
  turnaround?: Num;
  closed?: boolean;
}

export interface ChoiceDef {
  label: string;
  description?: string;
  effects: EffectSpec;
}

export interface EventVariant {
  title: string;
  /** Opis; {city}, {region}, {country} są podmieniane. */
  text: string;
}

export interface EventDef {
  id: string;
  category: EventCategory;
  severity: Severity;
  tone: Tone;
  weight: number;
  target: EventTarget;
  variants: EventVariant[];
  /** Skutki wydarzenia bez wyboru. */
  effects?: EffectSpec;
  /** Opcje decyzji (wydarzenie z wyborem jest zawsze pokazywane na środku ekranu). */
  choices?: ChoiceDef[];
  condition?: (s: GameState) => boolean;
  /** Dodatkowy filtr miast-celów (tylko działające lotniska są brane pod uwagę). */
  cityFilter?: (s: GameState, cityId: string) => boolean;
  /** Minimalny odstęp (godziny gry) przed ponownym wystąpieniem. Domyślnie 72. */
  cooldownH?: number;
}

/** Modyfikatory aktywne przez określony czas. */
export interface ModifierSet {
  demand?: number;
  fare?: number;
  fuel?: number;
  upkeep?: number;
  revenue?: number;
  turnaround?: number;
  closed?: boolean;
}

/** Skutki wydarzenia po wylosowaniu konkretnych wartości. */
export interface ResolvedEffects {
  cash?: number;
  reputation?: number;
  loan?: { amount: number; perDay: number; days: number };
  debtRelief?: number;
  grantPlane?: string;
  upgradeAirport?: string;
  mods?: ModifierSet & { hours: number; scope: EventTarget; targetId: string | null };
}

export interface ConsequenceLine {
  text: string;
  tone: Tone;
}

export interface EventChoice {
  label: string;
  description?: string;
  effects: ResolvedEffects;
  lines: ConsequenceLine[];
}

/** Konkretne wystąpienie wydarzenia (zapisywane w stanie, dopóki gracz go nie potwierdzi). */
export interface EventInstance {
  uid: number;
  defId: string;
  category: EventCategory;
  severity: Severity;
  tone: Tone;
  title: string;
  text: string;
  targetId: string | null;
  target: EventTarget;
  time: number;
  /** Skutki już zastosowane (wydarzenia bez wyboru). */
  effects?: ResolvedEffects;
  lines?: ConsequenceLine[];
  choices?: EventChoice[];
}

export interface Loan {
  id: number;
  title: string;
  perDay: number;
  daysLeft: number;
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
  title: string;
  tone: Tone;
  category: EventCategory;
  targetId: string | null;
  scope: EventTarget;
  start: number;
  end: number;
  mods: ModifierSet;
}

export interface DayStats {
  day: number;
  revenue: number;
  flightCost: number;
  planeUpkeep: number;
  airportUpkeep: number;
  /** Jednorazowe wpływy (nagrody, dotacje). */
  bonus: number;
  /** Raty kredytów i inne płatności finansowe. */
  financing?: number;
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
  /** Wydarzenia czekające na potwierdzenie lub decyzję gracza (panel na środku ekranu). */
  pendingEvents: EventInstance[];
  /** Najwcześniejszy moment kolejnego ważnego wydarzenia. */
  nextMajorAt: number;
  /** Czas, do którego dane wydarzenie nie może się powtórzyć. */
  eventCooldowns: Record<string, number>;
  loans: Loan[];
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
