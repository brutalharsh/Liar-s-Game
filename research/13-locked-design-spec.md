# 13 — LOCKED DESIGN SPEC: "Liar's Game" v1 (owner decisions 2026-11-23)

> **This is the product truth.** Every doc below this one serves THIS spec.
> Owner answers locked on 2026-11-23 after the 12-doc research round.

---

## 1. Identity & name

- **Product name: "Liar's Game"** (slug `liars-game`) — owner's pick.
- ⚠️ **Clearance flag (pre-launch only, not a build blocker):** "Liar's Game" is
  closer to Curve Animation's pending **LIAR'S BAR** mark (doc 05, IRN 1836234,
  same trademark classes) than the researched alternatives, AND collides with
  Japan's famous **Liar Game** manga/drama franchise (2005+, 17M copies, TV+films).
- **Decision:** build everything under `liars-game` now; run a formal name
  clearance before public launch; alternates from doc 05 remain on the bench
  (*Six Chambers*, *Crooked Deck*, *Doubt It!*) if clearance fails.
- One-line pitch: *"Liar's Deck, in your browser, 2–10 friends, one invite link,
  and a revolver with your name on it."*

## 2. Core game rules (final — doc 02 as amended here)

Everything in `02-liars-deck-rules.md` (32 rules, 28-step loop) EXCEPT these locked
amendments:

| # | Amendment | Spec |
|---|---|---|
| A1 | **Execution dynamic (owner's rule)** | Challenge loser by case: **caught liar** → server flips fair coin → (a) liar takes self-roulette, or (b) **accuser executes the liar** (revolver pointed at the loser only — no other target can ever be selected). **False accuser** → **always** self-roulette. Odds identical in all paths (1 live in 6 chambers, Model A fixed position) — pure drama, zero balance shift. Cinematics for both paths (doc 09 §4). |
| A2 | **Challenge windows** | 2–4p: next-player-only (authentic). 5–10p: **open 10s window** — any living non-accused player may CHECK; first event wins server-side; closes when the next player commits a play. 2s arm-delay after a play lands. |
| A3 | **Deck scaling** | m×(6K/6Q/6A+2J) with m=ceil(N/4): 2–4p → 20 cards; 5–8p → 40; 9–10p → 60. Hand always 5. Truth density 40% at every N (doc 04 §1.4). |
| A4 | **Turn timers** | 30s @2–3p, 20s @4–5p, 15s @6–10p + host `fast` toggle (10s). Timeout = auto-play pre-staged selection else 1 random card. **Never auto-call, never auto-shoot.** Disconnect: 60s grace → auto-play; "drunk under the table" (no elimination). |
| A5 | **Rooms capacity** | Free: 2–7. **Premium hosts: "Big Table" rooms 8–10** (ASSUMPTION — see §14). |
| A6 | Kept verbatim | Forced auto-call when 1 holder remains; reshuffle + new table card after every roulette; empty hand = safe this round; caught liar starts next round; last-alive wins; PG-13 deaths. |

## 3. Rooms & lobby

- **Private rooms** (default): 5-char confusable-free code, invite link + share button.
- **Public rooms (new):** joinable open tables — lobby browser shows room name, host
  avatar, theme, seats (e.g. "3/7"), lock icon. Host toggles private/public; host can
  kick; room names pass the sanitizer. Listed rooms cap 30, auto-expire after 10min idle.
- Lobby: seats fill top-down, host see theme picker + start button (needs ≥2),
  everyone sees "Est. match ~X min" (doc 04 §6.5), fun-fact/rule-help drawer.

## 4. Profiles, XP & levels (new systems)

- **Identity = nickname + avatar.** Every player is a guest by default (guest id in
  localStorage); "claim account" upgrades to a persistent account at first purchase
  (P3) or voluntarily earlier.
- **XP:** awarded per completed match (win 12, lose-and-alive-at-end 6, died 4 —
  tune ±). **Levels 1–100, deliberately brutal** per owner: cumulative XP to 100 ≈
  **10 lakh (1M) matches**. Suggested curve: geometric thresholds r≈1.02/mo… no —
  implement `threshold(L) = round(K·1.0721^(L−1))` tuning K so Σ L1–99 ≈ 1e7 XP
  (tuned at build; single constant). Level visible as small badge; every 10 levels
  unlocks a cosmetic **level frame** (never purchasable — prestige is earned).
- **NO purchasable XP, no odds boosts, nothing pay-to-win. Ever.** (Owner's "too
  hard" leveling is a feature — honest grind.)

## 5. Coins economy (new system)

| Flow | Rule |
|---|---|
| **Earn (winner)** | Winner receives **random 2–7 coins** per match win. (ASSUMPTION: literal 2–7, plus 1 coin per survived round for everyone — tune at beta. No-farm guard: max 3 earn-events/hour.) |
| **Buy** | Coin packs via Razorpay UPI (P3): ₹49→500, ₹99→1200, ₹199→2500, ₹399→5500 (+bonus). One-time, no subscriptions (doc 08 §5 RBI). |
| **Spend** | Avatar items, frames, animations, voice packs, themes (themes also direct-₹ per doc 08 if we want; v1 = coins only). |
| **Wallet** | Server-authoritative only: balance + append-only ledger, idempotent grants (webhook eventId dedupe), spend = atomic transactions. Client never sends balances — only intent. |
| **Anti-abuse** | Earns authenticated + rate-limited per account; refunds reverse via compensating ledger entries. |

## 6. Avatar & customization (new system)

- **Bases:** human male + female (original art, 3–4 skin tones). NOT animals (doc 05 —
  must stay clear of Curve's characters).
- **Categories:** hair styles, beards, hats, shirts/outfits, glasses, **frames**
  (profile border), **idle/win/death animations**, **voice packs**.
- **Free starter set:** 2 hairs, 1 beard, 2 shirts, no hat, default frame, 1 idle
  animation, default TTS voice. Everything else **coin-unlocked** (50–400 coins by
  rarity tiers).
- **Equip system:** one item per category; stored on profile; render = layered
  compositor (base → hair/beard → shirt accents → hat → frame) client-side.
- Art pipeline: AI-generated layered sprites in ONE consistent painterly-noir style
  (prompts in doc 10 §4); I generate in-session during the art phase.

## 7. Bar themes (premium product — as before, one amendment)

- FREE: **The Saloon** (default bar table) + **House Table** (owner's "house table" —
  living-room felt).
- PREMIUM (coins): Neon District (cyberpunk), Casino Royale, Jazz Speakeasy,
  Haunted Inn, Orbital Cantina, Kabuki Alley. Each = background + felt + card back
  alt + ambience loop (≤1MB lazy pack, doc 10 §5).
- ❌ **"Strip club" theme REJECTED (owner override, policy + payments):** adult
  content risks Razorpay termination (their AUP), kills the PG-13 rating, and gets
  us banned from school/office networks — the core audience. Five classy noir
  alternatives above instead.
- Theme mechanics: **host owns the theme, whole room renders it** (live-demo effect,
  doc 08 §1).

## 8. Voice lines & TTS (new system — NOT voice chat)

- **No voice chat, no microphones. Ever.** (Unchanged.)
- **Spoken claims via TTS (owner's "text to speech"):** when you throw, your
  character's voice announces the claim — "Two Aces!" — using the browser's free
  built-in SpeechSynthesis (zero infra, offline, all devices). Vocabulary is small:
  {One,Two,Three} × {Ace(s),King(s),Queen(s)}, "LIAR!", "Check me!", win stings,
  death lines. Pitch/rate/voice per **voice theme** preset (Villain, Chipper,
  Robot, Drunk…) selectable in Settings; per-player mute + global captions toggle.
- **Mid-game random barks** (owner's "random drop"): ~5% of throws + every kill/falsely-
  accused moment trigger a themed line — pre-scripted, TTS-rendered (recorded premium
  packs later if the game earns money).
- SFX (cards, cylinder, bang, blank click) from CC0 packs per doc 10 §3.

## 9. Emotes (table talk without voice)

10 preset emote bubbles ("Call my bluff", "My condolences", snake, skull, laugh…),
3s cooldown, mute-all toggle (doc 09 §5).

## 10. Security & fairness invariants (unchanged — doc 12)

Zero hidden-card data on the wire; validating server reducer for every action;
`crypto.randomInt` shuffle + chamber placement; hash-chained replay logs; 5-char
room codes; atomic play-or-call (no race exploit); Razorpay webhook signature +
idem Coin grants; sanitized nicknames/room names; helmet/CORS/rate-limits.

## 11. Content policy

PG-13: stylized cartoon deaths (slump + fade, no gore), no gambling imagery of real
money (coins are cosmetic-only soft currency, non-redeemable — keeps us clear of
gaming/gambling law buckets), no adult themes.

## 12. Monetization summary

FREE: 2–7 player rooms, Saloon + House themes, starter cosmetics, all gameplay.
PREMIUM (coins, Razorpay UPI): avatar items/frames/animations/voice packs, premium
themes, **Big Table 8–10 host unlock** (capacity perk, not game power). First-
purchase offer ₹49 (doc 08 §4).

## 13. Non-goals for v1

Voice chat · mobile native apps · friends list · ranked/MMR · coin redemption or
trading · chat text · Spectator password rooms · localization beyond EN-HI toggle.

## 14. Assumptions register (owner: say the word, I flip it)

1. **"Unblock lobby >5–7" = free 7 / premium 10 seats.** (Was: free = 5?)
2. Coin earn literal 2–7/win (+1 per survived round bonus — my add).
3. 2 rounded coin prices per doc 08 before Beta feedback.
4. "10 lakh games → level 100" honored as hard total; curve constant tuned in code.
5. Name ships as Liar's Game, clearance check before public launch.
6. "Strip club" replaced by Jazz Speakeasy-class alternates (§7).
