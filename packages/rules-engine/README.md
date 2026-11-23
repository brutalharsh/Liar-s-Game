# @liars-game/rules-engine

Pure TypeScript Liar's Deck engine per **STR/01** (incl. owner amendments A1
execution dynamic · A2 challenge windows · A3 deck scaling · A4 timers) and
research/02 §9's 28-step loop. Zero IO: no sockets, fs, express, zod; the only
impurity by design is the **injected RNG port**. Server-authoritative by
construction — hidden values (`bulletPos`, hands, leftovers) never appear in
any `Effect` meant for general broadcast (STR/07 §3; `toPublicSnapshot` +
`chamberBadge` exist for exactly this).

## S1 integration sketch (apps/server)

```ts
import { createMatch, apply, toPublicSnapshot, chamberBadge, logEnvelope, SeededRng } from '@liars-game/rules-engine';
import { randomInt } from 'node:crypto';

// PRODUCTION PATTERN — replay-guaranteed: crypto-minted seed drives the
// ball-striking stream; persist (seed, log) and `replay()` reproduces the match.
const seed = randomInt(0, Number.MAX_SAFE_INTEGER);
let state = createMatch({ roster, matchId, roomCode, theme, seed });      // phase: LOBBY
const r = apply(state, { type: 'MATCH_START', at: Date.now() });          // bullets rolled, round 1 dealt
state = r.state; room.broadcastAll(r.effects);                             // map Effect → STR/07 event

// on socket event (zod-parse first per STR/07):
const res = apply(state, { type: 'PLAY', seat, cardIds, at: Date.now() });
if (res.err) { socket.emit('error', { code: res.err.code, message: res.err.message }); }
else { state = res.state; room.route(res.effects); }                       // HAND_DEALT → that seat only
```

Timer wheel (server-owned; engine validates clocks): at `turn.deadline` →
`TURN_TIMEOUT`; at `window.closesAt` → `WINDOW_EXPIRE`; at
`disconnectedAt + config.disconnectGraceMs` → `ABANDON` (then timeouts
auto-play the seat — "drunk under the table"). Cinematic pacing between beats
is exactly what `REVEAL_ACK` / `SHOT_ACK` / `NEXT_ROUND` exist for: every
outcome is already computed and frozen in `state.round.resolution` — no
client trust ever enters.

## Effect → STR/07 socket-event mapping

| Effect | Socket event | Notes |
|---|---|---|
| `MATCH_STARTED` | — (internal intro) | starterSeat public |
| `ROUND_STARTED` | `round:new` | tableCard + dealt counts public |
| `HAND_DEALT` | `hand:deal` | **route to that seat ONLY** |
| `TURN_STARTED` | `turn:begin` | seat + deadline (client renders countdown) |
| `PLAYED` | `play:accept` | COUNT only; `auto` marks timeout/disconnect plays |
| `WINDOW_OPENED` / `WINDOW_CLOSED` | `window:open` / `window:close` | 5–10p only |
| `REVEALED` | `reveal:show` | the only face-leak event |
| `SHOT_ASSIGNED` | `shot:assign` | SELF / EXECUTE_BY_ACCUSER(+executorSeat) |
| `SHOT_RESULT` | `shot:result` | BLANK → round:end path; LIVE → death |
| `ROUND_ENDED` | `round:end` | reason + dareDevil flag |
| `GAME_OVER` | `game:over` | full MatchRecord (STR/09 payload) |
| `PRESENCE` | `presence:update` | disconnect/reconnect/abandon/leave |

Driver events (`MATCH_START`, `BEGIN_TURNS`, `REVEAL_ACK`, `SHOT_ACK`,
`NEXT_ROUND`) advance the FSM between broadcast beats; player events are
`PLAY`, `LIAR`, `STAGE`, `TURN_TIMEOUT`, `WINDOW_EXPIRE`, `DISCONNECT`,
`RECONNECT`, `ABANDON`, `LEAVE`. Every rejection carries a typed `ErrCode`
(set mirrors STR/07 `error{code,message}`).

## Public API

- `createMatch({ roster, matchId?, roomCode?, theme?, config?, seed | rng })` → `GameState` (LOBBY). Roster seats must be exactly `0..N-1` (ascending = counter-clockwise).
- `apply(state, event) → { state, effects, err? }` — pure reducer; input never mutated; rejected events touch nothing but the log.
- `replay({ roster, …, seed, events })` → bit-exact re-run from `(seed, log)`; `stripRuntime(state)` for equality checks; `logEnvelope(state)` feeds P1's hash-chain (task 111).
- `toPublicSnapshot(state, viewerSeat?)`, `chamberBadge(player)` — view-filtering helpers; **never leak `bulletPos`** (asserted by tests).
- `buildDeck(m)`, `deckModulesFor(N)` (A3: m=ceil(N/4)), `containsLie`, `dealHands`, `HAND_SIZE`.
- `assignShotKind(loserRole, rng)` (A1), `turnTimerMs(config, aliveCount)`, `challengeModeFor(config, aliveCount)`, `fisherYatesShuffle(...)`.
- RNG: `RngPort` (`int(min,max)`/`pick`/`shuffle`), `NodeCryptoRng` (node:crypto `randomInt`), `SeededRng` (splitmix64→xoshiro256**, exact rejection sampling — safe for bullets/cards AND unpredictable from partial public output).

Config knobs (STR/01 defaults, G2 balance touchpoints): `fastMode` (10s),
`turnTimerMsOverride`, `windowMode: 'auto' | 'next-only' | 'open-window'`,
`armDelayMs` (2s), `windowMs` (10s), `disconnectGraceMs` (60s).

## Interpretations locked while the owner slept (all recorded in the mission report)

1. False-accusation starter = **next living ccw after the previous round's starter** (STR/01 §2.3 literal), NOT the research/02 §9 step-26 loser-first reading.
2. Timers AND challenge-mode default **follow the current ALIVE count** (not lobby size); config overrides exist for both.
3. Forced auto-calls credit `catches`/`falseAccusations` to the forced caller like any challenge (uniform stat semantics).
4. Empty-handed players MAY `LIAR` in open-window mode ("ANY living player except the accused") but never in next-only mode (no turn = no challenge right).
5. `dareDevilMoments` = survived 50/50 pulls (5th pull survived — the only survivable coin-with-death).
6. `pullsSurvived` counts BLANK pulls only (fatal pull excluded). Winner coins = `roundsSurvived + randInt(2..7)`; everyone gets +1 coin per round survived (STR/04 §2), leavers included — the ledger/anti-farm caps live in S1/E1.
7. XP (STR/04 §5 encoded here): win 12, died 4, survived-to-end 6, left-alive 0.
8. Abort: `<2 connected-and-alive humans` → last one wins by default (`aborted: true`); zero remain → `winnerSeat: null`. Deferred while REVEAL/SHOT are in flight so the pending roulette always resolves.
9. Disconnect = flag + 60s grace; auto-play then (never auto-call/eliminate). LEAVE and grace-expiry (`ABANDON`) both mark the seat lost.
10. `LIAR` at exactly `armedAt` or `closesAt` is legal (inclusive); a late `CHECK` (after closesAt) is rejected even if `WINDOW_EXPIRE` hasn't been processed yet; play+call same-tick: first processed wins, second is a typed error — judging the caller's own just-played card is structurally impossible.

## Commands

```bash
npm test -w packages/rules-engine        # 132 cases green (vitest 5)
npm run typecheck -w packages/rules-engine
npm run build -w packages/rules-engine   # -> dist/ CommonJS + .d.ts
```
