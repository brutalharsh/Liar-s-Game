# STR/07 — NETWORK PROTOCOL (the wire contract)

> Exact names + payloads; `packages/shared` encodes these as zod (single source).
> Deep rationale: research/06. Transport: Socket.IO over WebSocket (auto-fallback).

## 0. Handshake

- Client connects with `{ guestToken, nickname?, avatarSpec? }`.
- Reconnect: same token + `reconnectToken` (issued per room join) → server restores
  seat; 60s grace with round-pause; expired → spectator view + "seat lost" toast.
- REST stays for: `GET /api/rooms` (public list), `GET /api/leaderboard`,
  `GET /api/me` (profile+wallet), `POST /api/payments/create-order` (mock),
  `GET /api/catalog`.

## 1. Client → Server (all zod-validated; all answered by state or error)

| Event | Payload | Server rule |
|---|---|---|
| `room:create` | `{name, capacity, theme, visibility}` | → host seat, code assigned |
| `room:join` | `{code}` or invite path | seat if open; else spectator |
| `room:leave` | `{}` | seat freed / room GC'd when empty |
| `game:start` | `{}` | host only; needs ≥2 seated |
| `play:cards` | `{cardIds: 1..3}` | your turn, own cards, ≤3, pre-assert atomic w/ liar check |
| `liar:call` | `{accusedSeat}` | window legality per STR/01 §4; first-wins |
| `emote:send` | `{emoteId}` | alive-or-ghost, 3s cooldown |
| `profile:tts-say` | `{phraseId}` | OPTIONAL alternate: TTS is client-local; no audio over wire EVER |

## 2. Server → Client (view-filtered: see §3)

| Event | Payload | Notes |
|---|---|---|
| `lobby:state` | full lobby snapshot | seats, host flags, theme, est match |
| `round:new` | `{roundNo, tableCard (K/Q/A), dealtCounts}` | table card is public |
| `hand:deal` | `{cards: {id, rank}[]}` | ONLY to that player |
| `turn:begin` | `{seat, deadlineTs}` | client renders countdown from its own clock vs deadlineTs (no tick spam) |
| `play:accept` | `{seat, count, totalPile}` | face-down COUNT only, never the rank — `reveal:show` is the ONLY face-leak event |
| `window:open` / `window:close` | `{playSeat, closesAtTs} / {reason}` | 5–10p tables |
| `reveal:show` | `{cards: {id, rank}[], verdict: TRUTH/LIE, loserSeat}` | after every LIAR resolution |
| `shot:assign` | `{loserSeat, kind: SELF/EXECUTE, executorSeat?}` | per STR/01 §6 |
| `shot:result` | `{loserSeat, pulls, outcome: BLANK/LIVE}` | BLANK→`round:end`; LIVE→death anim + maybe game end |
| `round:end` | `{reason, survivorCoins, xpEarned[]}` | 2s banner |
| `game:over` | `{winnerSeat, matchRecord (public stats), rewards}` | ledger writes server-side |
| `presence:update` | `{seats: {seat, connected, afk}[]}` | for toasts/badges |
| `emote:broadcast` | `{seat, emoteId}` | bubbles |
| `error` | `{code, message, eventRef}` | user-safe, never leaks state |

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
**25^5 ≈ 9.7M** codes; join rate-limit: 10 tries/IP/10min → brute-force dead end.
Code is also the room's authority secret (knowing code = seat rights).

## 6. Race & atomicity rulings

- Node serial event loop = natural serialization. `play:cards` and `liar:call` from
  the same tick: **first processed wins**; second gets `error EVENT_STALE`.
- `holders==1` auto-call has priority over any queued action.
- Timeout actions compose as events too (identical reducer path — no client trust).
