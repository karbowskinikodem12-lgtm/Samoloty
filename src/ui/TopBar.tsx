import { CircleQuestionMark, FastForward, Menu, Moon, Pause, Play, Sun, Sunrise, Sunset } from 'lucide-react';
import { dayPhase } from '../theme/dayNight';
import { CITIES } from '../data/cities';
import { CONFIG } from '../engine/config';
import { levelProgress } from '../engine/economy';
import { useGame } from '../game/useGame';
import { clock, dayNumber, money, num, plural } from './format';
import { operatingProfit } from './panels/OverviewPanel';

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <path d="M8 21.5c5-1 11-4.5 16-10" stroke="var(--on-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="8" cy="21.5" r="2.4" fill="var(--on-ink)" />
      <circle cx="24" cy="11.5" r="2.4" fill="var(--accent-on-ink)" />
    </svg>
  );
}

export function TopBar() {
  const c = useGame();
  const s = c.state!;
  const y = s.history[s.history.length - 1];
  const profit = y ? operatingProfit(y) : null;
  const lp = levelProgress(s);
  const planes = Object.values(s.planes);
  const idle = planes.filter((p) => !p.routeId).length;
  const all = Object.values(s.airports);
  const cities = all.filter((a) => a.buildEnd === undefined).length;
  const building = all.length - cities;
  const phase = dayPhase(s.time);
  const PhaseIcon = { day: Sun, dusk: Sunset, night: Moon, dawn: Sunrise }[phase];
  const phaseName = { day: 'Dzień', dusk: 'Zmierzch', night: 'Noc', dawn: 'Świt' }[phase];

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span className="brand-name">{s.airlineName}</span>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Środki</span>
          <span className={`stat-value${s.money < 0 ? ' tone-bad' : ''}`}>{money(s.money)}</span>
          <span className={`stat-sub${profit === null ? '' : profit >= 0 ? ' tone-good' : ' tone-bad'}`}>
            {profit === null ? 'pierwszy dzień' : `${money(profit, true)} wczoraj`}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Samoloty</span>
          <span className="stat-value">{planes.length}</span>
          <span className={`stat-sub${idle > 0 ? ' tone-warn' : ''}`}>{idle > 0 ? `${idle} w hangarze` : 'wszystkie w trasie'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Miasta</span>
          <span className="stat-value">{cities}</span>
          <span className={`stat-sub${building > 0 ? ' tone-accent' : ''}`}>
            {building > 0
              ? `${building} w budowie`
              : `z ${CITIES.length} · ${s.unlockedRegions.length} ${plural(s.unlockedRegions.length, 'region', 'regiony', 'regionów')}`}
          </span>
        </div>
        <div className="stat stat-secondary">
          <span className="stat-label">Pasażerowie</span>
          <span className="stat-value">{num(s.totals.pax)}</span>
          <span className="stat-sub">łącznie</span>
        </div>
      </div>

      <div className="progress-block">
        <div
          className="progress-row"
          title={lp.next ? `Do poziomu ${s.level + 1}: ${num(lp.next - s.xp)} pasażerów` : 'Maksymalny poziom'}
        >
          <span className="progress-label">Poziom {s.level}</span>
          <span className="bar">
            <span className="bar-fill accent" style={{ width: `${lp.ratio * 100}%` }} />
          </span>
        </div>
        <div className="progress-row" title="Reputacja rośnie, gdy obsługujesz pasażerów, i spada, gdy rezygnują z powodu pełnych terminali. Wpływa na popyt.">
          <span className="progress-label">Reputacja</span>
          <span className="bar">
            <span
              className={`bar-fill ${s.reputation >= 60 ? 'ok' : s.reputation >= 35 ? 'warn' : 'danger'}`}
              style={{ width: `${s.reputation}%` }}
            />
          </span>
        </div>
      </div>

      <div className="clock">
        <span className="clock-phase" title={phaseName}>
          <PhaseIcon size={17} strokeWidth={1.8} />
        </span>
        <div className="clock-time">
          <span className="clock-hm">{clock(s.time)}</span>
          <span className="clock-day">Dzień {dayNumber(s.time)}</span>
        </div>
        <div className="speed" role="group" aria-label="Prędkość gry">
          {CONFIG.SPEEDS.map((sp, i) => (
            <button
              key={sp}
              className={`speed-btn${c.speedIndex === i ? ' active' : ''}`}
              onClick={() => c.setSpeed(i)}
              title={i === 0 ? 'Pauza (spacja)' : `Prędkość ${sp}× (klawisz ${i})`}
              aria-label={i === 0 ? 'Pauza' : `Prędkość ${sp}×`}
            >
              {i === 0 ? <Pause size={14} /> : i === 1 ? <Play size={14} /> : <FastForward size={14} />}
              {i > 1 && <span>{sp}×</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" onClick={() => c.setHelp(true)} title="Jak grać">
          <CircleQuestionMark size={18} />
        </button>
        <button className="icon-btn" onClick={() => c.setMenu(true)} title="Menu">
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
