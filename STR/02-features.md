# STR/02 — FEATURES (versioned)

> What ships and when. v1 = first playable release. v1.x = fast-follow. Later = backlog.
> Source: owner decisions 2026-11-23 (research/13) + follow-ups.

## v1 — Core game (FREE)

- **Liar's Deck** full rules per STR/01, 2–7 player rooms
- Three table sizes implicitly: any count 2–7; "Big Table" 8–10 is premium (v1.x)
- Private rooms: 5-char code, invite link `/r/XXXXX`, share button
- **Public room browser**: open tables anyone can join (name, host avatar, theme,
  seats x/7, lock badge); rooms auto-expire 10min idle
- Lobby: seats fill, host controls (kick, lock, theme pick, start ≥2),
  est. match time chip, rules help drawer
- Full round loop: deal → play → windows (STR/01 §4) → reveal → shot (§6) →
  round end → win screen with rematch
- **Shooting dynamic**: self-roulette + accuser-executes-liar cinematics
- Emotes: 10 presets, 3s cooldown, mute-all
- **TTS voice lines** (no voice chat ever): spoken claims ("Two Aces!", "LIAR!"),
  kill/death/win stings, random mid-game barks (≈5% of throws); 4 voice themes
  (Villain, Chipper, Robot, Drunk) as pitch/rate/voice presets; captions toggle
- Profiles: guest identity (localStorage), nickname + avatar; claim-to-account later
- Stats: kills (headline), catches, wins, matches, deaths, pulls survived
- **Titles** ("Best Liar" etc., full list STR/04 §6): earned server-side, 1 equipped
- **Leaderboard**: global all-time, metrics wins | kills | XP | titles; top 100
- XP + levels 1–100 (brutal curve, STR/04 §5); prestige frame every 10 levels
- Coins wallet + earn (STR/04 §2); SPEND on cosmetics
- Avatar customization: starter set free; hair/beard/hat/shirt/glasses/frame items via coins
- Themes: **The Saloon** (default) + **House Table** free; premium themes via coins
- Two designed layout modes: **Mobile portrait** (rail+wings) and **Desktop oval**
- PWA (installable, offline shell), responsive 390/768/1440, reduced-motion + colorblind modes
- Settings: voice theme + TTS preview, volumes, captions, emote mute, reduced-motion
- Security & anti-cheat per STR/08 (server-authoritative, zero hidden data)

## v1 — Payments (MOCK until owner picks provider)

- Coin packs: ₹49/₹99/₹199/₹399 (500/1200/2500/5500 coins)
- **Buy button → `POST /api/payments/create-order`** → mock response →
  "Payment gateway coming soon" modal. Provider seam interface ready
  (`payments/provider.ts`: `createOrder`, `verifyWebhook`; MockProvider now,
  Razorpay/whatever later, zero UI change)

## v1.x — Fast follow

- **Big Table 8–10p** premium host perk (deck m=3, window rules auto-extend)
- Coin pack top-ups live (real provider wiring when owner says go)
- Claim-account (email magic link): keeps wallet/XP safe across devices
- Public room moderation tools (report, auto-expire tuning)
- Match history archive (last 20 on profile), title-unlock moments polish
- Quick Draw variant toggle (2 bullets/6 chambers for long 8–10p games)

## Later (backlog)

- Recorded voice packs (beyond TTS), Devil card variant (research/03), friends list,
  EN-IN language toggle, spectate-by-link, seasonal themes, gifting, mobile store apps

## Non-goals (never in v1)

Voice chat · real-money redemption/gambling mechanics (coins are cosmetic-only,
non-redeemable) · adult content (PG-13: no strip-club type themes — REJECTED for
payments/content policy) · ranked MMR.
