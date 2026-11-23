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

## 2. Versions (verified 2026-11-23; re-verify at install)

- **Next.js 16.4** (React 19), TypeScript ≥5.6 strict, Tailwind 4
- **Express 5.3** (CommonJS), **Socket.IO 4.8.4** (+ ws engine auto)
- **mongoose 9** (MongoDB Atlas), **zod 4**, **zustand 5**, **motion 14**
  (framer-motion), **howler 2.2**, vitest, nanoid, dotenv
- NO xstate (hand-rolled discriminated-union FSM), NO Colyseus, NO redis for v1 scale

## 3. The server-authoritative pattern (why this shape)

- `packages/rules-engine`: pure reducer `apply(state, event) → {state, effects}`.
  All RNG via injected port. Emit structured event log → deterministic replay.
- `apps/server`: RoomManager {roomId → RoomState + sockets}; Socket.IO events →
  zod-parse → `rules-engine.apply` → broadcast **view-filtered** snapshots/deltas.
  REST: leaderboard, profile, shop, payments (mock), public rooms list.
- `apps/web`: zustand store mirrors last-known state; optimistic UI only where
  safe (emotes, selections); every wire type re-exported from `@liars-game/shared`.
- **Clients are dumb terminals.** They never hold hidden cards, never compute
  outcomes, never send their own balance/XP.

## 4. Scale plan (target: ~1,000 concurrent; owner's VPS)

- Single Node process on the VPS: 1K players ≈ 1K sockets ≈ 100–200MB → trivial.
  Rooms live in process memory; MongoDB only for accounts/wallets/stats/leaderboards.
- No Redis adapter, no sticky sessions, no multi-instance at v1 scale.
- Escalation (documented, not built): >5K CCU → PM2 cluster + Socket.IO Redis adapter
  + sticky LB; >50K → consider Go/Elixir socket swap (single-process replace,
  contract unchanged).
- Match records written async (non-blocking) — game loop never awaits Mongo.

## 5. Deploy (Ubuntu VPS — per research/07)

- Caddy (auto-TLS) → reverse proxy: `/` → Next static (apps/web `next build`
  standalone out), `/socket.io/` → Node server (PM2, `pm2 reload` safe).
- `.env` on VPS only (never committed; rotate Mongo password — it was chat-shared).
- MongoDB Atlas free M0 (512MB ≈ 200K user docs) — upgrade M10 when needed.
- Dev loop: `npm run dev -w apps/web` + `npm run dev -w apps/server` (tsx watch);
  friend playtests via cloudflared tunnel before VPS.

## 6. Testing strategy

- rules-engine: 30+ vitest table-driven cases (research/02 §11 checklist) — the
  engine is correct if the tests are green; no other test layer may compensate.
- shared: sanitizer/room-code/schema round-trip tests.
- server: two-client socket integration tests (join → full round) + packet-recorder
  CI guard (asserts zero hidden-card payloads pre-reveal).
- web: Playwright E2E happy path (later waves), responsive screenshot audit
  390/768/1440, Lighthouse mobile budget (load ≤2.5MB, TTI <3s mid-tier).
