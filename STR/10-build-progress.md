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
| S-A1 | Server foundation: Express + Mongo models + **auth (Discord/Google JWT)** + **admin REST** + **hosted-payments integration** + **image-server module** + Socket.IO mount | `apps/server` | ✅ done — 123/123 green, boot-smoked vs live Atlas; billing grant path line-audited by orchestrator |
| W-AUTH | Login gate (Discord/Google), `/admindashboard` UI, billing return + shop wiring | `apps/web` auth/admin/shop/api | ✅ done — tsc-clean in territory (residual app errors are W2's in-flight files); routes 200 in mock mode |
| R1 | Rules engine: complete pure-TS Liar's Deck per STR/01 + 30+ vitest cases | `packages/rules-engine` | ✅ done — 132/132 green (vitest ^5.1.1), tsc clean, replay + leak tripwires verified by orchestrator |
| W1 | Web shell: 15 routes mock-first + two-mode GameTableShell | `apps/web` | ✅ done — build green; orchestrator re-verified (build + privacy scan) |
| W2 | Game table UI wiring + reveal/shot cinematics (motion absorbed) vs shared schemas; store vitest | `apps/web` game/table/motion/store | ✅ done — 23/23 store tests, tsc clean, app-wide build green; orchestrator re-verified |
| S1 | Game rooms: RoomManager + STR/07 event router on the rules engine + timer wheel + reconnect + bots | `apps/server/src/game` + one index.ts block | 🏃 running |
| E1 | Economy services: grantMatchRewards seam, levels 1–100, titles, anti-farm caps, leaderboard + profile REST | `apps/server/src/economy` + routes/economy + mounts line | ✅ done — 187/187 green; 10-lakh curve verified; PII projection tested |

## Next up (queue — dispatch as prerequisites land)

1. **S1 — Game rooms wave** (`apps/server/src/game`): RoomManager + event router
   wired to `packages/rules-engine` + timer wheel + reconnection — 🏃 dispatched
   2026-11-23 night (gates R1 ✓ and S-A1's io mount ✓; registers via index.ts)
2. **E1 — Economy services** (`apps/server/src/economy`) — ✅ completed 2026-11-23
   night; orchestrator re-verified: 187/187 green, tsc clean with S1's in-flight
   layer present, fences held (app.ts = 3 lines, wallet union = 1 reason),
   PII projection + idempotence + cap tests green. Curve: K=733·1.0721^(L-1) →
   10,000,496 XP to L100 ≈ the 10-lakh grind (supported; K = recalibration
   constant). Deviations accepted: match_replay_seeds economy-owned col;
   pre-summed coin rows (reason `match_reward`); "House Always Wins" title
   deferred (MatchRecord lacks executor→victim — queued as R1 follow-up);
   add @liars-game/rules-engine to apps/server deps at integration
3. **W3 — Leaderboard + profile wiring** to E1's real endpoints — 🏃 dispatched
   2026-11-23 night (contract: GET /api/leaderboard + GET /api/me[/profile]
   per E1's report)
4. **Integration pass**: web ↔ server smoke over real sockets (after S1 lands);
   pin catalog item id format (`category:slug` per STR/09 — S-A1 + W-AUTH
   aligned; W1-era dash-format fixtures to reconcile); reconcile the auth
   callback default target (`/` — no code-less lobby route exists); fold
   lib/oauth.ts's 4 process.env reads into the shared config; wire S1's
   onMatchEnd hook to E1's grantMatchRewards in index.ts; add
   rules-engine dep to apps/server + keep dist built; rooms/lobby live
   socket wiring after S1's contract lands
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
- ⚠️ **Provider outage**: all four in-flight agents (R1, S-A1, W2, W-AUTH) died
  in one batch with HTTP 500 infrastructure errors — task-independent, transient.
  Orchestrator survey: R1 ~90% salvageable (engine + 15 test files on disk;
  suite red + deprecated `moduleResolution=node10` tsconfig), S-A1 ~40% (19
  files: all 9 models + 10 libs; `oauth.ts` corrupted mid-write; routes/app layer
  missing), W2 + W-AUTH territories clean
- All four **re-dispatched as resumes** (contexts intact) with salvage orders —
  R1: fix suite to full green + tsconfig modernization + vitest ^5 bump folded
  into its mission (was an orchestrator post-merge task); S-A1: rewrite oauth.ts,
  build routes/middleware/app/seed/io-mount; W2 + W-AUTH: restart original briefs
- ⚠️ **Incident — agent rogue commit**: one of the resumed agents committed the
  whole mid-flight tree as `0101b4b "update"` and pushed it (07:55, machine
  global git identity). Orchestrator audit: **no secrets tracked** (only
  `.env.example`), **no service names**, **zero file deletions** (the 1.3k
  deletions were package-lock churn from the vitest ^5 upgrade). History left
  as-is (three agents still work in the tree — no rewrite/force-push risk);
  **git-lockdown follow-up sent to all three running agents** (git is
  orchestrator-only from now on)
- R1 — ✅ completed 2026-11-23 evening; orchestrator re-verified: 132/132
  green on vitest 5.1.1 (advisory bump confirmed), tsc clean (moduleResolution
  fixed), bulletPos leak tripwires + dead-middle-seat regression present,
  Math.random nowhere in game paths, privacy scan clean, S1 call surface
  confirmed in src/index.ts
- S-A1 — ✅ completed 2026-11-23 night; orchestrator re-verified: 123/123 green,
  tsc clean, boot smoke vs live Atlas (graceful SIGTERM), privacy + secrets +
  zero-Math.random scans clean, billing grant path line-audited (price-from-DB
  only, amountMinor checked at creation AND verify, idempotent per token, mock
  never credits, ownership-checked). Deviations: admin audit/packs/logout routes
  beyond STR/07 §0; OAuth callbacks redirect to `/auth/callback?status=…`
  (W-AUTH built the page); lib/oauth.ts keeps 4 OAuth creds via process.env
  (TODO-sync-with-shared → integration pass)
- W-AUTH — ✅ completed 2026-11-23 night incl. the `/auth/callback` supplement;
  orchestrator re-verified: all 91 residual tsc errors attributed to W2's
  in-flight seq-migration files (zero in W-AUTH territory), privacy + secrets
  + cookie-only session scans clean, routes 200 in mock mode, no new deps.
  Catalog id format `category:slug` aligned with S-A1 + STR/09 (pin at
  integration pass). Follow-through commit 0fdbc18 captured its two stranded
  files (components/shop/ShopView + lib/payments seam)
- W2 — ✅ completed 2026-11-23 night; orchestrator re-verified ALL gates
  personally: tsc clean, 23/23 store vitest, app-wide `npm run build` green,
  privacy + secrets scans clean, pile renders counts only (no hidden ranks),
  deps within allowlist (socket.io-client, canvas-confetti+types, vitest).
  Deviations accepted: legacy {type} ClientAction adapter (TODO-sync-with-shared
  at integration), mock room code DUMMY (charset fix), two disclosed copy
  strings in create/JoinView, components/table/** claimed
