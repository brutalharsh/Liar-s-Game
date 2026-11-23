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

- Match **win**: `randInt(2..7)` coins (server crypto RNG at match end)
- Everyone: **+1 coin per round survived** (was alive when the round ended)
- Cap: 3 earn-events/hour/user (login identity from the start — no guest accounts)
- All grants idempotent (matchId + playerId unique index)

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

**Free**: The Saloon (default bar table), House Table (living-room felt).
**Premium (coins)**: Neon District (cyberpunk), Casino Royale, Jazz Speakeasy,
Haunted Inn, Orbital Cantina, Kabuki Alley. Each pack: background + felt + card back
variant + ambience loop, ≤1MB, lazy-loaded. Theme is chosen by the **host** and renders
for the whole room (live demo pressure to buy). ❌ No adult-content themes (rejected).

## 5. XP & levels (honest grind)

- XP per completed match: **win 12 · survived-to-end 6 · died 4**
- Levels 1–100. Threshold: `xpForLevel(L) = round(K · 1.0721^(L-1))` with `K` tuned so
  **cumulative to level 100 ≈ 10,000,000 XP ≈ owner's 10 lakh (1M) matches** at ~10 XP avg.
  (Exact K solved in code + test; recalibratable via one constant.)
- Every 10 levels: prestige **level frame** (earned-only, never purchasable).
- No purchasable XP. No XP boosts. Ever.

## 6. Titles (equip 1, shown on profile/lobby/leaderboard)

| Title | Unlock (cumulative stats) |
|---|---|
| Best Liar | 50 bluffSuccesses |
| Smooth Talker | 100 bluffSuccesses |
| Sharp Eye | 25 catches |
| Lie Detector | 100 catches |
| Dead Eye | 10 kills |
| Grim Reaper | 25 kills |
| Bar Legend | 10 wins |
| Regular | 50 matches |
| Honest Fool | 10 matches, 0 lies played |
| Cat With Nine Lives | 9 pulls survived |
| The House Always Wins | execute the same player twice in one match |
| Chicken Dinner? | first false accusation (fun-negative) |

Computed server-side at match end; unlock push + cockpit toast (never mid-round
interruption — lobby/round-end only).

## 7. Ledger invariants

- Append-only `walletLedger`: `{txId, accountId, delta, reason, refId, at}`.
- Balance = derived; spend = atomic conditional (`balance >= price`).
- Idempotency keys everywhere (grant txId = `{source}:{refId}`).
- Refunds/support = compensating entries, never edits.
