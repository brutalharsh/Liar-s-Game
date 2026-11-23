# 00 — MASTER SUMMARY: Research Complete (2026-11-23)

> **Read this file first.** It consolidates 12 deep-dive research docs (~4,800 lines)
> into the decisions, answers, and open questions for our build.
> Doc 99 holds the raw initial notes every researcher started from.

---

## The project (owner's brief, refined by research)

A **free-to-play, browser-based multiplayer bluffing card game** — a faithful web
clone of Steam's *Liar's Bar* in its card mode (**Liar's Deck**) only:

- **2–7 players** per room (original is locked to 4 — real market gap)
- **Mobile + desktop**, responsive, instant play via room-code invite link (no download)
- **No built-in voice chat** — players bring their own (Discord/WhatsApp)
- Throw 1–3 cards face-down claiming the table rank → challenge ("CHECK") →
  reveal → **loser faces the revolver** → full shooting animations
- **Premium cosmetic bar themes** (free Saloon + paid skins)
- Server-authoritative (anti-cheat is existential in this genre, see doc 12 §0)

---

## Doc index (reading order)

| File | What it is | Read when |
|---|---|---|
| `99-initial-search-notes.md` | Raw verified facts + sources from first pass | — |
| `01-game-overview.md` | History, virality, stats, market gap, drama engine | Context |
| `02-liars-deck-rules.md` | **THE rules spec** — 32 rules, 28-step game loop, conflict resolutions | **Building the engine** |
| `03-variants-and-other-modes.md` | Devil/Chaos/Deck-2/Dice/Poker/Slots + official "Shoot Opponent" spec | Post-MVP modes |
| `04-strategy-and-probability.md` | Balance math: deck scaling, roulette odds, challenge economics, **parameter table §7** | **Tuning the engine** |
| `05-origins-similar-games-and-ip.md` | Folk-game lineage, clone landscape, **trademark red-light**, name shortlist | Naming, launch |
| `06-multiplayer-architecture.md` | Transport verdict, server-authority recipe, rooms, reconnect, **event protocol** | **Building the server** |
| `07-hosting-and-deployment.md` | VPS vs PaaS vs serverless (2026 prices), capacity math, cost tiers | Deploying |
| `08-monetization.md` | Theme catalog, ₹/$ pricing, Razorpay/Paddle, entitlements | Payments phase |
| `09-ui-ux-design.md` | Screen map, **wireframes for 2–7p on phone/tablet/desktop**, cine specs, emotes | **Building the UI** |
| `10-assets-checklist.md` | 60+ item asset manifest, licenses, AI-art prompt recipes, budgets | Asset creation |
| `11-tech-stack.md` | Monorepo, libraries w/ versions, engine pattern, testing, phases P0–P4 | **Project scaffold** |
| `12-security-anticheat.md` | Threat model, golden rule, RNG, room codes, webhook security | Server hardening |

---

## Owner's questions — direct answers

### 1. "Where should I host it — Ubuntu VPS or a Vercel-type server?" → **Ubuntu VPS (one box does everything)**

- Vercel/Netlify/Cloudflare Pages **cannot host the game server**: even with 2026
  WebSocket support, Vercel force-kills every connection at 300s (Hobby) / 800s (Pro),
  pins each socket to an ephemeral instance with no shared memory, and bills
  provisioned memory while open. Fatal for persistent rooms. Free tier also bans
  commercial use (doc 07 §1, Vercel docs cited).
- **Recommended**: one **Ubuntu VPS** running Node (Express + Socket.IO) + Caddy +
  the Next.js static export. **DigitalOcean Bangalore $6/mo** (or Linode Mumbai $5,
  Vultr Mumbai $3.50) — Indian players get ~10–30ms; a turn-based game tolerates
  200–300ms anyway, so one region serves the world. Cloudflare free tier in front.
- **Tiered path**: $0 (localhost + cloudflared tunnel for friend playtests) →
  $6/mo + $11/yr domain for beta (**~₹8,000/yr total**) → $12–24 box + Redis adapter
  past ~500 concurrent players. A $6 1GB box handles **~13,000 concurrent players** —
  100× a realistic launch CCU for this genre.

### 2. "Do I need WebSocket, or do I just use it with API keys?" → **You need your own WebSocket server. API keys are unrelated.**

- An **API key** is a credential for calling someone *else's* service. The only one
  this project ever has is a Razorpay key pair for payments. There is **no third-party
  game API** — no voice, no text AI, nothing external. The game logic is ours.
- The realtime part is a **WebSocket** between each player's browser and *our own
  Node server* (Socket.IO: auto-reconnect, room management, HTTP fallback for
  misconfigured proxies/mobile Safari quirks — doc 06 §1). Server sends events the
  instant anything happens; no polling, no lag.
- REST (regular HTTP) is still used for the slow stuff: landing pages, theme store,
  checkout, webhooks (doc 06 §2).

### 3. "Does it work? Can this actually be done?" → **Yes — verified, and cheaply.**

- Turn-based, tiny messages (card IDs + counts), 2–7 players/room, ~52KB per socket.
  No physics, no tick-rate, no voice bandwidth. The heaviest engineering is the
  **anti-cheat server authority** (doc 12) and the **animation polish** (doc 09) —
  both fully specced.
- Market gap confirmed: the Roblox clone has 66M visits; the official Android app is
  dormant at 3.3★; web search is SEO fakes and single-player sims. **Nobody ships
  real-time multiplayer Liar's Deck in a browser with an invite link** (doc 01 §4).

---

## Verdict on the plan: what's GOOD ✅

1. **Genre & timing** — proven viral format (113,798 peak CCU, $0 marketing), still
   underserved in its web form. Emote-based drama works *without* voice (doc 01 §3).
2. **2–7 players** — the original is hard-locked to 4; bigger friend groups have
   nowhere to go. Deck-scaling math preserves balance at every N (doc 04 §7).
3. **No voice** — validated by the original's design; saves cost, moderation, and
   mobile headaches. Our emotes + cinematic reveal + "ghost lounge" replace table
   talk (doc 04 §5, doc 09 §5).
4. **Cosmetic themes as the only monetization** — watertight: no power exists to
   sell in a bluffing game, and the host's theme renders for the whole table → every
   lobby is a live demo. ₹99/theme, ₹399 bundle, Razorpay first (UPI ≈ 87% of Indian
   volume) (doc 08).
5. **Cards-only scope** (no Dice/Poker/Slots) — correct discipline for v1.

## What must CHANGE ⚠️ (the "not good" list)

1. **The name "Liar's Bar" is a red light.** Curve Animation filed international
   trademark **IRN 1836234** (Nov 2024, classes 9/41/42 = web games). Rules are
   copyable (folk-game lineage, Tetris/Scrabulous precedent); the name/art/characters
   are not. **Ship under a different name** — shortlist: *Six Chambers* (recommended),
   *Crooked Deck*, *Doubt It!* (doc 05 §6, needs a final clearance pass).
2. **"Images from Google" cannot happen.** Those images are all-rights-reserved and
   Steam's art is copyrighted. Plan instead (doc 10): **AI-generate all hero art**
   (I can generate these in-session — we own the results), **CC0 packs for utility**
   (Kenney cards/audio, game-icons, Freesound), OFL fonts. **$0 asset budget**.
3. **The 20-card deck doesn't deal to 7 players.** Fix (doc 04): deck = m×(6/6/6+2J)
   with m=ceil(N/4) → single 20-card deck at 2–4p, doubled 40-card deck at 5–7p.
   Truth density stays exactly 40%, E[truths/hand]=2.0 at every N.
4. **"Accuser shoots the liar" is not the base rule.** In the original, the challenge
   loser **always shoots themselves**; gun-pointing is official only in Chaos mode
   (9-second aim window, same revolver odds — doc 03 §4.5). Recommended: ship
   self-roulette as the balanced default, add **"Sharpshooter" toggle** as an
   optional mode (your idea, officially precedented). The strategy doc warns the
   sharpshooter rule adds kingmaking but the same 1/6 odds, so it changes *who pulls*,
   not survival rates (doc 04 §6.6).

---

## Locked game design (research-backed defaults)

- **Rules**: doc 02 — next-player-only challenge at 2–4p; forced auto-call when one
  holder remains (a round can never end without a roulette); reshuffle + new table
  card after every roulette; empty hand = safe; new round starts with the caught liar.
- **Revolver**: Model A — chamber position fixed per match, odds 1/6→1/5→1/4→1/3→1/2
  →6th pull is certain death; public `(pulled/6)` counter; E[pulls to death]=3.5.
- **Challenge rule for 5–7p**: **open 10-second first-come window** (any living player
  may CHECK during it; next player's committed play closes it as "believe"). With
  next-only at 7p, non-adjacent players go whole rounds with zero agency (doc 04 §6.3).
- **Turn timers**: 30s @2–3p, 20s @4–5p, 15s @6–7p (+host 10s "fast table" toggle).
  Timeout = auto-play one card (pre-staged selection if any) — **never** auto-call,
  never auto-shoot into a challenge. Disconnect: 60s grace, then auto-play (doc 04 §6.2).
- **Match length honesty**: 2–4p ≈ 5–25 min; 6–7p ≈ 35–45 min by the math
  (E[rounds]=3.5(N−1)+2). Mitigations: show est. match time on lobbies, make
  spectating fun (emotes/ghost lounge), optional **Quick Draw toggle** (2 bullets
  in 6 chambers → 7p ≈ 28–32 min) (doc 04 §6.5).
- **Anti-cheat golden rule**: server holds everything hidden; client receives card
  *counts* for others, card values only on reveal; even your own bullet chamber is
  never sent pre-reveal. `crypto.randomInt` for shuffle + chambers; hash-chained
  replay logs. 5-char room codes from a confusable-free set (doc 12).
- **UI**: hero-bottom portrait layout — wing seats (prev/next neighbors) flank the
  felt, far players on a top rail; CALL LIAR ≥64px thumb-zone, confirm guard sheet;
  reveal flips staggered 400ms; roulette cinematic ≈3.4s with Zimmermann head-fake
  blank beat; PG-13 deaths (ava52 slump, no gore); 10 emotes, 3s cooldown (doc 09).
- **Stack**: Next.js 16.4 App Router (14 is EOL) + Express 5 + Socket.IO 4.8 +
   MongoDB Atlas M0 (free) + monorepo `apps/web` / `apps/server` /
   `packages/rules-engine` / `packages/shared` (doc 11).

## Open decisions for the owner (asked right after this doc)

1. **Shooting rule v1** — self-roulette only (recommended default), or add the
   Sharpshooter toggle in v1? *(recommend: self-roulette v1, Sharpshooter v1.5)*
2. **Challenge rule at 5–7p** — open 10s window (research recommendation) or strict
   next-player-only everywhere (purist)? *(recommend: open window)*
3. **Name** — *Six Chambers* / *Crooked Deck* / *Doubt It!* / other?
4. **Payments timing** — Razorpay store in v1, or after core game is polished (P3)?
   *(recommend: P3 — polish the free game first; code entitlements but ship store later)*

---

## Recommended build plan (from doc 11, adjusted)

| Phase | Ships | Acceptance bar |
|---|---|---|
| **P0 — Prototype** | rules-engine (pure TS, fully tested) + server + minimal table UI, local only | 2 people play a full match on localhost; all 18 rules tests green |
| **P1 — Core** | rooms 2–7p, lobby, invite code, full loop + reveal + roulette, emotes v1, responsive phone+desktop | 7 people complete a match on real phones via tunnel; zero hidden-card leaks in packet recorder test |
| **P2 — Juice** | full cine timelines, Saloon theme + 1 premium theme preview, sfx/haptics, reconnect hardening, PWA manifest | "feels like the Steam game" blind test; ≥60fps on a mid-range phone |
| **P3 — Money** | lightweight accounts, Razorpay checkout, entitlement webhooks, theme store, 8 premium themes | end-to-end UPI purchase unlocks a theme owned server-side; refund safe |
| **P4 — Launch** | VPS deploy + domain + Cloudflare, rate limiting+room codes final, Playwright E2E, the "how to play" page | beta friends group completes a week of matches with <5% failed rounds |

**Rule of thumb used between phases (doc 12 §9 + doc 01 §5):** never ship a build where
the client can learn a hidden card, and never add a payment before the free game is fun.
