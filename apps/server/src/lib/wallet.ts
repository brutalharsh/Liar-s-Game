/**
 * Wallet helpers — the ONLY code that reads/writes wallet_ledger
 * (append-only, balance derived — STR/04 §7).
 */
import type { ClientSession } from 'mongoose';
import { WalletLedger, type LedgerReason } from '../models/wallet-ledger.js';

export interface LedgerInput {
  accountId: string | import('mongoose').Types.ObjectId;
  delta: number;
  reason: LedgerReason;
  refId: string;
  /** Idempotency key — `${source}:${refId}` (unique index). */
  txId: string;
}

export interface BalanceRow {
  _id: unknown;
  total: number;
}

/** Mongo duplicate-key (E11000) — the idempotency signal everywhere. */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number; message?: string };
  return e?.code === 11000 || (typeof e?.message === 'string' && e.message.includes('E11000'));
}

/** Derived balance = sum of ledger deltas. Never a stored column. */
export async function deriveBalance(
  accountId: string | import('mongoose').Types.ObjectId,
): Promise<number> {
  const rows = await WalletLedger.aggregate<BalanceRow>([
    { $match: { accountId } },
    { $group: { _id: null, total: { $sum: '$delta' } } },
  ]).exec();
  const row = rows[0];
  return row ? Number(row.total) : 0;
}

/** Batch derived balances for the admin user list (one aggregation). */
export async function deriveBalances(accountIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (accountIds.length === 0) return out;
  const rows = await WalletLedger.aggregate<{ _id: unknown; total: number }>([
    { $match: { accountId: { $in: accountIds } } },
    { $group: { _id: '$accountId', total: { $sum: '$delta' } } },
  ]).exec();
  for (const row of rows) {
    out.set(String(row._id), Number(row.total));
  }
  return out;
}

export type AppendLedgerResult = { ok: true } | { ok: false; duplicate: true };

/**
 * Appends one ledger row. Returns `duplicate` instead of throwing on E11000 —
 * callers decide what a duplicate means (idempotent re-verify, re-click, …).
 */
export async function appendLedger(
  input: LedgerInput,
  session?: ClientSession,
): Promise<AppendLedgerResult> {
  try {
    await WalletLedger.create([input], session ? { session } : undefined);
    return { ok: true };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { ok: false, duplicate: true };
    throw err;
  }
}
