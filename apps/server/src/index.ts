/**
 * Boot sequence (STR/06 §5): loadConfig() (dotenv trio + validation) →
 * Mongo connect (db from config) → express + Socket.IO listen → index sync
 * (best-effort, non-blocking) → route table → graceful SIGTERM/SIGINT.
 * Config errors list KEY NAMES only, never values (STR/08 §10).
 */
import { loadConfig, resolveEnvFile } from '@liars-game/shared/server';
import { connectDB, disconnectDB, syncIndexesBestEffort } from './db.js';
import { startServer } from './app.js';
import { printRoutes } from './lib/printRoutes.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { registerGame } from './game/index.js';
import { economy } from './economy/index.js';

async function main(): Promise<void> {  const config = loadConfig();
  const envFile = resolveEnvFile();
  await connectDB(config);

  const { server, io, routes } = startServer(config);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => resolve());
  });

  console.log(`[boot] Liar's Game server listening on :${config.port}`);
  console.log(`[boot] env file: ${envFile ?? '(none — real environment only)'}`);
  console.log(`[boot] payments provider: ${config.payments.provider}`);
  console.log('[boot] socket.io mounted on the same HTTP server');
  printRoutes(routes);

  // S1 + E1: authoritative game rooms, rewards wired end-to-end.
  // grantMatchRewards is idempotent per user+match; bot: seats fail the
  // ObjectId check inside the grant → skipped-unknown-user (never rewarded).
  const game = registerGame(io, {
    authenticateSocket: createAuthMiddleware(config.authSecret).authenticateSocket,
    onMatchEnd: economy.grantMatchRewards,
  });

  // Unique indexes are the idempotency backbone — sync without blocking boot.
  void syncIndexesBestEffort();

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[boot] ${signal} received — shutting down`);
    game.close(); // dissolve all rooms (no partial match rewards)
    io.close();
    server.close();
    setTimeout(() => {
      void disconnectDB().finally(() => process.exit(0));
    }, 50);
    // Hard stop if something refuses to close.
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[boot] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
