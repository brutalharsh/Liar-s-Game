# 🎰 Liar's Game

![CI](https://github.com/brutalharsh/Liar-s-Game/actions/workflows/ci.yml/badge.svg)

A free-to-play **browser multiplayer bluffing card game** — the *Liar's Deck*
format: throw cards, call out liars, and the loser faces a revolver with one
live round in six chambers.

🕹 **2–7 players per room** (8–10 premium "Big Table") · 📱 mobile + desktop ·
⚡ instant play via invite link — no download, no voice chat.

> Bring your friends, bring Discord, bring your poker face.

**Not affiliated with Curve Animation.** This is an original open-source
implementation of the folk bluffing-game format (Cheat / BS / "I Doubt It"
meets a revolver), with original code, art, and assets. See `research/05` for
the design and IP analysis behind it.

## How it plays (30 seconds)

Each round one rank is the **Table Card** (King / Queen / Ace). On your turn,
throw 1–3 cards **face-down** claiming they're all that rank — lying allowed
(Jokers are wild and always safe). The next player believes you or slams
**"LIAR!"**. The cards flip. Caught lying? A coin decides: you take the
revolver yourself, or your accuser executes you. Wrongly accused someone?
You shoot yourself. Six chambers, one bullet, odds climb every pull —
**the 6th pull is certain death.** Last player alive wins.

Full rules incl. house amendments: [`STR/01-game-rules.md`](STR/01-game-rules.md)

## Repo map

| Path | What |
|---|---|
| **`STR/`** | **Start here** — distilled docs: rules, features, flows, economy, UI/motion, stack, wire protocol, security, data model, live build status |
| `AGENTS.md` | Working guide for AI agents and human contributors alike |
| `research/` | Deep research archive — rules archaeology, probability math, IP analysis, hosting & monetization research, 159-task build plan |
| `apps/web` | Next.js App Router client (UI, PWA, motion) |
| `apps/server` | Express + Socket.IO game server (sole authority) |
| `packages/rules-engine` | Pure TypeScript game rules + table-driven test suite |
| `packages/shared` | zod wire schemas, types, sanitizer, config |

## Set up locally

Requirements: **Node 20+** and a **MongoDB** the server can reach (a free
MongoDB Atlas cluster or a local `mongod` — the server connects before it
listens).

```bash
git clone https://github.com/brutalharsh/Liar-s-Game.git
cd Liar-s-Game
npm install                                            # npm workspaces monorepo

# packages/*/dist is gitignored — build the two base packages FIRST,
# or every import of @liars-game/* (server, web, tests) fails to resolve:
npm run build -w packages/shared -w packages/rules-engine

cp .env.example .env.local   # NEVER commit .env* (only the template is committed)

npm run dev:server           # Express + Socket.IO on :3001
npm run dev:web              # Next.js app on :3000 (another terminal)
```

The server boots only when its config validates — it names empty keys,
never values. From the template you must fill in:

| Key | Notes |
|---|---|
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | admin-dashboard login |
| `MONGODB_URI` | real Mongo connection string (`mongodb://` / `mongodb+srv://`) |
| `IMAGE_SERVER_URL` / `IMAGE_SERVER_KEY` / `IMAGE_SERVER_PROJECT_ID` | must be non-empty; an `http://` placeholder + any strings work for local dev |

`APP_URL`, `MONGODB_DB`, `PORT`, `CLIENT_ORIGIN`, `PAYMENTS_PROVIDER` ship
workable dev defaults in the template. Dev loads `.env.local` (falls back to
`.env`); production loads `.env.production`. Player login uses Discord/Google
OAuth with owner-registered client keys — leave them empty and the server
boots fine, but `/login` can't complete a real provider flow yet.

Verify everything (packages built): `npm run verify` — typecheck + lint +
full test suite across all workspaces.

**Live smoke** (scripted match over real sockets): boot the server, then
`cd apps/web && node scripts/live-smoke.mjs`. It needs the same env + Mongo
(reads `.env.local` walking up), runs a full ~4-minute match, and exits 0
only if every wire-schema, privacy, and economy check passes. Restart the
server process between smoke runs (join rate limit: 10 per IP per 10 min).

## Project status

Live build log: [`STR/10-build-progress.md`](STR/10-build-progress.md)

Roadmap highlights: public rooms browser, leaderboard + kills + titles,
TTS voice lines, cosmetic shop with coin economy, AI-generated original art.
Billing runs in `PAYMENTS_PROVIDER=mock` — nothing charges while the shop is
playable — until the owner completes provider registration and flips the
flag (`.env.example` documents the contract; nothing here names the hosted
services). See [`STR/02-features.md`](STR/02-features.md).

## Contributing

Yes please! Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first (10-minute doc tour
inside), then claim a good-first-issue. The two laws of this codebase:

1. **Hidden game data never leaves the server** (`reveal:show` is the only exception)
2. **All game RNG is server-side crypto-random** (injected port, replayable)

Found something security-sensitive? See [`SECURITY.md`](SECURITY.md) — no public issues for those.

## License

[MIT](LICENSE) © 2026 Harsh (brutalharsh) and contributors.
