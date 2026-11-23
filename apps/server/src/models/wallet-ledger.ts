/**
 * wallet_ledger — append ONLY (STR/09, STR/04 §7). Balance is derived
 * (sum of `delta`), never stored. `txId` is UNIQUE — every grant/spend is
 * idempotent via `{source}:{refId}` keys. Compensating entries only;
 * rows are never edited or deleted.
 */
import { Schema, model } from 'mongoose';

// 'match_reward' = coins granted at game:over (rounds-survived + win bonus,
// pre-summed by the rules engine — grant.ts applies the record's number).
export const LEDGER_REASONS = [
  'win',
  'survived_round',
  'purchase',
  'spend',
  'adjust',
  'match_reward',
] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];

export interface LedgerFields {
  accountId: unknown; // ObjectId ref users
  delta: number;
  reason: LedgerReason;
  refId: string;
  txId: string;
  at: Date;
}

const WalletLedgerSchema = new Schema<LedgerFields>({
  accountId: { type: Schema.Types.ObjectId, required: true, index: true },
  delta: { type: Number, required: true },
  reason: { type: String, enum: LEDGER_REASONS, required: true },
  refId: { type: String, required: true },
  txId: { type: String, required: true },
  at: { type: Date, default: () => new Date() },
});

WalletLedgerSchema.index({ txId: 1 }, { unique: true });
WalletLedgerSchema.index({ accountId: 1, at: -1 });

export const WalletLedger = model<LedgerFields>('wallet_ledger', WalletLedgerSchema);
