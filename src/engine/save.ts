import { updateDiscovery } from './countries';
import { SAVE_VERSION } from './setup';
import type { GameState } from './types';

const KEY = 'contrail-save-v1';

export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION || s.gameOver) return null;
    return migrate(s);
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* brak dostępu do localStorage */
  }
}

/** Uzupełnia zapisy ze starszych wersji gry o nowe pola. */
export function migrate(s: GameState): GameState {
  s.pendingEvents ??= [];
  s.loans ??= [];
  s.eventCooldowns ??= {};
  s.nextMajorAt ??= 0;
  s.expeditions ??= [];
  if (!s.discovered) {
    s.discovered = [];
    updateDiscovery(s, undefined, true);
  }
  // Stary format aktywnych wydarzeń (bez modyfikatorów) jest odrzucany.
  s.events = (s.events ?? []).filter((e) => e && typeof e === 'object' && 'mods' in e);
  s.eventRev = (s.eventRev ?? 0) + 1;
  return s;
}
