import { CITY_BY_ID } from '../../data/cities';
import { planesOnRoute } from '../../engine/actions';
import { useGame } from '../../game/useGame';
import { Empty, Section } from '../common';
import { km, money, pct } from '../format';

export function RoutesPanel() {
  const c = useGame();
  const s = c.state!;
  const routes = Object.values(s.routes)
    .map((r) => {
      const load = r.loads.length ? r.loads.reduce((a, b) => a + b, 0) / r.loads.length : 0;
      const result = r.yesterday.flights ? r.yesterday.revenue - r.yesterday.cost : r.today.revenue - r.today.cost;
      return { r, load, result, planes: planesOnRoute(s, r.id).length };
    })
    .sort((a, b) => b.result - a.result);

  return (
    <div className="panel-body">
      <Section title="Trasy" aside={`${routes.length}`}>
        {routes.length === 0 ? (
          <Empty>Nie masz jeszcze tras. Otwórz drugie lotnisko i przeciągnij między nimi linię na mapie.</Empty>
        ) : (
          <div className="route-table">
            <div className="rt-head">
              <span>Trasa</span>
              <span>Samol.</span>
              <span>Obł.</span>
              <span>Wynik*</span>
            </div>
            {routes.map(({ r, load, result, planes }) => (
              <button key={r.id} className="rt-row" onClick={() => c.select({ kind: 'route', id: r.id })}>
                <span className="rt-name">
                  <strong>
                    {CITY_BY_ID[r.a].code} – {CITY_BY_ID[r.b].code}
                  </strong>
                  <span className="dim">{km(r.distance)}</span>
                </span>
                <span className={planes === 0 ? 'tone-warn' : ''}>{planes}</span>
                <span>{r.loads.length ? pct(load) : '—'}</span>
                <span className={result >= 0 ? 'tone-good' : 'tone-bad'}>{money(result, true)}</span>
              </button>
            ))}
          </div>
        )}
        <p className="hint">* Wynik trasy z poprzedniego dnia (przychody z biletów minus koszty lotów, bez kosztów stałych).</p>
      </Section>
    </div>
  );
}
