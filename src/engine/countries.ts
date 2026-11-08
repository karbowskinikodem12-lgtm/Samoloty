import { geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldTopo from 'world-atlas/countries-50m.json';
import { CITIES, CITY_BY_ID } from '../data/cities';
import { CONFIG } from './config';
import { cityDistance } from './geo';
import type { GameState, SimSink } from './types';
import { log } from './util';

/**
 * Kraje i ich odkrywanie.
 *
 * Kraj = obszar państwa z mapy (world-atlas). Miasta są przypisywane do krajów automatycznie
 * (punkt w wielokącie, w razie braku trafienia — najbliższy kraj), więc nowe miasto nie wymaga
 * żadnej dodatkowej konfiguracji. Gracz widzi tylko kraje odkryte: w zasięgu swoich lotnisk
 * (zasięg rośnie z poziomem lotniska) albo zbadane misją rozpoznawczą.
 */

export interface CountryInfo {
  id: string;
  /** Nazwa wyświetlana (polska nazwa z danych miast, a dla krajów bez miast — z mapy). */
  name: string;
  centroid: [number, number];
  cityIds: string[];
  /** Region (wg pierwszego miasta) — kraje bez miast nie mają regionu. */
  region: string | null;
}

const EARTH_R = 6371;

const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
/** Kraje z mapy (z unikalnym id; fragmenty bez id są pomijane). */
export const COUNTRY_FEATURES: Feature<Geometry, { name: string }>[] = fc.features.filter((f) => f.id !== undefined && f.id !== null);

export const COUNTRIES: Record<string, CountryInfo> = {};
for (const f of COUNTRY_FEATURES) {
  const id = String(f.id);
  COUNTRIES[id] = { id, name: f.properties?.name ?? id, centroid: geoCentroid(f) as [number, number], cityIds: [], region: null };
}

/** Prostokąty graniczne krajów (szybkie odrzucanie przed dokładnym testem punktu). */
const BOUNDS = new Map(COUNTRY_FEATURES.map((f) => [f, geoBounds(f)]));

function inBounds(f: Feature<Geometry, { name: string }>, [lon, lat]: [number, number]): boolean {
  const [[x0, y0], [x1, y1]] = BOUNDS.get(f)!;
  if (lat < y0 || lat > y1) return false;
  return x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1; // obsługa antypołudnika
}

function containing(p: [number, number]): Feature<Geometry, { name: string }> | undefined {
  return COUNTRY_FEATURES.find((f) => inBounds(f, p) && geoContains(f, p));
}

/** Punkt odległy o `km` w kierunku `bearing` (stopnie). */
function offset([lon, lat]: [number, number], km: number, bearing: number): [number, number] {
  const d = km / EARTH_R;
  const b = (bearing * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((((l2 * 180) / Math.PI + 540) % 360) - 180), (p2 * 180) / Math.PI];
}

/** Miasto → id kraju. */
export const CITY_COUNTRY: Record<string, string> = {};

function assign(cityId: string, id: string): void {
  const c = CITY_BY_ID[cityId];
  CITY_COUNTRY[cityId] = id;
  const info = COUNTRIES[id];
  if (!info.cityIds.length) {
    info.name = c.country;
    info.region = c.region;
  }
  info.cityIds.push(cityId);
}

// 1. Miasta leżące wewnątrz konturu kraju.
const unresolved: string[] = [];
for (const c of CITIES) {
  const hit = containing([c.lon, c.lat]);
  if (hit) assign(c.id, String(hit.id));
  else unresolved.push(c.id);
}

// 2. Lotniska na wybrzeżu i wyspach: próbkujemy punkty wokół lotniska, preferując kraj o tej samej nazwie.
for (const cityId of unresolved) {
  const c = CITY_BY_ID[cityId];
  let chosen: string | undefined;
  for (const km of [6, 15, 30, 60, 120, 250]) {
    const hits = new Map<string, number>();
    for (let a = 0; a < 360; a += 30) {
      const f = containing(offset([c.lon, c.lat], km, a));
      if (f) hits.set(String(f.id), (hits.get(String(f.id)) ?? 0) + 1);
    }
    if (!hits.size) continue;
    const same = [...hits.keys()].find((id) => COUNTRIES[id].name === c.country);
    chosen = same ?? [...hits.entries()].sort((x, y) => y[1] - x[1])[0][0];
    break;
  }
  if (!chosen) {
    // Ostatecznie: kraj o tej samej nazwie albo najbliższy środkiem.
    chosen = Object.values(COUNTRIES).find((i) => i.name === c.country)?.id;
    if (!chosen) {
      let best = Infinity;
      for (const info of Object.values(COUNTRIES)) {
        const d = geoDistance([c.lon, c.lat], info.centroid);
        if (d < best) {
          best = d;
          chosen = info.id;
        }
      }
    }
  }
  assign(cityId, chosen!);
}

/** Kraje, w których są miasta (te, które gracz może odkrywać i w których może budować). */
export const PLAYABLE_COUNTRIES: CountryInfo[] = Object.values(COUNTRIES).filter((c) => c.cityIds.length > 0);

export const countryOfCity = (cityId: string) => COUNTRIES[CITY_COUNTRY[cityId]];

export function isCityDiscovered(s: GameState, cityId: string): boolean {
  return s.discovered.includes(CITY_COUNTRY[cityId]);
}

/** Zasięg odkrywania wokół lotniska (km). */
export function discoveryRadius(level: number): number {
  return CONFIG.DISCOVERY_BASE_KM + CONFIG.DISCOVERY_PER_LEVEL_KM * (level - 1);
}

/** Odległość (km) z najbliższego działającego lotniska gracza do kraju. */
export function distanceToCountry(s: GameState, countryId: string): number {
  const info = COUNTRIES[countryId];
  let best = Infinity;
  const airports = Object.values(s.airports).filter((a) => a.buildEnd === undefined);
  for (const ap of airports) {
    const a = CITY_BY_ID[ap.cityId];
    for (const cid of info.cityIds) best = Math.min(best, cityDistance(ap.cityId, cid));
    best = Math.min(best, geoDistance([a.lon, a.lat], info.centroid) * EARTH_R);
  }
  return best;
}

function reveal(s: GameState, id: string, sink: SimSink | undefined, how: string): void {
  if (s.discovered.includes(id)) return;
  s.discovered.push(id);
  const info = COUNTRIES[id];
  if (info.cityIds.length) {
    const n = info.cityIds.length;
    log(s, 'good', `Odkryto kraj: ${info.name}`, `${how} ${n} ${n === 1 ? 'miasto' : n < 5 ? 'miasta' : 'miast'} do zbadania.`, sink);
  }
}

/**
 * Odkrywa kraje w zasięgu działających lotnisk: kraj jest odkryty, gdy któreś z jego miast
 * albo jego środek leży w zasięgu lotniska. Wywoływane po otwarciu i rozbudowie lotnisk.
 */
export function updateDiscovery(s: GameState, sink?: SimSink, quiet = false): void {
  const airports = Object.values(s.airports).filter((a) => a.buildEnd === undefined);
  for (const ap of airports) {
    const home = CITY_COUNTRY[ap.cityId];
    if (!s.discovered.includes(home)) s.discovered.push(home);
  }
  for (const id of Object.keys(COUNTRIES)) {
    if (s.discovered.includes(id)) continue;
    const info = COUNTRIES[id];
    const inRange = airports.some((ap) => {
      const r = discoveryRadius(ap.level);
      if (info.cityIds.some((cid) => cityDistance(ap.cityId, cid) <= r)) return true;
      const c = CITY_BY_ID[ap.cityId];
      return geoDistance([c.lon, c.lat], info.centroid) * EARTH_R <= r;
    });
    if (inRange) {
      if (quiet || !info.cityIds.length) {
        s.discovered.push(id);
      } else reveal(s, id, sink, 'Nowe kierunki w zasięgu Twojej sieci:');
    }
  }
}

// ---------- Misje rozpoznawcze ----------

export function expeditionCost(s: GameState, countryId: string): number {
  const d = distanceToCountry(s, countryId);
  return Math.round((CONFIG.EXPEDITION_BASE_COST + CONFIG.EXPEDITION_COST_PER_KM * Math.min(d, 15_000)) / 5_000) * 5_000;
}

export function expeditionDays(s: GameState, countryId: string): number {
  const d = distanceToCountry(s, countryId);
  return Math.round((CONFIG.EXPEDITION_BASE_DAYS + d / CONFIG.EXPEDITION_KM_PER_DAY) * 10) / 10;
}

export function checkExpedition(s: GameState, countryId: string): string | null {
  const info = COUNTRIES[countryId];
  if (!info || !info.cityIds.length) return 'Nieznany kraj.';
  if (s.discovered.includes(countryId)) return 'Kraj jest już odkryty.';
  if (s.expeditions.some((e) => e.countryId === countryId)) return 'Misja do tego kraju już trwa.';
  if (s.expeditions.length >= CONFIG.MAX_EXPEDITIONS) return `Możesz prowadzić najwyżej ${CONFIG.MAX_EXPEDITIONS} misje naraz.`;
  const cost = expeditionCost(s, countryId);
  if (s.money < cost) return `Brakuje środków (${cost.toLocaleString('pl-PL')} $).`;
  return null;
}

export function startExpedition(s: GameState, countryId: string): { ok: true } | { ok: false; reason: string } {
  const err = checkExpedition(s, countryId);
  if (err) return { ok: false, reason: err };
  const cost = expeditionCost(s, countryId);
  s.money -= cost;
  s.today.investment += cost;
  const days = expeditionDays(s, countryId);
  s.expeditions.push({ id: ++s.nextId, countryId, start: s.time, end: s.time + Math.round(days * 1440) });
  log(s, 'info', `Misja rozpoznawcza: ${COUNTRIES[countryId].name}`, `Wyniki za ok. ${days.toLocaleString('pl-PL')} dnia.`);
  return { ok: true };
}

/** Kończy misje rozpoznawcze, których termin minął. */
export function updateExpeditions(s: GameState, sink?: SimSink): void {
  if (!s.expeditions.length) return;
  const done = s.expeditions.filter((e) => e.end <= s.time);
  if (!done.length) return;
  s.expeditions = s.expeditions.filter((e) => e.end > s.time);
  for (const e of done) reveal(s, e.countryId, sink, 'Misja rozpoznawcza zakończona:');
}

/** Ile krajów (z miastami) gracz odkrył. */
export const discoveredPlayable = (s: GameState) => PLAYABLE_COUNTRIES.filter((c) => s.discovered.includes(c.id)).length;
