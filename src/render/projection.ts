import { geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldTopo from 'world-atlas/countries-50m.json';
import { CITIES, CITY_BY_ID } from '../data/cities';

/** Współrzędne „świata” — mapa jest rzutowana raz na prostokąt WORLD_W × WORLD_H, kamera tylko skaluje i przesuwa. */
export const WORLD_W = 1000;
export const WORLD_H = 520;

const projection = geoNaturalEarth1().fitExtent(
  [
    [4, 4],
    [WORLD_W - 4, WORLD_H - 4],
  ],
  { type: 'Sphere' },
);

export function project(lon: number, lat: number): [number, number] {
  const p = projection([lon, lat]);
  return p ? [p[0], p[1]] : [0, 0];
}

const pathGen = geoPath(projection);

function toPath2D(d: string | null): Path2D {
  return new Path2D(d ?? '');
}

let cachedPaths: { land: Path2D; borders: Path2D; sphere: Path2D; graticule: Path2D } | null = null;

/** Ścieżki tła (ląd, granice państw, kula, siatka) — liczone raz. */
export function basePaths() {
  if (cachedPaths) return cachedPaths;
  const topo = worldTopo as unknown as Topology<{ land: GeometryCollection; countries: GeometryCollection }>;
  const land = feature(topo, topo.objects.land) as unknown as FeatureCollection<Polygon | MultiPolygon>;
  // Tylko granice wewnętrzne (między dwoma państwami) — linia brzegowa jest rysowana osobno.
  const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  cachedPaths = {
    land: toPath2D(pathGen(land)),
    borders: toPath2D(pathGen(borders)),
    sphere: toPath2D(pathGen({ type: 'Sphere' })),
    graticule: toPath2D(pathGen(geoGraticule10())),
  };
  return cachedPaths;
}

/** Pozycje miast w układzie świata. */
export const CITY_XY: Record<string, [number, number]> = Object.fromEntries(
  CITIES.map((c) => [c.id, project(c.lon, c.lat)]),
);

export interface RouteGeometry {
  /** Odcinki polilinii (rozcięte na antypołudniku). */
  segments: [number, number][][];
  /** Punkt na ortodromie dla t∈[0,1] (od a do b). */
  at: (t: number) => [number, number];
}

const geomCache = new Map<string, RouteGeometry>();

/** Geometria trasy po ortodromie (łuk wielkiego koła), w układzie świata. */
export function routeGeometry(a: string, b: string): RouteGeometry {
  const key = `${a}|${b}`;
  const hit = geomCache.get(key);
  if (hit) return hit;
  const ca = CITY_BY_ID[a];
  const cb = CITY_BY_ID[b];
  const interp = geoInterpolate([ca.lon, ca.lat], [cb.lon, cb.lat]);
  const at = (t: number) => {
    const [lon, lat] = interp(t);
    return project(lon, lat);
  };
  const n = 48;
  const segments: [number, number][][] = [[]];
  let prev: [number, number] | null = null;
  for (let i = 0; i <= n; i++) {
    const p = at(i / n);
    if (prev && Math.abs(p[0] - prev[0]) > WORLD_W / 2) segments.push([]);
    segments[segments.length - 1].push(p);
    prev = p;
  }
  const g = { segments: segments.filter((s) => s.length > 1), at };
  geomCache.set(key, g);
  return g;
}
