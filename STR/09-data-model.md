# STR/09 — DATA MODEL (MongoDB Atlas, db: `liars-game`)

> Mongoose 9 (CommonJS on server). Game rooms NEVER live in Mongo (process memory);
> Mongo = identity, economy, stats, catalog. Write-behind only — never blocks play.

## Collections

### users (Discord/Google identity — login REQUIRED to play)
```ts
{ _id, provider: 'discord'|'google', providerId, email?, name, avatarUrl?,
  nickname, role: 'user'|'admin', banned: false, banReason?,
  avatarSpec: {base, hair?, beard?, hat?, shirt?, glasses?, frame?, anim?, voicePack?},
  activeTitle?, xp, level, createdAt, lastSeenAt }
// idx: (provider, providerId) unique, email sparse-unique, level, banned
```

### wallet_ledger (append-only)
```ts
{ _id, accountId, delta, reason: 'match_reward'|'purchase'|'spend'|'adjust'
            |('win'|'survived_round' legacy slots, unused by the grant path),
  refId, txId, at }  // txId unique — idempotency: match grants match:<matchId>:<userId>,
                     // purchases spend:<userId>:<itemId>, billing checkout:<token>,
                     // admin adjust:<uuid>
// balance derived: sum or cached on account with periodic verify
```

### entitlements
```ts
{ _id, accountId, kind: 'item'|'theme'|'title'|'capacity', key, source, at }
// rules-engine of shop: spend → entitlement + ledger -price, ONE transaction
```

### catalog_items
```ts
{ _id: 'hair:mohawk', category: 'hair', price: 120, tier: 'common'|'rare'|'epic',
  free?: false, active: true, levelReq?,  // >0 = earned-only (never purchasable)
  artSlug?, imageId?, imageUrl?, imageName?, sort }
// themes same collection, category 'theme', subdoc theme {bg, felt, cardBack, ambience}
// idx: (active, category, sort); id = composite `category:slug`
```

### coin_packs (pricing lives in DB → admin-editable; checkout ALWAYS prices from here)
```ts
{ _id: 'starter'|'popular'|'big-bag'|'whale', name, priceMajor (INR), coins, bonus,
  active: true, sortOrder }
```

### checkouts (payment records — hosted payment proxy)
```ts
{ _id, token UNIQUE, userId, packId, productName, amountMinor, currency,
  status: 'created'|'paid'|'failed'|'expired', providerOrderId?, providerPaymentId?,
  paidAt?, grantedAt?, createdAt }
// grant idempotent — grantedAt set exactly once, only after backend status verify
```

### admin_audit (every admin dashboard mutation)
```ts
{ _id, actor, action, targetType, targetId, details, at }
```

### match_records
```ts
{ _id, matchId, roomCode, startedAt, endedAt, capacity, theme,
  players: [{ accountId, seat, nickname, avatarSpec, titleAtPlay,
    stats: { kills, catches, falseAccusations, bluffSuccesses, deaths,
             deathCause?, pullsSurvived, roundsPlayed, won, xpEarned, coinsEarned } }],
  summary: { rounds, totalPulls, dareDevilMoments } }
// idx: matchId unique, 'players.accountId', 'players.stats.kills' (sparse), endedAt
// THE ONLY source of leaderboard/XP/titles. Written once at game:over.
```

### title_progress (cache from match_records)
```ts
{ _id, accountId, titleId, unlockedAt, progress }
// unique (accountId, titleId); truth = cumulative stats recomputed on every grant
// (grant.ts); rows are the unlock ledger the profile page + `titles` metric read
```

### xp_events (REQUIRED — the grant idempotence anchor)
```ts
{ _id, accountId, matchId, xp, at }  // unique accountId+matchId
// Written FIRST inside each per-player grant transaction: duplicate key there
// means the player's grant already fully committed → a re-fired game:over no-ops
// and a crash mid-grant retries clean.
```

### match_replay_seeds (deterministic-replay envelope — economy-owned)
```ts
{ _id, matchId (UNIQUE), roomCode, seed, winnerSeat, aborted,
  log: LogEntry[] (rules-engine serialized event log), endedAt }
// Written once per match beside match_records, keyed 1:1 by matchId; input for
// the wave-2 hash chain. Duplicate = already persisted.
```

### public_rooms (registry mirror for the browser UI)
```ts
{ _id: roomCode, name, hostNickname, theme, capacity, seatsTaken,
  visibility, updatedAt }
// TTL index 10 min on updatedAt — rooms vanish when stale
```

## Derived reads

- **Leaderboard** `GET /api/leaderboard?metric=wins|kills|xp|titles&page=&perPage=`:
  wins + kills = aggregation over `match_records` (sum per account), xp = `users`
  sorted by xp, titles = counted `title_progress` rows; in-process cache 60s,
  envelope `{metric, page, perPage, total, leaderboard[{accountId, nickname,
  avatarSpec?, activeTitle?, level?, rank, value}]}`; banned/deleted accounts
  never shown; default 20/page, max 50.
- **Profile** `GET /api/me` (identical twin at `/api/me/profile`): account +
  derived coin balance + levelProgress (canonical level + percent) +
  unlockedTitleCount + **last 10** match_records (own line only, explicit
  no-PII projection — no email/provider identity).
- **Room browser** `GET /api/rooms`: paginated read of the `public_rooms` mirror
  (browser fields only — STR/08 §1).
- **Entitlements** `GET /api/me/entitlements`: the account's owned rows
  (kind: item|theme|title|capacity, key, source: purchase|free|level|…).
- **No guest merge** — Discord/Google is the identity from the first login; all
  economy rows are keyed to the user from day one.

## Notes

- Atlas M0 free tier suffices to ~200K docs; monitor, not guess.
- Databases: dev `liars-game`, production `liars-game-prod` (same Atlas cluster for
  now; dedicated prod user + rotated password before launch — STR/10 open items).
- Never query Mongo inside the socket event path (stats write async at round/game end).
- Collections above = v1; leaderboard_period variants land in v1.x.
