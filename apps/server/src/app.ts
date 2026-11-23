/**
 * Express 5 app + Socket.IO mount (STR/06 §3 app shape; STR/07 §0).
 *
 * - config ALWAYS via loadConfig() from @liars-game/shared/server
 * - CORS = config.clientOrigins (credentials — cookies ride same-site)
 * - helmet, cookie-parser, 64kb JSON bodies, per-surface rate limits
 * - Socket.IO attaches to the SAME http server; on connection the session is
 *   resolved into socket.data.user. NO game handlers here — S1 mounts those.
 */
import express, { type Express, type Router, type NextFunction, type Request, type Response } from 'express';
import http from 'node:http';
import { Server as SocketIOServer, type Server as IOServer, type Socket } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { AppConfig } from '@liars-game/shared/server';
import { createDefaultLimiters, type LimiterOverrides } from './lib/rateLimit.js';
import { createPaymentsClient, type PaymentsClient } from './lib/payments.js';
import { createImageServerClient, type ImageClient } from './lib/imageServer.js';
import type { FetchLike } from './lib/oauth.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createAdminRouter } from './routes/admin.js';
import { createBillingRouter } from './routes/billing.js';
import { createShopRouter } from './routes/shop.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createEconomyRouter } from './routes/economy.js';
import { collectRoutes, printRoutes, type RouteInfo } from './lib/printRoutes.js';
import { jsonError } from './lib/api.js';

export interface AppDeps {
  limiters?: LimiterOverrides;
  payments?: PaymentsClient;
  images?: ImageClient;
  fetchImpl?: FetchLike;
}

export interface BootedApp {
  app: Express;
  server: http.Server;
  io: IOServer;
  routes: RouteInfo[];
}

function notFound(_req: Request, res: Response): void {
  jsonError(res, 404, 'NOT_FOUND');
}

function errorHandler(
  err: Error & { status?: number; type?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;
  if (err?.type === 'entity.parse.failed') {
    jsonError(res, 400, 'BAD_REQUEST');
    return;
  }
  if (err?.type === 'entity.too.large') {
    jsonError(res, 413, 'PAYLOAD_TOO_LARGE');
    return;
  }
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status >= 500) {
    console.error('[server] unhandled error:', err instanceof Error ? err.message : String(err));
  }
  res.status(status).json(
    status >= 500 ? { error: 'INTERNAL' } : { error: err?.message ?? 'REQUEST_FAILED' },
  );
}

export function createApp(config: AppConfig, deps: AppDeps = {}): Express {
  const limiters = { ...createDefaultLimiters(), ...deps.limiters };
  const payments =
    deps.payments ??
    createPaymentsClient(config.payments, deps.fetchImpl ? { fetch: deps.fetchImpl } : {});
  const images = deps.images ?? createImageServerClient(config.imageServer);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only — no HTML documents served
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploads render cross-origin
    }),
  );
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response): void => {
    res.json({ ok: true });
  });

  const authRouter = createAuthRouter(config, {
    authLimiter: limiters.auth,
    fetchImpl: deps.fetchImpl,
  });
  const adminRouter = createAdminRouter(config, {
    loginLimiter: limiters.login,
    adminLimiter: limiters.admin,
    images,
  });
  const billingRouter = createBillingRouter(config, {
    billingLimiter: limiters.billing,
    payments,
    fetchImpl: deps.fetchImpl,
  });
  const shopRouter = createShopRouter(config);

  const economyRouter = createEconomyRouter(config);
  const roomsRouter = createRoomsRouter();
  const mounts: ReadonlyArray<readonly [string, Router]> = [
    ['/api/auth', authRouter],
    ['/api/admin', adminRouter],
    ['/api/billing', billingRouter],
    ['/api', shopRouter],
    ['/api', economyRouter],
    ['/api', roomsRouter],
  ];
  const routes: RouteInfo[] = [
    { methods: ['GET'], path: '/api/health' },
    ...mounts.flatMap(([prefix, router]) => collectRoutes(prefix, router)),
  ];
  app.locals['routes'] = routes;

  for (const [prefix, router] of mounts) app.use(prefix, router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export function startServer(config: AppConfig, deps: AppDeps = {}): BootedApp {
  const app = createApp(config, deps);
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: { origin: config.clientOrigins, credentials: true },
    maxHttpBufferSize: 64 * 1024, // payloads stay tiny — emotes, not media
  });

  const socketAuth = createAuthMiddleware(config.authSecret);
  io.on('connection', (socket: Socket) => {
    // Resolve the handshake cookie; unauthenticated sockets are allowed to
    // connect (spectator), but S1 denies play events with AUTH_REQUIRED.
    void socketAuth.authenticateSocket(socket).then((user) => {
      socket.data.user = user;
    });
  });

  return {
    app,
    server,
    io,
    routes: (app.locals['routes'] as RouteInfo[]) ?? [],
  };
}
