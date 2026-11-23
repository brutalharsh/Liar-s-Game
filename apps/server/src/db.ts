/**
 * Mongo connection — db name comes from config (dev `liars-game`,
 * prod `liars-game-prod`). Index sync is best-effort and never blocks
 * boot: idempotency guarantees (unique txId / token / entitlement) need the
 * indexes, but a slow Atlas cold-start must not kill the process.
 */
import mongoose from 'mongoose';
import type { AppConfig } from '@liars-game/shared/server';

export async function connectDB(config: AppConfig): Promise<void> {
  await mongoose.connect(config.mongodbUri, {
    dbName: config.mongodbDb,
  });
  console.log(`[db] connected — db "${config.mongodbDb}"`);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

/** Ensures every schema index exists (unique keys for idempotency). */
export async function syncIndexesBestEffort(): Promise<void> {
  const names = mongoose.modelNames();
  const results = await Promise.allSettled(
    names.map((name) => mongoose.model(name).syncIndexes()),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[db] WARNING: syncIndexes failed for ${failed.length} model(s)`);
  } else {
    console.log(`[db] indexes in sync (${names.length} models)`);
  }
}
