/** Wszystkie pokrętła balansu w jednym miejscu. */
export const CONFIG = {
  START_MONEY: 800_000,
  START_PLANE: 't70',
  START_REPUTATION: 50,

  /** Minuty gry na sekundę czasu rzeczywistego przy prędkości 1x. */
  MINUTES_PER_SECOND: 30,
  /** Maksymalny krok symulacji (minuty) — dłuższe odcinki są dzielone. */
  MAX_STEP: 5,
  SPEEDS: [0, 1, 2, 4] as const,

  // Popyt
  /** Pasażerów na godzinę na √(mln mieszkańców) przy reputacji 50 i lotnisku poz. 1. */
  DEMAND_BASE: 6.0,
  /** Wzrost rynku: maksymalny dodatkowy mnożnik i liczba dni, po których jest osiągany. */
  MARKET_GROWTH_MAX: 0.6,
  MARKET_GROWTH_DAYS: 40,
  /** Każde osiągalne lotnisko zwiększa popyt (efekt sieci), aż do limitu. */
  CONNECTIVITY_BASE: 0.6,
  CONNECTIVITY_PER_DEST: 0.2,
  CONNECTIVITY_MAX: 1.8,
  /** Kara (w km) za każdą przesiadkę przy wyznaczaniu trasy pasażera. */
  TRANSFER_PENALTY_KM: 450,
  /** Waga celu: pop^EXP / (1 + dist / DIST_SCALE). */
  DEST_POP_EXP: 0.7,
  DEST_DIST_SCALE: 3000,

  // Ceny
  FARE_BASE: 80,
  FARE_PER_KM: 0.2,

  // Loty
  /** Stały narzut na start, kołowanie i lądowanie (minuty). */
  FLIGHT_OVERHEAD_MIN: 25,
  MAX_PLANES_PER_ROUTE: 6,

  // Koszty inwestycji
  AIRPORT_BASE_COST: 60_000,
  /** Koszt rośnie z populacją^AIRPORT_COST_EXP. */
  AIRPORT_COST_PER_MLN: 26_000,
  AIRPORT_COST_EXP: 0.8,
  /** Dopłata za każdy poziom infrastruktury ponad pierwszy, z jakim lotnisko startuje. */
  AIRPORT_START_LEVEL_PREMIUM: 150_000,
  /** Czas budowy lotniska (dni gry) = BASE + PER_TIER × kategoria miasta + PER_LEVEL × (poziom startowy − 1). */
  BUILD_DAYS_BASE: 1.25,
  BUILD_DAYS_PER_TIER: 0.4,
  BUILD_DAYS_PER_LEVEL: 0.5,
  ROUTE_BASE_COST: 15_000,
  ROUTE_COST_PER_KM: 18,
  ROUTE_REFUND: 0.3,
  PLANE_RESALE: 0.6,

  /** Koszt i wymagany poziom odblokowania n-tego regionu (indeks = liczba posiadanych regionów). */
  REGION_UNLOCK: [
    { cost: 0, level: 1 },
    { cost: 750_000, level: 2 },
    { cost: 2_000_000, level: 3 },
    { cost: 4_500_000, level: 5 },
    { cost: 8_000_000, level: 6 },
    { cost: 14_000_000, level: 7 },
    { cost: 22_000_000, level: 8 },
  ],

  // Reputacja
  /**
   * Reputacja dąży do celu wyznaczanego przez jakość obsługi (odsetek pasażerów obsłużonych
   * vs. tych, którzy zrezygnowali z powodu przepełnionych terminali) z danego okresu.
   */
  REP_TARGET_MIN: 20,
  REP_TARGET_MAX: 95,
  /** Stała czasowa dążenia reputacji do celu (godziny). */
  REP_TIME_CONSTANT_H: 14,
  /** Rezygnacja waży więcej niż obsłużenie. */
  REP_LOST_WEIGHT: 2,
  /** Mnożnik popytu = REP_DEMAND_MIN + (REP_DEMAND_MAX - REP_DEMAND_MIN) * rep / 100. */
  REP_DEMAND_MIN: 0.7,
  REP_DEMAND_MAX: 1.3,

  // Poziomy linii (doświadczenie = dowiezieni pasażerowie)
  LEVEL_XP: [0, 400, 1_500, 4_000, 9_000, 18_000, 32_000, 55_000, 90_000, 140_000, 210_000, 300_000],
  LEVEL_REWARD_PER_LEVEL: 50_000,

  // Wydarzenia
  EVENT_INTERVAL_H: [20, 44] as [number, number],
  FIRST_EVENT_H: 30,

  /** Po tylu dniach z ujemnym saldem gra się kończy. */
  BANKRUPTCY_DAYS: 3,

  HISTORY_DAYS: 30,
  LOG_SIZE: 60,
};

export const MIN_PER_DAY = 1440;
