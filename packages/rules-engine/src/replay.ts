/**
 * Deterministic replay — research/13 §10 "hash-chained replay logs" input and
 * the engine's audit primitive: `(seed, events[]) → the exact match again`.
 *
 * A match is reproducible iff its RNG was a `SeededRng` constructed from the
 * recorded `initialSeed` (the recommended production pattern — see rng.ts).
 * Rejected events replay identically (they mutate nothing but the log).
 */
import { apply, createMatch } from './engine';
import { SeededRng } from './rng';
import type { Effect, GameError, GameEvent, GameState, LogEntry, MatchConfig, RosterEntry } from './types';
import { DEFAULT_MATCH_CONFIG } from './types';

export interface ReplayOptions {
  roster: RosterEntry[];
  matchId?: string;
  roomCode?: string;
  theme?: string;
  config?: Partial<MatchConfig>;
  seed: number;
  /** The ordered event log — LogEntry[] (from state.log) or plain GameEvent[]. */
  events: (LogEntry | GameEvent)[];
}

export interface ReplayResult {
  state: GameState;
  effects: Effect[];
  rejected: GameError[];
}

/** Re-runs a match from its input events and seed. */
export function replay(o: ReplayOptions): ReplayResult {
  let s = createMatch({
    roster: o.roster,
    matchId: o.matchId,
    roomCode: o.roomCode,
    theme: o.theme,
    config: { ...DEFAULT_MATCH_CONFIG, ...o.config },
    seed: o.seed,
    rng: new SeededRng(o.seed),
  });
  const effects: Effect[] = [];
  const rejected: GameError[] = [];
  for (const entry of o.events) {
    const event = 'event' in entry ? entry.event : entry;
    const r = apply(s, event);
    s = r.state;
    effects.push(...r.effects);
    if (r.err) rejected.push(r.err);
  }
  return { state: s, effects, rejected };
}

/**
 * The state minus its live `rng` reference — a JSON-comparable value for
 * replay-equality assertions and for persisting engine state.
 */
export function stripRuntime(s: GameState): Omit<GameState, 'rng'> {
  const { rng, ...rest } = s;
  void rng;
  return structuredClone(rest);
}
