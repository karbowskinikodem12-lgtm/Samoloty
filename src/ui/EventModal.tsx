import {
  ChartLine, CloudLightning, Globe, Handshake, Minus, Swords, Ticket, TrendingDown, TrendingUp, TriangleAlert,
} from 'lucide-react';
import { useEffect } from 'react';
import { CITY_BY_ID } from '../data/cities';
import { REGION_BY_ID } from '../data/regions';
import { CATEGORY_NAMES, choiceBlocked, SEVERITY_NAMES } from '../engine/events';
import type { ConsequenceLine, EventCategory, EventInstance } from '../engine/types';
import { useGame } from '../game/useGame';
import { clock, dayNumber } from './format';

const CATEGORY_ICON: Record<EventCategory, typeof Globe> = {
  economy: ChartLine,
  investors: Handshake,
  competition: Swords,
  local: Ticket,
  international: Globe,
  infrastructure: CloudLightning,
};

function targetName(e: EventInstance): string | null {
  if (!e.targetId) return null;
  if (e.target === 'city') return CITY_BY_ID[e.targetId]?.name ?? null;
  return REGION_BY_ID[e.targetId]?.name ?? null;
}

function Consequences({ lines }: { lines: ConsequenceLine[] }) {
  return (
    <ul className="consequences">
      {lines.map((l, i) => {
        const Icon = l.tone === 'good' ? TrendingUp : l.tone === 'bad' ? TrendingDown : Minus;
        return (
          <li key={i} className={`tone-${l.tone}`}>
            <Icon size={14} strokeWidth={2.2} />
            <span>{l.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Ważne wydarzenia na środku ekranu. Czas gry stoi, dopóki gracz nie potwierdzi
 * wydarzenia albo nie wybierze jednej z opcji (klawisze 1–3 lub Enter).
 */
export function EventModal() {
  const c = useGame();
  const s = c.state;
  const ev = s?.pendingEvents[0];
  const queued = (s?.pendingEvents.length ?? 1) - 1;

  useEffect(() => {
    if (!ev) return;
    const onKey = (e: KeyboardEvent) => {
      if (ev.choices?.length) {
        const n = Number(e.key);
        if (n >= 1 && n <= ev.choices.length && !choiceBlocked(s!, ev.choices[n - 1])) {
          e.preventDefault();
          e.stopImmediatePropagation();
          c.resolveEvent(ev.uid, n - 1);
        }
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        c.resolveEvent(ev.uid);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [c, ev, s]);

  if (!s || !ev || s.gameOver) return null;
  const Icon = CATEGORY_ICON[ev.category] ?? Globe;
  const where = targetName(ev);

  return (
    <div className="event-backdrop">
      <div className={`event-panel sev-${ev.severity} ev-${ev.tone}`} role="dialog" aria-modal="true" aria-labelledby={`ev-${ev.uid}`} key={ev.uid}>
        <div className="event-meta">
          <span className="event-category">
            <Icon size={15} strokeWidth={1.9} />
            {CATEGORY_NAMES[ev.category]}
          </span>
          <span className={`event-severity sev-${ev.severity}`}>
            {ev.severity === 'critical' && <TriangleAlert size={12} strokeWidth={2.2} />}
            {SEVERITY_NAMES[ev.severity]}
          </span>
          <span className="event-when">
            {where ? `${where} · ` : ''}dzień {dayNumber(ev.time)}, {clock(ev.time)}
          </span>
        </div>

        <h2 className="event-title" id={`ev-${ev.uid}`}>
          {ev.title}
        </h2>
        <p className="event-text">{ev.text}</p>

        {ev.choices?.length ? (
          <>
            <h3 className="event-subhead">Twoja decyzja</h3>
            <div className="choices">
              {ev.choices.map((ch, i) => {
                const blocked = choiceBlocked(s, ch);
                return (
                <button key={i} className="choice" disabled={!!blocked} title={blocked ?? undefined} onClick={() => c.resolveEvent(ev.uid, i)}>
                  <span className="choice-key">{i + 1}</span>
                  <span className="choice-body">
                    <strong>{ch.label}</strong>
                    {ch.description && <span className="choice-desc">{ch.description}</span>}
                    <Consequences lines={ch.lines} />
                    {blocked && <span className="choice-blocked">{blocked}</span>}
                  </span>
                </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h3 className="event-subhead">Konsekwencje</h3>
            <Consequences lines={ev.lines ?? []} />
            <div className="event-actions">
              <button className="btn btn-primary" onClick={() => c.resolveEvent(ev.uid)} autoFocus>
                Rozumiem
              </button>
              <span className="event-hint">
                <kbd>Enter</kbd>
              </span>
            </div>
          </>
        )}

        <div className="event-footer">
          <span>Czas gry jest wstrzymany.</span>
          {queued > 0 && <span>Kolejne wydarzenia: {queued}</span>}
        </div>
      </div>
    </div>
  );
}
