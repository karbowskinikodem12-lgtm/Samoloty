import { LogOut, Moon, Play, Save, SunMoon, Sun, X } from 'lucide-react';
import type { ThemeMode } from '../theme/dayNight';
import type { ReactNode } from 'react';
import { clearSave } from '../engine/save';
import { useGame } from '../game/useGame';
import { Button } from './common';
import { dayNumber, money, num } from './format';

function Modal({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Zamknij">
              <X size={18} />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function HelpModal() {
  const c = useGame();
  if (!c.helpOpen) return null;
  return (
    <Modal title="Jak grać" onClose={() => c.setHelp(false)} wide>
      <div className="help-grid">
        <section>
          <h3>Cel</h3>
          <p>
            Zbuduj sieć połączeń od jednego lotniska do globalnej linii. Zarabiasz na każdym przewiezionym pasażerze — im dłuższy odcinek, tym droższy bilet.
            Realizuj cele, zdobywaj poziomy i kupuj licencje na kolejne regiony.
          </p>
          <h3>Podstawy</h3>
          <ol>
            <li>Kliknij miasto z pustym pierścieniem i otwórz w nim lotnisko.</li>
            <li>Przeciągnij linię od lotniska do lotniska, aby otworzyć trasę.</li>
            <li>Przypisz do trasy samolot z hangaru lub kup nowy.</li>
            <li>Samoloty kursują same tam i z powrotem, zabierając czekających pasażerów.</li>
          </ol>
        </section>
        <section>
          <h3>Pasażerowie i przesiadki</h3>
          <p>
            Każde lotnisko z trasami generuje pasażerów do wszystkich osiągalnych miast. Jeśli nie ma lotu bezpośredniego, pasażer przesiada się w węźle — dlatego dobrze
            połączone lotniska stają się hubami.
          </p>
          <h3>Terminale</h3>
          <p>
            Pierścień wokół lotniska to zapełnienie terminalu. Gdy się zapełni, nowi pasażerowie rezygnują, a reputacja spada. Dodawaj samoloty lub rozbudowuj lotniska — rozbudowa
            daje też więcej slotów na trasy i większy popyt.
          </p>
        </section>
        <section>
          <h3>Ekonomia</h3>
          <p>
            Każdy lot kosztuje (paliwo, załoga, opłaty) niezależnie od obłożenia, a samoloty i lotniska mają dzienne koszty utrzymania. Pilnuj obłożenia tras: duży samolot na
            pustej trasie traci pieniądze. Trzy dni z ujemnym saldem oznaczają bankructwo.
          </p>
          <h3>Budowa i pora dnia</h3>
          <p>
            Nowe lotnisko powstaje kilka dni gry — postęp widać na mapie i w panelu miasta. Większe miasta mają lepszą infrastrukturę na start i wyższy limit rozbudowy, ale ich
            budowa trwa dłużej i kosztuje więcej. Po zmroku mapa i interfejs przechodzą w ciemny motyw (można to zmienić w menu).
          </p>
          <h3>Wydarzenia</h3>
          <p>
            Gospodarka, inwestorzy, konkurencja, wydarzenia lokalne, polityka i pogoda zmieniają popyt, ceny, koszty i pracę lotnisk. Drobne wydarzenia pojawiają się w rogu
            ekranu, ważne — na środku, z zatrzymanym czasem. Przy decyzjach każda opcja ma inne konsekwencje (klawisze 1–3). Aktywne wydarzenia i kredyty znajdziesz w zakładce
            Przegląd.
          </p>
        </section>
        <section>
          <h3>Sterowanie</h3>
          <ul className="keys">
            <li>
              <kbd>Spacja</kbd> pauza
            </li>
            <li>
              <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd> prędkość gry
            </li>
            <li>
              <kbd>Esc</kbd> anuluj / zamknij panel
            </li>
            <li>
              <kbd>Kółko myszy</kbd> przybliżanie
            </li>
            <li>
              <kbd>Przeciągnij tło</kbd> przesuwanie mapy
            </li>
            <li>
              <kbd>Przeciągnij lotnisko</kbd> nowa trasa
            </li>
            <li>
              <kbd>Prawy przycisk</kbd> anuluj rysowanie trasy
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}

export function MenuModal() {
  const c = useGame();
  if (!c.menuOpen) return null;
  return (
    <Modal title="Menu" onClose={() => c.setMenu(false)}>
      <div className="menu-actions">
        <Button variant="primary" icon={Play} block onClick={() => c.setMenu(false)}>
          Wróć do gry
        </Button>
        <Button
          icon={Save}
          block
          onClick={() => {
            const ok = c.save();
            c.message(ok ? 'good' : 'bad', ok ? 'Gra zapisana' : 'Nie udało się zapisać gry');
          }}
        >
          Zapisz grę
        </Button>
        <Button icon={LogOut} block onClick={() => c.quitToMenu()}>
          Zapisz i wyjdź do menu
        </Button>
      </div>
      <span className="menu-label">Motyw</span>
      <div className="theme-switch" role="group" aria-label="Motyw">
        {(
          [
            ['auto', 'Pora dnia', SunMoon],
            ['light', 'Jasny', Sun],
            ['dark', 'Ciemny', Moon],
          ] as [ThemeMode, string, typeof Sun][]
        ).map(([mode, label, Icon]) => (
          <button key={mode} className={c.themeMode === mode ? 'active' : ''} onClick={() => c.setThemeMode(mode)}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <p className="hint">
        „Pora dnia” płynnie przełącza jasny i ciemny wygląd razem z zegarem gry. Gra zapisuje się automatycznie co kilkanaście sekund w pamięci przeglądarki.
      </p>
    </Modal>
  );
}

export function GameOverModal() {
  const c = useGame();
  const s = c.state;
  if (!s?.gameOver) return null;
  return (
    <Modal title="Bankructwo">
      <p>
        {s.airlineName} nie udźwignęła długów. Twoja linia przetrwała {dayNumber(s.time)} dni.
      </p>
      <div className="gameover-stats">
        <div>
          <span>Pasażerowie</span>
          <strong>{num(s.totals.pax)}</strong>
        </div>
        <div>
          <span>Przychody</span>
          <strong>{money(s.totals.revenue)}</strong>
        </div>
        <div>
          <span>Lotniska</span>
          <strong>{Object.keys(s.airports).length}</strong>
        </div>
        <div>
          <span>Poziom</span>
          <strong>{s.level}</strong>
        </div>
      </div>
      <Button
        variant="primary"
        block
        onClick={() => {
          clearSave();
          c.quitToMenu();
        }}
      >
        Nowa gra
      </Button>
    </Modal>
  );
}
