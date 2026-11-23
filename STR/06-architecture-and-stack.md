# STR/06 — ARCHITECTURE & STACK (pinned)

> Full TypeScript, approved by owner 2026-11-23. Deep rationale: research/11.

## 1. Monorepo tree (npm workspaces, repo root = this folder)

```
liars-game/
├── AGENTS.md, README.md, .env, .env.example, package.json
├── apps/
│   ├── web/          # Next.js 16.4 App Router — all UI, PWA
│   └── server/       # Express 5 (CommonJS) + Socket.IO 4.8 — the whole game authority
├── packages/
│   ├── shared/       # zod event schemas + domain types + sanitizer + config loader
│   └── rules-engine/ # PURE TypeScript game rules (no IO) + vitest suite
├── STR/              # distilled docs (this folder)
└── research/         # deep research archive
```

## 2. Versions (verified against shipped package.json 2026-11-23; re-verify at install)

- **Next.js 16.4.6** (React 19.2), TypeScript ^5.7 strict, Tailwind ^4.3
- **Express ^5.3** (CommonJS), **Socket.IO ^4.8.4** (+ ws engine auto; web uses
  socket.io-client ^4.8.4)
- **mongoose ^9.12**, **zod ^4.6**, **zustand 5.1**, **motion 14.14**
  (framer-motion's package name), vitest ^5.1, dotenv ^18
- Server extras: helmet ^8, cors (phantom dep — see STR/10 flags),
  express-rate-limit ^8, jsonwebtoken ^9, cookie-parser
- **not installed yet**: howler (SFX seam built at `web/lib/sfx.ts`, engine
  lands with the audio pass); nanoid is NOT used anywhere (node:crypto
  `randomUUID`/`randomInt` instead)
- NO xstate (hand-rolled discriminated-union FSM), NO Colyseus, NO redis for v1 scale

## 3. The server-authoritative pattern (as shipped)

- `packages/rules-engine`: pure reducer `apply(state, event) → {state, effects, err?}`.
  All RNG via injected port. Structured event log → deterministic replay
  (`replay({roster, seed, events})` is bit-exact).
- `apps/server`: `RoomManager {roomCode → Room}` in process memory; one
  `MatchRuntime` per live match wraps the engine, maps engine `Effect`s to STR/07
  events (seq-stamped), drives a timer wheel from ENGINE deadline fields, and
  schedules bots (`SeededRng(seed ^ salt)` so bot draws never advance the replay
  stream). Socket.IO events → session resolve → zod-parse → reducer → broadcast
  **view-filtered** snapshots/deltas. REST: auth, admin, billing, shop, rooms,
  leaderboard, profile.
- `apps/web`: zustand store mirrors last-known state; every wire type re-exported
  from `@liars-game/shared` via the single seam `lib/wire.ts`; optimistic UI only
  where safe (emotes, selections). Mock-first: `NEXT_PUBLIC_API_MODE` (mock in dev,
  live in prod, `?apimode=` per-tab override).
- **Clients are dumb terminals.** They never hold hidden cards, never compute
  outcomes, never send their own balance/XP.

### 3a. Boot flow (`apps/server/src/index.ts`, verified)

`loadConfig()` (env trio via `@liars-game/shared/server`) → `connectDB` →
`startServer()` (Express app + Socket.IO on the SAME http server; helmet, strict
CORS from `CLIENT_ORIGIN`, cookie-parser, 64kb JSON, per-surface rate limits;
handshake cookie resolves `socket.data.user`) → listen → route-table print →
**`registerGame(io, { authenticateSocket, onMatchEnd: economy.grantMatchRewards })`**
(mounts RoomManager + the 8-event socket router; this is the whole game-layer
registration — 2 imports + 1 call in index.ts, zero changes in app.ts) →
`syncIndexesBestEffort()` (async, never blocks boot) → SIGTERM/SIGINT:
`game.close()` (dissolve all rooms) → `io.close()` → `server.close()` → Mongo
disconnect.

## 4. Scale plan (target: ~1,000 concurrent; owner's VPS)

- Single Node process on the VPS: 1K players ≈ 1K sockets ≈ 100–200MB → trivial.
  Rooms live in process memory; MongoDB only for accounts/wallets/stats/leaderboards.
- No Redis adapter, no sticky sessions, no multi-instance at v1 scale.
- Escalation (documented, not built): >5K CCU → PM2 cluster + Socket.IO Redis adapter
  + sticky LB; >50K → consider Go/Elixir socket swap (single-process replace,
  contract unchanged).
- Match records written async (non-blocking) — game loop never awaits Mongo.

## 5. Deploy (Ubuntu VPS — per research/07)

- **Production domain: `https://liarsgame.thedevs.org`** (DNS on the VPS).
- Caddy (auto-TLS) → reverse proxy: `/` → Next static (apps/web `next build`
  standalone out), `/socket.io/` + `/api` → Node server (PM2, `pm2 reload` safe),
  `NODE_ENV=production`.
- Env files: `.env.local` (dev machine) / `.env.production` (copy-paste ready for
  the VPS, domain already set inside); both gitignored — only `.env.example` is
  committed. Rotate Mongo password before launch; dedicated prod Atlas user + IP lock.
- MongoDB Atlas free M0 (512MB ≈ 200K user docs) — upgrade M10 when needed.
- Dev loop: `npm run dev -w apps/web` + `npm run dev -w apps/server` (tsx watch);
  in dev the web app proxies `/api/*` → `localhost:3001` (next.config rewrites)
  so cookies + OAuth stay same-origin; production is same-origin behind the
  reverse proxy. Web-only env defaults: `NEXT_PUBLIC_API_MODE` (mock|live),
  `NEXT_PUBLIC_TRANSPORT` (mock|live) + `NEXT_PUBLIC_SOCKET_URL` ("" = same
  origin). Friend playtests via cloudflared tunnel before VPS.

## 6. Testing strategy (as shipped)

- rules-engine: **132 vitest cases** (deck/replay/revolver/timeout/window/stats/…) —
  the engine is correct if the tests are green; no other test layer may compensate.
- shared: sanitizer / room-code / schema round-trip / timers / config — 59 cases;
  strict zod = leak tripwire on every payload.
- server: 241 cases — model/route/billing/admin suites + full two-client socket
  integration over faked transports (join → full round at 2/4/6+bot/7 players,
  cross-hand privacy scans, bulletPos deep-key scan, exactly-once timers,
  reconnect/abandon, replay bit-exactness).
- web: 23 store vitest (shared-schema-shaped event → UI state).
- CI (GitHub Actions): typecheck + lint + test all workspaces + `next build` web.
  Hidden-card enforcement = in-suite strict-zod + payload capture scans (a
  dedicated packet-recorder job is still on the wishlist); full-stack
  `live-smoke.mjs` (8 sections, 54 checks incl. privacy + reconnect + smoke of
  the seed P0 fix) is a manual/verification tool, not CI.
- web Playwright E2E happy path + responsive/screenshot + Lighthouse budget:
  later waves (not yet present).
