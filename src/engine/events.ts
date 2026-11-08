import { AIRCRAFT_BY_ID } from '../data/aircraft';
import { CITY_BY_ID } from '../data/cities';
import { EVENT_BY_ID, EVENTS } from '../data/events';
import { REGION_BY_ID } from '../data/regions';
import { addPlane } from './actions';
import { maxLevelFor } from './cities';
import { CONFIG } from './config';
import { regionsInNetwork } from './network';
import { pickWeighted, random, randRange } from './rng';
import type {
  ActiveEvent, Amount, ConsequenceLine, EffectSpec, EventChoice, EventContext, EventDef, EventInstance, GameState, LogKind, Num,
  ResolvedEffects, SimSink,
} from './types';
import { clamp, log } from './util';

export { demandModifier, getModifiers } from './modifiers';

/**
 * System wydarzeń.
 *
 * 1. Co kilkanaście godzin gry losowane jest wydarzenie z data/events.ts (z uwzględnieniem warunków,
 *    odstępów i poziomu ważności), następnie cel (miasto / region / świat), wariant tekstu i konkretne wartości.
 * 2. Drobne wydarzenia (minor, bez wyboru) działają od razu i pojawiają się jako powiadomienie w rogu.
 * 3. Ważne (major) i krytyczne (critical) oraz wszystkie wydarzenia z decyzją trafiają do kolejki
 *    `pendingEvents` — interfejs pokazuje je na środku ekranu i wstrzymuje czas do decyzji gracza.
 */

// ---------- Skala i losowanie wartości ----------

/** Średni dzienny przychód z ostatnich 3 dni — kwoty wydarzeń rosną razem z linią. */
export function econScale(s: GameState): number {
  const recent = s.history.slice(-3);
  const avg = recent.length ? recent.reduce((a, d) => a + d.revenue, 0) / recent.length : 0;
  return Math.max(CONFIG.EVENT_MIN_SCALE, avg);
}

function rollNum(s: GameState, v: Num | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  return randRange(s, v[0], v[1]);
}

function rollAmount(s: GameState, a: Amount | undefined, ctx: EventContext): number | undefined {
  if (a === undefined) return undefined;
  if (typeof a === 'function') return a(s, ctx);
  return rollNum(s, a);
}

const round = (v: number, step: number) => Math.round(v / step) * step;
const roundMoney = (v: number) => (Math.abs(v) >= 100_000 ? round(v, 5_000) : round(v, 1_000));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Zamienia deklarację skutków na konkretne wartości. */
export function resolveEffects(s: GameState, spec: EffectSpec, def: EventDef, ctx: EventContext): ResolvedEffects {
  const out: ResolvedEffects = {};
  const cash = rollAmount(s, spec.cash, ctx);
  if (cash !== undefined && cash !== 0) out.cash = roundMoney(cash);
  const rep = rollNum(s, spec.reputation);
  if (rep !== undefined && rep !== 0) out.reputation = Math.round(rep);
  if (spec.loan) {
    const amount = roundMoney(rollAmount(s, spec.loan.amount, ctx) ?? 0);
    out.loan = { amount, days: spec.loan.days, perDay: Math.round((amount * (1 + spec.loan.rate)) / spec.loan.days) };
  }
  if (spec.debtRelief) out.debtRelief = spec.debtRelief;
  if (spec.grantPlane) out.grantPlane = spec.grantPlane;
  if (spec.upgradeAirport && ctx.targetId) out.upgradeAirport = ctx.targetId;

  const hasMods = ['demand', 'fare', 'fuel', 'upkeep', 'revenue', 'turnaround', 'closed'].some((k) => spec[k as keyof EffectSpec] !== undefined);
  if (hasMods) {
    const scope = spec.scope ?? def.target;
    const targetId = scope === 'global' ? null : scope === 'region' && def.target === 'city' && ctx.targetId ? CITY_BY_ID[ctx.targetId].region : ctx.targetId;
    const m: NonNullable<ResolvedEffects['mods']> = { hours: Math.round(rollNum(s, spec.hours ?? 48)!), scope: targetId ? scope : 'global', targetId };
    for (const k of ['demand', 'fare', 'fuel', 'upkeep', 'revenue', 'turnaround'] as const) {
      const v = rollNum(s, spec[k]);
      if (v !== undefined) m[k] = round2(v);
    }
    if (spec.closed) m.closed = true;
    out.mods = m;
  }
  return out;
}

// ---------- Opis konsekwencji ----------

const nf = (v: number) => Math.round(v).toLocaleString('pl-PL');
function moneyText(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(a / 1_000_000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mln $`;
  if (a >= 1_000) return `${nf(a / 1_000)} tys. $`;
  return `${nf(a)} $`;
}

function durationText(hours: number): string {
  if (hours < 48) return `${hours} h`;
  const d = Math.round(hours / 24);
  return `${d} ${d === 1 ? 'dzień' : 'dni'}`;
}

function scopeText(scope: string, targetId: string | null): string {
  if (!targetId) return 'na całym świecie';
  if (scope === 'city') return `w mieście ${CITY_BY_ID[targetId]?.name ?? targetId}`;
  if (scope === 'region') return `w regionie ${REGION_BY_ID[targetId]?.name ?? targetId}`;
  return 'na całym świecie';
}

const pctText = (mult: number) => `${mult >= 1 ? '+' : '−'}${Math.round(Math.abs(mult - 1) * 100)}%`;

/** Czytelna lista konsekwencji dla gracza. */
export function describeEffects(s: GameState, e: ResolvedEffects): ConsequenceLine[] {
  const lines: ConsequenceLine[] = [];
  if (e.cash) lines.push({ text: `${e.cash > 0 ? '+' : '−'}${moneyText(e.cash)} na koncie`, tone: e.cash > 0 ? 'good' : 'bad' });
  if (e.loan)
    lines.push({
      text: `Kredyt ${moneyText(e.loan.amount)}, spłata ${moneyText(e.loan.perDay)} dziennie przez ${e.loan.days} dni (łącznie ${moneyText(e.loan.perDay * e.loan.days)})`,
      tone: 'neutral',
    });
  if (e.debtRelief) {
    const debt = s.loans.reduce((a, l) => a + l.perDay * l.daysLeft, 0);
    lines.push({ text: `Umorzenie ${Math.round(e.debtRelief * 100)}% zadłużenia (ok. ${moneyText(debt * e.debtRelief)})`, tone: 'good' });
  }
  if (e.grantPlane) lines.push({ text: `Nowy samolot w hangarze: ${AIRCRAFT_BY_ID[e.grantPlane]?.name ?? e.grantPlane}`, tone: 'good' });
  if (e.upgradeAirport) {
    const ap = s.airports[e.upgradeAirport];
    lines.push({ text: `Lotnisko ${CITY_BY_ID[e.upgradeAirport].name}: rozbudowa do poziomu ${(ap?.level ?? 0) + 1}`, tone: 'good' });
  }
  const m = e.mods;
  if (m) {
    const where = scopeText(m.scope, m.targetId);
    const dur = `przez ${durationText(m.hours)}`;
    if (m.closed) {
      const what = m.scope === 'region' ? `Lotniska ${where} zamknięte` : `Lotnisko ${CITY_BY_ID[m.targetId ?? '']?.name ?? ''} zamknięte`;
      lines.push({ text: `${what} ${dur}`, tone: 'bad' });
    }
    if (m.demand !== undefined) lines.push({ text: `Popyt ${pctText(m.demand)} ${where} ${dur}`, tone: m.demand >= 1 ? 'good' : 'bad' });
    if (m.fare !== undefined) lines.push({ text: `Ceny biletów ${pctText(m.fare)} ${where} ${dur}`, tone: m.fare >= 1 ? 'good' : 'bad' });
    if (m.fuel !== undefined) lines.push({ text: `Koszty lotów ${pctText(m.fuel)} ${dur}`, tone: m.fuel <= 1 ? 'good' : 'bad' });
    if (m.upkeep !== undefined) lines.push({ text: `Koszty utrzymania ${pctText(m.upkeep)} ${dur}`, tone: m.upkeep <= 1 ? 'good' : 'bad' });
    if (m.revenue !== undefined) lines.push({ text: `Przychody z biletów ${pctText(m.revenue)} ${dur}`, tone: m.revenue >= 1 ? 'good' : 'bad' });
    if (m.turnaround !== undefined)
      lines.push({ text: `Obsługa samolotów ${m.turnaround >= 1 ? 'dłuższa' : 'krótsza'} o ${Math.round(Math.abs(m.turnaround - 1) * 100)}% ${where} ${dur}`, tone: m.turnaround <= 1 ? 'good' : 'bad' });
  }
  if (e.reputation) lines.push({ text: `Reputacja ${e.reputation > 0 ? '+' : '−'}${Math.abs(e.reputation)}`, tone: e.reputation > 0 ? 'good' : 'bad' });
  if (!lines.length) lines.push({ text: 'Brak bezpośrednich skutków', tone: 'neutral' });
  return lines;
}

// ---------- Stosowanie skutków ----------

export function applyEffects(s: GameState, e: ResolvedEffects, title: string, def: EventDef): void {
  if (e.cash) {
    s.money += e.cash;
    if (e.cash > 0) s.today.bonus += e.cash;
    else s.today.financing = (s.today.financing ?? 0) - e.cash;
  }
  if (e.reputation) s.reputation = clamp(s.reputation + e.reputation, 0, 100);
  if (e.loan) {
    s.money += e.loan.amount;
    s.today.bonus += e.loan.amount;
    s.loans.push({ id: ++s.nextId, title, perDay: e.loan.perDay, daysLeft: e.loan.days });
  }
  if (e.debtRelief) {
    for (const l of s.loans) l.perDay = Math.round(l.perDay * (1 - e.debtRelief));
  }
  if (e.grantPlane && AIRCRAFT_BY_ID[e.grantPlane]) {
    const p = addPlane(s, e.grantPlane);
    p.from = p.to = s.startCity;
  }
  if (e.upgradeAirport) {
    const ap = s.airports[e.upgradeAirport];
    if (ap && ap.buildEnd === undefined && ap.level < maxLevelFor(s, ap.cityId)) ap.level++;
  }
  if (e.mods) {
    const { hours, scope, targetId, ...mods } = e.mods;
    const ev: ActiveEvent = {
      uid: ++s.nextId,
      defId: def.id,
      title,
      tone: def.tone,
      category: def.category,
      targetId,
      scope,
      start: s.time,
      end: s.time + hours * 60,
      mods,
    };
    s.events.push(ev);
    s.eventRev++;
  }
}

// ---------- Losowanie wydarzeń ----------

function fillText(text: string, targetId: string | null, def: EventDef): string {
  if (!targetId) return text.replaceAll('{region}', 'świecie');
  if (def.target === 'city') {
    const c = CITY_BY_ID[targetId];
    return text
      .replaceAll('{city}', c.name)
      .replaceAll('{country}', c.country)
      .replaceAll('{region}', REGION_BY_ID[c.region].name);
  }
  return text.replaceAll('{region}', REGION_BY_ID[targetId]?.name ?? targetId);
}

function pickTarget(s: GameState, def: EventDef): string | null | undefined {
  if (def.target === 'global') return null;
  if (def.target === 'region') return pickWeighted(s, [...regionsInNetwork(s)], () => 1) ?? undefined;
  const busy = new Set(s.events.filter((e) => e.scope === 'city').map((e) => e.targetId));
  const cities = Object.values(s.airports)
    .filter((a) => a.buildEnd === undefined && !busy.has(a.cityId))
    .map((a) => a.cityId)
    .filter((id) => !def.cityFilter || def.cityFilter(s, id));
  return pickWeighted(s, cities, (id) => Math.sqrt(CITY_BY_ID[id].pop) * (CITY_BY_ID[id].tourism ?? 1)) ?? undefined;
}

/** Tworzy konkretne wystąpienie wydarzenia (bez stosowania skutków). Zwraca null, gdy brak celu. */
export function createEventInstance(s: GameState, def: EventDef, forcedTarget?: string | null): EventInstance | null {
  const targetId = forcedTarget !== undefined ? forcedTarget : pickTarget(s, def);
  if (targetId === undefined) return null;
  const variant = def.variants[Math.floor(random(s) * def.variants.length)];
  const ctx: EventContext = { targetId, scale: econScale(s) };
  const inst: EventInstance = {
    uid: ++s.nextId,
    defId: def.id,
    category: def.category,
    severity: def.severity,
    tone: def.tone,
    title: fillText(variant.title, targetId, def),
    text: fillText(variant.text, targetId, def),
    targetId,
    target: def.target,
    time: s.time,
  };
  if (def.choices?.length) {
    inst.choices = def.choices.map((c) => {
      const effects = resolveEffects(s, c.effects, def, ctx);
      return { label: c.label, description: c.description, effects, lines: describeEffects(s, effects) };
    });
  } else if (def.effects) {
    inst.effects = resolveEffects(s, def.effects, def, ctx);
    inst.lines = describeEffects(s, inst.effects);
  }
  return inst;
}

const logKind = (def: EventDef): LogKind => (def.tone === 'bad' ? 'bad' : def.tone === 'good' ? 'event' : 'info');

/** Uruchamia wydarzenie: drobne stosuje od razu, ważne dodaje do kolejki panelu na środku ekranu. */
export function fireEvent(s: GameState, inst: EventInstance, sink?: SimSink): void {
  const def = EVENT_BY_ID[inst.defId];
  if (inst.effects) applyEffects(s, inst.effects, inst.title, def);
  const central = inst.severity !== 'minor' || !!inst.choices;
  if (central) {
    s.pendingEvents.push(inst);
    log(s, logKind(def), inst.title, inst.text);
  } else {
    log(s, logKind(def), inst.title, inst.lines?.map((l) => l.text).join(' · ') ?? inst.text, sink);
  }
}

/** Wydarzenia, które mogą teraz wystąpić. */
function eligible(s: GameState, allowCentral: boolean): EventDef[] {
  return EVENTS.filter((d) => {
    if ((s.eventCooldowns[d.id] ?? 0) > s.time) return false;
    if (!allowCentral && (d.severity !== 'minor' || d.choices)) return false;
    if (d.condition && !d.condition(s)) return false;
    return true;
  });
}

/** Wygasza zakończone wydarzenia i co jakiś czas losuje nowe. */
export function updateEvents(s: GameState, sink: SimSink): void {
  const before = s.events.length;
  s.events = s.events.filter((e) => e.end > s.time);
  if (s.events.length !== before) s.eventRev++;

  if (s.time < s.nextEventAt) return;
  s.nextEventAt = s.time + randRange(s, CONFIG.EVENT_INTERVAL_H[0], CONFIG.EVENT_INTERVAL_H[1]) * 60;
  if (Object.values(s.airports).filter((a) => a.buildEnd === undefined).length < 2) return;

  const allowCentral = s.pendingEvents.length === 0 && s.time >= s.nextMajorAt && s.time >= CONFIG.FIRST_MAJOR_EVENT_H * 60;
  for (let attempt = 0; attempt < 4; attempt++) {
    const def = pickWeighted(s, eligible(s, allowCentral), (d) => d.weight);
    if (!def) return;
    const inst = createEventInstance(s, def);
    if (!inst) continue;
    s.eventCooldowns[def.id] = s.time + (def.cooldownH ?? 72) * 60;
    if (inst.severity !== 'minor' || inst.choices) {
      const gap = randRange(s, CONFIG.MAJOR_EVENT_GAP_H[0], CONFIG.MAJOR_EVENT_GAP_H[1]);
      s.nextMajorAt = s.time + gap * 60;
    }
    fireEvent(s, inst, sink);
    return;
  }
}

/** Powód, dla którego opcji nie można wybrać (brak środków), albo null. */
export function choiceBlocked(s: GameState, choice: EventChoice): string | null {
  const cost = choice.effects.cash ?? 0;
  if (cost < 0 && s.money + cost < 0) return 'Brakuje środków na tę opcję.';
  return null;
}

/** Gracz potwierdza wydarzenie lub wybiera opcję decyzji. */
export function resolvePendingEvent(s: GameState, uid: number, choiceIndex?: number): boolean {
  const i = s.pendingEvents.findIndex((e) => e.uid === uid);
  if (i < 0) return false;
  const inst = s.pendingEvents[i];
  const def = EVENT_BY_ID[inst.defId];
  if (inst.choices?.length) {
    const choice = inst.choices[choiceIndex ?? 0];
    if (!choice || choiceBlocked(s, choice)) return false;
    // Wartości mogły się zmienić od chwili pokazania (np. stan konta) — stosujemy to, co gracz widział.
    if (def) applyEffects(s, choice.effects, inst.title, def);
    log(s, 'info', `Decyzja: ${choice.label}`, inst.title);
  }
  s.pendingEvents.splice(i, 1);
  return true;
}

/** Codzienne raty kredytów (wywoływane o północy). */
export function chargeLoans(s: GameState, sink?: SimSink): number {
  let paid = 0;
  for (const l of s.loans) {
    s.money -= l.perDay;
    paid += l.perDay;
    l.daysLeft--;
    if (l.daysLeft <= 0) log(s, 'good', 'Kredyt spłacony', l.title, sink);
  }
  s.loans = s.loans.filter((l) => l.daysLeft > 0);
  return paid;
}

/** Ile pozostało do spłaty. */
export const totalDebt = (s: GameState) => s.loans.reduce((a, l) => a + l.perDay * l.daysLeft, 0);

/** Do testów i narzędzi deweloperskich: wywołaj konkretne wydarzenie. */
export function triggerEvent(s: GameState, defId: string, sink?: SimSink, target?: string | null): EventInstance | null {
  const def = EVENT_BY_ID[defId];
  if (!def) return null;
  const inst = createEventInstance(s, def, target);
  if (!inst) return null;
  fireEvent(s, inst, sink);
  return inst;
}

export const CATEGORY_NAMES: Record<string, string> = {
  economy: 'Gospodarka',
  investors: 'Inwestorzy',
  competition: 'Konkurencja',
  local: 'Wydarzenie lokalne',
  international: 'Sytuacja międzynarodowa',
  infrastructure: 'Infrastruktura i pogoda',
};

export const SEVERITY_NAMES: Record<string, string> = { minor: 'Drobne', major: 'Ważne', critical: 'Krytyczne' };

/** Opis aktywnego wydarzenia (modyfikatory z pozostałym czasem). */
export function describeActive(s: GameState, ev: ActiveEvent): ConsequenceLine[] {
  const hours = Math.max(1, Math.ceil((ev.end - s.time) / 60));
  return describeEffects(s, { mods: { ...ev.mods, hours, scope: ev.scope, targetId: ev.targetId } });
}
