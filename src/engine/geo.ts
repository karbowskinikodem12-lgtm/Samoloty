import { CITY_BY_ID } from '../data/cities';

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Odległość po ortodromie w km. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const cache = new Map<string, number>();

export function cityDistance(a: string, b: string): number {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  let d = cache.get(key);
  if (d === undefined) {
    const ca = CITY_BY_ID[a];
    const cb = CITY_BY_ID[b];
    d = Math.round(haversine(ca.lat, ca.lon, cb.lat, cb.lon));
    cache.set(key, d);
  }
  return d;
}
