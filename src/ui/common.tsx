import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Button({
  children, onClick, disabled, variant = 'default', icon: Icon, title, small, block,
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  title?: string;
  small?: boolean;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant}${small ? ' btn-sm' : ''}${block ? ' btn-block' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {Icon && <Icon size={small ? 14 : 16} strokeWidth={2} />}
      {children && <span>{children}</span>}
    </button>
  );
}

/** Przycisk akcji z ceną i powodem blokady wyświetlanym pod spodem. */
export function ActionButton({
  label, cost, reason, onClick, icon, variant = 'primary',
}: {
  label: string;
  cost?: string;
  reason: string | null;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'default' | 'danger';
}) {
  return (
    <div className="action">
      <Button variant={variant} icon={icon} onClick={onClick} disabled={!!reason} block>
        {label}
        {cost && <em className="action-cost">{cost}</em>}
      </Button>
      {reason && <div className="action-reason">{reason}</div>}
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h3>{title}</h3>
        {aside && <div className="section-aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export function KV({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'dim' }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className={`kv-value${tone ? ` tone-${tone}` : ''}`}>{value}</span>
    </div>
  );
}

export function Meter({ value, tone, thin }: { value: number; tone?: 'auto' | 'accent' | 'gold'; thin?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  let cls = 'meter-fill';
  if (tone === 'auto' || tone === undefined) cls += v < 0.5 ? ' tone-ok' : v < 0.8 ? ' tone-warn' : ' tone-danger';
  else cls += ` tone-${tone}`;
  return (
    <div className={`meter${thin ? ' meter-thin' : ''}`}>
      <div className={cls} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'accent' | 'dim' }) {
  return <span className={`pill${tone ? ` pill-${tone}` : ''}`}>{children}</span>;
}

/** Mały wykres słupkowy (np. dzienny wynik), dodatnie w górę, ujemne w dół. */
export function Bars({ values, height = 44 }: { values: number[]; height?: number }) {
  if (!values.length) return <div className="bars-empty">Brak danych — wykres pojawi się po pierwszym dniu.</div>;
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const hasNeg = values.some((v) => v < 0);
  const mid = hasNeg ? height / 2 : height;
  const w = 100 / Math.max(values.length, 14);
  return (
    <svg className="bars" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }}>
      {hasNeg && <line x1="0" x2="100" y1={mid} y2={mid} className="bars-axis" />}
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * (hasNeg ? height / 2 - 1 : height - 1);
        return (
          <rect
            key={i}
            x={i * w + w * 0.15}
            width={w * 0.7}
            y={v >= 0 ? mid - h : mid}
            height={Math.max(0.5, h)}
            className={v >= 0 ? 'bar-pos' : 'bar-neg'}
          />
        );
      })}
    </svg>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
