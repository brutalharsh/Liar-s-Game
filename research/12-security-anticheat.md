# 12 — Security & Anti-Cheat: Server-Authoritative Browser Card Game

> Topic: security & anti-cheat for a free-to-play real-time multiplayer web clone of Liar's Bar (Liar's Deck mode, 2–7 friends/room, Node.js + Express + Socket.IO + MongoDB, premium cosmetic themes via payment webhook). Date: 2026-11-23. Builds on `99-initial-search-notes.md`. Section 9 is the binding MVP checklist.

---

## 0. Why this is existential, not hygiene

The original Liar's Bar (Unity, client-heavy netcode) is a **documented cheater's playground**: Steam players report *"with the cheat 'The truth bar menu' you can see the cards of the other players… force the other players' guns to hit"* ([Steam thread](https://steamcommunity.com/app/3097560/discussions/0/599640143391897807)); public cheat menus advertise see-all-cards + change-your-cards ([example](https://cheatermad.com/free-liars-bar-hack), [UnknownCheats](https://unknowncheats.me/forum/printthread.php?t=685319)); and the community anti-cheat mod *LiarsAntiCheat* fights it by **client-side obfuscation** — "prevents cheaters from seeing other players' cards by obfuscating everyone's cards to 5 jokers" ([GitHub](https://github.com/tyzeron/LiarsAntiCheat), [Nexus](https://www.nexusmods.com/liarsbar/mods/1)). When the fix is "make the client lie to itself," that's the tell: **in the Steam game, opponents' hidden cards reach (or are derivable on) other players' machines.**

The same wound in adjacent hits:

- **Among Us (2020):** client-hosted authority enabled always-impostor / kill-anyone cheats; Innersloth's Nov 2020 patch added **server-side validation** after admitting it got "pretty bad" ([SixthAxis](https://www.thesixthaxis.com/2020/11/04/among-us-patch-notes-roadmap-cheat-hack/), [Wired](https://www.wired.com/story/among-us-cheats-hacks), [Tenable](https://medium.com/tenable-techblog/hacking-in-among-us-b43ea0fdd3d7)).
- **Online poker:** the **Absolute Poker "superuser" scandal** (2007) — insider accounts (POTRIPPER, GRAYCAT, ~40 days of unfair play) saw opponents' hole cards; exposed only because a leaked hand-history showed statistically impossible play ([CBS](https://www.cbsnews.com/news/how-online-gamblers-unmasked-cheaters/), [Kahnawake audit](https://pokernews.com/news/2008/01/absolute-poker-kgc-releases-final-audit-report-4634.htm)). Hidden-card visibility is THE trust killer for a deception game.
- **skribbl.io:** the server (correctly) sends the secret word only to the drawer, yet "autoguesser" extensions still solve it from letter-pattern hints + the public wordlist — hidden info leaks *inferentially* too ([protocol gist](https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814), [ProGameGuides](https://progameguides.com/skribbl/best-skribbl-io-hacks)).

**Our structural advantage:** we own the only server. If hidden cards never cross the wire, the entire cheat class above becomes impossible rather than obfuscated. Everything below keeps that promise plus the cheap hardening around it.

---

## 1. Threat model: what's actually worth attacking

Scale: friend-group party game, no persistent chat, money flow = one cosmetic purchase. 90% of attackers = a curious/griefing friend with F12; 10% = opportunist troll bots once viral. Out of economic scope: IP theft, kernel anti-cheat, APTs.

| # | Threat | Who / why | Likelihood | Impact | Verdict |
|---|--------|-----------|------------|--------|---------|
| 1 | **Peeping hidden hands/pile/bullet via devtools** (network tab → WS frames; Socket.IO frames are plaintext JSON) | Any bored friend; one "I can see your cards" Discord screenshot kills the game socially | Near-certain | Fatal — core mechanic dies | **MUST (architectural)** |
| 2 | **Forged actions** — challenge outside window, throw cards you don't hold, act out of turn, play 5 cards | One headless `socket.io-client` script | High once tools circulate | Round integrity fatal | **MUST (server validation)** |
| 3 | **RNG-rigging suspicion** ("the site deals me garbage") | Any salty loser; word-of-mouth poison | Certain | Trust death | **MUST (crypto RNG + audit log)** |
| 4 | **Room-code trolling / "Ruskolling"** — brute-forcing join codes to crash strangers' rooms | Bored kid with a script; skribbl ships a dedicated "Joining rooms too quickly" error — proof this happens | Medium, spikes with virality | Griefing only | **SHOULD** |
| 5 | **Payment webhook forgery** (POST fake `payment.captured` to a public URL) | Opportunist; trivial if signature check is skipped | Low→High if unverified | Real revenue loss | **MUST (~1 hour of work)** |
| 6 | **XSS via nickname** — the only user-authored persistent string, rendered room-wide | Trolls | Medium-low (React auto-escapes) | Defacement → session theft | **SHOULD** |
| 7 | **Griefing:** join/leave spam, rage-bot (scripted no-op/reconnect client), AFK stalling, mid-round mass disconnect | Trolls + genuine mobile flakiness | High | Room dies socially | **SHOULD (server timers)** |
| 8 | **npm supply chain** (dependency ships webhook-secret-stealing malware) | Not personal — collateral & historically real | Given npm history | Catastrophic if it fires | **MUST (lockfile + audit + tiny tree)** |
| 9 | Infra DDoS | Only after success | Low until popular | Availability only | Buy it (Cloudflare/PaaS) |
| 10 | **Collusion / multi-accounting among friends** (Discord screen-share, two phones) | Your actual players | Certain | Zero (see §8) | **WONTFIX (by design)** |

\* "Ruskolling" (orchestrator's term) = random roll-through of join codes hoping to land in a live room and grief it.

**Paranoid tier — skip for MVP:** device fingerprinting for multi-accounting (false positives on NAT'd friend groups, privacy cost, no payoff); kernel anti-cheat (nothing client-side to trust is the point); custom DDoS scrubbing (buy it); signed state-push receipts among friends.

**Ranking:** 1→2→3 are existential and likely. 5, 8 are cheap and catastrophic-if-skipped. 4, 6, 7 are game-quality issues. 9 you purchase. 10 is a feature.

---

## 2. The golden rule + implementation recipe

> **GOLDEN RULE: every hidden fact (card faces, deck order, pile contents, bullet chamber) lives 100% server-side until a challenge reveal flips it public. Until then the server sends ONLY counts. The client only ever sends intent.**

**Byte budget of every non-reveal server frame** (the promise in one list): seat list, per-seat `handCount`, per-seat `pulled/6` counters (spent chambers are public in the real game), `pileCount`, table rank (K/Q/A), whose turn + deadline, dead/alive flags, cosmetic events, and — to one socket only — that seat's **own** hand faces. A challenge is the *only* event that emits pile faces, and the round ends with the reveal anyway.

**Even "your own" hidden data is need-to-know.** Never send a player their own revolver's live-chamber index — the real game shows "(4/6 pulled)" but not *which* chamber is live; a devtools user who knows the index knows whether their next loss is fatal and can stall or dodge challenges. Pull outcomes are computed and narrated server-side only. Generalized: **a client gets what it must render, not what it "owns."**

**Client → server event whitelist** — anything else gets warned, then `disconnect(true)`:

| Event | Payload | Server validates |
|---|---|---|
| `play_cards` | `{ ids: [1..3 CardIds] }` | room in `TURN`? `room.turn === socket.seat`? every ID exists in **that seat's server-side hand**? count 1–3? deadline not passed? |
| `challenge` | `{}` | sender is the **next seat** after the last play (rules: only the next player may call liar)? pile non-empty? window open? |
| `chat` / `emote` | enum / ≤16 chars | per-event rate limit (§4) |
| `lobby:*` (sit, ready, theme, lock, kick) | ids / booleans | sender is host or quorum; room state allows it |
| `reclaim_seat` | `{ seatTicket }` | ticket one-time, seat open, same room, inside grace window (§7) |

Facts the server **never** accepts as input: turn number, timers, "I survived the roulette", "he lied!", any card face, scores, bullet outcome, payment status. A message that asserts an *outcome* rather than an *intent* is invalid by construction.

**Recipe (~150 lines of engine code):**

1. **Server-side room state machine**: `LOBBY → DEALING → TURN → CHALLENGE → ROULETTE → ROUND_END`; only validated events or server timers drive transitions. The client state copy is a disposable render cache.
2. **One reducer** for all mutations — `applyEvent(room, actor, event) → { publicPatch, privatePatch, logArtifact }` — and emit from its output; never dump server objects to sockets.

   ```js
   const publicView = r => ({ phase: r.phase, tableRank: r.tableRank, pileCount: r.pile.length,
     seats: r.seats.map(s => ({ id: s.id, handCount: s.hand.length, pulls: s.pulls, alive: s.alive })) });
   io.to(room.id).emit('state', publicView(room));       // identical bytes for every seat
   io.to(mySocket).emit('hand', mySeat.hand);             // the ONLY private channel
   io.to(room.id).emit('reveal', { cards: pile.map(face) }); // ONLY at challenge resolution
   ```
3. **Opaque card IDs**: `crypto.randomUUID()` per card per deal (sequential IDs correlate deck order across rounds for log readers; random is free).
4. **Message-level authorization on every event** — never "connected ⇒ trusted" ([OWASP WS cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)).
5. **CI guard that keeps the promise honest**: a headless 3-client test room with a packet recorder; assert no pre-reveal frame contains a hidden card face or the strings `bullet|chamber|index`. Catches the innocent "full state sync" refactor that no code review will.

Why not "just encrypt the frames"? Pointless — the cheater *is* the recipient and their browser must decrypt everything. Obfuscation defeats only people who can't open devtools, i.e., nobody. And per skribbl: any auxiliary signal hinting at hidden state gets mined (there: underscore patterns vs public wordlist) — pile *counts* are fine (public knowledge in the physical game), but nothing derived from hidden state should reach a client "for animations."

---

## 3. RNG fairness: crypto randomness + replayable audit trail

1. **`Math.random()` (or any PRNG) is banned for game decisions.** It's a seeded xorshift-family PRNG — predictable, non-cryptographic ([OWASP Insecure Randomness](https://owasp.org/www-community/vulnerabilities/Insecure_Randomness), [WSTG weak-cryptography testing](https://wstg.owasp.org/latest)). For a game whose entire fun is "the deal could be anything," a predictable shuffle is a game-design bug, not just a security one.
2. Use Node's **`crypto.randomInt(min, max)`** — cryptographically strong, uniform integers in `[min, max)` ([Node docs](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback)) — for every decision: each Fisher–Yates swap step, round-1 first player, and the bullet chamber.

   ```js
   function shuffle(deck) {                          // Fisher–Yates, unbiased
     for (let i = deck.length - 1; i > 0; i--) {
       const j = crypto.randomInt(0, i + 1);         // never Math.floor(Math.random() * (i + 1))
       [deck[i], deck[j]] = [deck[j], deck[i]];
     }
     return deck;
   }
   const liveChamber = crypto.randomInt(0, 6);        // once per player at match start
   ```

3. **Bullet-at-fixed-index pattern**: `liveChamber` is chosen once per player at match start and never re-rolled. Each loss = one trigger pull; server computes `hit = (pulls === liveChamber)`, `pulls++`. That yields the canonical 1/6 → 1/5 → 1/4 → 1/3 → 1/2 → guaranteed-death ladder (99-notes rules + TheGamer table). No client input can influence it, and the index never leaves the server (§2).

**Optional "provably fair" (phase 2, cheap):** commit–reveal — broadcast `HMAC(deckOrder ‖ chambers ‖ salt)` to the room at deal time, publish `salt` + full order at match end so anyone can verify the deal wasn't switched mid-match. "Mental poker" in miniature ([Shamir/Rivest/Adleman — Mental Poker](https://en.wikipedia.org/wiki/Mental_poker)).

**Audit trail: seed-less, deterministically replayable per round.** Don't store just a seed — store **resolved facts**, enough to re-run the reducer mechanically:

```
{ roomId, gameNo, roundNo, players[], tableRank, deckOrder[], hands{seat→faces},
  bulletChamber{seat→0..5},
  actions: [ {ts, actor, event, payload, serverResult}… ],
  reveal: { plays, verdict, rouletteOutcome }, finalState,
  prevHash, hashChain: H(prevHash ‖ thisRound) }
```

- **Dispute review**: "the server rigged me" becomes "pull the log, replay the round in the harness, watch it play out." Absolute Poker was exposed *because* hand histories existed and were analyzable ([CBS](https://www.cbsnews.com/news/how-online-gamblers-unmasked-cheaters/)); we keep that property — deliberately, since in a deception game the operator (a friend's friend) is a legitimate suspect.
- **Regression fixtures**: a handful of juicy saved logs (called-lie catch, 5/6 survival, 2-player forced-call endgame, mid-round disconnect auto-resolve) become frozen engine tests.
- **Tamper evidence**: hash-chaining rounds makes retroactive edits detectable — one line of code against the Absolute-Poker insider class of problem.
- **Cost control**: capped MongoDB collection, TTL index 30 days, flush on round end — nothing on the hot path before reveal.

---

## 4. WebSocket security hardening

### 4.1 Origin allowlist at the handshake (CSWSH defense)

The Same-Origin Policy does not govern *opening* a WebSocket: scripts on any site can dial our game and, if identity rides only on cookies, make authenticated moves — Cross-Site WebSocket Hijacking, formalized as **CWE-1385 (Missing Origin Validation in WebSockets)**. Real example: Gitpod's 2023 CSWSH enabled **full account takeover** ([GHSA-f53g-frr2-jhpf](https://github.com/advisories/GHSA-f53g-frr2-jhpf)).

- Validate `Origin` on **every** handshake against an explicit allowlist. No substrings or wildcards ([OWASP WS cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)).
- Socket.IO v3+ no longer allows all origins by default ([change note](https://github.com/socketio/socket.io/commit/f78a575), [server options](https://socket.io/docs/v4/server-options)) — so configure intent, not absence:

  ```js
  const io = new Server(http, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
    maxHttpBufferSize: 1e4,                        // §4.2
  });
  io.use((socket, next) => {
    if (!ALLOWED_ORIGINS.has(socket.handshake.headers.origin)) return next(new Error('origin'));
    next();
  });
  ```

- Best case: serve Next.js and the game server from **one origin** — the allowlist becomes `['https://ourdomain']` and the whole class shrinks. Do this first.
- **Tickets, not query strings**: REST issues a one-time join ticket (room + seat claim + 60s TTL) presented via `io({ auth: { ticket } })`. OWASP explicitly warns against tokens in handshake URLs — they land in proxy/access logs ([session management](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html#session-management)).

### 4.2 Payload caps + per-event rate limits

- `maxHttpBufferSize`: default 1 MB is absurd for us (biggest legit event < 200 bytes) → set **10 KB** ([Socket.IO server options](https://socket.io/docs/v4/server-options)); OWASP suggests ≤ 64 KB generally.
- Per-socket, per-event-type token buckets:

| Event | Budget | Notes |
|---|---|---|
| `play_cards` / `challenge` | structurally bounded (validated 1/turn); 3 misfires/s then warn | out-of-state events are O(1) rejects by §2 design |
| `chat` / `emote` | 3 per 5s, burst 5 | table-talk spam |
| `join_room` / `rename` | 4/min then exponential backoff incl. a 10s "too many attempts" block | skribbl ships literally this ("Joining rooms too quickly") |

- **Connection caps**: room occupancy **7** enforced in state; one live socket per seat (a new socket for a seat disconnects the stale one); **per-IP cap ≈ 12 concurrent** — seven friends on one café/WhatsApp-hotspot NAT is *normal*, never punish NAT, 12 covers refresh-bounce; a global cap that sheds load instead of OOMing. skribbl precedent: "Too many IP connections" ([protocol gist](https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814)). OWASP: cap messages, cap connections, prefer per-user limits where identity exists.
- Chat/lobby replay-nonce hardening is unnecessary while every event is state-machine validated (a replayed `play_cards` just fails the state check); revisit only if logs show collision abuse.

### 4.3 Nickname sanitization (the XSS answer)

Primary defense is architectural: React text nodes auto-escape, and we ship **no** `dangerouslySetInnerHTML`, no markdown, no user-hyperlinks, ever. The server still sanitizes (defense-in-depth + data hygiene):

1. NFKC normalize ([Unicode UTS #39](https://www.unicode.org/reports/tr39/)).
2. Strip control chars: C0/C1 (`\p{Cc}`) and DEL.
3. Strip zero-width & bidi marks: `\u200B`-`\u200F`, `\u2060`, `\uFEFF` (these hide homoglyph/injection abuse).
4. Confusable policy: fold via UTS #39 confusables or reject mixed-script tokens (identity tricks like Cyrillic `І` vs Latin `I`).
5. Trim, collapse whitespace, truncate to 16 codepoints; empty → `Player-<n>`.
6. Classic XSS payloads (`<script>`, `onerror=`, `javascript:`) never matter because output is text-only — but re-audit any future HTML surface (email receipts, leaderboard embeds) that renders names raw.

Rate-limit renames (1 per 30s). No profanity filter — friend rooms self-moderate (§7); our job is charset honesty, not politeness.

### 4.4 Room-code entropy: the guessing math

Threat: a troll enumerates join codes to land in strangers' rooms (griefing only — even if they land, §2 means they can't peek). A random guess hits a living room with probability ≈ N/keyspace, so expected guesses to find *any* active room ≈ keyspace/N:

| Code | Keyspace | Hit odds (N=500 / N=100 active) | Expected guesses (N=500 / N=100) |
|---|---|---|---|
| 4 × A–Z ("ABCD") | 26⁴ = 456,976 | 1/914 / 1/4,570 | **914 / 4,570** |
| 4 × unambiguous 31 ("G7XQ") | 31⁴ ≈ 923,521 | 1/1,847 / 1/9,235 | 1,847 / 9,235 |
| 5 × A–Z ("ABCDE") | 26⁵ = 11,881,376 | 1/23,763 / 1/118,814 | **23,763 / 118,814** |

Attack-rate card: one IP pushing an aggressive ~60 joins/min hits a 4-letter room in roughly **15–76 minutes** (N=500 vs N=100) — too fast. With a 4/min/IP limiter that becomes **~3.8–19 hours of steady slog for one room hit**, and the hit only buys a seat at a party that can host-kick them. Ten bot IPs divide the time by ten — that's DoS tier, and Cloudflare bot protections are the accepted answer.

**Decisions:** ship **5-character codes** (99-notes said 4-letter; the math says bump — days of slogging at 4/min even with 500 active rooms); sliding-window join limiter with exponential delay per IP; **uniform failure responses** ("room not found or locked") so the join endpoint isn't an existence oracle; **no** REST "does this room exist?" preview — every lookup goes through the same rate-limited join path; alert on join-limit trips (tripwire metric).

---

## 5. Payments security (premium cosmetic themes)

**Flow:** client → `POST /api/checkout` with `{ themeId }` **only** → server pulls price from its own catalog, creates the provider order with the server-computed amount → checkout widget (key_id is the only client-visible credential) → user pays → `payment.captured` webhook hits our public endpoint → after verification, upsert the entitlement doc → theme live.

**1. Webhook signature verification** — the only thing between the open internet and free merchandise. Razorpay sends `X-Razorpay-Signature` = **HMAC-SHA256 of the raw request body keyed with the webhook secret** ([docs](https://razorpay.com/docs/webhooks/validate-test)):

```js
const expected = Buffer.from(crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.rawBody).digest('hex'));
const got = Buffer.from(req.get('x-razorpay-signature') || '', 'utf8');
if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return res.status(400).end();
```

- Verify against the **raw body**: mount `express.raw({ type: 'application/json' })` (or a `verify` capture hook) on this route, because `express.json()` consumes it. Razorpay's docs warn explicitly: *"Do not parse or cast the webhook request body"* — most integration bugs are "I `JSON.stringify`'d the parsed body and the signature never matched."
- Use **`crypto.timingSafeEqual`**, not `===` ([Node docs](https://nodejs.org/api/crypto.html#cryptotimingsafeequalab)).
- Whitelist expected events (`payment.captured`, `refund.processed`); log and ignore the rest. (Stripe equivalent: `stripe-signature` + timestamp tolerance — same recipe, different header names.)

**2. Idempotency.** Webhooks are at-least-once and **out of order** ("payment.authorized" can arrive after "payment.captured" — [docs](https://razorpay.com/docs/webhooks/validate-test)). Unique index on Razorpay's `x-razorpay-event-id` in a `webhook_events` ledger; duplicate delivery ⇒ insert fails ⇒ ack 200 and move on. **Derive state from the payload's order/status fields, never from arrival count.** This is the entire replay protection — a stale-but-signed event cannot double-grant.

**3. Defense-in-depth after verification.** A valid signature only proves "genuinely from the provider, about this payload" — still re-check internally: the `order` id is one we created, `amount`/`currency` match our stored server-priced order, and it isn't already fulfilled. See [OWASP Third-Party Payment Gateway Integration](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html) and [Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html).

**4. Never trust the client about money.** Client sends `{ themeId }`; price, currency, description come from the server catalog. No client-supplied amounts, ever ([OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)).

**5. Entitlements are server-owned data.** Doc `{ userId, themeId, orderId, status, grantedAt }`:
- Every theme *usage* (room creation, theme apply, seat render) re-validates ownership server-side; CSS/asset files are just static art — the exclusive record is the money.
- **Refunds**: refund events → `status: revoked`, strip the theme at next room join, restore free defaults; nightly reconciliation against the provider API catches missed webhooks.
- Store a receipt (order id, timestamp, payload sha256) per purchase so "I paid and lost everything" tickets are answerable.
- **Keys**: `RAZORPAY_KEY_ID` is public (fine in client JS); `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server env only (§6.4). When rotating the webhook secret, dual-verify (old OR new) until retries age out ([docs](https://razorpay.com/docs/webhooks/validate-test)).
- Dev note: Razorpay blacklists webhook-tunnel domains (requestbin, ngrok.io, …) even in test mode ([list](https://razorpay.com/docs/webhooks/validate-test)) — use a real staging URL; that conveniently also keeps the webhook secret off third-party services.

---

## 6. Web app basics

- **Headers — helmet**: defaults on, then tighten CSP: `default-src 'self'; connect-src 'self' wss://<game-host>; frame-ancestors 'none'; object-src 'none'`, plus HSTS, nosniff, Referrer-Policy ([helmet](https://helmetjs.github.io/), [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)). CSP is also the safety net that makes a hypothetical nickname-XSS boring instead of fatal.
- **CSRF**: REST mutations = cookie session with **SameSite=Lax** + required custom header (`X-Requested-With`) or double-submit token ([OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)); Socket.IO's CSRF story is §4.1 (origin allowlist — SameSite alone is not reliable for cross-site WS handshakes — plus the join ticket doubles as a CSRF token).
- **CORS**: one explicit origin allowlist applied to both Express `cors` and Socket.IO's `cors` option; never `origin: true` or `"*"` with credentials ([handling CORS](https://socket.io/docs/v4/handling-cors), [server options](https://socket.io/docs/v4/server-options)).
- **Secrets — env-only, never in the client bundle.** All secrets server-side: `MONGODB_URI`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, session key; `.env*` gitignored. **Next.js rule:** only `NEXT_PUBLIC_*` env vars reach the browser, and those are **inlined into the JS bundle** at build time — public by definition ([env docs](https://nextjs.org/docs/app/guides/environment-variables), [next.config env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env)). Leak footguns to never commit:
  - `NEXT_PUBLIC_MONGO_URI` — DB connection string served publicly (secret hygiene becomes the only defense).
  - `NEXT_PUBLIC_RAZORPAY_WEBHOOK_SECRET` / `…KEY_SECRET` — instant webhook forgery from any visitor's devtools.
  - `NEXT_PUBLIC_JWT_SECRET` / `SESSION_SECRET` — session forgery.
  - `next.config.js` `env: {}` — same effect; bundled into client JS regardless of intent.
  - Refactors that move a server module into a client component take its env reads along — add `import 'server-only'` to secret-holding modules so this is a build error.
  - Release check: `grep -rE "SECRET|URI|PASSWORD|TOKEN" .next/static/` must return only false positives; run it in CI.
- **MongoDB Atlas**: dedicated least-privilege DB user; strong generated password; **IP allowlist limited to server egress IPs** — never `0.0.0.0/0` (one leaked credential then equals total compromise; if server IPs rotate, fix with a static egress IP or VPC peering, not by opening the door); TLS enforced ([Atlas security docs](https://www.mongodb.com/docs/atlas/security/)).
- **Dependencies — the npm history lesson is directly about us.**
  - **eslint-scope (July 12, 2018):** attacker compromised a maintainer's npm token (reused password, no 2FA); published `eslint-scope@3.7.2` with a postinstall that exfiltrated `.npmrc` (publish tokens) to pastebin ([postmortem](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes)). Their own recommendations: lockfiles, and be careful with auto-merging dependency bots.
  - **Shai-Hulud (Sept 2025) + 2.0 (Nov 2025):** self-replicating npm worm seeded by a compromised `@ctrl/tinycolor`; spread via stolen maintainer GitHub tokens; 500+ packages (CISA alert; wave two also hit 25,000+ repos in hours) and harvested cloud/npm credentials — **exactly the webhook + DB secrets a payments server holds** ([CISA](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem), [Wiz](https://wiz.io/blog/shai-hulud-npm-supply-chain-attack), [Check Point on 2.0](https://blog.checkpoint.com/research/shai-hulud-2-0-inside-the-second-coming-the-most-aggressive-npm-supply-chain-attack-of-2025)).
  - (Adjacent: polyfill.io 2024 — third-party CDN script tags are supply-chain deps too; self-host.)
  - **Mitigations, all cheap:** (1) minimal tree — express, socket.io, mongoose, helmet, cookie-parser is nearly the whole MVP; verify webhooks with `node:crypto` (§5) instead of a provider SDK; (2) commit `package-lock.json`, deploy with `npm ci` so a compromised publish can't slip in — the eslint lesson literally; (3) CI gate `npm audit --audit-level=high`, lockfile diffs reviewed in PRs, Dependabot **merged by humans, never auto-merged**; (4) no postinstall magic you can't explain in a sentence.

---

## 7. Anti-griefing (UX-level) mitigations

Every control below is a **server clock** — no client pauses it by tabbing away, dropping network, or crashing; timers in JS are decoration.

- **Turn timers (30s, matching the source game)** → on expiry the server **auto-plays**: auto-throw 1 card (least-damaging neutral default), or auto-challenge when that seat is the forced caller. Repeated timeouts flag the seat for vote-kick suggestion. Timeout events land in the round log (§3).
- **Reconnection grace window**: a mid-round disconnect pauses the round clock with a visible ≤30s "player reconnecting…" countdown; rejoin revalidates via the one-time seat ticket (§4.1) and restores public state + own hand **only** (no full-state endpoint exists to abuse — there's no such code path, deliberately). After grace: auto-play continues for that seat until the room kicks it — one person's metro wifi never bricks a six-friend game. All sockets dark: pause 60s, then GC.
- **Join/leave spam**: §4.4 join limiter plus a 30s mid-round rejoin cooldown make seat-thrashing useless; empty seats mid-round are locked ("room locked while playing"); server counts joins per identity+IP and exposes a `JoinError 429` so the client can show "calm down" UX. skribbl's dedicated join-rate error confirms this is standard in the wild ([protocol gist](https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814)).
- **Vote-kick** (phase 2): majority of living players, server-counted, 24h room ban.
- **Host controls** (MVP): lock room mid-round, kick (invalidates seat ticket), ban by identity (IP as tiebreak only), and host migration when the host leaves (skribbl's "Set Owner" pattern — the room outlives its founder). Host is **not** god: host actions pass through the same §2 validators — no reveal, no peeking, no RNG influence.
- **Room expiry policy**: idle 30 min in lobby → "room closing" broadcast + 60s grace → removed from memory. Round logs (§3) outlive rooms under their own 30d TTL for dispute review.
- **Bot-fill** (phase 2): server-resident virtual seats execute through the same reducer; a bot's "socket" doesn't exist and its hand is server data like anyone else's — bots can't leak by construction even with trivial policies.

---

## 8. Collusion & multi-accounting in friend games

**Accepted risk; genuinely unfixable; mostly a feature.** Friends on a Discord call screen-sharing hands is not cheating, it's a Thursday. Rules insight from the 99-docs: the only player that matters is your immediate challenger, so collusion mostly degrades *the colluders'* own fun. Two-phones-one-person is always physically possible anyway.

- Do **not** build device fingerprinting, shared-IP seat-pair detection, or behavioral similarity: false positives are guaranteed (all seven friends on one hotspot), the privacy cost is disproportionate for a casual game, and the payoff is policing your friends.
- The one legitimate lever is *invite-only by default*: keep join codes/links non-guessable (§4.4) and the party stays friends-only. If public quickplay lobbies ever ship, they inherit collusion knowingly, not by accident. *The honest statement: we don't track you, we can't stop your friends' friends, and we don't pretend to.*

---

## 9. What this means for our version — must-do list (severity order)

1. **Nothing about hidden cards, deck order, or bullet chambers — even a player's own chamber — ever leaves the server** until the challenge reveal; server sends counts + own-hand only, bullet outcomes are narrated events. This kills the cheat class that plagues the Steam original (§0) and is *the* architectural decision of the project.
2. **One server-side reducer validates everything**: your turn? your cards? 1–3? challenge window open? next-seat-only challenge? forced-call resolved by state. Client sends intents from a fixed whitelist; anything else disconnects.
3. **CI packet-recorder test**: no pre-reveal frame contains a hidden card face or chamber index — because #1 will silently regress via an innocent "full state sync" refactor.
4. **`crypto.randomInt` for shuffle + chamber** (never `Math.random` in decision paths); chamber fixed at match start per player; commit–reveal later if anyone cares.
5. **Razorpay webhook: HMAC-SHA256 over raw body + `timingSafeEqual`** + `x-razorpay-event-id` unique-index ledger + re-check amount/order against internal records regardless of signature.
6. **Entitlements & pricing server-side**: `{themeId}` is all the client ever sends; ownership re-validated on every theme usage; refund events revoke grants.
7. **Origin allowlist at the handshake + one-time join tickets** (never cookie-only WS auth, never tokens in URLs) — CSWSH/CWE-1385 dead on arrival.
8. **Rate + size limits**: 10 KB `maxHttpBufferSize`; per-event budgets; **5-char join codes** (99-notes said 4 — §4.4 math says bump) with 4/min/IP + uniform not-found responses; per-IP socket cap ≈ 12 (NAT-friendly).
9. **Anti-grief spine**: server-side 30s turn timers with auto-play, ≤30s reconnect pause with seat reclaim, host lock/kick + host migration, 30-min idle room GC. (Vote-kick, bot-fill: phase 2.)
10. **Ops hygiene**: helmet+CSP, SameSite=Lax + custom-header CSRF for REST, CORS allowlist, Atlas IP allowlist (no 0.0.0.0/0), env-only secrets with a `grep .next/static` release check, `npm ci` + committed lockfile + `npm audit` CI gate + human-merged Dependabot + minimal dep tree, hash-chained seed-less round logs (30d TTL) for disputes and fixtures.

---

## Sources

- **OWASP**: [WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) · [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · [CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) · [Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html) · [Third-Party Payment Gateway Integration](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html) · [Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) · [Insecure Randomness](https://owasp.org/www-community/vulnerabilities/Insecure_Randomness) · [CWE-1385](https://cwe.mitre.org/data/definitions/1385.html)
- **Docs**: [Node crypto.randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback) · [Node crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequalab) · [Socket.IO server options / CORS / v3 default-origin change](https://socket.io/docs/v4/server-options) · [Next.js env variables](https://nextjs.org/docs/app/guides/environment-variables) · [Razorpay: validate & test webhooks](https://razorpay.com/docs/webhooks/validate-test) · [MongoDB Atlas security](https://www.mongodb.com/docs/atlas/security/) · [Unicode UTS #39](https://www.unicode.org/reports/tr39/) · [helmet](https://helmetjs.github.io/)
- **Incidents / precedent**: [Liar's Bar Steam cheater thread](https://steamcommunity.com/app/3097560/discussions/0/599640143391897807) · [LiarsAntiCheat mod](https://github.com/tyzeron/LiarsAntiCheat) · [Among Us anti-cheat patch (2020)](https://www.thesixthaxis.com/2020/11/04/among-us-patch-notes-roadmap-cheat-hack/) · [Wired on Among Us security holes](https://www.wired.com/story/among-us-cheats-hacks) · [CBS: Absolute Poker unmasked](https://www.cbsnews.com/news/how-online-gamblers-unmasked-cheaters/) · [Kahnawake final audit](https://pokernews.com/news/2008/01/absolute-poker-kgc-releases-final-audit-report-4634.htm) · [skribbl.io protocol gist (join-rate errors, per-IP caps, votekick, Set Owner)](https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814) · [skribbl autoguesser precedent](https://progameguides.com/skribbl/best-skribbl-io-hacks) · [ESLint postmortem (2018)](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes) · [CISA: Shai-Hulud (2025)](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem) · [Wiz: Shai-Hulud analysis](https://wiz.io/blog/shai-hulud-npm-supply-chain-attack) · [Check Point: Shai-Hulud 2.0](https://blog.checkpoint.com/research/shai-hulud-2-0-inside-the-second-coming-the-most-aggressive-npm-supply-chain-attack-of-2025) · [Gitpod CSWSH advisory (2023)](https://github.com/advisories/GHSA-f53g-frr2-jhpf) · [Mental Poker (concept)](https://en.wikipedia.org/wiki/Mental_poker)
