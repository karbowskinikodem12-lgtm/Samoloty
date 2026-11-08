import { CircleQuestionMark, FastForward, Menu, Pause, Play } from 'lucide-react';
import { CONFIG } from '../engine/config';
import { levelProgress } from '../engine/economy';
import { useGame } from '../game/useGame';
import { operatingProfit } from './panels/OverviewPanel';
import { clock, dayNumber, money, num } from './format';

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 22c6-1 14-5 22-13" stroke="var(--accent)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="5" cy="22" r="3" fill="var(--accent)" />
      <circle cx="27" cy="9" r="3" fill="var(--gold)" />
    </svg>
  );
}

export function TopBar() {
  const c = useGame();
  const s = c.state!;
  const y = s.history[s.history.length - 1];
  const profit = y ? operatingProfit(y) : null;
  const lp = levelProgress(s);

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
        </div>
        <div className="stat">
          <span className="stat-label">Wynik wczoraj</span>
          <span className={`stat-value${profit === null ? ' dim' : profit >= 0 ? ' tone-good' : ' tone-bad'}`}>
            {profit === null ? '—' : money(profit, true)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Pasażerowie</span>
          <span className="stat-value">{num(s.totals.pax)}</span>
        </div>
        <div className="stat stat-wide" title="Reputacja zależy od tego, ilu pasażerów obsługujesz, a ilu rezygnuje z powodu pełnych terminali. Wpływa na popyt.">
          <span className="stat-label">Reputacja</span>
          <span className="stat-inline">
            <span className="mini-meter">
              <span style={{ width: `${s.reputation}%` }} className={s.reputation >= 60 ? 'tone-ok' : s.reputation >= 35 ? 'tone-warn' : 'tone-danger'} />
            </span>
            <span className="stat-value small">{Math.round(s.reputation)}</span>
          </span>
        </div>
        <div className="stat stat-wide" title={lp.next ? `Do następnego poziomu: ${num(lp.next - s.xp)} pasażerów` : 'Maksymalny poziom'}>
          <span className="stat-label">Poziom {s.level}</span>
          <span className="stat-inline">
            <span className="mini-meter gold">
              <span style={{ width: `${lp.ratio * 100}%` }} />
            </span>
            <span className="stat-value small dim">{lp.next ? `${num(s.xp)} / ${num(lp.next)}` : 'MAX'}</span>
          </span>
        </div>
      </div>

      <div className="clock">
        <div className="clock-time">
          <span className="clock-day">Dzień {dayNumber(s.time)}</span>
          <span className="clock-hm">{clock(s.time)}</span>
        </div>
        <div className="speed" role="group" aria-label="Prędkość gry">
          {CONFIG.SPEEDS.map((sp, i) => (
            <button
              key={sp}
              className={`speed-btn${c.speedIndex === i ? ' active' : ''}`}
              onClick={() => c.setSpeed(i)}
              title={i === 0 ? 'Pauza (spacja)' : `Prędkość ${sp}× (klawisz ${i})`}
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
