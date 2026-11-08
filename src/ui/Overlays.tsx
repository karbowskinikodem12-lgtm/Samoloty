import { CircleCheck, Info, Minus, Plus, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { planesOnRoute } from '../engine/actions';
import { useGame } from '../game/useGame';

const TOAST_ICON = { info: Info, good: CircleCheck, goal: Sparkles, level: Sparkles, event: Info, bad: TriangleAlert };

export function Toasts() {
  const c = useGame();
  return (
    <div className="toasts" aria-live="polite">
      {c.toasts.map((t) => {
        const Icon = TOAST_ICON[t.kind] ?? Info;
        return (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon size={16} className="toast-icon" />
            <div className="toast-body">
              <strong>{t.title}</strong>
              {t.text && <p>{t.text}</p>}
            </div>
            <button className="toast-close" onClick={() => c.dismissToast(t.id)} aria-label="Zamknij">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const TUTORIAL_KEY = 'contrail-tutorial-hidden';

function readHidden(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

/** Podpowiedzi kolejnych kroków dla nowego gracza — wyliczane ze stanu gry. */
export function TutorialHint() {
  const c = useGame();
  const s = c.state!;
  const [hidden, setHidden] = useState(readHidden);
  if (hidden) return null;

  const airports = Object.keys(s.airports).length;
  const routes = Object.values(s.routes);
  const served = routes.some((r) => planesOnRoute(s, r.id).length > 0);
  let step: { n: number; title: string; text: string } | null = null;
  if (airports < 2) step = { n: 1, title: 'Otwórz drugie lotnisko', text: 'Kliknij miasto oznaczone pustym pierścieniem i wybierz „Otwórz lotnisko”. Bliskie miasta są tańsze w obsłudze.' };
  else if (routes.length === 0) step = { n: 2, title: 'Połącz lotniska trasą', text: 'Przytrzymaj lotnisko na mapie i przeciągnij linię do drugiego lotniska. Możesz też użyć przycisku „Nowa trasa”.' };
  else if (!served) step = { n: 3, title: 'Przypisz samolot', text: 'Kliknij trasę na mapie i przypisz do niej samolot czekający w hangarze.' };
  else if (s.totals.pax < 60) step = { n: 4, title: 'Obserwuj terminale', text: 'Pierścień wokół lotniska pokazuje zapełnienie terminalu. Gdy robi się czerwony, dodaj samoloty lub rozbuduj lotnisko.' };
  if (!step) return null;

  return (
    <div className="tutorial">
      <span className="tutorial-step">
        Krok {step.n} / 4
      </span>
      <div>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
      </div>
      <button
        className="toast-close"
        title="Ukryj podpowiedzi"
        onClick={() => {
          try {
            localStorage.setItem(TUTORIAL_KEY, '1');
          } catch {
            /* ignoruj */
          }
          setHidden(true);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ZoomControls({ onZoom }: { onZoom: (f: number) => void }) {
  return (
    <div className="zoom">
      <button className="icon-btn" onClick={() => onZoom(1.4)} title="Przybliż">
        <Plus size={16} />
      </button>
      <button className="icon-btn" onClick={() => onZoom(1 / 1.4)} title="Oddal">
        <Minus size={16} />
      </button>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="lg-dot hub" /> Baza
      </span>
      <span>
        <i className="lg-dot airport" /> Lotnisko
      </span>
      <span>
        <i className="lg-dot ring" /> Dostępne miasto
      </span>
      <span>
        <i className="lg-line" /> Trasa
      </span>
      <span>
        <i className="lg-line idle" /> Bez samolotu
      </span>
    </div>
  );
}
