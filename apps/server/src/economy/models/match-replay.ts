/**
 * match_replay_seeds — the deterministic-replay pin (rules-engine README:
 * "persist (seed, log) and replay() reproduces the match") and the input for
 * the wave-2 event hash-chain (doc-14 task 111).
 *
 * WHY a companion collection: STR/09's match_records shape (and S-A1's
 * model) carries only the stats core — no `seed`/`log`/`winnerSeat`/`aborted`
 * columns — and models/ is outside E1's territory. Economy persists the
 * envelope fields here, keyed 1:1 by matchId. Written exactly once per
 * match (unique matchId), duplicate = already persisted.
 */
import { Schema, model } from 'mongoose';

export interface MatchReplayFields {
  matchId: string;
  roomCode: string;
  seed: number;
  winnerSeat: number | null;
  aborted: boolean;
  /** Rules-engine serialized LogEntry[] — opaque here, hash-chained in wave 2. */
  log: unknown[];
  endedAt: Date;
}

const MatchReplaySchema = new Schema<MatchReplayFields>({
  matchId: { type: String, required: true },
  roomCode: { type: String, required: true },
  seed: { type: Number, required: true, min: 0 },
  winnerSeat: { type: Number, min: 0, max: 9, default: null },
  aborted: { type: Boolean, default: false },
  log: { type: Schema.Types.Mixed, default: () => [] },
  endedAt: { type: Date, required: true },
});

MatchReplaySchema.index({ matchId: 1 }, { unique: true });

export const MatchReplay = model<MatchReplayFields>('match_replay_seeds', MatchReplaySchema);
