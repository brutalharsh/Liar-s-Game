# 14 — BUILD PLAN: phases, 20+ agent roster, 129-task board (2026-11-23)

> Implements `13-locked-design-spec.md` on the architecture from docs 11/06/09/12.
> Monorepo at the project root; repo slug `liars-game`.

---

## 1. Roster (22 agent missions across 5 waves)

| Wave | # | Agent mission | Territory | Upstream |
|---|---|---|---|---|
| 1 | F1 | Foundations & shared contract | root toolchain, `packages/shared` | docs 06, 11 |
| 1 | R1 | Rules engine + full test suite | `packages/rules-engine` | docs 02, 04, 13 §2 |
| 1 | W1 | Web app shell + lobby screens | `apps/web` | docs 09, 13 |
| 2 | S1 | Game server: Express+Socket.IO, RoomManager, event router, timers | `apps/server` | F1, R1 |
| 2 | W2 | Game table UI + interaction + cinematics hooks | `apps/web/table` | W1, R1 |
| 2 | M1 | Motion & reveal/roulette cinematic library | `apps/web/motion` | doc 09 §4 |
| 3 | A1 | Art pipeline pass 1: saloon, cards, avatars, gun (I generate AI art in-session → files) | `apps/web/public/art` | doc 10 |
| 3 | E1 | Accounts (guest→claim), coins wallet, XP/levels, catalog services | `apps/server` + shared | S1 |
| 3 | W3 | Shop, inventory, equip UI, avatar compositor | `apps/web/shop` | E1, A1 |
| 3 | C1 | TTS engine, voice themes, barks, SFX wiring, settings | `apps/web/audio` | doc 13 §8 |
| 3 | P1 | Public rooms + presence + moderation basics | `apps/server` + web | S1 |
| 4 | V1 | Payments: Razorpay orders, checkout, webhooks, entitlements | `apps/server` + web | E1 |
| 4 | T1 | Theme system runtime + 5 premium theme packs | `apps/web` + A1 assets | A1 |
| 4 | Q1 | Security pass: packet-recorder CI, rate limits, fuzz, audit | everywhere | doc 12 |
| 4 | Q2 | QA: Playwright E2E, mobile viewports, perf budget | everywhere | doc 11 §6 |
| 5 | D1 | Ubuntu VPS deploy: Caddy, PM2/systemd, Atlas M0, backups, tunnel doc | infra | doc 07 |
| 5 | X1 | Polish: onboarding "how to play", empty/error/loading states | `apps/web` | Q1/Q2 |
| 5 | G2 | Balance tuning pass from doc 04 §7 parameter table + playtest script | rules-engine | all |
| 5 | Z1 | Launch checklist, name clearance review, credits/legal pages | docs | doc 05 |
| 5 | Y1 | Big Table 8–10p mode + deck scaling m=3 verify | rules+server | A3 |
| 5 | O1 | Post-launch backlog: recorded voice packs, Devil variant, quick-draw toggle | docs | doc 03 |

Wave 1 agents are parallel (disjoint dirs). Wave 2 starts when F1/R1 land; wave 3 when
S1/A1 land; etc. That is 22 distinct missions — 20+ as ordered, most running 2–3
parallel at a time to avoid file collisions.

## 2. Task board (129 tasks, each with owner + acceptance)

### T-FOUNDATIONS (F1) — 9
1. Root `package.json` workspaces verify (node≥20, npm workspaces) — `npm run check` green
2. `tsconfig.base.json` strict, path aliases per package — no
3. ESLint flat config + Prettier + scripts — `npm run lint` green
4. Vitest workspace config — sample test passes
5. `packages/shared`: zod event schemas for ALL events (doc 06 §5 protocol): room:join/leave, lobby:state, game:start, round:new, hand:deal(view-filtered), turn:begin, play:cards, liar:call, window:open/close, reveal:show, shot:assign(self|execute), shot:result, round:end, game:over, emote:send, presence:ping, error — schemas type-inferred + exported
6. `packages/shared`: domain types (Card, Rank, TableCard, RoomState, PlayerState, ShotKind, CoinGrant, XpEvent) — rules-engine imports these
7. `packages/shared`: nickname/room-name sanitizer (18 chars, control/emoji-confusable strip, blocklist) — tests
8. Room code util: 5-char confusable-free decode/encode — entropy tests
9. `.env.example` + config loader + version stamp util — documented

### T-RULES-ENGINE (R1) — 20
10. `rules/engine.ts`: state machine (LOBBY→DEAL→TURN→WINDOW→REVEAL→SHOT→ROUND_END→GAME_END) as discriminated unions — no illegal transition reachable
11. Crypto RNG port (interface + Node `crypto.randomInt` impl, injectable test seed)
12. Deck builder: m×(6/6/6+2J) scaling A3 — m=1,2,3 covered
13. Fisher–Yates shuffle via RNG port
14. Deal: 5 cards/each from top; remainder hidden — full-deal vs partial precomputed per N
15. Table card draw uniform {K,Q,A}
16. Turn order: counter-clockwise; skip dead/empty; starter rules (random → caught-liar → next-in-order)
17. `validatePlay`: owner + hand membership + 1–3 + turn — negative tests per clause
18. `validateChallenge`: next-only ≤4p; open-window 5–10p (arm-delay 2s, first-wins, closes on next commit)
19. `resolveChallenge`: reveal; liar iff any non-table non-joker; loser = liar (challenge ok) else accuser
20. **Assign shot kind (A1)**: false accuser→SELF always; caught liar→ coin flip SELF vs EXECUTE_BY_ACCUSER — 50/50 statistical test 100k runs ±1%
21. Revolver Model A: `bulletPos` uniform 1–6 fixed per match; pull()→ spent blank advances `pulls`; death odds `pulls→6` guaranteed; no resets
22. Forced-call trigger: holders==1 → challenger=single holder, accused=last play
23. Empty-hand safe-skip bookkeeping
24. Round transition: reshuffle all, new table card, starter=caught liar/next — regression test trio
25. Timeout policy A4: auto-play pre-staged else 1 random; NEVER auto-call — test
26. Disconnect policy: 60s grace, then auto-play persists — simulated clock test
27. Winner detection: last alive (and abort when <2 remain with win-by-default)
28. `(pulled/6)` public chamber serializer (no bullet position leaks)
29. Deterministic replay: emit event-log append per action (input for hash-chain)
30. Table-driven suite ≥30 cases from docs 02 §11 + 12 §6 + 04 §7 — ALL green incl. joker, 7p scaling, race atomicity

### T-WEB-SHELL (W1) — 16
31. Next.js 16.4 App Router + TS strict + Tailwind 4 scaffold — dev build green
32. Design tokens: dark bar palette, CSS variables per doc 09 §8 theme token list
33. Fonts: Smokum/Rye display + Special Elite body (OFL/Apache, doc 10) — preload
34. PWA `app/manifest.ts` + icons + install prompt handling
35. Landing page: hero, 3-step how-it-works, CTA (create/join) — responsive 390/768/1440
36. How-to-play page: rules summary + animation of the loop (from doc 02 §9)
37. Create-room flow: nickname + avatar pick (starter set) + theme + capacity
38. Join flow: code entry (auto-uppercase, confusable hint), paste-link parse
39. Public rooms browser: list cards, join button, empty/loading states — mocked data
40. Lobby screen: 2–10 seat layout (doc 09 wireframes), host controls, est-match-time chip, invite share, kick
41. Socket client singleton + reconnect/backoff + auth handshake — typed against shared schemas
42. Zustand store mirroring RoomState + patch reducers — deterministic tests
43. Route guards (leave confirmation mid-game), safe-area insets, 48px target audit
44. Responsive shell: portrait/tablet/desktop breakpoints per doc 09 §2 wireframes — screenshots at 3 sizes
45. Error/empty/toast system + skeleton loaders
46. Settings screen: voice theme, sfx volume, captions, reduced-motion, emote mute

### T-WEB-TABLE (W2) — 14
47. Table layout component: rail+wings seat engine for 2–10 seats — resizes cleanly 390px→1440px
48. Hand fan: multi-select ≤3, badges, drag-slide disabled (tap only), throw button with live claim text ("THROW 2 as ACES")
49. Central pile: per-player face-down stacks + count chips + last-play highlight
50. Table-card banner + "your turn" spotlight
51. Chamber counters `(x/6)` per player + risk tinting
52. CHECK button: legality states (open-window mode, 10s ring, arm-delay), confirm guard sheet w/ quoted claim
53. Reveal sequence: staged flips 400ms apart, truth/lie verdict stamp
54. Shot-assign UI: SELF vs EXECUTE transitions (who takes the gun), execute = target lock overlay on loser
55. Roulette cinematics hooks (consumes M1) incl. Zimmermann blank head-fake beat + death slump/fade
56. Round-end banner: why it ended, coins/XP toasts (stubs)
57. Winner screen: crown, confetti, coin flip rewards, rematch button
58. Ghost lounge for the dead: spectate cam + emotes
59. Emote wheel: 10 presets, 3s CD, bubbles + mute
60. Reduced-motion + colorblind modes verified on table screen

### T-MOTION (M1) — 8
61. framer-motion timeline lib: deal/throw/flip/reveal primitives (variant-based, interruptible)
62. Cylinder cinematic: spin 1.2s → cock → 1.2s dead air → result (bang/shake OR dry click + relief)
63. Execute-cinematic: aim overlay, reticle, fear trembling on target, bang
64. Death: slump+fade+gray sunglasses ghost; win: crown+confetti
65. Turn timer ring + urgency pulse states
66. Stagger orchestration manager (central sequencer keyed to server events)
67. Haptics map via navigator.vibrate (throw/reveal/blank/bang) — Android test note
68. Reduced-motion alternates for every timeline above

### T-ART (A1 via in-session AI generation, doc 10 recipes) — 12
69. Art direction freeze: prompt style block + seed consistency sheet
70. Saloon background + felt + props (free)
71. House Table background (free)
72. Card faces K/Q/A/J ×3 suit-tints + back (originals, no Curve resemblance)
73. Gun set: revolver side, cylinder (6 spent-states), muzzle flash, smoke, reticle
74. Avatar bases: male×3 tones, female×3 (neutral idle)
75. Hair set ×6, beards ×4
76. Hats ×5, shirts ×6, glasses ×3
77. Frames ×8 (incl. level prestige frames ×4)
78. Win/death/idle animation poses (sprite strips)
79. Icons pass (timer, lock, coin, settings — CC0 where possible)
80. Optimize: WebP, SVG, budgets per doc 10 §5 — report sizes vs budget

### T-ECONOMY (E1) — 12
81. Guest identity + claim-account service (magic word for v1: passphrase recovery)
82. Coins wallet: append-only ledger, idempotent grant IDs, spend atomicity — concurrency test
83. Earn rules: win randomInt 2–7 + survived-round +1 — caps per hour — tests
84. XP service: thresholds r-curve to 1e7 XP @L100 constant K — 3-point curve test
85. Level-up detection → prestige frame entitlement at 10s
86. Item catalog data model (category, rarity, price, owned, equipped) + seed data ~40 items
87. Equip service: one per category, persisted; server-validated
88. Entitlement stub for themes (no money move in E1, grants only)
89. Profile service: avatar composite spec sent over the wire (no image blobs over socket)
90. Anti-abuse: per-account earn rate limits, replay-verified match rewards
91. Ledger audit endpoint (admin-only)
92. Integration test: full match → coins+XP credited once each

### T-WEB-SHOP (W3) — 8
93. Shop screens: featured item carousel, category tabs, preview modal (on-avatar try-on)
94. Purchase flow: coin confirm → server spend → equip prompt — optimistic UI + rollback
95. Inventory & equip UI (mirror of doc 09 §6 brief)
96. Avatar compositor: layered render (base→hair/beard→shirt→hat→frame) — screenshot parity test
97. Level up celebration overlay + prestige frame unlock toast
98. Wallet HUD (coin count + packs link) everywhere
99. Theme store tab inside lobby: preview, lock badges, Big Table room toggle (premium)
100. First-purchase offer surface (stub UI ready for V1)

### T-AUDIO (C1) — 7
101. Howler SFX engine + CC0 pack wiring (cards/cylinder/bang/click/jingle)
102. TTS engine wrapper: SpeechSynthesis queue, pause/resume, mobile unlock
103. Claim announcer: localized strings {One|Two|Three}{Ace(s)|King(s)|Queen(s)}, "LIAR!", stings — vocab tests
104. Voice themes: presets (Villain/Chipper/Robot/Drunk): voice+pitch+rate maps + graceful voice-missing fallback
105. Random barks: 5% throw + kill/false-accuse triggers from doc 13 §8 — cooldown map
106. Ambience loops per theme + seamless swap on theme change
107. Settings UX wiring: volumes, captions toggle, per-player voice mute

### T-ROOMS (P1) — 6
108. Public room registry service (list ≤30, expiry, visibility flag) + E2E room list test
109. Presence: heartbeat + idle churning, disconnect badge to others
110. Host migration on host DC (order of arrival), lobby lock for empty hosts
111. Replay log hash-chain ingest to Mongo (async, non-blocking loop)
112. Room name + names moderation filter tests
113. Invite deep-link route (/r/XXXXX) with meta embed image

### T-PAYMENTS (V1) — 8
114. Razorpay order endpoint + coin-pack catalog enum (₹49/99/199/399)
115. Standard Razorpay Checkout embed (UPI-first flow) — test-mode run screenshot
116. Webhook: signature verify, eventId idempotent, amount re-check, grant→ledger
117. Entitlement service for themes + Big Table capacity (>7 vs actual caps) — server-enforced
118. Refund flow via compensating ledger entry
119. Sandbox test harness: simulated webhook spam, duplicated orders
120. Claim-account merge: guest progress + wallet migrate into claimed account (no dupes)
121. PCI posture: no card data ever touches us (Razorpay-hosted checkout) — doc statement

### T-SECURITY-QA (Q1+Q2) — 14
122. Packet-recorder CI: two-client mock match; assert zero hidden payloads pre-reveal; diff-guard on schema changes
123. Rate limits: connect, join, events, emotes — per-IP + per-socket
124. Fuzz: malformed zod inputs (500 iterations/event) — no crashes, no leaks
125. Room code brute-force math unit test (5-char ent vs lockout policy)
126. Dependency audit + lockfile pinned + engines check
127. Playwright E2E happy path (2 browsers × 3 viewports): create→join→win→rematch
128. Perf budget check: Lighthouse mobile, load ≤2.5MB, TTI < 3s on mid-tier
129. Load smoke: 50 simulated rooms / 350 sockets latency sanity
130. Join-then-DC chaos test (dropout of every role at every phase) — recovery green
131. Emote/tTS/name spam cooldown review
132. Ghost-chat spectator cannot act — verified from dead sockets
133. Atlas hardening checklist + secrets audit for NEXT_PUBLIC leakage
134. Final sweep:OVE cabin (server) acceptance checklist from doc 12 §9 — all items closed

### T-DEPLOY (D1) — 5
135. Ubuntu VPS bootstrap script: Caddy TLS + Node 20 PM2 + UFW + fail2ban — doc 07 §6
136. `deploy.md`: from zero to live in 30 minutes, incl. rollback + logs
137. Atlas M0 connection + IP allowlist + backup cron
138. cloudflared tunnel doc friend-playtest mode (pre-VPS phase)
139. Production release runbook + monitoring URLs (uptime robot)

### T-LAUNCH (X1, Z1, G2, Y1) — 10
140. Balance tuning vs doc 04 §7 (timers/earn values/curve K) — spreadsheet + playtest notes
141. Big Table 8–10p verification suite (deck m=3, window, est-match-time UI)
142. Onboarding polish: first-time tutorial overlay (3 hints max)
143. How-to-play recheck vs implementation drift
144. Empty/error/lost states pass 2 (every screen)
145. Credits page (CC-BY attribution file from doc 10 §6)
146. Terms/Privacy/templates (docs, no legal advice)
147. Name clearance workpad (Liar's Game: TM databases + manga conflict table)
148. Local EN-IN copy sweep (rupee/currency/lakh strings)
149. Launch announcement pack (screenshots og-image, 90-sec demo script)

*(Numbering continues past 129 into launch polish, giving 149 discrete assignment units across 22 missions.)*

## 3. Phase gate criteria (go/no-go)

- **P0 done =** R1 suite green + F1 contract exported + W1 connects (mocked) — *playable bits exist.*
- **P1 done =** 7 humans finish a full match over the tunnel on real phones, incl. one disconnect recovery, packet-recorder clean.
- **P2 done =** blind "feels like the Steam game" test passes; 60fps mid-tier phone; art & audio in.
- **P3 done =** test-mode UPI ₹49 purchase credits wallet once-and-only-once; theme applies to whole room.
- **P4 done =** live on VPS, Playwright green, name cleared or changed, one real week of friend matches <5% failed rounds.

## 4. Risk register (live)

| Risk | Tier | Mitigation |
|---|---|---|
| Name clearance fails | med | Bench alternates (doc 05); rename = strings/config pass only |
| Scope creep (shop+XP+TTS+payers) | HIGH | Wave gates above; nothing enters a wave without spec §-ref |
| 8–10p balance unknown | med | Y1 task runs G2 tuning first; ship behind feature flag |
| Razorpay KYC drag | med | V1 ships play-ready WITHOUT buys; store opens post-KYC |
| TTS device variance | low | Preset fallbacks + captions always available |
| Solo-dev ops crunch at launch | med | D1 scripts make deploy a one-command repeatable |
