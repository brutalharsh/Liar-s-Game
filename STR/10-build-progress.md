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
| W3 | Leaderboard + profile pages wired to E1's real endpoints (typed 1:1, curve-matched fixtures) | `apps/web` leaderboard/profile/api/fixtures | ✅ done — tsc, build, 23/23, scans clean; 4-metric board + full profile against the real contract |
| S1 | Game rooms: RoomManager, 15-event router on the rules engine, timer wheel, reconnect/grace, bots, per-seat snapshots | `apps/server/src/game` + index.ts block | ✅ done — 238/238 green; every payload strides shared schemas; (seed,log) bit-exact replay asserted |
| W4 | Live rooms/create/join/lobby flows + full-stack smoke script | `apps/web` rooms/create/join/lobby + live-smoke.mjs | ✅ done — found the game:start P0; live smoke 8/8 sections, 54 checks after orchestrator's seed/port fix |

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
3. **W3 — Leaderboard + profile wiring** to E1's real endpoints — ✅ completed
   2026-11-23 night; orchestrator re-verified: tsc clean, build green (both
   routes static), 23/23, scans clean, territory exact. Flags folded into the
   integration pass: dead mocks lib/mock/{leaderboard,profile}.ts (unread by
   pages; store/economy still imports MOCK_WALLET — shop balance path),
   titles registry reconcile 12→11 (`nine-lives`→`cat-with-nine-lives`,
   `house-wins` deferred), no public per-account profile (board rows static),
   server sends bare {error:CODE} bodies (client messages generic — acceptable
   v1)
4. **Integration pass** (orchestrator): ✅ hook wired —
   `onMatchEnd: economy.grantMatchRewards` in index.ts (bot seats fail the
   ObjectId check → skipped-unknown-user; game.close() dissolves rooms on
   SIGTERM before io.close); ✅ shared schema patch landed (seat-view isBot
   optional, game:over winnerSeat nullable + web "Nobody survived" variant,
   summary rounds min 0 — webs store/overlay fixed, dist rebuilt, 59/59);
   ✅ GET /api/rooms mounted (public_rooms mirror, page envelope, 3 tests →
   241/241; boot smoke: rooms route live, game layer registered, graceful
   SIGTERM); ✅ rules-engine dep added by S1. **Remaining**: rooms/lobby/
   create/join live wiring (W4 running), oauth env fold, dead-mock cleanup
   + titles registry reconcile 12→11, catalog id pin, real-socket smoke
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
- **Rotate the image server's ADMIN (master) key** — A6 audit 2026-11-23:
  the service's master key equals a public string (the owner's GitHub handle,
  visible in this repo) → the service incl. our art bucket is compromise-able
  to anyone who connects the dots. Rotate at the service dashboard
  (private docs/image-server.md §1) — our app only uses the PROJECT key, so
  nothing breaks.
- **Deploy-wave checklist (A6 audit)**: trust-proxy depth must match the real
  hop count (Cloudflare→Caddy = 2; wrong depth collapses rate limits into one
  sitewide bucket); consider a dedicated ADMIN_SECRET separate from
  AUTH_SECRET; add a per-IP socket connection cap (STR/08 §8) or accept CDN
  absorption; confirm CSP is enforced at the edge (Caddy).
- **Post-fleet fix list (A6 + A1 audits)**: scrub the `td_setup_` key-prefix hint
  from STR (A6); admin-query safeParse → VALIDATION not INTERNAL (A6);
  **PRUNE the dead HandshakeSchema** from shared events.ts — A1 confirmed
  server auth is cookie-only and STR/07 §0 now documents no-reconnectToken
  (A1/A6 agree: prune, don't wire); **emote id mismatch** — web
  lib/mock/emotes.ts ids ≠ server EMOTE_CATALOG (rooms.ts:62–73) → live
  emotes VALIDATION-reject (A1 ③, real user-facing bug; coordinate EmoteWheel
  which U6 audits); **catalog tier union mismatch** — web api.ts
  `common|fine|rare|cursed` vs server `common|rare|epic` (A1 ④); theme
  `house` vs `house-table` (A7 owns that normalize mid-flight). ① (undeclared
  cors phantom-dep) fixed immediately.

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
- E1 — ✅ completed 2026-11-23 night; orchestrator re-verified: 187/187 green,
  tsc clean with S1's in-flight layer present, fences held (app.ts = 3 lines,
  wallet union = 1 reason), PII projection + idempotence + cap tests green.
  Curve K=733·1.0721^(L-1) → 10,000,496 XP to L100 ≈ the 10-lakh grind.
  Deviations accepted: match_replay_seeds economy-owned; pre-summed coin rows
  (reason match_reward); "House Always Wins" title deferred (MatchRecord lacks
  executor→victim — R1 follow-up); rules-engine type-only imports (dep added
  later by S1)
- S1 — ✅ completed 2026-11-23 late night; orchestrator re-verified: 238/238
  green (51 new game tests: lifecycle audits at 2/4/6+bot/7 players, cross-hand
  privacy scans, bulletPos deep-key scan, exactly-once timers, reconnect/
  abandon, abort win-by-default, bit-exact replay), tsc clean, index.ts
  registration = 2 imports + 1 call, rules-engine workspace dep, scans clean.
  Shared-schema gaps flagged for orchestrator patch (isBot on seat views,
  game:over winnerSeat:nullable, summary rounds min 0) — F1 package is
  orchestrator territory; done at integration. Big-Table entitlement pinned
  `capacity:big-table`; lock/kick/bot programmatic (no wire events by design);
  room code = seat authority (no reconnectToken, STR/07 §5)
- A1 — ✅ completed 2026-11-23 morning; STR conformance audit 00–09 vs shipped
  code. Docs corrected where code is truth: STR/07 §0 full REST surface
  (health/logout/packs/images/audit routes, /api/me/profile twin,
  /api/shop/purchase, /api/me/entitlements; reconnect = room code + user-bound
  seats, no reconnectToken), §1–2 acks + seq + reason enums + ERR_* codes,
  §6 EVENT_STALE note; STR/09 match_replay_seeds + xp_events-as-anchor +
  match_reward ledger enum + derived-read shapes; STR/06 shipped versions +
  registerGame boot flow + dev proxy + CI reality; STR/04 K=733 curve,
  match_reward pre-summed rows + 3/hour cap, 11-title registry (House Always
  Wins deferred); STR/02 gate list + /auth/callback flow; STR/03 screen map +
  reconnect; STR/08 seed/RNG mechanism + 31^5; STR/05 emote wire slugs.
  Code-flags for owners (NOT doc fixes): cors undeclared in
  apps/server/package.json (phantom via socket.io); shared HandshakeSchema
  (guestToken required) unused by server — auth is cookie-only; web mock
  emote ids (lib/mock/emotes.ts) ≠ server EMOTE_CATALOG (only `laugh`
  overlaps → live emotes would VALIDATION-reject); web tier union
  common|fine|rare|cursed (lib/api.ts) vs server common|rare|epic; web
  ThemeId `house` vs server `house-table` (queued). Observed mid-audit: A5
  concurrently reconciled titles mock 12→11 + deleted dead mock
  leaderboard/profile (its own queue); STR/04/05 updated to match.
  Markdown-only — no code files touched by A1.

## Wave 1 COMPLETE — all 11 agent waves landed, verified, committed, pushed.

**Integration pass done — the game is END-TO-END PLAYABLE over real transport.**
`live-smoke.mjs`: 8/8 sections, 54 checks — scripted match over real sockets →
strict-zod + seq + chamber tripwires on every frame → hands/spectator privacy →
mid-match reconnect (`reconnected:true` catch-up) → /api/rooms mid-match →
game:over → grantMatchRewards → Mongo → leaderboard shows the XP.

- ⚠️ **P0 incident (found by live smoke only — unit tests inject the port,
  so the crash was invisible to every suite)**: the match-seed mint asked
  node:crypto for a 2^53 range (hard cap 2^48) → uncaught ERR_OUT_OF_RANGE
  killed the process mid-ack at game:start. First fix (call site 2^48-1)
  revealed an inclusive→exclusive bridge off-by-one in the crypto-port shim
  (+1 → 2^48, one over). Final fix: call site 2^48-2 + shim Math.min clamp
  (protects every future caller). W4 diagnosed the bridge from read-only
  discipline; orchestrator landed the fix + re-ran the smoke to 8/8.
- Deferred to the hardening/deploy wave: router-wide async catch (engine
  bugs currently crash the process rather than emitting error events —
  rejected as late-night surgery on S1's dispatch paths; the seed class is
  fully neutralized at the port, engine is 132-test deterministic).

## Remaining polish (small, next session)

- lib/oauth.ts: fold 4 OAuth process.env reads into the shared config
- Dead mocks: lib/mock/{leaderboard,profile}.ts unread (store/economy still
  imports MOCK_WALLET for the shop balance path) — delete or wire consciously
- Titles registry reconcile: web mock/titles.ts has 12 (nine-lives,
  house-wins) vs E1's 11 (cat-with-nine-lives; House Always Wins deferred)
- Catalog id pin: `category:slug` everywhere (W1-era dash-format fixtures)
- Theme slug normalize at the store level (house vs house-table adapter seam)

## Mega-wave 2 (2026-11-23 morning) — 22 agents dispatched on owner's order

**Fleet A — engineering recheck (10)**: A1 STR-vs-code doc audit (owns STR
edits) · A2 race conditions in src/game (rooms/timers/match/bots — router.ts
excluded) · A3 flow tests + smoke scenarios (window/bots/abandon) · A4 router
crash hardening (owns router.ts — the deliberate P0 follow-up) · A5 cleanups
(oauth env fold, .env.example parity, dead mocks, titles reconcile, shop
balance rewire, catalog id pin) · A6 security/privacy re-audit (read-only) ·
A7 web store/flow audit + theme-slug normalize (owns store/socket/wire/
GameBridge) · A8 economy edge audit · A9 rules conformance (test-only, engine
frozen) · A10 repo hygiene (README/CONTRIBUTING/CI + command verification).

**Fleet B — UI/UX (12, browser-verified at 375/768/1024/1440 per owner's
explicit order)**: U1 landing/how-to-play · U2 login+auth · U3 rooms/create/join
· U4 lobby · U5 table layout/seats/banner · U6 hand/CHECK/emotes/pile ·
U7 cinematics+motion-lab (timing budgets verified in-browser) · U8 ghost/
spectate · U9 shop+billing · U10 admindashboard (all 5 tabs) · U11 profile+
leaderboard · U12 cross-cutting design-system/a11y/PWA token audit (owns only
globals.css/tailwind token fixes; everything else = P0-P2 report table).

Shared dev servers running: web :3000 (mock default), API :3001. Fleet B
saves screenshots to /tmp/ui-audit/<U-id>/ for orchestrator vision review.
File territories are strictly partitioned across all 22 agents; every agent
has git-lockdown (orchestrator commits each verified landing).
