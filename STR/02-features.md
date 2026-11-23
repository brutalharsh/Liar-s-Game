# STR/02 — FEATURES (versioned)

> What ships and when. v1 = first playable release. v1.x = fast-follow. Later = backlog.
> Source: owner decisions 2026-11-23 (research/13) + follow-ups.

## v1 — Core game (FREE)

- **Liar's Deck** full rules per STR/01, 2–7 player rooms
- Three table sizes implicitly: any count 2–7; "Big Table" 8–10 is premium — the
  capacity gate is BUILT (host must hold the `capacity:big-table` entitlement;
  capacity >7 is rejected `ILLEGAL_MOVE` without it)
- Private rooms: 5-char code, invite link `/r/XXXXX`, share button
- **Public room browser**: open tables anyone can join (code, name, host nickname,
  theme, seats x/capacity, freshness); rooms auto-expire 10min idle (also enforced
  by the 10-min TTL on the `public_rooms` mirror)
- Lobby: seats fill, host controls (kick, lock, theme pick, start ≥2),
  est. match time chip, rules help drawer
- Full round loop: deal → play → windows (STR/01 §4) → reveal → shot (§6) →
  round end → win screen with rematch
- **Shooting dynamic**: self-roulette + accuser-executes-liar cinematics
- Emotes: 10 presets, 3s cooldown, mute-all
- **TTS voice lines** (no voice chat ever): spoken claims ("Two Aces!", "LIAR!"),
  kill/death/win stings, random mid-game barks (≈5% of throws); 4 voice themes
  (Villain, Chipper, Robot, Drunk) as pitch/rate/voice presets; captions toggle
- Profiles: **Discord/Google login identity** (login required to play), nickname + avatar — persistent in MongoDB
- Stats: kills (headline), catches, wins, matches, deaths, pulls survived
- **Titles** ("Best Liar" etc., full list STR/04 §6): earned server-side, 1 equipped
  (shipped registry = 11 title ids, STR/04 §6)
- **Leaderboard**: global all-time, metrics wins | kills | XP | titles; paginated
  (default 20/page, max 50), 60s server cache, banned accounts never shown
- XP + levels 1–100 (brutal curve, STR/04 §5); prestige frame every 10 levels
- Coins wallet + earn (STR/04 §2); SPEND on cosmetics
- Avatar customization: starter set free; hair/beard/hat/shirt/glasses/frame items via coins
- Themes: **The Saloon** (default) + **House Table** free; premium themes via coins
- Two designed layout modes: **Mobile portrait** (rail+wings) and **Desktop oval**
- PWA (installable, offline shell), responsive 390/768/1440, reduced-motion + colorblind modes
- Settings: voice theme + TTS preview, volumes, captions, emote mute, reduced-motion
- Security & anti-cheat per STR/08 (server-authoritative, zero hidden data)

## v1 — Auth (login REQUIRED), Admin dashboard & Payments

- **Login gate**: users sign in with **Discord or Google OAuth** before creating,
  joining or playing. JWT httpOnly cookie sessions (7-day, `lg_session`). No guest
  play. Client-side gate covers `/create`, `/join`, `/shop`, `/profile`, `/settings`;
  landing, `/rooms`, `/leaderboard`, `/how-to-play` stay public (browse-only when
  signed out). Every Socket.IO play event (`room:create`, `room:join`, `game:start`,
  `play:cards`, …) is server-gated regardless of page (`AUTH_REQUIRED`).
- **OAuth flow**: `/login` buttons are plain anchors to `GET /api/auth/{discord,google}`
  → provider → backend callback validates the one-time `lg_oauth_state` cookie,
  upserts the user, sets the session, then 302-redirects to
  `/auth/callback?status=ok|error&reason=denied|state|code|not_configured|banned|exchange`.
  The `/auth/callback` page verifies the cookie via `GET /api/auth/me` and routes
  onward (`?next=` honored only for same-origin paths).
- **Admin dashboard `/admindashboard`** (env credentials `ADMIN_USERNAME` /
  `ADMIN_PASSWORD`, timing-safe compare): full user management — searchable user
  list (avatar, level, coins, titles), profile drill-down (character/avatar spec,
  wallet ledger, payment history, match count), grant/adjust coins with reason,
  ban/unban, **catalog editing — name & price, active toggle, plus tier / levelReq /
  sort / art and full item CREATE** — coin-pack price editing, payment records
  browser, audit-trail browser, catalog-image uploads + image browser (to the
  hosted image server). Every admin mutation lands in `admin_audit`.
- **Payments: hosted payment proxy** (Razorpay behind it — identity + full
  API live in the PRIVATE gitignored `docs/` folder):
  `POST /api/billing/checkout {packId}` → price read SERVER-SIDE from the
  `coin_packs` DB table → proxy returns a hosted `checkoutUrl` → user pays there →
  returns to `/billing/return` → **backend re-verifies** status with the proxy →
  grants coins ONLY on `status === 'paid'` + exact `amountMinor` match,
  idempotent by token. Packs: ₹49/₹99/₹199/₹399 → 500/1200/2500/5500 coins.
  BLOCKED only on project registration (owner's project setup key, or manual
  creation on the provider dashboard — see private `docs/payments-api.md` —
  then paste key+id into env). Mock
  fallback until then — mock never credits anything.

## v1.x — Fast follow

- **Big Table 8–10p** premium host perk (deck m=3, window rules auto-extend)
- Payments go LIVE: flip `PAYMENTS_PROVIDER=proxy` in env after project
  registration (the backend ships fully built for the proxy)
- Session options: remember-me duration + sign-out-everywhere
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
