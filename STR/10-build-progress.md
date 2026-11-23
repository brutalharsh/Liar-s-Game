# STR/10 — BUILD PROGRESS (LIVING STATUS — updated by orchestrator only)

> Every session starts here: what's done, what's in flight, what's next.
> Last updated: **2026-11-23 evening — F1 landed ✅ (re-verified), R1/W1 running;
> auth+admin+payments+images specs locked; S-A1 (server foundation) dispatched**

## Done

- ✅ 12 deep-dive research docs (`research/01–12`) + summary (`research/00`)
- ✅ Owner decisions locked → spec (`research/13`) incl. execution dynamic, challenge
  windows, deck scaling, timers, coins/economy, avatars, titles, leaderboard, TTS
- ✅ Build plan: 22 missions, 159 tasks (`research/14`)
- ✅ Stack approved by owner: **Full TypeScript** (Next 16.4 + Express 5 + Socket.IO +
  framer-motion + Tailwind + Atlas); scale target ≈1K concurrent, one VPS (owner has it)
- ✅ STR distilled docs 00–09
- ✅ AGENTS.md + root scaffold (`package.json`, `.env`, `.gitignore`, README)
- ✅ **OPEN SOURCE (owner decision, 2026-11-23):** MIT license, CONTRIBUTING,
  SECURITY, PR template, GitHub Actions CI (workspace-tolerant), OSS README,
  hardened .gitignore. Repo → https://github.com/brutalharsh/Liar-s-Game.git
  (foundation commit pushed by orchestrator; code waves land as they verify).
- ✅ **F1 LANDED + re-verified by orchestrator**: `packages/shared` — zod wire
  contract for every event (strictObject + required `seq` = leak tripwire),
  sanitizer, room codes (31-char confusable-free set — STR/07 math corrected),
  deadline helpers, config loader behind `@liars-game/shared/server` (client
  bundles can never import it). Dual CJS+ESM dist. **51/51 vitest**, tsc clean,
  eslint clean. Root toolchain landed (tsconfig.base, eslint flat, prettier,
  vitest workspace).
- ✅ **Image server bootstrapped**: our project is registered on the hosted
  image server with its own project key (identity + full API: the private
  gitignored `docs/`; values live in env files only).
- ✅ **Env trio convention**: `.env.example` (committed template) / `.env.local`
  (real dev) / `.env.production` (copy-paste ready for `liarsgame.thedevs.org`,
  secrets freshly generated) — all gitignored via `.env*` + `!.env.example`;
  `git check-ignore` verified by orchestrator.
- ✅ **Scope locked for wave S-A1**: login REQUIRED (Discord+Google OAuth, JWT
  sessions), `/admindashboard` (env-credential login, full user management,
  catalog name/price editing, payment history, image uploads), hosted
  payment-proxy integration (grant-on-verify-only), image-server module.
  STR/02/04/07/08/09 amended.

## In flight (Wave 1 — dispatched 2026-11-23)

| Agent | Mission | Territory | Status |
|---|---|---|---|
| F1 | Foundations: root toolchain + `packages/shared` | root configs, `packages/shared` | ✅ done — 51/51 green; env-trio config follow-up in flight |
| S-A1 | Server foundation: Express + Mongo models + **auth (Discord/Google JWT)** + **admin REST** + **hosted-payments integration** + **image-server module** + Socket.IO mount | `apps/server` | 🏃 running |
| R1 | Rules engine: complete pure-TS Liar's Deck per STR/01 + 30+ vitest cases | `packages/rules-engine` | 🏃 running |
| W1 | Web shell: 15 routes mock-first + two-mode GameTableShell | `apps/web` | ✅ done — build green; orchestrator re-verified (build + privacy scan) |
| W2 | Game table UI wiring + reveal/shot cinematics (motion absorbed) vs shared schemas; store vitest | `apps/web` game/table/motion/store | 🏃 running |
| W-AUTH | Login gate (Discord/Google), `/admindashboard` UI, billing return + shop wiring | `apps/web` auth/admin/shop/api | 🏃 running |

## Next up (queue — dispatch as prerequisites land)

1. **S1 — Game rooms wave** (`apps/server`): RoomManager + event router wired to
   `packages/rules-engine` + timers + reconnection — needs R1 (running) + S-A1's
   io mount (running)
2. **E1 — Economy services** (after S-A1): XP awarding, titles computation,
   match-record ingestion at game end (STR/04/09)
3. **W3 — Shop/profile/leaderboard wiring** to real APIs (after S-A1)
4. **Integration pass**: web ↔ server smoke over real sockets (after S1), fixing
   drift between W2/W-AUTH mock-first clients and the live APIs
5. *(M1 motion pass absorbed into W2's mission)*

## Open items (owner, no rush)

- **Payments registration — the ONE blocker for going live**: give the
  `td_setup_…` key OR create the project on the provider dashboard (private
  `docs/payments-api.md`) →
  paste `PAYMENT_API_KEY` + `PROJECT_ID` into `.env.local` AND `.env.production` →
  flip `PAYMENTS_PROVIDER=proxy`. Everything else is already built.
- **OAuth apps to create** (paste into both env files; register the redirect URIs
  listed inside them): Discord (discord.com/developers → OAuth2, scope identify) +
  Google (console.cloud.google.com, openid email profile). Prod URIs use
  `https://liarsgame.thedevs.org`.
- Admin dashboard credentials (username+strong password) generated and stored in
  the env files — change anytime, they're yours.
- Rotate the chat-shared MongoDB password before launch; dedicated prod Atlas
  user + Network Access locked to the VPS IP (notes inside both env files).
- Trademark clearance for "Liar's Game" before public launch (alternates benched)
- Owner's VPS details (provider, region, access) for the deploy wave
- Post-R1 merge: bump `packages/rules-engine` vitest 3.2.7 → ^5 (two CRITICAL
  advisories — F1's flag) and re-run the suite

## Agent dispatch log

- Research wave (12 agents) — ✅ all completed 2026-11-23, docs verified
- Build wave 1 (F1, R1, W1) — dispatched 2026-11-23
- F1 — ✅ completed same day; orchestrator re-verified (51/51 tests, tsc,
  eslint, zero secrets in packages, env gitignore checks)
- F1 follow-up (config-loader env trio + provider switch) — ✅ completed same
  day (59/59 green), orchestrator re-verified
- S-A1 (server foundation: auth + admin + payments + images) — dispatched
  2026-11-23 evening; R1 still running
- W1 (web shell) — ✅ completed same day; orchestrator re-verified (build green,
  15 routes, privacy + secrets scans clean)
- W2 (table UI + cinematics) + W-AUTH (auth gate + admin UI + billing) —
  dispatched 2026-11-23 evening
