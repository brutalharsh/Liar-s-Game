/**
 * Thin transaction wrapper. The shop spend flow needs balance-check + ledger
 * append + entitlement insert to be one atomic unit (STR/04 §7 "spend =
 * atomic conditional"). Atlas (replica set) supports multi-document
 * transactions. Unit tests mock this module (sequential = race-free there).
 */
import mongoose, { type ClientSession } from 'mongoose';

export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async (txSession) => work(txSession));
  } finally {
    await session.endSession();
  }
}
