import { CONFIG } from '../engine/config';
import { saveGame } from '../engine/save';
import { advance } from '../engine/simulation';
import type { ActionResult, GameState, LogEntry } from '../engine/types';
import { emptySink } from '../engine/util';

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

  get paused(): boolean {
    return this.speed === 0 || this.helpOpen || this.menuOpen;
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
      if (sink.notices.length || s.gameOver) changed = true;
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
