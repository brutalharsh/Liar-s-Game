# STR/04 — SHOP & ECONOMY

> All cosmetic. No power, no odds, no XP for money. Coins are non-redeemable soft
> currency (gambling-law distance). Source: research/08 + owner addenda 2026-11-23.

## 1. Coin packs (hosted payment proxy — Razorpay behind it; identity + full
## API in the private gitignored `docs/` folder)

| key | Price (₹, MAJOR units) | Coins | Bonus |
|---|---|---|---|
| starter | 49 | 500 | — |
| popular | 99 | 1,200 | +100 |
| big-bag | 199 | 2,500 | +350 |
| whale | 399 | 5,500 | +1,000 |

Prices live in the `coin_packs` DB collection (admin-editable via dashboard). Flow
(backend truth only): `POST /api/billing/checkout {packId}` → price read from DB,
NEVER from the request → proxy `POST /api/v1/checkout` with `amount` in MAJOR
units (49, never paise), `returnUrl = ${APP_URL}/billing/return`, `metadata
{packId}` → user pays at the hosted `checkoutUrl` → returns with
`?payment=paid&token=` → backend re-verifies `GET /api/v1/checkout/<token>` →
grant ONLY when `status === 'paid'` AND `amountMinor` matches the saved record →
idempotent wallet credit (`txId = checkout:<token>`). Checkouts expire after 30
minutes; `failed` can flip to `paid` on retry — believe only the status endpoint,
never the redirect. BLOCKED only on project registration (owner: `td_setup_…`
  key OR manual creation on the provider dashboard — see private docs/payments-api.md); until then
`PAYMENTS_PROVIDER=mock` → informational modal, credits nothing, ever.

## 2. Earning coins (no farming)

- Match **win**: `randInt(2..7)` coins; **everyone** gets **+1 coin per round
  survived**. The rules engine pre-sums both into each player's
  `stats.coinsEarned` at `game:over`; the economy seam applies that number
  verbatim as ONE **`match_reward`** ledger row (`txId = match:<matchId>:<userId>`)
  — there are no separate win/survived_round rows.
- Cap: **3 earn-events/hour/user** — enforced by counting that player's
  `match_reward` rows in the trailing hour; XP is NOT capped. Grants idempotent:
  the unique `xp_events (accountId, matchId)` anchor plus the unique ledger `txId`
  make a re-fired `game:over` a no-op.

## 3. Spending — catalog (server-validated prices, tiers)

| Category | Items v1 | Prices (coins) |
|---|---|---|
| Hair | 6 (2 free starter) | 50–150 |
| Beard | 4 (1 free) | 50–150 |
| Hat | 5 | 100–250 |
| Shirt/outfit | 6 (2 free) | 100–300 |
| Glasses | 3 | 75–150 |
| Avatar frames | 8 (2 free; 4 are LEVEL-LOCKED, not purchasable) | 150–500 |
| Idle/win/death animations | 4 (1 idle free) | 200–400 |
| Voice packs (TTS presets beyond free 4) | 2 | 250–500 |
| **Bar themes** | 6 premium | 400–800 (theme = host-level room cosmetic) |

Rules: one equip per category; server rejects un-owned equips; purchases are final
(no coin refunds v1, reversible only via support ledger entries).

## 4. Themes

**Free**: The Saloon (`saloon`, default bar table), House Table (`house-table`,
living-room felt). **Premium (coins)**: Neon District, Casino Royale, Jazz Speakeasy,
Haunted Inn, Orbital Cantina, Kabuki Alley. Each pack: background + felt + card back
variant + ambience loop, ≤1MB, lazy-loaded. Theme is chosen by the **host** and renders
for the whole room (live demo pressure to buy); on the server a theme is legal if
`saloon`/`house-table` or the host holds the matching `theme` entitlement — web-side
`house` alias normalization is a known store seam. ❌ No adult-content themes (rejected).

## 5. XP & levels (honest grind)

- XP per completed match: **win 12 · survived-to-end 6 · died 4** (0 if you left alive)
- Levels 1–100. Step cost `xpForLevel(L) = round(K · 1.0721^(L-1))` with **K = 733**
  (solved + locked in code): cumulative XP to reach level 100 =
  **10,000,496** ≈ the 10,000,000 target ≈ owner's 10-lakh (1M) matches at ~10 XP
  avg. (K is a single recalibration constant in `economy/levels.ts`.)
- Every 10 levels: prestige **level frame** (earned-only, never purchasable).
- No purchasable XP. No XP boosts. Ever.

## 6. Titles (equip 1, shown on profile/lobby/leaderboard)

Shipped server registry = **11 ids** (`economy/titles.ts`), threshold-based on
cumulative match_records stats:

| Title (id) | Unlock (cumulative stats) |
|---|---|
| Best Liar (`best-liar`) | 50 bluffSuccesses |
| Smooth Talker (`smooth-talker`) | 100 bluffSuccesses |
| Sharp Eye (`sharp-eye`) | 25 catches |
| Lie Detector (`lie-detector`) | 100 catches |
| Dead Eye (`dead-eye`) | 10 kills |
| Grim Reaper (`grim-reaper`) | 25 kills |
| Bar Legend (`bar-legend`) | 10 wins |
| Regular (`regular`) | 50 matches |
| Honest Fool (`honest-fool`) | 10 matches, 0 bluffSuccesses (the only "lies played" proxy the record carries) |
| Cat With Nine Lives (`cat-with-nine-lives`) | 9 pulls survived |
| Chicken Dinner? (`chicken-dinner`) | first false accusation (fun-negative) |

⚠️ **"The House Always Wins" (execute the same player twice in one match) is
DEFERRED**: MatchRecord stats don't record executor→victim identity, so it is not
computable today — deliberately absent rather than approximated; needs a future
engine stats field. (The web title mock is reconciled 1:1 with these 11.)

Computed server-side at match end (recomputed from match_records on every grant);
unlock push + cockpit toast (never mid-round interruption — lobby/round-end only).
Title ids are stable wire strings (`best-liar` … `chicken-dinner`).

## 7. Ledger invariants

- Append-only `walletLedger`: `{txId, accountId, delta, reason, refId, at}`.
- Balance = derived; spend = atomic conditional (`balance >= price`).
- Idempotency keys everywhere (grant txId = `{source}:{refId}`).
- Refunds/support = compensating entries, never edits.
