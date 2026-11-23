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
  owner setup key OR create the project on the provider dashboard (private
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
- **Post-fleet fix list (A6 + A1 audits)** — ALL RESOLVED (fix waves FW-1/FW-2 +
  orchestrator): td_setup key-prefix scrub → generic "owner setup key"
  phrasing ✓ · admin-query safeParse → 400 VALIDATION ✓ · dead
  HandshakeSchema pruned (cookie-only auth per STR/07 §0) ✓ · emote id
  mismatch → shared EMOTE_IDS enum, both trees derive ✓ · catalog tier
  union aligned (common|rare|epic) ✓ · cors phantom-dep declared ✓ ·
  theme house/house-table normalized at the wire boundary (A7) ✓
- **More queued (fleet A)**: A8 billing read-only flags — checkout crash
  between ledger append and grantedAt never converges (dup path could set);
  pack coins read at verify vs price frozen at checkout (admin edits in the
  ≤30-min window drift coins — freeze coins in the checkout record at
  creation?); paidAt may store Invalid Date from proxy garbage. A9 note:
  STR/01 §8 "empty hand can't be challenged" = "no NEW risk attaches" (the
  emptied finisher's last play stays challengeable) — add to README
  interpretations. A10: root `lint` script is a silent no-op — wire eslint
  or drop the script; `format:check` fails on 27 files — run `format:write`
  once the UI fleet lands. U4 flags: demo-room snapshot omits isBot (mock
  lobby shows zero bot badges — 1 line); Toaster toasts are focusable →
  tabIndex={-1}. Smoke §8 robustness fix lands with A3.

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

### Fleet A landings (2026-11-23 morning, all orchestrator-verified + committed)

- **A6** ✅ read-only security re-audit: zero P0/P1; P2s (image-server master
  key rotation; deploy trust-proxy depth) promoted to owner items above.
- **A1** ✅ STR 00–09 reconciled to shipped code; code-drift flags queued
  (cors phantom-dep — fixed immediately; emote-id mismatch; tier union;
  dead HandshakeSchema).
- **A4** ✅ router crash hardening: all 8 handlers + disconnect + connection
  listener inside runGuarded/failSafe (double-wrapped; stacks never cross the
  wire); 19 crash tests + 57 consumer tests green; happy paths byte-identical.
- **A5** ✅ OAuth env fold (shared OAuthConfig, both-keys-or-absent → 503),
  dead mocks deleted after the store/economy rewire to real profile coins,
  titles registry 12→11 reconciled; .env.example verified complete; 62/62
  shared + 296 server + 56 web.
- **A7** ✅ seq-rewind rejoin-storm fix, single-flight recovery controller,
  transport-drop → re-join, pendingThrow freeze fix, post-game-over input
  rejection, emote cooldown on accept only; theme slugs normalized at the
  wire boundary; +33 store/socket/bridge tests.
- **A2** ✅ six real races fixed — double game:start (HIGH), seat-change
  mid-start crash (HIGH), kickoff grace clock loss, vacated-room GC leak,
  seam sync-throw, host-cascade deadlock self-heal; 6 deterministic
  regression tests; runtime changed → smoke re-run pending A3's file.
- **A8** ✅ one real grant defect fixed (banned-mid-tx anchor leak — tx now
  aborts, unban + re-grant recovers); +19 edge tests + parallel-grant
  harness. Billing flags queued (ledger-convergence; pack-coins-at-verify
  drift window; paidAt Invalid Date). P0 flag (match.ts promise discard)
  already covered by A2's handleMatchEnd guard — verified.
- **A9** ✅ engine conformance: 23 new tests, engine matches STR/01 on every
  audited axis (zero P0–P2). Soak timeout raised 60s → 120s (orchestrator).
- **A10** ✅ cold-start docs double-broken and fixed (packages build step,
  mandatory keys, Mongo prerequisite); CI as-pushed failed → build step
  added; icons script name fixed; lint is a silent no-op (queued);
  format:check fails on 27 files (deferred until the UI fleet lands to
  avoid mid-edit churn).
- **A3** ✅ flow-test expansion: 6 new flow suites (11 tests) — window mode
  (inclusive bounds, first-wins, arm-delay), forced-call empty-hand, bot-fill
  (every bot id proven grant-immune), spectator-only walls, abandonment
  (0-round records + zero-winner on the wire), session-expiry blast radius
  zero. SMOKE_SCENARIO runner + the §8 check FIXED by its owner:
  clientId-pinned scan (the old nickname scan false-negatived once runs
  accumulated — the real flake), 80s budget spanning the 60s leaderboard
  cache, error seq carve-out, 25s connect budget. All four scenarios PASS
  incl. the full 8/8 54-check regression — re-verified by the orchestrator
  against the shared server. Suite 296/296, tsc clean. **FLEET A IS NOW
  FULLY LANDED.**

### Smoke §8 flake — ROOT-CAUSED (by A3) + FIXED + VALIDATED

The check's nickname scan false-negatived once runs accumulated duplicate
accounts, and its 20s retry budget sat inside the 60s leaderboard cache —
worse under the audit-fleet's concurrent API reads. A3's fix: clientId-
pinned matching + 80s budget (spans the cache) + error-seq carve-out;
all four scenarios (full/window/bots/abandon) now PASS, and the full 8/8
54-check run was re-verified by the orchestrator against the shared
server. The chain itself was never broken — verified twice independently.

### Fleet B landings (browser-verified at 375/768/1024/1440)

- **U4** ✅ lobby: Lighthouse a11y mobile 100/100, 0 console errors at all
  widths incl. kick→start flip; 4 fixes (9:00 chip off-viewport at 1024,
  h1 + main landmarks, aria labels on empty-seat taps). COMMIT HELD until
  U5 lands (SeatChip/DesktopTableLayout are shared-territory edits).
  Flags queued: demo-room isBot mock gap; Toaster tabIndex.
- **U2** ✅ login + auth callback: Lighthouse a11y 100/100 m+d, 0 console
  errors across 46 loads incl. 4 widths × all states; 8 fixes —
  institutional OAuth buttons (official SVG marks, 56px), full server
  reason-map (was dead code mapping 2 of 6 real ids), h1 landmarks, 48px
  targets, shimmer skeletons, dev-speak → human copy; ?next sanitized,
  keyboard-only journeys verified. Verdict: SHIP.

- **U10** ✅ admindashboard: a11y 100 both modes (pre-directive measurement),
  all 5 tabs + login at 4 widths, toasts/optimistic+rollback, empty-search,
  pagers 2/3, currency sanity, 10MB/bad-type upload refusals, blob-preview
  PATCH, pack SAVE flows — all pass; 0 console errors on its route. Fixes:
  placeholder contrast 1.05→4.9:1, axe focusable-region ×2 labeled,
  card-in-card flattened in Catalog/Packs. **P0 OUTSIDE TERRITORY — fixed
  by orchestrator**: ui/Sheet.tsx desktop dialogs froze mid-entrance
  (translateY 550–614px, 100% repro ≥1024px; drawer/coin/ban/add-item all
  half off-screen) — useViewportMode resolves null→mobile→desktop and the
  desktop animate target dropped the y key mid-spring; every motion branch
  now carries all keys. P1s queued for the fix wave: Sheet focus trap +
  restore-on-close, reduced-motion spring, drag-to-dismiss affordance
  (or remove the grab-bar); favicon.ico 404 (icon.svg already exists).
- **U9** ✅ shop + billing return: a11y 100 + BP 100 both modes
  (pre-directive), all 7 billing outcomes honest + retry deep-links, ≥2
  cards/row at 375, zero dark-pattern language. Fixes: useCountUp wired into
  the granted card (was dead code — no count-up at all) with settled-figure
  aria-label, modal split "payments aren't live" vs "checkout desk snag" +
  null-crash guard, pack names + coins units on cards, 48px profile-rack
  CTA (was 11px), sr-only h2 on the grid. Flags: Sheet focus trap P1
  (matches U10), robots.txt, AuthGate skeleton CLS (re-measure on prod),
  usePrefersReducedMotion first-frame false → system-wide one-frame "+0"
  flash (needs useSyncExternalStore — fix wave). Incident: broad pkill hit
  U8's running browser — U8 run integrity to re-check on its landing,
  tightened to exact-PID kills after.
- **U8** ✅ ghost lounge: sepia ghost frame verified atmospheric, hand
  tap-guarded + CHECK unmounts, emote-only live, exit door clean, dead seats
  gray-out + 🕯 through all rounds, a11y 95 on the route, axe clean in its
  components. Fixes: minimized ghost chip → real 48px button with aria-label,
  spectator-aware copy. Flags: store heroSeat ?? hostSeat non-nullable →
  spectator inherits the HOST seat (you-state leak — fix wave, store owner);
  demo-room hardcodes spectator:false (unreachable in dev); MotionLab ghost
  invariant broken; ghost keeps a disabled THROW stub + keyboard "X" opens
  the call sheet (emote-only violated); SeatChip aria on roleless span;
  HandFan ghost cards lack disabled; table route has no landmarks/h1;
  GameOverOverlay blocks the leave CTA at match end (+ "YOU WINS" typo).
- **U3** ✅ rooms/create/join: Lighthouse /rooms a11y 100 · BP 100 · SEO 100
  (perf 99 desktop), poll = true stale-while-revalidate (27s observation,
  zero flash on 10s ticks). Fixes: useRoomsPoll StrictMode deadlock (100%
  repro — every /rooms visit sat 10s on skeleton: effect cleanup discarded
  the first fetch + the in-flight guard blocked the remount's; now
  ref-gated), join caret focus state + autoCapitalize, rooms empty-search
  split with CLEAR FILTERS, create blur-gated nickname errors + a full
  roving-tabindex radiogroup (skips locked 8–10), 48px shuffle, contrast
  upgrades (placeholders 2.40→4.94:1, locked tiles 3.08→4.86:1). Flags:
  (P1, applied by orchestrator) MobileTabBar fully occluded /join's
  PARSE & JOIN at 375 — taps hit the SHOP tab (main now pb-16 lg:pb-0);
  (P1 queue) mock getRooms bypasses mockFetch — ?mock= doors dead on
  /rooms; (P1 queue) parseCodeFromPasted("https://…/r/ABC7E") returns
  "HTTPS" — protocol chars survive the charset filter; (P2 queue) mock
  room codes RM100-107 contain 0/1 outside the advertised charset;
  SiteHeader Sign-out 1px under target. Emoji house-style left consistent.
- **U6** ✅ hand + controls: five code-verified fixes — HandFan reject-shake
  was a framer key-remount that re-dealt the whole fan on every rejected
  4th tap (future-deal killer) → WAAPI shake on a plain wrapper, reduced-
  motion guarded; CallGuardSheet live integer seconds + real plurals;
  A/D card walk wraps instead of dead-ending; PlayedPile dead ternary +
  shared pluralClaim; EmoteWheel cooldown pill floats above the grid
  (was covering the mobile bottom row). Genotyped THROW ≥64px + claim text,
  CHECK visible-but-dead per STR/03 §2, no face glyphs in the pile (DOM +
  code path — hidden-data law holds). Flags: emote catalog split 9/10 dead
  on live (third confirmation — shared enum, both trees derive);
  ShotCinematic hooks-order console spam (U7's in-flight fix landed mid-
  audit); useCountdown urgent<10 → ring red for life (≤3 per spec);
  MotionLab ghost invariant; TimerArc hardcoded total=10; lab bar pushes
  THROW at 812px; wheel auto-close-on-send; 42px fan strip at <500px
  (fan-overlap vs target tension — owner verdict).
- **U7** ✅ cinematics: **P0 FIXED IN PRODUCTION** — ShotCinematic had
  Rules-of-Hooks violations (3 useMemo after an early return) that crashed
  EVERY real shot:assign into the error boundary (masked in the lab,
  proven on /table/DUMMY pre-fix). Also: stale beat flashing the prior
  shot's stamp, revolver mounted at t=0 (500ms dead gap vs enter@500),
  air vignette popped at hold, black slab fade → 60ms snap, muzzle flash
  350ms → 80ms law + reduced skip; crown backOut → gravity fall +
  recoil-settle; reduced-motion gates for RoundEndBanner/RevealStage/
  victory/ghost; TimerArc role=timer + fallback label; MotionLab
  server-paced 3s shot:result + NOBODY-SURVIVED trigger. Every beat
  measured vs law at 375: reveal 401/400 · build 539/500 · spin 1290/1200
  · cock 2497/2400 · air 2623/2550 · hold 2940/2900 · lurch 3744/3600 ·
  EXECUTE reticle 736/700 — all ≤+8% (±20% budget). Drama verified on
  faithful compositor frames: air holds through the 600ms silence,
  slam-to-black → 9° grayscale keel-over (slump not splat — PG-13 held),
  stamps slam, NOBODY SURVIVED reads dire, reduced path meaningful.
  Median frame 16.7ms, ≤1 frame >50ms per 6.3s beat. aria-live assertive
  on verdict/shot/round-end/game-over. Flags: PlayedPile pluralClaim
  mid-flight scare = stale (import verified at :9, gates green);
  LeaderboardView mid-edit 500s (settled); TimerArc call sites should
  pass contextual labels; lab bar pointer-occluded during overlays
  (dev tool, fine). Lighthouse /motion-lab: perf 95 · a11y 100.
- **U5** ✅ table layout (the last agent of the 22-agent mega-wave):
  independently REPRODUCED U7's shot:assign hooks P0 at 8/8 viewports, then
  RE-VERIFIED the fix through full 7-round matches at 1440 + 375 with zero
  console errors. Fixes: top-arc chips rode 25–38px above the stage into
  the context ribbon → `top: max(y%, 88px)` floor (clock contract re-
  verified exact: next 3:00 / prev 9:00 / hero 6:00, arc symmetric ≥1024);
  mobile hero-starter ★ was missing entirely → "★ YOU THROW FIRST" pill;
  SeatChip aria (label-in-name "5c, 0/6", pips role=img). Re-verified U4's
  radius-44→38 aside fix (independent math predicted the same 24px
  collision). Mobile rail+wings verified 375–900 (no h-scroll), dead-seat
  gray-out, chamber tints, 64px THROW/CHECK with live claim text, brass
  focus rings, reduced-motion honored. Lighthouse mobile (dev): a11y 100 ·
  BP 100 · SEO 100. Flags: landscape 667×375 collapses (research/09 §7
  redesign = owner-question debt); pile `totalPile` never rendered (store
  drops it — fix wave); spectator heroSeat falls back to host (fix wave);
  MotionLab ghost fixture; HandFan aria/desktop overlap — all queued.
  **U4's held commit releases with this entry — both waves touched the
  same three files coherently (U5 re-verified U4's edits live).**
- **U12** ✅ design-system cross-audit: "coherent and genuinely good — one
  design language, not AI slop; structure/states/a11y skeleton/tokens
  production-grade", ZERO P0s. In-scope token fixes landed (globals.css):
  blood-bright #d9574a→#e56a59 (3.9→4.7:1 on felt), theme-pack wood-chain
  completion (house/royale/kabuki inherited-mode collapse), reduced-motion
  hardened (delay neutralization both paths). Master queue (its 19-row
  table) — top P1s: disabled:opacity-40 renders funnel CTAs at 1.3:1 on
  first paint (JOIN/DEAL/THROW — one-line Button fix), table a11y 95 via
  chamber-pip role + card/seat accessible-name embedding, 118× sub-12px
  text escapes (tab bar 9px), emoji-vs-SVG icon verdict (owner), Sheet focus
  trap (pending ui-owner fix wave), game-route landmarks, dev-speak in the
  payments sheet, ProfileView nested Link><Button ×3, PWA service worker +
  install affordance absent, palette literals in shot/revolver art, robots/
  sitemap, first-fold tab-bar overlap, navigator.vibrate before gesture.
  Its font audit (Smokum/Elite) predates the owner's classic-font swap.
- **U1** ✅ landing + how-to-play: prod-build Lighthouse mobile 89 / desktop
  98 (a11y 100 both; per the code-only policy this pre-directive measurement
  stands as the perf baseline). Fixes: hero CTA nested a/button killed →
  single Link (axe nested-interactive gone), 16→48px tertiary links, room
  skeletons matched to content height (CLS), nonexistent `.panel` class →
  `<Panel>`, hero fade → y-rise (SSR paints content; LCP no longer JS-gated),
  how-to loop responsive grid (3×2 ≥md), revived law arrows, next/link CTA,
  scope=col semantics. Flags: SiteHeader auth cluster 48→52px CLS (fixed-
  height slot), + the shared SiteFooter/MobileTabBar items, inline
  text-shadow → token (globals owner), 340ms framer unused-JS on landing
  (architecture pass).
- **U11** ✅ profile + leaderboard: XP bar math measured exactly coherent,
  ?metric/?page survive reloads preserving ?apimode/?mock, 0 console errors,
  keyboard trace logical, Lighthouse a11y 100 (perf 72m/89d = dev-mode
  artifacts). Fixes landed: medal/YOU ring-2 treatment (Panel base utilities
  silently overrode border classes — cascade-order lesson), banned h2→h1,
  sr-only h1 on USER_NOT_FOUND. Flags: useCountUp unclamped t (negative
  counts 1-2 frames; drives GameOverOverlay too), profile-fixtures titles
  rows value 0 vs "25 players", SiteFooter 16px targets, Panel override
  architecture, Tabs arrow-keys, Recent-empty state, mock YOU|YOU.

### Policy-switch stragglers: U11 finished browser-measured pre-directive
(evidence archive stands); remaining UI agents close as code-level audits.

### Owner questions from the UI fleet (taste calls — your pick)

1. U2: allow official brand colors inside the 32px OAuth badge chips, or
   keep monochrome tokens?
2. U2: site-wide emoji art-direction vs U2's SVG provider marks — which
   accent language wins?
3. U2: banned/denied callback states hide the retry CTA (honest dead-end) —
   keep?

### POLICY SWITCH (owner, mid-fleet): no MCP / no Chrome — code-only

The browser mandate for the UI fleet is REVOKED. All remaining UI agents
finish as code-level audits (source review + geometry/a11y/target sizes
from markup + tokens) with code gates only (tsc / tests / build). The
orchestrator's verification from here is code-only too; live-smoke.mjs
stays (pure Node REST/sockets, no browser). U2 + U4 had already completed
with browser evidence before the switch — their findings stand. Straggler
automation processes killed at OS level (headless/remote-debugging patterns
only — the owner's personal Chrome untouched); every agent reporting from
here receives the directive before any further work.

### Owner directives (second round, 2026-11-23)

- **Classic fonts everywhere** (owner): the themed display/body faces
  (Smokum western + Special Elite typewriter, both Google-font downloads)
  are GONE — display is now the classic Georgia serif stack, body is the
  clean system sans stack. Zero font downloads → the font-swap-bound LCP
  (U1 measured 3.2s mobile) is dead by construction. STR/05 §2 updated.

## Owner directives (third round — the noir + avatars build, 2026-11-23)

1. **Icons, not emojis** (emote-wheel CONTENT stays; all UI chrome → lucide)
   — T1 running.
2. **Re-theme: black / white / gray main + RED primary accent**, free
   secondary (gold kept for coins/warmth only) — T2 running. Token NAMES
   stay (compile-compat aliasing), VALUES remap; [data-theme] packs re-
   authored as noir variants.
3. **Real avatar engine** ("same to same" equip): layered SVG paper-doll —
   bases human-{male|female}-{thin|gym} + dog/cat/horse upright species;
   every catalog item renders faithfully ON the avatar; tap-to-equip
   previews. New endpoints: PUT /api/me/profile (nickname) + POST
   /api/me/equip (ownership-checked) — T3 running. emojiForSpec dies.
4. **Settings → proper dashboard** (sidebar, sections: avatar editor with
   live try-on, inventory grid with tap-to-equip, appearance, sound/
   haptics, account) — **T4, wave 2** against T3's contract.
5. **Admin dashboard → sidebar shell** (Users/Payments/Catalog/Packs/Audit
   as sidebar nav, mosaic reflow, no tabs) — **T5, wave 2**.
6. Standing rules unchanged: git-lockdown per agent, no browsers/MCP
   anywhere, code gates per landing, orchestrator verifies + commits each
   wave pathspec'd.

### Noir + avatars wave 1 — T2 landed

- **T1** ✅ icon system (owner directive: no emoji as UI icons): lucide-react
  ^1.77 (the one justified dep — tree-shaken) + components/ui/icons.tsx
  makeIcon factory (currentColor, strokeWidth 2, aria-hidden unless a
  label is passed, 20px game / 18px chrome). 18 territory files migrated
  (layout trio + tab bar, landing + how-to loops + rules-content slugs,
  game-over crown/skull/coins/candles/medal, ghost lounge, table banner/
  panel, lobby 12 glyphs, shop, profile 21 glyphs, leaderboard medals,
  motion-lab, CoinBadge, InviteChip, AsyncSection+Tabs — Tabs' icon prop
  widened to ReactNode). CONTENT preserved (not chrome): emote-wheel
  presets, catalog/animal art (avatar wave's domain), card-face text
  glyphs, prose arrows. Next-wave icon inventory handed to T4/T5
  (admin/settings/game-chrome lists + store game.ts:506 toast seam).
  LandingView committed here carrying T2's held color edits. Gates:
  tsc clean · 63/63 · build 22 routes. emojiForSpec down to 2 consumers
  (GameOverOverlay, ShotCinematic) — avatar wave's to replace.
- **T2** ✅ noir re-theme: token VALUES remapped under their historical
  names (compile-compat alias map in globals.css) — black/white/gray
  surfaces (#0a0a0a–#1c1c1c, ivory/ink → #f5f5f5/#a3a3a3), brass* =
  PRIMARY RED family #d92d20 (hover #e5484d, deep #a71d14) harmonized
  with blood, lamp = toned gold SECONDARY (coins only), spotlight amber →
  red hot-seat glow, all 8 [data-theme] packs re-authored noir variants,
  palette literals migrated to color-mix tokens (muzzle flash, oval +
  revolver shadows, text-shadow). Contrast: body ≥15:1; red-as-small-text
  failed (3.9-4.1:1) → new --color-red-text #f2554a (5.4+) + the 2 owned
  usages swapped. Gates: tsc · 63/63 · build (22 routes). Disposition of
  its flags: brass small-text sweep (~25 non-owned files) + themes.ts
  swatch sync + LandingView color edits → post-wave-1 integration pass
  (LandingView held out of this commit — the icon agent owns it live);
  icon.svg/PNG palette = owner verdict (noir logo pass).

## Fix wave (post-mega-wave, 2 agents, disjoint territories)

- **FW-2** ✅ interaction layer — 11/11: Sheet focus management complete
  (focus dialog on open, doc-level Tab-cycle trap with wraparound,
  open-stack for nested sheets, focus restore on close, dismissible-Esc,
  motion props untouched post-P0); Button disabled 70% +
  pointer-events-none (kills hover-paint drift across variants);
  useCountUp t clamped [0,1] (no more −74 coins first frames); countdown
  urgent ≤3 (10s windows back to amber→red spec); usePrefersReducedMotion
  → useSyncExternalStore + SSR snapshot (no +0 flash, data-reduced-motion
  contract intact); parseCodeFromPasted prefers /r/ segment then last ≥5
  charset run (+7 unit tests); footer links 48px, tab-bar labels text-xs,
  header auth slot fixed h-13 (52px, zero CLS) + 48×48 controls; ghost
  THROW stub + E/X keys guarded, "YOU WIN"/"{name} WINS" copy, LEAVE THE
  TABLE added to game-over (room:leave → reset → /rooms); MotionLab ghost
  fires for real + lab bar scrollable (THROW fits 812px); totalPile
  plumbed through the store (lobby:state/play:accept/round:new reset) +
  rendered as an "on the table: N" chip; HandFan/GameCard accessible
  names carry the rank; ProfileView Link><Button nested ×3 un-nested.
  heroSeat spectator nullability deliberately untouched (parked as its
  own follow-up). Web suite 63/63, tsc clean, build green (22 routes).
- **FW-1** 🏃 data layer — in flight (emote enum, HandshakeSchema prune,
  tier union, admin safeParse, mock charset/doors/fixtures, robots +
  sitemap + metadata + favicon).
