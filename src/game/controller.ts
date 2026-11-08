import { CONFIG } from '../engine/config';
import { saveGame } from '../engine/save';
import { resolvePendingEvent } from '../engine/events';
import { advance } from '../engine/simulation';
import type { ActionResult, GameState, LogEntry } from '../engine/types';
import { emptySink } from '../engine/util';
import { applyTheme, loadThemeMode, nightFactor, saveThemeMode, SWAP_POINT, type ThemeMode } from '../theme/dayNight';

export type Selection =
  | { kind: 'city'; id: string }
  | { kind: 'route'; id: string }
  | null;

export type SideTab = 'overview' | 'routes' | 'fleet' | 'regions';

export interface Toast extends LogEntry {
  expires: number;
}

export interface FloatingText {
  cityId: string;
  amount: number;
  born: number;
}

/**
 * Łączy silnik z interfejsem: trzyma stan gry, napędza pętlę czasu (requestAnimationFrame),
 * wykonuje akcje gracza i powiadamia React o zmianach (useSyncExternalStore).
 * Stan gry jest mutowany w miejscu — React odświeża się na podstawie licznika `version`.
 */
export class GameController {
  state: GameState | null = null;
  speedIndex = 1;
  selection: Selection = null;
  tab: SideTab = 'overview';
  /** Tryb rysowania trasy z wybranego lotniska (po kliknięciu „Nowa trasa”). */
  routeFrom: string | null = null;
  toasts: Toast[] = [];
  floating: FloatingText[] = [];
  helpOpen = false;
  menuOpen = false;
  /** Prośba o ustawienie kamery na podanych miastach (konsumowana przez renderer mapy). */
  focusRequest: string[] | null = null;
  /** Tryb motywu: automatyczny (cykl dnia i nocy) albo stały. */
  themeMode: ThemeMode = loadThemeMode();
  /** Postęp nocy 0..1 — płynnie dąży do wartości wynikającej z pory dnia lub trybu. */
  night = 0;
  /** Zamiana jasnego motywu na ciemny (0..1), animowana w czasie rzeczywistym. */
  themeSwap = 0;
  version = 0;

  private listeners = new Set<() => void>();
  private raf = 0;
  private lastFrame = 0;
  private lastNotify = 0;
  private lastSave = 0;
  private frameHooks = new Set<(now: number) => void>();
  private toastSeq = 1_000_000;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getVersion = () => this.version;

  notify(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  /** Renderer mapy rejestruje się tutaj, by rysować w tej samej klatce co symulacja. */
  onFrame(fn: (now: number) => void): () => void {
    this.frameHooks.add(fn);
    if (!this.raf) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
    return () => {
      this.frameHooks.delete(fn);
    };
  }

  start(state: GameState): void {
    this.state = state;
    this.selection = { kind: 'city', id: state.startCity };
    this.tab = 'overview';
    this.routeFrom = null;
    this.toasts = [];
    this.floating = [];
    this.speedIndex = 1;
    this.helpOpen = false;
    this.menuOpen = false;
    this.lastSave = performance.now();
    if (!this.raf) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
    this.notify();
  }

  quitToMenu(): void {
    if (this.state && !this.state.gameOver) saveGame(this.state);
    this.state = null;
    this.selection = null;
    this.menuOpen = false;
    this.helpOpen = false;
    this.notify();
  }

  get speed(): number {
    return CONFIG.SPEEDS[this.speedIndex];
  }

  setSpeed(index: number): void {
    this.speedIndex = Math.max(0, Math.min(CONFIG.SPEEDS.length - 1, index));
    this.notify();
  }

  togglePause(): void {
    this.setSpeed(this.speedIndex === 0 ? 1 : 0);
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.routeFrom = null;
    this.notify();
  }

  setTab(tab: SideTab): void {
    this.tab = tab;
    this.selection = null;
    this.routeFrom = null;
    this.notify();
  }

  requestFocus(cityIds: string[]): void {
    this.focusRequest = cityIds;
  }

  beginRoute(from: string): void {
    this.routeFrom = from;
    this.notify();
  }

  cancelRoute(): void {
    this.routeFrom = null;
    this.notify();
  }

  setHelp(open: boolean): void {
    this.helpOpen = open;
    this.notify();
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    saveThemeMode(mode);
    this.notify();
  }

  /** Docelowa wartość „nocy” dla bieżącego stanu i trybu. */
  get nightTarget(): number {
    if (this.themeMode === 'light') return 0;
    if (this.themeMode === 'dark') return 1;
    return this.state ? nightFactor(this.state.time) : 0;
  }

  setMenu(open: boolean): void {
    this.menuOpen = open;
    this.notify();
  }

  /** Wykonuje akcję silnika; przy błędzie pokazuje komunikat. */
  act(fn: (s: GameState) => ActionResult, successToast?: string): ActionResult {
    if (!this.state) return { ok: false, reason: 'Brak gry.' };
    const res = fn(this.state);
    if (!res.ok) this.message('bad', 'Nie można wykonać', res.reason);
    else if (successToast) this.message('info', successToast);
    this.notify();
    return res;
  }

  message(kind: LogEntry['kind'], title: string, text?: string): void {
    this.toast({ id: ++this.toastSeq, time: this.state?.time ?? 0, kind, title, text });
    this.notify();
  }

  toast(entry: LogEntry): void {
    const ttl = entry.kind === 'bad' ? 7000 : 5500;
    this.toasts.push({ ...entry, expires: performance.now() + ttl });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  save(): boolean {
    return this.state ? saveGame(this.state) : false;
  }

  /** Czy na środku ekranu czeka ważne wydarzenie (czas gry jest wtedy wstrzymany). */
  get eventOpen(): boolean {
    return !!this.state && this.state.pendingEvents.length > 0;
  }

  get paused(): boolean {
    return this.speed === 0 || this.helpOpen || this.menuOpen || this.eventOpen;
  }

  /** Potwierdzenie wydarzenia lub wybór opcji decyzji. */
  resolveEvent(uid: number, choice?: number): void {
    if (!this.state) return;
    resolvePendingEvent(this.state, uid, choice);
    saveGame(this.state);
    this.notify();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dtReal = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const s = this.state;
    let changed = false;

    if (s && !s.gameOver && !this.paused) {
      const sink = advance(s, dtReal * CONFIG.MINUTES_PER_SECOND * this.speed, emptySink());
      for (const a of sink.arrivals) {
        // Przyloty do tego samego miasta w krótkim odstępie sumujemy w jeden napis.
        const recent = this.floating.find((f) => f.cityId === a.cityId && now - f.born < 500);
        if (recent) recent.amount += a.amount;
        else this.floating.push({ cityId: a.cityId, amount: a.amount, born: now });
      }
      for (const n of sink.notices) this.toast(n);
      if (sink.notices.length || s.gameOver || s.pendingEvents.length) changed = true;
      if (now - this.lastSave > 15_000) {
        saveGame(s);
        this.lastSave = now;
      }
    }
    if (this.floating.length > 60) this.floating.splice(0, this.floating.length - 60);
    this.floating = this.floating.filter((f) => now - f.born < 1600);
    const toastsBefore = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.expires > now);
    if (this.toasts.length !== toastsBefore) changed = true;

    // Postęp nocy podąża za zegarem gry (wygładzony, by ręczna zmiana trybu też była płynna).
    const target = this.nightTarget;
    this.night += (target - this.night) * Math.min(1, dtReal * 1.2);
    if (Math.abs(target - this.night) < 0.001) this.night = target;
    // Zamiana jasny ↔ ciemny trwa ok. 1,2 s czasu rzeczywistego, niezależnie od prędkości i pauzy.
    const swapTarget = this.night >= SWAP_POINT ? 1 : 0;
    const step = dtReal / 1.2;
    this.themeSwap = swapTarget > this.themeSwap ? Math.min(swapTarget, this.themeSwap + step) : Math.max(swapTarget, this.themeSwap - step);
    applyTheme(this.night, this.themeSwap);

    for (const hook of this.frameHooks) hook(now);

    // Panele Reacta odświeżamy rzadziej niż mapę.
    if (changed || (s && !this.paused && now - this.lastNotify > 250)) {
      this.lastNotify = now;
      this.notify();
    }
  };
}

export const controller = new GameController();

// Ułatwienie debugowania w trybie deweloperskim: window.contrail w konsoli przeglądarki.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { contrail: GameController }).contrail = controller;
}
