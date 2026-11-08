import { useSyncExternalStore } from 'react';
import { controller } from './controller';

/** Subskrybuje kontroler; komponent przerysowuje się po każdej zmianie stanu gry lub UI. */
export function useGame() {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  return controller;
}
