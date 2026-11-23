# STR/09 — DATA MODEL (MongoDB Atlas, db: `liars-game`)

> Mongoose 9 (CommonJS on server). Game rooms NEVER live in Mongo (process memory);
> Mongo = identity, economy, stats, catalog. Write-behind only — never blocks play.

## Collections

### accounts
```ts
{ _id, guestToken, claimedAt?, email?, authHash?, nickname, isGuest,
  avatarSpec: {base, hair?, beard?, hat?, shirt?, glasses?, frame?, anim?, voicePack?},
  activeTitle?, xp, level, createdAt, lastSeenAt }
// idx: guestToken unique, email sparse-unique, level (leaderboard)
```

### wallet_ledger (append-only)
```ts
{ _id, accountId, delta, reason: 'win'|'survived_round'|'purchase'|'spend'|'adjust',
  refId, txId, at }  // txId unique — idempotency: `${reason}:${refId}`
// balance derived: sum or cached on account with periodic verify
```

### entitlements
```ts
{ _id, accountId, kind: 'item'|'theme'|'title'|'capacity', key, source, at }
// rules-engine of shop: spend → entitlement + ledger -price, ONE transaction
```

### catalog_items
```ts
{ _id: 'hair:mohawk', category: 'hair', price: 120, tier: 'common',
  free?: false, active: true, artSlug, sort }
// themes same collection, kind 'theme' {bg, felt, cardBack, ambience}
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
// recompute-on-read from match_records (cheap at v1 scale), cache for profile page
```

### xp_events (optional audit)
```ts
{ _id, accountId, matchId, xp, at }  // unique accountId+matchId
```

### public_rooms (registry mirror for the browser UI)
```ts
{ _id: roomCode, name, hostNickname, theme, capacity, seatsTaken,
  visibility, updatedAt }
// TTL index 10 min on updatedAt — rooms vanish when stale
```

## Derived reads

- **Leaderboard** `GET /api/leaderboard?metric=wins|kills|xp|titles`:
  aggregation pipeline over `match_records` (sum per account), cached 60s.
- **Profile** `GET /api/me`: account + balance + title_progress + last 5 match_records.
- **Guest → claim merge**: accountId stays; email attaches; guestToken rotates;
  one atomic update; wallet/entitlements unaffected (all keyed by accountId).

## Notes

- Atlas M0 free tier suffices to ~200K docs; monitor, not guess.
- Never query Mongo inside the socket event path (stats write async at round/game end).
- Collections above = v1; leaderboard_period variants land in v1.x.
