import { CONFIG, MIN_PER_DAY } from './config';
import type { GameState, LogEntry, LogKind, SimSink } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const dayOf = (time: number) => Math.floor(time / MIN_PER_DAY);

export function nextId(s: GameState, prefix: string): string {
  s.nextId += 1;
  return `${prefix}${s.nextId}`;
}

export function sumValues(rec: Record<string, number>): number {
  let t = 0;
  for (const k in rec) t += rec[k];
  return t;
}

/** Dopisuje wpis do dziennika i (opcjonalnie) przekazuje go do UI jako powiadomienie. */
export function log(s: GameState, kind: LogKind, title: string, text?: string, sink?: SimSink): LogEntry {
  const entry: LogEntry = { id: ++s.nextId, time: s.time, kind, title, text };
  s.log.push(entry);
  if (s.log.length > CONFIG.LOG_SIZE) s.log.splice(0, s.log.length - CONFIG.LOG_SIZE);
  sink?.notices.push(entry);
  return entry;
}

export function emptySink(): SimSink {
  return { arrivals: [], notices: [] };
}
