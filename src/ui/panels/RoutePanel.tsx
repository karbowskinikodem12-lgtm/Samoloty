import { ArrowLeftRight, Minus, PlaneTakeoff, ShoppingCart, Trash, X } from 'lucide-react';
import { AIRCRAFT, AIRCRAFT_BY_ID } from '../../data/aircraft';
import { CITY_BY_ID } from '../../data/cities';
import {
  assignPlane, buyPlane, checkAssignPlane, checkBuyPlane, closeRoute, planesOnRoute, unassignPlane,
} from '../../engine/actions';
import { CONFIG } from '../../engine/config';
import { fare, flightCost, flightMinutes } from '../../engine/economy';
import { getNetwork } from '../../engine/network';
import type { Plane, Route } from '../../engine/types';
import { useGame } from '../../game/useGame';
import { Button, Empty, KV, Meter, Section } from '../common';
import { duration, km, money, num, pct } from '../format';

export function planeStatus(p: Plane, routes: Record<string, Route>): string {
  if (!p.routeId || p.status === 'idle') return 'W hangarze';
  const to = CITY_BY_ID[p.to]?.code ?? p.to;
  const from = CITY_BY_ID[p.from]?.code ?? p.from;
  if (p.status === 'flying') return `${p.leaving ? 'Ostatni lot' : 'Lot'} do ${to} · ${pct(p.progress)}`;
  void routes;
  return p.timer > 0 ? `Obsługa w ${from} · ${Math.ceil(p.timer)} min` : `Czeka w ${from}`;
}

export function RoutePanel({ routeId }: { routeId: string }) {
  const c = useGame();
  const s = c.state!;
  const r = s.routes[routeId];
  if (!r) return null;
  const A = CITY_BY_ID[r.a];
  const B = CITY_BY_ID[r.b];
  const planes = planesOnRoute(s, routeId);
  const idle = Object.values(s.planes).filter((p) => !p.routeId);
  const loads = r.loads.length ? r.loads.reduce((a, b) => a + b, 0) / r.loads.length : 0;
  const y = r.yesterday;
  const t = r.today;
  const net = getNetwork(s);
  const waitingDir = (from: string, to: string) => {
    const ap = s.airports[from];
    if (!ap) return 0;
    let n = 0;
    for (const [dest, cnt] of Object.entries(ap.waiting)) if (net.nextHop[from]?.[dest] === to) n += cnt;
    return n;
  };
  const wAB = waitingDir(r.a, r.b);
  const wBA = waitingDir(r.b, r.a);
  const full = planes.length >= CONFIG.MAX_PLANES_PER_ROUTE;

  return (
    <div className="panel-body">
      <header className="panel-head">
        <div className="code-badge wide">
          {A.code}
          <ArrowLeftRight size={12} />
          {B.code}
        </div>
        <div className="panel-title">
          <h2>
            {A.name} – {B.name}
          </h2>
          <div className="panel-sub">
            {km(r.distance)} · bilet {money(fare(r.distance))}
          </div>
        </div>
        <button className="icon-btn" onClick={() => c.select(null)} title="Zamknij (Esc)">
          <X size={18} />
        </button>
      </header>

      <Section title="Obłożenie" aside={r.loads.length ? pct(loads) : '—'}>
        <Meter value={loads} tone="accent" />
        <div className="grid2">
          <KV label={`Czeka w ${A.code}`} value={num(wAB)} tone={wAB > 150 ? 'warn' : undefined} />
          <KV label={`Czeka w ${B.code}`} value={num(wBA)} tone={wBA > 150 ? 'warn' : undefined} />
        </div>
      </Section>

      <Section title="Wynik trasy">
        <div className="table-mini">
          <div className="tm-head">
            <span />
            <span>Dziś</span>
            <span>Wczoraj</span>
          </div>
          <div className="tm-row">
            <span>Loty</span>
            <span>{num(t.flights)}</span>
            <span>{num(y.flights)}</span>
          </div>
          <div className="tm-row">
            <span>Pasażerowie</span>
            <span>{num(t.pax)}</span>
            <span>{num(y.pax)}</span>
          </div>
          <div className="tm-row">
            <span>Przychód</span>
            <span>{money(t.revenue)}</span>
            <span>{money(y.revenue)}</span>
          </div>
          <div className="tm-row">
            <span>Koszt lotów</span>
            <span>{money(t.cost)}</span>
            <span>{money(y.cost)}</span>
          </div>
          <div className="tm-row strong">
            <span>Wynik</span>
            <span className={t.revenue - t.cost >= 0 ? 'tone-good' : 'tone-bad'}>{money(t.revenue - t.cost, true)}</span>
            <span className={y.revenue - y.cost >= 0 ? 'tone-good' : 'tone-bad'}>{money(y.revenue - y.cost, true)}</span>
          </div>
        </div>
      </Section>

      <Section title="Samoloty na trasie" aside={`${planes.length} / ${CONFIG.MAX_PLANES_PER_ROUTE}`}>
        {planes.length === 0 ? (
          <Empty>Trasa nie ma samolotu. Przypisz maszynę z hangaru lub kup nową poniżej.</Empty>
        ) : (
          <ul className="list">
            {planes.map((p) => {
              const type = AIRCRAFT_BY_ID[p.typeId];
              return (
                <li key={p.id} className="plane-row">
                  <div>
                    <div className="plane-name">
                      {p.reg} <span className="dim">{type.name}</span>
                    </div>
                    <div className="plane-status">{planeStatus(p, s.routes)}</div>
                  </div>
                  <Button
                    small
                    variant="ghost"
                    icon={Minus}
                    disabled={p.leaving}
                    title="Odeślij do hangaru"
                    onClick={() => c.act((st) => unassignPlane(st, p.id))}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {idle.length > 0 && (
        <Section title="Przypisz z hangaru">
          <ul className="list">
            {idle.map((p) => {
              const reason = checkAssignPlane(s, p.id, routeId);
              return (
                <li key={p.id} className="plane-row">
                  <div>
                    <div className="plane-name">
                      {p.reg} <span className="dim">{AIRCRAFT_BY_ID[p.typeId].name}</span>
                    </div>
                    {reason && <div className="plane-status tone-bad">{reason}</div>}
                  </div>
                  <Button small icon={PlaneTakeoff} disabled={!!reason} onClick={() => c.act((st) => assignPlane(st, p.id, routeId))}>
                    Przypisz
                  </Button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Kup samolot na tę trasę">
        <ul className="list">
          {AIRCRAFT.filter((a) => a.minLevel <= s.level + 1).map((a) => {
            const reason = full ? 'Trasa ma maksymalną liczbę samolotów.' : checkBuyPlane(s, a.id, routeId);
            const fm = flightMinutes(a, r.distance);
            const cost = flightCost(a, r.distance);
            const breakEven = cost / (fare(r.distance) * (a.fareMult ?? 1) * a.seats);
            return (
              <li key={a.id} className="buy-row">
                <div>
                  <div className="plane-name">
                    {a.name} <span className="dim">{a.seats} miejsc</span>
                  </div>
                  <div className="plane-status">
                    lot {duration(fm)} · koszt lotu {money(cost)} · próg rentowności {pct(breakEven)}
                  </div>
                  {reason && <div className="plane-status tone-bad">{reason}</div>}
                </div>
                <Button
                  small
                  variant="primary"
                  icon={ShoppingCart}
                  disabled={!!reason}
                  onClick={() => c.act((st) => buyPlane(st, a.id, routeId), `${a.name} dołączył do floty`)}
                >
                  {money(a.price)}
                </Button>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="danger-zone">
        <Button
          variant="danger"
          icon={Trash}
          block
          onClick={() => {
            if (planes.some((p) => p.status === 'flying') && !confirm('Samoloty w powietrzu wrócą do hangaru, a pasażerowie na pokładzie przepadną. Zamknąć trasę?')) return;
            c.act((st) => closeRoute(st, routeId), 'Trasa zamknięta');
            c.select({ kind: 'city', id: r.a });
          }}
        >
          Zamknij trasę (zwrot {money(r.openCost * CONFIG.ROUTE_REFUND)})
        </Button>
      </div>
    </div>
  );
}
