# STR/07 — NETWORK PROTOCOL (the wire contract)

> Exact names + payloads; `packages/shared` encodes these as zod (single source).
> Deep rationale: research/06. Transport: Socket.IO over WebSocket (auto-fallback).

## 0. Handshake & auth (login REQUIRED to play)

- **Web session first**: Discord/Google OAuth → JWT httpOnly cookie
  (`lg_session`, 7-day, payload `{sub: userId}`). The Socket.IO handshake carries
  the cookie; the server resolves it into `socket.data.user` (unauthenticated
  sockets may connect as spectators). No session → play events (`room:create`,
  `room:join`, `game:start`, in-round actions) are denied with `error AUTH_REQUIRED`.
- **Reconnect**: seats bind to USER IDs, not sockets; the **room code is the seat
  authority** (§5 — there is NO reconnectToken). Re-join = same session +
  `room:join {code}`, which always answers with a fresh full per-seat snapshot
  (`reconnected: true` in the ack drives the "Welcome back" banner). Drop grace:
  60s with round-pause; after grace the seat is ABANDONED ("seat lost", engine
  auto-plays it — rejoin shows the seat but rejects further action input from it).
- **REST surface** (as shipped on `apps/server`; all bodies zod-validated,
  errors are `{error: CODE}`):
  - **Health**: `GET /api/health`
  - **Auth**: `GET /api/auth/discord` (+ `/discord/callback`),
    `GET /api/auth/google` (+ `/google/callback`), `GET /api/auth/me`,
    `POST /api/auth/logout`. Callbacks redirect to the web app at
    `/auth/callback?status=ok|error&reason=…` (state cookie `lg_oauth_state`).
  - **Admin** (env-credential login → `lg_admin` cookie, 8h; login 5/15min,
    surface 30/min): `POST /api/admin/login`, `POST /api/admin/logout`,
    `GET /api/admin/users` (+`?search=&page=`), `GET /api/admin/users/:id`,
    `POST /api/admin/users/:id/coins`, `POST /api/admin/users/:id/ban`,
    `GET /api/admin/payments` (+status/page), `GET /api/admin/catalog`,
    `POST /api/admin/catalog`, `PATCH /api/admin/catalog/:id` (name/price/
    active/tier/levelReq/art), `GET /api/admin/packs`, `PATCH /api/admin/packs/:key`,
    `POST /api/admin/upload` (raw image body, ≤10MB), `GET /api/admin/images`,
    `GET /api/admin/audit`
  - **Billing** (10/min, authed): `POST /api/billing/checkout {packId}` →
    `{checkoutUrl, token}` (mock → `{mock:true, checkoutUrl:null}`);
    `POST /api/billing/verify {token}` → status (server grants on paid+match only)
  - **Game/store**: `GET /api/rooms` (public list, paginated), `GET /api/leaderboard`
    (+`?metric=wins|kills|xp|titles&page=&perPage=`), `GET /api/me` (profile,
    = `GET /api/me/profile` twin), `GET /api/me/entitlements`,
    `GET /api/catalog`, `POST /api/shop/purchase {itemId}`

## 1. Client → Server (all zod-validated; all answered by state or error)

Every event also answers a Socket.IO **ack**: `{ok: true, data} | {ok: false,
error: {code, message}}` — ack data: `room:create → {roomCode}`,
`room:join → {roomCode, spectator, yourSeat, reconnected}` (reconnected is an
extra hint for the "Welcome back" banner), others `null` or `{seq}` for
play/call. Rejections ALSO emit the `error` event (§2) to the offending socket.

| Event | Payload | Server rule |
|---|---|---|
| `room:create` | `{name, capacity, theme, visibility}` | → host seat 0, code assigned; capacity 2–7 free, 8–10 needs the HOST's `capacity:big-table` entitlement; theme must be `saloon`/`house-table` or owned |
| `room:join` | `{code}` or invite path | seat if open (seats bind to user IDs — known members always land); else spectator |
| `room:leave` | `{}` | lobby: seat freed / room GC'd when empty; mid-match: engine LEAVE |
| `game:start` | `{}` | host only; needs ≥2 seated (bot seats count) |
| `play:cards` | `{cardIds: 1..3 unique}` | your turn, own cards, ≤3, pre-assert atomic w/ liar check |
| `liar:call` | `{accusedSeat}` | window legality per STR/01 §4; first-wins |
| `emote:send` | `{emoteId}` | alive-or-ghost (seated only), 3s cooldown, server `EMOTE_CATALOG` whitelist |
| `profile:tts-say` | `{phraseId}` | OPTIONAL alternate: TTS is client-local; no audio over wire EVER (validated no-op server-side) |

## 2. Server → Client (view-filtered: see §3)

**Every payload carries a required monotonic `seq`** (per-room, strict-zod-checked
— the leak tripwire). Payloads below show the fields beyond `seq`:

| Event | Payload (beyond seq) | Notes |
|---|---|---|
| `lobby:state` | full `RoomState` snapshot: `{roomCode, name, capacity, theme, visibility, phase, hostSeat, seats[], you, spectator, seq, roundNo?, tableCard?, currentTurnSeat?, deadlineTs?, pileTotal?, challengeWindow?, estMatchMinutes}` | `you` = owner's own state (hand ranks legal HERE only); null for spectators; also THE catch-up snapshot on every (re)join; seat views may carry `isBot` |
| `round:new` | `{roundNo, tableCard (K/Q/A), dealtCounts: [{seat, count}]}` | table card is public |
| `hand:deal` | `{cards: {id, rank}[]}` | ONLY to that player's own sockets |
| `turn:begin` | `{seat, deadlineTs}` | client renders countdown from its own clock vs deadlineTs (no tick spam) |
| `play:accept` | `{seat, count, totalPile}` | face-down COUNT only, never the rank — `reveal:show` is the ONLY face-leak event |
| `window:open` / `window:close` | `{playSeat, closesAtTs} / {reason: belief\|expired\|liar_called}` | 5–10p tables |
| `reveal:show` | `{cards: {id, rank}[], verdict: TRUTH/LIE, loserSeat}` | after every LIAR resolution (incl. forced auto-calls) |
| `shot:assign` | `{loserSeat, kind: SELF/EXECUTE, executorSeat? (iff EXECUTE)}` | per STR/01 §6 |
| `shot:result` | `{loserSeat, pulls (1–6), outcome: BLANK/LIVE}` | BLANK→`round:end`; LIVE→death anim + maybe game end |
| `round:end` | `{reason: survived/death, survivorCoins, xpEarned[]}` | 2s banner; xpEarned usually empty mid-match, filled on the final round |
| `game:over` | `{winnerSeat (nullable = zero-survivor abort), matchRecord, rewards[]}` | ledger writes server-side via grantMatchRewards; bot seats never grant |
| `presence:update` | `{seats: {seat, connected, afk}[]}` | for toasts/badges (afk = abandoned/disconnected) |
| `emote:broadcast` | `{seat, emoteId}` | bubbles |
| `error` | `{code, message, eventRef}` | user-safe, never leaks state |

Stable vocabularies: shared `ERROR_CODES` (VALIDATION, EVENT_STALE, NOT_YOUR_TURN,
ILLEGAL_MOVE, NOT_IN_ROOM, NOT_HOST, ROOM_NOT_FOUND, ROOM_FULL, RATE_LIMITED,
UNAUTHORIZED, INSUFFICIENT_PLAYERS, INTERNAL) is the pinned union; the GAME layer
emits its own mirror (`GAME_ERROR_CODES`, plus `AUTH_REQUIRED` for missing
sessions) and rules-engine rejections ride their typed `ERR_*` codes verbatim
(`ERR_NOT_YOUR_TURN`, `ERR_FIRST_PLAY`, `ERR_SELF_CHALLENGE`, `ERR_ABANDONED`,
`ERR_WINDOW_NOT_ARMED`, …) through the same `error` envelope.

## 3. View filtering (THE anti-cheat table)

| Data | Owner player | Other players | Spectator |
|---|---|---|---|
| Own hand (ranks) | YES | — | — |
| Others' hands (ranks) | **NEVER** (not even counts of ranks) | Same | Same |
| Pile played cards | own played: known client-side | face-down count only | count only |
| bulletPos (chamber index) | **NEVER SENT TO ANYONE** (not even the owner's own client) | — | — |
| Public counters `(pulled/6)` | YES | YES | YES |
| Deck size / leftovers | total size only | same | same |
| Wallet balances | own only | leaderboard aggregates only | — |

Post-reveal, of course, revealed cards' ranks go to everyone (that's `reveal:show`).

## 4. Clocks

All timing = server **deadline timestamps** in payloads (`deadlineTs`, `closesAtTs`);
clients compute remaining locally. Server is the only one who *acts* on expiry.
One catch-up snapshot on (re)join; then deltas with monotonic `seq` per room.

## 5. Room codes

5 chars, charset `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I/L/O/0/1) =
**31^5 ≈ 28.6M** codes (31-char confusable-free set — count verified by F1; my original 25^5 was a miscount); join rate-limit: 10 tries/IP/10min → brute-force dead end.
Code is also the room's authority secret (knowing code = seat rights).

## 6. Race & atomicity rulings

- Node serial event loop = natural serialization. `play:cards` and `liar:call` from
  the same tick: **first processed wins**; second gets a typed engine rejection
  (e.g. `ERR_NOT_YOUR_TURN` / `ERR_WINDOW_NOT_ARMED` — the pinned vocabulary name
  `EVENT_STALE` exists in shared but is not currently emitted by the engine).
- `holders==1` auto-call has priority over any queued action.
- Timeout actions compose as events too (identical reducer path — no client trust).
- Judging your OWN just-played cards is structurally impossible (same-tick
  first-wins + `ERR_SELF_CHALLENGE`); a LIAR at exactly `armedAt`/`closesAt` is
  legal, late CHECKs are rejected even before `WINDOW_EXPIRE` processes.
