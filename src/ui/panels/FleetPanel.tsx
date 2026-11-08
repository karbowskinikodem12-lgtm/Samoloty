import { Lock, ShoppingCart } from 'lucide-react';
import { AIRCRAFT, AIRCRAFT_BY_ID } from '../../data/aircraft';
import { CITY_BY_ID } from '../../data/cities';
import { assignPlane, buyPlane, checkAssignPlane, checkBuyPlane, sellPlane } from '../../engine/actions';
import { planeResale } from '../../engine/economy';
import { useGame } from '../../game/useGame';
import { Button, Empty, Section } from '../common';
import { km, money, num } from '../format';
import { planeStatus } from './RoutePanel';

export function FleetPanel() {
  const c = useGame();
  const s = c.state!;
  const planes = Object.values(s.planes);
  const idle = planes.filter((p) => !p.routeId);
  const active = planes.filter((p) => p.routeId);
  const routes = Object.values(s.routes);

  return (
    <div className="panel-body">
      <Section title="Hangar" aside={`${idle.length}`}>
        {idle.length === 0 ? (
          <Empty>Wszystkie samoloty są w trasie.</Empty>
        ) : (
          <ul className="list">
            {idle.map((p) => {
              const options = routes.filter((r) => !checkAssignPlane(s, p.id, r.id));
              return (
                <li key={p.id} className="plane-row column">
                  <div className="plane-row-top">
                    <div>
                      <div className="plane-name">
                        {p.reg} <span className="dim">{AIRCRAFT_BY_ID[p.typeId].name}</span>
                      </div>
                      <div className="plane-status">W hangarze</div>
                    </div>
                    <Button
                      small
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Sprzedać ${p.reg} za ${money(planeResale(p.typeId))}?`)) c.act((st) => sellPlane(st, p.id));
                      }}
                    >
                      Sprzedaj
                    </Button>
                  </div>
                  <select
                    className="select"
                    value=""
                    disabled={options.length === 0}
                    onChange={(e) => {
                      if (e.target.value) c.act((st) => assignPlane(st, p.id, e.target.value));
                    }}
                  >
                    <option value="">{options.length ? 'Przypisz do trasy…' : 'Brak tras dla tego samolotu'}</option>
                    {options.map((r) => (
                      <option key={r.id} value={r.id}>
                        {CITY_BY_ID[r.a].name} – {CITY_BY_ID[r.b].name} ({km(r.distance)})
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="W trasie" aside={`${active.length}`}>
        {active.length === 0 ? (
          <Empty>Żaden samolot nie lata. Wybierz trasę i przypisz do niej maszynę.</Empty>
        ) : (
          <ul className="list">
            {active.map((p) => {
              const r = s.routes[p.routeId!];
              return (
                <li key={p.id}>
                  <button className="plane-row clickable" onClick={() => c.select({ kind: 'route', id: r.id })}>
                    <div>
                      <div className="plane-name">
                        {p.reg} <span className="dim">{AIRCRAFT_BY_ID[p.typeId].name}</span>
                      </div>
                      <div className="plane-status">
                        {CITY_BY_ID[r.a].code}–{CITY_BY_ID[r.b].code} · {planeStatus(p, s.routes)}
                      </div>
                    </div>
                    <span className="num dim">{money(p.revenue)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Katalog samolotów" aside={`${AIRCRAFT.filter((a) => a.minLevel <= s.level).length} / ${AIRCRAFT.length} dostępnych`}>
        <div className="catalog">
          {AIRCRAFT.map((a) => {
            const locked = s.level < a.minLevel;
            const reason = checkBuyPlane(s, a.id);
            if (locked)
              return (
                <div key={a.id} className="aircraft-card locked compact">
                  <div className="ac-head">
                    <div>
                      <strong>{a.name}</strong>
                      <div className="dim">
                        {a.category} · {a.seats} miejsc · {num(a.range)} km
                      </div>
                    </div>
                    <span className="lock-tag">
                      <Lock size={12} /> poziom {a.minLevel}
                    </span>
                  </div>
                </div>
              );
            return (
              <div key={a.id} className={`aircraft-card${locked ? ' locked' : ''}`}>
                <div className="ac-head">
                  <div>
                    <strong>{a.name}</strong>
                    <div className="dim">{a.category}</div>
                  </div>
                  {locked ? (
                    <span className="lock-tag">
                      <Lock size={12} /> poziom {a.minLevel}
                    </span>
                  ) : (
                    <span className="ac-price">{money(a.price)}</span>
                  )}
                </div>
                {a.note && <div className="ac-note">{a.note}</div>}
                <div className="ac-stats">
                  <div>
                    <span>Miejsca</span>
                    <strong>{a.seats}</strong>
                  </div>
                  <div>
                    <span>Zasięg</span>
                    <strong>{num(a.range)} km</strong>
                  </div>
                  <div>
                    <span>Prędkość</span>
                    <strong>{a.speed} km/h</strong>
                  </div>
                  <div>
                    <span>Lot 1000 km</span>
                    <strong>{money(a.costPerFlight + a.costPerKm * 1000)}</strong>
                  </div>
                  <div>
                    <span>Utrzymanie</span>
                    <strong>{money(a.upkeep)}/dz.</strong>
                  </div>
                  <div>
                    <span>Lotniska</span>
                    <strong>poz. {a.minAirportLevel}+</strong>
                  </div>
                </div>
                {!locked && (
                  <Button
                    small
                    block
                    icon={ShoppingCart}
                    disabled={!!reason}
                    title={reason ?? undefined}
                    onClick={() => c.act((st) => buyPlane(st, a.id), `${a.name} czeka w hangarze`)}
                  >
                    Kup do hangaru
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
