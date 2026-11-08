import type { EventDef } from '../engine/types';

/**
 * Wydarzenia losowe. Aby dodać nowe, dopisz obiekt — silnik sam wybierze cel
 * (miasto / region z sieci gracza albo cały świat) i zastosuje efekty.
 * Nowy rodzaj efektu: pole w EventEffects (types.ts) + obsługa w engine/events.ts.
 */
export const EVENTS: EventDef[] = [
  {
    id: 'festival', title: 'Festiwal muzyczny', target: 'city', tone: 'good', weight: 10,
    text: 'Wielki festiwal w mieście {city} przyciąga tłumy podróżnych. Popyt na loty wyraźnie rośnie.',
    duration: [30, 54], effects: { demand: 1.8 },
  },
  {
    id: 'congress', title: 'Międzynarodowy kongres', target: 'city', tone: 'good', weight: 8,
    text: 'Do {city} zjeżdżają delegaci z całego świata. Więcej podróży służbowych.',
    duration: [20, 36], effects: { demand: 1.5 },
  },
  {
    id: 'final', title: 'Finał mistrzostw', target: 'city', tone: 'good', weight: 6,
    text: '{city} gości finał mistrzostw. Kibice rezerwują wszystkie wolne miejsca.',
    duration: [16, 28], effects: { demand: 2.2 },
  },
  {
    id: 'strike', title: 'Strajk obsługi naziemnej', target: 'city', tone: 'bad', weight: 6,
    text: 'Lotnisko {city} jest sparaliżowane strajkiem. Samoloty czekają na ziemi.',
    duration: [6, 14], effects: { closed: true },
    condition: (s) => Object.keys(s.airports).length >= 3,
  },
  {
    id: 'storm', title: 'Gwałtowne burze', target: 'city', tone: 'bad', weight: 7,
    text: 'Front burzowy nad {city} wstrzymuje starty i lądowania.',
    duration: [3, 8], effects: { closed: true },
    condition: (s) => Object.keys(s.airports).length >= 3,
  },
  {
    id: 'fuel_up', title: 'Wzrost cen paliwa', target: 'global', tone: 'bad', weight: 7,
    text: 'Ceny paliwa lotniczego skoczyły. Każdy lot kosztuje więcej.',
    duration: [48, 84], effects: { fuel: 1.35 },
  },
  {
    id: 'fuel_down', title: 'Tanie paliwo', target: 'global', tone: 'good', weight: 7,
    text: 'Ceny ropy spadają — koszty operacyjne lotów są niższe.',
    duration: [48, 84], effects: { fuel: 0.75 },
  },
  {
    id: 'tourism', title: 'Szczyt sezonu turystycznego', target: 'region', tone: 'good', weight: 8,
    text: 'Sezon wakacyjny w regionie {region}. Popyt we wszystkich miastach regionu rośnie.',
    duration: [60, 100], effects: { demand: 1.4 },
  },
  {
    id: 'slowdown', title: 'Spowolnienie gospodarcze', target: 'region', tone: 'bad', weight: 5,
    text: 'Firmy w regionie {region} ograniczają podróże. Popyt spada.',
    duration: [48, 84], effects: { demand: 0.75 },
    condition: (s) => s.level >= 3,
  },
  {
    id: 'price_war', title: 'Wojna cenowa', target: 'global', tone: 'bad', weight: 5,
    text: 'Konkurencja obniża ceny biletów. Musisz dopasować taryfy.',
    duration: [36, 60], effects: { fare: 0.85 },
    condition: (s) => s.level >= 2,
  },
  {
    id: 'long_weekend', title: 'Długi weekend', target: 'global', tone: 'good', weight: 6,
    text: 'Długi weekend w wielu krajach — wszyscy chcą gdzieś polecieć.',
    duration: [36, 60], effects: { demand: 1.3 },
  },
  {
    id: 'subsidy', title: 'Dotacja na rozwój połączeń', target: 'global', tone: 'good', weight: 4,
    text: 'Rząd wspiera rozwój lokalnych połączeń. Otrzymujesz jednorazową dotację.',
    duration: [0, 0], effects: { cash: (s) => 60_000 + 40_000 * s.level },
  },
  {
    id: 'award', title: 'Nagroda za punktualność', target: 'global', tone: 'good', weight: 4,
    text: 'Twoja linia zdobyła wyróżnienie w rankingu punktualności. Reputacja rośnie.',
    duration: [0, 0], effects: { reputation: 6 },
    condition: (s) => s.totals.flights >= 40,
  },
  {
    id: 'inspection', title: 'Kontrola techniczna floty', target: 'global', tone: 'bad', weight: 3,
    text: 'Nadzór lotniczy zlecił dodatkowe przeglądy. Płacisz za nie z bieżącego budżetu.',
    duration: [0, 0], effects: { cash: (s) => -(15_000 * Object.keys(s.planes).length) },
    condition: (s) => Object.keys(s.planes).length >= 3,
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
