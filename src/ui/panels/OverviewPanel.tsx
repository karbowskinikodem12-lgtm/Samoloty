import { CircleCheck, Target } from 'lucide-react';
import { EVENT_BY_ID } from '../../data/events';
import { dailyFixedCosts } from '../../engine/economy';
import { describeEvent, eventTargetName } from '../../engine/events';
import { activeGoals } from '../../engine/progression';
import type { DayStats } from '../../engine/types';
import { useGame } from '../../game/useGame';
import { Bars, Empty, KV, Meter, Pill, Section } from '../common';
import { clock, dayNumber, hoursLeft, km, money, num } from '../format';

export const operatingProfit = (d: DayStats) => d.revenue - d.flightCost - d.planeUpkeep - d.airportUpkeep;

export function OverviewPanel() {
  const c = useGame();
  const s = c.state!;
  const y = s.history[s.history.length - 1];
  const t = s.today;
  const fixed = dailyFixedCosts(s);
  const goals = activeGoals(s);

  return (
    <div className="panel-body">
      <Section title="Finanse" aside={y ? `dzień ${y.day + 1}` : undefined}>
        <div className="table-mini">
          <div className="tm-head">
            <span />
            <span>Dziś</span>
            <span>Wczoraj</span>
          </div>
          <div className="tm-row">
            <span>Przychody z biletów</span>
            <span>{money(t.revenue)}</span>
            <span>{y ? money(y.revenue) : '—'}</span>
          </div>
          <div className="tm-row">
            <span>Koszty lotów</span>
            <span>{money(-t.flightCost)}</span>
            <span>{y ? money(-y.flightCost) : '—'}</span>
          </div>
          <div className="tm-row">
            <span>Utrzymanie floty</span>
            <span className="dim">{money(-fixed.planes)}</span>
            <span>{y ? money(-y.planeUpkeep) : '—'}</span>
          </div>
          <div className="tm-row">
            <span>Utrzymanie lotnisk</span>
            <span className="dim">{money(-fixed.airports)}</span>
            <span>{y ? money(-y.airportUpkeep) : '—'}</span>
          </div>
          <div className="tm-row strong">
            <span>Wynik operacyjny</span>
            {(() => {
              const today = t.revenue - t.flightCost - fixed.planes - fixed.airports;
              return <span className={today >= 0 ? 'tone-good' : 'tone-bad'}>{money(today, true)}</span>;
            })()}
            {y ? <span className={operatingProfit(y) >= 0 ? 'tone-good' : 'tone-bad'}>{money(operatingProfit(y), true)}</span> : <span>—</span>}
          </div>
        </div>
        <p className="hint">Koszty stałe są pobierane o północy. Inwestycje i nagrody nie wliczają się do wyniku operacyjnego.</p>
        <div className="chart-label">Wynik operacyjny — ostatnie dni</div>
        <Bars values={s.history.slice(-20).map(operatingProfit)} />
      </Section>

      <Section title="Cele" aside={`${s.goalsDone.length} ukończonych`}>
        {goals.length === 0 ? (
          <Empty>Wszystkie cele ukończone. Gratulacje!</Empty>
        ) : (
          goals.map((g) => {
            const p = g.progress(s);
            const fmt = (v: number) => (g.format === 'money' ? money(v) : g.format === 'km' ? km(v) : num(v));
            return (
              <div key={g.id} className="goal">
                <div className="goal-head">
                  <Target size={14} />
                  <strong>{g.title}</strong>
                  <span className="goal-reward">{money(g.reward)}</span>
                </div>
                <div className="goal-desc">{g.description}</div>
                <div className="goal-progress">
                  <Meter value={p / g.target} tone="gold" thin />
                  <span className="dim">
                    {fmt(Math.max(0, Math.min(p, g.target)))} / {fmt(g.target)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </Section>

      <Section title="Wydarzenia">
        {s.events.length === 0 ? (
          <Empty>Brak aktywnych wydarzeń.</Empty>
        ) : (
          s.events.map((e) => {
            const def = EVENT_BY_ID[e.defId];
            return (
              <div key={e.uid} className={`event-card tone-${def.tone}`}>
                <div className="event-head">
                  <strong>{def.title}</strong>
                  <Pill tone={def.tone === 'good' ? 'good' : def.tone === 'bad' ? 'bad' : 'dim'}>{eventTargetName(def, e.targetId)}</Pill>
                </div>
                <p>{describeEvent(def, e.targetId)}</p>
                <span className="dim">Pozostało: {hoursLeft(e.end - s.time)}</span>
              </div>
            );
          })
        )}
      </Section>

      <Section title="Dziennik">
        <ul className="log">
          {s.log
            .slice(-8)
            .reverse()
            .map((l) => (
              <li key={l.id} className={`log-${l.kind}`}>
                <span className="log-time">
                  D{dayNumber(l.time)} {clock(l.time)}
                </span>
                <span className="log-text">
                  {(l.kind === 'goal' || l.kind === 'level') && <CircleCheck size={12} />} {l.title}
                </span>
              </li>
            ))}
        </ul>
      </Section>

      <Section title="Statystyki">
        <div className="grid2">
          <KV label="Pasażerowie łącznie" value={num(s.totals.pax)} />
          <KV label="Loty łącznie" value={num(s.totals.flights)} />
          <KV label="Przychody łącznie" value={money(s.totals.revenue)} />
          <KV label="Rezygnacje łącznie" value={num(s.totals.lost)} tone={s.totals.lost > 0 ? 'bad' : 'dim'} />
        </div>
      </Section>
    </div>
  );
}
