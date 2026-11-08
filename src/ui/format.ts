import { MIN_PER_DAY } from '../engine/config';

const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** Kwota w zwięzłym polskim formacie: „820 $”, „45,2 tys. $”, „1,25 mln $”. */
export function money(v: number, signed = false): string {
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  const a = Math.abs(v);
  let body: string;
  if (a >= 1_000_000) body = `${nf2.format(a / 1_000_000)} mln`;
  else if (a >= 10_000) body = `${nf0.format(a / 1_000)} tys.`;
  else if (a >= 1_000) body = `${nf1.format(a / 1_000)} tys.`;
  else body = nf0.format(a);
  return `${sign}${body} $`;
}

/** Krótsza wersja do mapy. */
export function moneyShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${nf1.format(v / 1_000_000)} mln $`;
  if (a >= 1_000) return `${nf1.format(v / 1_000)} tys. $`;
  return `${nf0.format(v)} $`;
}

export const num = (v: number) => nf0.format(v);
export const km = (v: number) => `${nf0.format(v)} km`;
export const pct = (v: number) => `${nf0.format(v * 100)}%`;

export function clock(time: number): string {
  const m = Math.floor(time % MIN_PER_DAY);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const dayNumber = (time: number) => Math.floor(time / MIN_PER_DAY) + 1;

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export function hoursLeft(minutes: number): string {
  if (minutes >= 48 * 60) return `${Math.round(minutes / MIN_PER_DAY)} dni`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.max(1, Math.round(minutes))} min`;
}

/** Odmiana: plural(5, 'samolot', 'samoloty', 'samolotów'). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}

/** Pozostały czas w zwięzłej formie: „2 d 5 h”, „5 h 20 min”, „12 min”. */
export function timeLeft(minutes: number): string {
  const m = Math.max(0, Math.ceil(minutes));
  if (m >= MIN_PER_DAY) {
    const d = Math.floor(m / MIN_PER_DAY);
    const h = Math.floor((m % MIN_PER_DAY) / 60);
    return h > 0 ? `${d} d ${h} h` : `${d} d`;
  }
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm > 0 ? `${h} h ${mm} min` : `${h} h`;
  }
  return `${m} min`;
}
