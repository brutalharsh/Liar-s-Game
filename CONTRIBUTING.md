# Contributing to Liar's Game

Thanks for wanting to help! This is an open-source browser multiplayer bluffing
card game (the Liar's Deck format) built with TypeScript end-to-end.

## Where to understand the project (10 minutes)

1. **`STR/00-INDEX.md`** — project snapshot + doc map
2. **`STR/01-game-rules.md`** — the exact rules we implement (including our two
   house amendments: the execution dynamic and open challenge windows)
3. Your area's doc: `STR/06` (stack), `STR/07` (wire protocol), `STR/08`
   (security rules), `STR/09` (data model), `STR/03`/`STR/05` (flows/UI)
4. **`STR/10-build-progress.md`** — what's done/in flight, so you don't redo work

`research/` holds the deep-dive archive (rules archaeology, probability math,
IP analysis, hosting/economy research) — cite it when arguing for a change.

## Set up locally

```bash
git clone https://github.com/brutalharsh/Liar-s-Game.git
cd Liar-s-Game
npm install                 # workspaces: apps/web, apps/server, packages/*
cp .env.example .env        # fill in your own values (never commit .env)
npm run dev:server          # Express + Socket.IO game server
npm run dev:web             # Next.js app (another terminal)
```

## Ground rules

- **Server-authoritative, zero hidden data on the wire** (`STR/08`). The only
  face-leak event is `reveal:show`. Any PR that leaks hidden cards is rejected.
- Rules logic lives in `packages/rules-engine` (pure TypeScript + tests).
  Servers import it; clients never re-implement it.
- All game randomness goes through the injected crypto RNG port.
- TypeScript strict; no `any` in exported signatures.
- Match the style around you; don't reformat untouched code.
- No secrets in code — `.env` only (already gitignored).

## Before you open a PR

```bash
npm run typecheck   # must pass
npm run lint        # must pass
npm test            # full suite must pass, no skipped tests
```

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Keep PRs focused; link the issue; describe the *why* in one paragraph.
- New game-rule behaviour needs table-driven tests first.

## Good first issues

Docs/typos, a11y improvements, new emotes ideas, mock-data realism,
Playwright helpers, CI improvements — and once live: theming, avatars, titles.

PG-13 content policy: no gore, no adult themes, no real-money redemption
(see `STR/02`).
