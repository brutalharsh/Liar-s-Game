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

```bash
git clone https://github.com/brutalharsh/Liar-s-Game.git
cd Liar-s-Game
npm install                 # npm workspaces monorepo
cp .env.example .env        # fill in your own values — NEVER commit .env
npm run dev:server          # Express + Socket.IO on :3001
npm run dev:web             # Next.js app on :3000 (another terminal)
```

Verify everything: `npm run verify` (typecheck + lint + full test suite).

## Project status

Live build log: [`STR/10-build-progress.md`](STR/10-build-progress.md)

Roadmap highlights: public rooms browser, leaderboard + kills + titles,
TTS voice lines, cosmetic shop with coin economy (payments stubbed until a
provider is chosen), AI-generated original art. See [`STR/02-features.md`](STR/02-features.md).

## Contributing

Yes please! Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first (10-minute doc tour
inside), then claim a good-first-issue. The two laws of this codebase:

1. **Hidden game data never leaves the server** (`reveal:show` is the only exception)
2. **All game RNG is server-side crypto-random** (injected port, replayable)

Found something security-sensitive? See [`SECURITY.md`](SECURITY.md) — no public issues for those.

## License

[MIT](LICENSE) © 2026 Harsh (brutalharsh) and contributors.
