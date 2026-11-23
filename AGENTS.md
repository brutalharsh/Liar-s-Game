# AGENTS.md — working guide for AI agents on this repo

**Project:** Liar's Game — a free-to-play browser multiplayer bluffing card game
(the "Liar's Deck" format: throw cards, call liars, loser faces a 1-in-6 revolver).
Mobile + desktop web, 2–7 players per room (8–10 premium), invite-link instant play.

**Today's shape:** npm-workspaces monorepo, full TypeScript, e.g.

```
apps/web            Next.js 16.4 App Router (all UI, PWA, framer-motion)
apps/server         Express 5 CommonJS + Socket.IO 4.8 (game authority + REST)
packages/rules-engine  PURE game rules, zero IO, vitest suite
packages/shared     zod wire schemas + domain types + sanitizer + config
STR/               distilled project docs ← READ THESE FIRST
research/          deep research archive (cite-able background)
```

## Read order (mandatory, before writing any code)

1. `STR/00-INDEX.md` (2 min) — project snapshot + doc map
2. `STR/01-game-rules.md` — the game we're building (rules incl. our amendments)
3. Your mission-specific docs: stack/protocol/security/data-model as relevant
   (`STR/06`, `STR/07`, `STR/08`, `STR/09`), and flow/UI for frontend work
   (`STR/03`, `STR/05`, and ASCII wireframes in `research/09`)
4. `STR/10-build-progress.md` — current status; don't redo finished work
5. `docs/` — **PRIVATE (gitignored; never commit, push, or quote it)**: full API
   references for the two hosted services. Read ONLY if your mission touches
   payments or images. Public files never name those services — say "the
   payment proxy" / "the image server"; identities live in env + docs/.

## Non-negotiables (violating any of these = work rejected)

1. **Server-authoritative, zero hidden data on the wire** (STR/08 §1): other players'
   card ranks, deck order, and ANY `bulletPos` never leave the server. `reveal:show`
   is the only face-leak event. zod-validate EVERY socket/REST input.
2. **All game RNG via injected crypto port**; never `Math.random` in game paths.
3. **Rules belong in `packages/rules-engine`** — pure, deterministic, replayable.
   Server imports them; web NEVER implements rules logic.
4. `@liars-game/shared` is the only wire-contract source — no duplicate event
   definitions in apps (temporary local mocks must be marked `TODO-sync-with-shared`).
5. **Never hardcode secrets** — env files + `process.env` only. Convention:
   `NODE_ENV=production` → `.env.production`; dev → `.env.local` (falls back to
   `.env`); only `.env.example` is committed. Rotate-before-launch items are
   tracked in STR/10 Open items.
6. TypeScript strict everywhere; no `any` in exported signatures; no new deps
   without a one-line justification in your report.
7. Visual defaults live in tokens/CSS variables (STR/05 §2) — no hardcoded hex soups.
8. Payments run through the **hosted payment proxy** (server-only key in env;
   amounts always read from the `coin_packs` DB table; grant ONLY after backend
   status verify returns `paid` AND `amountMinor` matches; idempotent per token).
   Until registration, `PAYMENTS_PROVIDER=mock` credits nothing. NEVER store
   `PROJECT_SETUP_KEY` in this repo, and never add a Razorpay SDK.
9. PG-13: no gore, no adult content, no real-money redemption (coins are cosmetic-only).
10. Match the file's existing style; don't reformat untouched code; conventional
    commits (`feat:`, `fix:`, `chore:`) if you commit at all (repo may not be git yet).

## Territory protocol (parallel agents are running)

- Work ONLY inside your assigned directory(ies). Root files (`package.json`, `.env`,
  `AGENTS.md`, `STR/`, `research/`) belong to the orchestrator.
- Don't create files outside your territory; don't `npm install` at repo root unless
  your mission says so (workspaces hoist — prefer `npm install -w <pkg>`).
- Your workspace `package.json` is yours; keep dep versions aligned with STR/06 §2.

## Definition of done (per mission)

- `npx tsc --noEmit` clean in your workspace
- Your test suite green (`npm test -w <pkg>`); rules-engine changes require the
  FULL suite green (no skips, no foc)
- Mock-first UI missions: `npm run build -w apps/web` passes
- Report: files created, verification output summary, deviations + interpretation
  decisions you had to make, anything the next wave needs to know (≤ 15 lines)

## Where things are pinned (single sources)

Rules → STR/01 · Features → STR/02 · Flows → STR/03 · Economy → STR/04 ·
UI/motion → STR/05 · Stack → STR/06 · Wire protocol → STR/07 · Security → STR/08 ·
Mongo schemas → STR/09 · Status → STR/10 · Full task board → research/14.
