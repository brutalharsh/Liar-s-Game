/**
 * xp_events — STR/09 (optional audit, promoted here): { accountId, matchId,
 * xp, at } with a UNIQUE (accountId, matchId) index. It is the per-user
 * per-match idempotence ANCHOR for grantMatchRewards: the first write inside
 * the per-user transaction. A duplicate key there means the player's grant
 * already fully committed (ledger + users land in the same transaction) — a
 * re-fired game:over is a no-op, and a crash mid-grant retries clean.
 */
import { Schema, model } from 'mongoose';

export interface XpEventFields {
  accountId: unknown; // ObjectId ref users
  matchId: string;
  xp: number;
  at: Date;
}

const XpEventSchema = new Schema<XpEventFields>({
  accountId: { type: Schema.Types.ObjectId, required: true },
  matchId: { type: String, required: true },
  xp: { type: Number, required: true, min: 0 },
  at: { type: Date, default: () => new Date() },
});

XpEventSchema.index({ accountId: 1, matchId: 1 }, { unique: true });

export const XpEvent = model<XpEventFields>('xp_events', XpEventSchema);
