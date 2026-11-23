# 11 — Final Tech Stack, Repo Structure & Build Plan

> Deep-dive owner: stack + architecture. Researched 2026-11-23 against live npm registry,
> Socket.IO/Vercel/Next.js/Express official docs. Owner preference rule applied: we stay on
> **Next.js (App Router) + TypeScript + Tailwind / Express (CommonJS) + MongoDB (Mongoose) / npm** —
> we do NOT switch languages. Where owner preference collides with a hard 2026 fact (Next.js 14
> is out of support), we keep the spirit of the preference and bump within the same stack.

---

## 1. Architecture verdict: npm-workspaces monorepo, 2 apps + 2 packages

One repo. The game *rules* must be importable by both the server (authority) and the web app
(typing + tests), and shared event schemas must be the single forbidden-to-drift wire contract.
npm workspaces handles this without extra tooling (https://docs.npmjs.com/cli/v11/using-npm/workspaces);
no Turborepo/Nx needed at our scale.

**Note on Next.js version (the one deviation from preference):** owner's config says
"Next.js 14", but per the official support policy (https://nextjs.org/support-policy) only
**16.x (Active LTS)** and **15.x (Maintenance LTS, security fixes until 31 Jan 2027)** are
supported; **14.x is unsupported since Oct 26, 2025** and receives none of the 2026 security
releases — including two critical RCEs fixed in 16.4.1/15.5.28
(https://nextjs.org/blog/november-2026-security-release). So: **Next.js 16.4.x, App Router** —
same mental model as 14, React 19, Tailwind v4. Nothing about the plan below changes if the
owner insists on 15.5.29 as a stopgap; avoid 14.

**CRA/Vite relevance:** create-react-app was deprecated for new apps in Feb 2025
(https://react.dev/blog/2025/02/14/sunsetting-create-react-app) — moot for us: Next.js is
React's recommended framework. Vite 8 (https://vite.dev/) is *not* used — our app has real
SSR-able marketing/store pages + metadata needs.

```text
liars-bar/
├── package.json                  # private, "workspaces": ["apps/*", "packages/*"], root scripts
├── package-lock.json
├── .gitignore                    # ignores .env*, node_modules, dist, replay logs
├── README.md
├── engines                       # node >= 22.12 (LTS 24 in prod) — needed for require(esm)
│
├── apps/
│   ├── web/                      # Next.js 16, App Router, TS, Tailwind v4 (all "use client" where needed)
│   │   ├── next.config.ts
│   │   ├── src/app/
│   │   │   ├── layout.tsx                  # providers (SocketProvider, AudioProvider)
│   │   │   ├── page.tsx                    # landing / marketing
│   │   │   ├── how-to-play/page.tsx
│   │   │   ├── store/page.tsx              # premium themes gallery (P3)
│   │   │   ├── play/page.tsx               # lobby: create / join by room code, seat picker
│   │   │   ├── room/[code]/page.tsx        # THE GAME — single client-heavy island (see §5)
│   │   │   ├── manifest.ts                 # PWA manifest via Next file convention (no plugin)
│   │   │   └── api/health/route.ts
│   │   ├── src/components/                 # <Table> <Seat> <Hand> <PlayedPile> <Gun> <RouletteHud>…
│   │   ├── src/stores/                     # zustand: game.ts, ui.ts, audio.ts (see §5)
│   │   ├── src/lib/socket.ts               # singleton socket.io-client instance
│   │   ├── src/lib/audio.ts                # howler wrappers (+ iOS unlock)
│   │   └── src/motion/                     # motion variants/timelines (throw, reveal, gun, death)
│   │
│   └── server/                  # Express 5 + Socket.IO — CommonJS ("type" absent), THE authority
│       ├── src/index.js                    # createServer(app) + io attached + listen(PORT)
│       ├── src/config.js                    # dotenv; env parsed by zod (fail fast on boot)
│       ├── src/http/routes/                # REST: /auth, /purchase-webhook, /store, /leaderboard
│       ├── src/http/middleware/            # helmet, express-rate-limit, jwt verify, error handler
│       ├── src/rooms/RoomManager.js        # Map<roomCode, {state, sockets, timers, version, replay}>
│       ├── src/rooms/eventHandlers.js      # pipeline: validate → mutate → broadcast (§4)
│       ├── src/rooms/snapshot.js           # per-player perspective filter (hides other hands)
│       ├── src/rooms/timers.js             # 30s turn deadline, reconnect grace
│       ├── src/replay/recorder.js           # JSONL append per room (debugging, §4)
│       └── src/db/                         # mongoose 9 models: Account, Purchase, MatchSummary
│
├── packages/
│   ├── shared/                  # TS + zod: wire contract, safe to import both sides
│   │   └── src/  (events.ts, schema.ts, ids.ts, errors.ts, config.ts, index.ts)
│   ├── rules-engine/            # PURE TS game logic, zero IO, zero imports of apps — THE core
│   │   ├── src/  (state.ts, heads.ts, deck.ts /*dealer+scaling*/, play.ts,
│   │   │           challenge.ts /*call-liar validation + resolution*/, roulette.ts,
│   │   │           advance.ts /*phase transitions*/, rng.ts /*seedable, injectable*/, index.ts)
│   │   └── tests/              # vitest table-driven suite (§6)
│   ├── eslint-config/          # (optional; single flat config shared by all workspaces)
│   └── tsconfig/               # shared base tsconfigs (app, cjs, package)
```

Module-system note: `packages/*` ship TS source (`"main": "src/index.ts"`). Next compiles
workspace TS natively; the server runs under **tsx** in dev AND prod (esbuild under the hood),
with a separate `npm run typecheck` (tsc -b --noEmit) to catch what tsx silently allows. If we
later want bare `node` in prod, add a tsc build to CJS — 30 minutes of work, not worth it day 1.

## 2. Why web and server are separate processes, and how they deploy

The Vercel limitation (the load-bearing fact for this whole section):

- Socket.IO's official Next.js guide: *"You won't be able to deploy your application on Vercel,
  as it does not support WebSocket connections"* — for the custom-server pattern we need
  (https://socket.io/how-to/use-with-nextjs).
- Next.js docs, custom server page: *"A custom server removes important performance optimizations… A
  custom server cannot be deployed on Vercel"*
  (https://nextjs.org/docs/pages/building-your-application/configuring/custom-server).

But nuance (2026 fact): Vercel Functions **now** serve WebSockets — GA since Oct 20, 2026
(https://vercel.com/changelog/websocket-support-is-now-generally-available,
https://vercel.com/docs/functions/websockets). It still does NOT fit us, because:

1. **Connections pin to ONE function instance** — "messages … are delivered to the Vercel Function
   instance that accepted the connection"; cross-instance state must live in external Redis
   (Vercel's own chat example adds Upstash). Our RoomManager-in-memory model would break.
2. **Socket.IO must drop its HTTP long-polling fallback** (`transports: ['websocket']` "required")
   — we lose the fallback that rescues players behind carrier/proxy NAT (our exact mobile audience).
3. **Billing**: "Provisioned Memory bills for the instance lifetime, so an open connection keeps
   its instance billable until it closes" — idle sockets in hour-long game sessions haemorrhage
   money vs a $6 VPS.

So the game server is a **long-lived Node process**. Two supported topologies:

- **Plan A (recommended for P0→P3, simplest): both on one cheap VPS.**
  nginx (Caddy also fine) reverse-proxies: `/` → Next standalone (:3000),
  `/socket.io/` → game server (:4001). One origin → no CORS, no split-domain config, no
  candy js needed to glue. A 2-vCPU/4GB box holds hundreds of concurrent rooms; rooms are small.
- **Plan B (fine too): web on Vercel Hobby (free) + game server on VPS.**
  Zero infra work for the frontend, instant deploys on `git push`. Cost: cross-origin
  (`wss://play.example.com` subdomain, CORS allowlist in socket.io options + cookie/domain
  care), and the game still dies when the VPS dies either way.

We start on Plan A with Docker Compose or plain pm2/systemd; moving web to Vercel later is a
Vercel-project-create away (~half a day, mostly DNS). **Scaling out is a later non-problem**: at
2–7 players/room we fit thousands of rooms per process; when needed, socket.io's Redis adapter
+ sticky sessions is the documented path (https://socket.io/docs/v4/using-multiple-nodes/).
MongoDB: Atlas free tier M0 is plenty (accounts, purchases, match summaries — nothing hot;
room state itself lives in server memory, Redis optional later).

Web↔server protocol summary: REST (`/api` on server) for account, theme purchase/webhook,
leaderboards; Socket.IO for ALL room interaction (join, seats, plays, challenges, chat, spectate).
If the server restarts mid-match, RoomManager can rehydrate a room from its last JSONL
replay checkpoint (graceful recovery; not a P0 requirement).

**Express 5 verdict:** Express is at **5.3.0**, `latest` on npm since 5.1.0 (Mar 31 2025) —
the 5.x line is the "ACTIVE" line under Express's new LTS policy, EOL "no sooner than 2027-04"
(https://expressjs.com/en/blog/2025-03-31-v5-1-latest-release,
https://expressjs.com/en/changelog). Express 5 supports **CommonJS** out of the box
(`type: commonjs` in registry), works with async error handling, and is boring in the good way.
Owner preference honored: **Express 5.3 CommonJS.**

## 3. Libraries (versions verified from npm registry on 2026-11-23)

| Package | Ver | One-line rationale |
|---|---|---|
| express | 5.3.0 | Owner's framework; async-error support in 5; CJS-compatible; ACTIVE line. |
| socket.io / socket.io-client | 4.8.4 | Rooms, acks, auto-reconnect, long-polling fallback; the multiplayer backbone. |
| zod | 4.6.7 | Single source of truth for event validation, shared both sides; ships CJS+ESM so `require()` works in the server. |
| mongoose | 9.12.3 | **Picked over native driver**: our Mongo use is tiny (accounts/purchases/summaries), validation+hooks save us a hand-rolled layer — strict owner preference; use `.lean()` reads, escape hatch `mongoose.connection.db` if ever needed (https://markaicode.com/vs/mongoose-vs-native-mongodb/). |
| zustand | 5.1.0 | Client store mirroring server room state; tiny, no provider ceremony. |
| motion (formerly framer-motion — same package renamed; keep `motion/react`) | 14.14.0 | Declarative card throws, flips, gun shakes; AnimatePresence for reveals/deaths; no other candidate close. |
| howler | 2.2.4 | Dead-simple positional sfx (click, flip, gunshot, heartbeat); old but frozen-stable and tiny; iOS-unlock helper needed. |
| canvas-confetti | 1.9.4 | Win screen + celebration; do not hand-roll confetti. |
| nanoid | 6.0.2 | Web-side IDs fine; server room codes use `customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 4)` (ESM-only since v4 — `require()` loads it on Node ≥22.12 per README https://github.com/ai/nanoid, else `crypto.randomInt` — either is fine). |
| xstate | 5.33.4 | **Verdict: skip.** Five-phase game loop fits rules-engine as explicit discriminated-union states + exhaustive `switch` (broader state machine reviewer: PRs would add learning cost); add it later only if debugging phase bugs gets hairy (its visualization would help). Do NOT serialize client animation sequencing through xstate — framer-motion timelines suffice. |
| dotenv | 18.0.10 | Server secrets loading (Next loads its own env files). |
| express-rate-limit | 8.7.5 | Throttle REST auth/store endpoints. |
| helmet | 8.3.0 | Default security headers on the Express side. |
| jsonwebtoken | 9.0.3 | **Picked vs cookie sessions**: stateless guest/registered auth shared between Next HTTP routes and the Socket.IO handshake (`auth: { token }`) with ONE secret and no session store couple —mongodb sessions (express-session + connect-mongo) rejected as needless infra. httpOnly-cookie carries it on web page loads. |
| PWA manifest "plugin" | — | **None.** Next.js has a native `app/manifest.ts` convention and an official PWA guide (https://nextjs.org/docs/app/guides/progressive-web-apps). next-pwa is DEAD (last real release 2022; archived) — if we ever want a real offline-shell service worker, the maintained successor is Serwist 9.x (https://serwist.pages.dev/docs/next/getting-started) — but a live multiplayer game needs the network anyway, so P0–P2 is manifest+icons only. |
| tsx | 4.23.15 | Dev watch + prod runtime for CommonJS server loading TS workspaces. |
| vitest | 5.1.1 | Tests for rules-engine + socket integration (§6). |
| tailwindcss | 4.3.5 | Owner's styling stack; v4 works with Next 16 via `@tailwindcss/postcss`. |

Also: `concurrently` (or npm-run-all2) at root for `npm run dev`. No Socket.IO alternative
(plain `ws` means rebuilding rooms/acks/reconnect for no benefit at 2–7 players).

## 4. Game engine pattern: pure functions, server as authority

rules-engine is **state-in → state-out pure functions** with an **injectable RNG** (seedable,
so tests are exact and replays are deterministic). No IO, no sockets, no DB, no `Date.now()` —
time and randomness are always arguments. The server owns the only mutable copy.

Server-side per-event **pipeline** (single authority, in RoomManager):

```text
onEvent(socket, raw):
  1 parse     zod parse raw against shared schema        (reject → error ack)
  2 authz     is this socket's player in this room/seat, alive, is it their turn, in-phase?
  3 compute   const { state, effects } = rulesEngine.someMove(room.state, input, rng, now)
  4 apply     room.state = state; room.version++          (single-threaded event loop = free mutex)
  5 emit      broadcast effects + per-player snapshot     (io.to(room).emit; snapshot filters hands)
  6 log       recorder.append(roomCode, { v, event, stateHash }) for replay/debugging
```

Broadcast model: emit small **typed delta events** (for animations) *and* a per-player
**snapshot** with version. Client applies deltas it can, falls back to the snapshot on gap —
correctness never depends on the network being perfect.

### 4.1 Core state (packages/rules-engine/src/state.ts)

```ts
export type Rank = 'K' | 'Q' | 'A';
export type Card = Rank | 'JOKER';                  // JOKER is wild: always "truth"
export type PlayerId = string;

export interface Player {
  id: PlayerId; name: string; seat: number;
  hand: Card[];                                    // own cards (authoritative copy here only)
  alive: boolean; connected: boolean;
  pullsThisMatch: number;                          // for stats/HUD (n/6 display)
}

export interface Revolver { playerId: PlayerId; liveAt: 1|2|3|4|5|6; pulled: number } // liveAt FIXED at match start

export interface PlayedPile { playerId: PlayerId; cards: Card[] }     // face-down play this round

export type Phase =
  | 'lobby' | 'dealing' | 'playing' | 'reveal' | 'roulette' | 'roundEnd' | 'gameOver';

export interface RoomState {
  roomCode: string;
  phase: Phase;
  players: Player[];                 // ordered by seat; play proceeds counter-clockwise
  roundNumber: number;
  tableCard: Rank | null;            // dealt from the 3-card table deck {K,Q,A}
  tableDeck: Rank[];                 // remaining table cards (new one each round)
  deck: Card[];                      // draw pile — SCALED for player count (§6, test 7)
  discard: PlayedPile[];              // this round's face-down plays, in order
  turn: number;                      // index into players for whose move it is
  turnDeadline: number;              // now + 30_000, passed in by server
  revolvers: Revolver[];
  winner: PlayerId | null;
}
```

### 4.2 Challenge resolution (challenge.ts) — the heart of the game

```ts
export interface RevealResult {
  accusedId: PlayerId; accuserId: PlayerId; cards: Card[]; allTruth: boolean;
  loserId: PlayerId; reason: 'liar_exposed' | 'false_accusation';
}

/** PURE: only the NEXT player may call; validation happens before this if needed. */
export function resolveChallenge(s: RoomState, accuserId: PlayerId, now: number) {
  const last = s.discard[s.discard.length - 1];
  const allTruth = last.cards.every(c => c === s.tableCard || c === 'JOKER');
  const loserId = allTruth ? accuserId : last.playerId;      // whole play is judged together
  const state: RoomState = {
    ...s, // (immutable style; deep-copy hands via helper in real code)
    phase: 'roulette',
    // reveal payload rides in `effects` for broadcast; state advances to roulette phase
  };
  return { state, effects: [{ t: 'revealed', result: { accusedId: last.playerId, accuserId, cards: last.cards, allTruth, loserId, reason: allTruth ? 'false_accusation' : 'liar_exposed' } satisfies RevealResult }] };
}
```

### 4.3 Russian Roulette (roulette.ts) — odds sequence visible in code

```ts
export interface PullOutcome { playerId: PlayerId; chamber: number; survived: boolean; eliminated: boolean }

/**PURE — liveAt is fixed at match start, so odds are 1/6 → 1/5 → … → 6th pull ALWAYS fatal. */
export function pullTrigger(r: Revolver): PullOutcome {
  const chamber = r.pulled + 1;                    // 1..6
  const survived = chamber !== r.liveAt;           // pulls < liveAt survive; on liveAt it fires
  return { playerId: r.playerId, chamber, survived, eliminated: !survived };
}
// property to test: across liveAt 1..6, exactly liveAt-1 blanks then death —
// survival probabilities 5/6, 4/6, 3/6, 2/6, 1/6, 0 … i.e. TheGamer's 83/80/75/67/50/0 table.
```

### 4.4 Wire contract (packages/shared/src/events.ts) — zod discriminated unions

```ts
import { z } from 'zod';
export const CardZ = z.enum(['K', 'Q', 'A', 'JOKER']);

export const ClientEvent = z.discriminatedUnion('t', [
  z.object({ t: z.literal('join'), roomCode: z.string().length(4), rejoinToken: z.string().optional() }),
  z.object({ t: z.literal('takeSeat'), seat: z.number().int().min(0).max(6) }),
  z.object({ t: z.literal('startMatch'), themeId: z.string() }),                 // host only
  z.object({ t: z.literal('playCards'), cards: z.array(CardZ).min(1).max(3), requestId: z.string() }),
  z.object({ t: z.literal('callLiar'), requestId: z.string() }),
  z.object({ t: z.literal('pullTrigger'), requestId: z.string() }),              // loser clicks gun
]);
export const ServerEvent = z.discriminatedUnion('t', [
  z.object({ t: z.literal('snapshot'), version: z.number(), state: z.unknown() }),
  z.object({ t: z.literal('reveal'), result: z.unknown() }),
  z.object({ t: z.literal('pull'), outcome: z.unknown() }),
  z.object({ t: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type ClientEvent = z.infer<typeof ClientEvent>;
export type ServerEvent = z.infer<typeof ServerEvent>;
```

**Replay logging for debugging** (`src/replay/recorder.js`): append-only
`replays/RM4D-17.jsonl`: `{v:12, ts, event, stateHash}` per step. When a bug report comes in,
we re-run the pure engine over the log to reproduce exactly (RNG is seeded per match and the
seed goes in the log header). Cheap, zero deps, no Mongo hot-path writes.

## 5. Client architecture (Next.js side)

- **Pages that are pages:** `/` landing, `/how-to-play`, `/store`, `/play` lobby are mostly
  Server Components + small client widgets. SEO/enumerability matters for a store.
- **The game screen is one client-heavy island:** `/room/[code]/page.tsx` is a thin Server
  Component that awaits nothing and renders `<GameScreen code={code}/>`, a `'use client'`
  tree that: creates/connects the singleton socket, hands it `rejoinToken`, and after the
  first `snapshot` never fetches again — the rest of the app is inert while animating game.
- **zustand store mirrors server state** (no nested client derivations — derive in selectors):

```ts
interface GameStore {
  me: PlayerId | null;
  room: ClientRoomState | null;      // snapshot minus other hands (server-filtered)
  version: number;                   // last applied server version
  pendingReveal: RevealResult | null; // transient animation payloads
  applySnapshot(s: ClientRoomState): void;
  onEvent(e: ServerEvent): void;      // handles version gaps by requesting snapshot
}
```

- **Sync rule:** every server event carries `version`; store applies only `version ===
  store.version + 1`, else requests a fresh snapshot (drift is impossible by construction).
  Optimistic UI only for felt-mechanics (my card leaves my hand instantly, rolled back on error
  ack).
- **Animation orchestration (motion):** the reveal sequence is a *fixed timeline* cued by a
  server `reveal` event — flip cards face-up sequentially (stagger 120ms) → hold 600ms (tension)
  → loser badge → roulette chamber-spin → trigger. Use `AnimatePresence` keyed by card ids +
  `useAnimate` for the gun; never bind animation progress to socket message timing — queue
  events into the timeline so slow networks don't skip frames of drama.
- **howler:** all sfx through one helper (unlock-on-first-gesture for iOS Safari autoplay
  policy); preloaded, short (flip, thump, gunshot, click, heartbeat). Music bed optional in P2.
- PWA: `app/manifest.ts` + icons + `display: standalone` — installable from the browser menu
  without any service worker (Chromium + iOS accept manifest-only installs); add Serwist only
  if we later want an offline shell.

## 6. Testing plan

**Rules engine — vitest, table-driven, fully seeded** (deterministic RNG injection). 15+
must-pass cases:

1. Deal exactness: 4 players × 5 = all 20 cards dealt, nothing duplicated.
2. 7-player deck scaling invariant: deck generator produces a multiple satisfying 5×N, correct K/Q/A balance, exactly 2 Jokers for any N ∈ [2..7] (test at 2, 5, 7).
3. Joker counts as truth: play `[K?, JOKER]` on King table challenged → accused survives, challenger pulled.
4. All-truth play ([K,K] on K) challenged → false accusation, challenger pulled.
5. Mixed bluff (1 truth + 1 lie) revealed → liar loses (whole play judged together — "don't mix" rule).
6. Unplayed-liar edge: played pile empty (first move of round) + someone calls → invalid event (no reveal).
7. Challenger must be the NEXT player — earlier/later player's call is rejected at validation, no state change.
8. Turn enforcement: playing out of order / unheld cards / >3 cards / 0 cards → rejected, state unchanged, version not bumped.
9. Turn timeout (30s passed as `now` argument) → forced pass (play 1 random card? decision in rules doc 01) then turn advances — code path exercised.
10. Forced call endgame: only one player still holds cards → they must challenge; engine resolves or exposes the auto-challenge path (TheGamer heads-up rule: "last card automatically declared a lie").
11. Empty-hand players are skipped for the rest of the round but safe (not challengeable).
12. Roulette sequence: for liveAt k, first k−1 pulls survive, kth eliminates (loop over k=1..6 with seeded RNG); 6th pull is fatal for every liveAt.
13. liveAt uniformity: 1,000 seeded matches → chi-square on liveAt∈1..6 (protects against biased placement).
14. Post-roulette roundEnd: hands reset, NEW table card from table deck, correct next first player (caught liar, else next in order); dead players' hands removed from the count.
15. Dead player cannot act (challenge/play/pull rejected); dead player's seat becomes spectator snapshot.
16. Winner: last alive → `phase:'gameOver'`, winner set.
17. Snapshot filter: `snapshot(state, viewerId)` leaks zero other-player hand info (golden-file test).
18. Determinism: same seed + same event log → identical final state (replay golden).

**Socket integration tests (vitest, in-process server on an ephemeral port):** 2–3 real
socket.io clients — join/takeSeat/startMatch flow; full round-trip play→challenge→pull with all
clients receiving identical versions; a second client's illegal action gets an error ack without
touching state; disconnect → seat marked `connected:false`, grace timer fires; reconnect with
rejoinToken → snapshot identical to pre-disconnect (integrity test); host leaving aborts room.

**Manual QA / game-feel checklist (weekly playtest):** reveal timing (tension ≥600ms), shot
sound vs animation sync, 30s timer visibility on mobile, reconnect on airplane-mode toggle,
iOS Safari audio unlock, multi-tab same-account, spectate-after-death UI, theme switch changes
music/felt without reload, low-end Android (30fps target for animations), room-code types fast
on mobile (uppercase, no ambiguity — codegen avoids `0/O 1/I`), lobby link sharing via
WhatsApp renders OG preview.

## 7. Dev loop & config

```jsonc
// root package.json (npm workspaces)
"workspaces": ["apps/*", "packages/*"],
"scripts": {
  "dev": "concurrently -n web,server \"npm:dev:web\" \"npm:dev:server\"",
  "dev:web": "npm run dev -w apps/web",                    // next dev → :3000
  "dev:server": "npm run dev -w apps/server",              // tsx watch src/index.js → :4001
  "test": "npm run test -w packages/rules-engine",
  "test:i": "npm run test:i -w apps/server",               // socket integration
  "typecheck": "tsc -b --noEmit (all workspaces)",
  "build": "next build (web) — server has no build under tsx"
}
```

- **Local:** one command, one machine. Web calls `http://localhost:4001` (socket + REST) via
  env `NEXT_PUBLIC_SERVER_URL=http://localhost:3000` (same-origin via Next rewrites in dev so
  no CORS at all — rewrite `/socket.io` + `/api/:path*` to :4001).
- **Friend playtesting before hosting:** `cloudflared tunnel --url http://localhost:3000`
  gives a free HTTPS URL phones can use from anywhere with zero deploy
  (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/create-local-tunnels/);
  add the tunnel hostname to the server's CORS allowlist + rewrite env. Perfect for P1
  playtests with friends.
- **Secrets:** `.env.example` committed, real `.env` files gitignored. Server reads via
  dotenv + zod-validated config module (boot fails on missing key); web uses Next's env
  conventions (`NEXT_PUBLIC_*` only for truly public values). Secrets: `MONGO_URI`,
  `JWT_SECRET`, `PURCHASE_WEBHOOK_SECRET` (P3 Stripe/RevenueCat key stored on server only).
  Never inline tokens; production uses systemd `EnvironmentFile=` (VPS) or the Vercel dashboard
  (Plan B) — in both, the repo carries no secrets.

## 8. Build phases

| Phase | Scope | Acceptance criteria | Effort (solo, rough) |
|---|---|---|---|
| **P0** Prototype | Monorepo scaffold; rules-engine (all §6 tests green); text-only table in web; local 2-player game over localhost sockets | Two browser tabs complete a match (win/die); all 17 rules tests pass; replay log reproduces a bug | ~1 week |
| **P1** Playable core | Rooms 2–7 (codes, seats, startMatch), full 5-phase loop, 30s timer, reconnect+rejoinToken, blank-vs-live roulette loop, cloudflared playtests | 3 real friend games with 5+ players on phones; no desync (version-gap test); reconnect survives network loss | ~2 weeks |
| **P2** Juice + responsive | Table/deck art (safe-licensed assets per doc 10), motion reveal/gun/death animations, howler sfx, themes 1–2, mobile-first layout polish, PWA manifest, OG share cards | 60fps on mid Android; game "feels like Liar's Bar" per 5-tester vibe survey; installable to home screen | ~2 weeks |
| **P3** Accounts + payments | Guest profile (JWT) → optional upgrade, MongoDB Atlas M0, purchase flow for themes (Stripe checkout one-time or RevenueCat), entitlement checks on theme selection | Purchase → theme unlocked persists; restore works on fresh device; webhook idempotent | 1–2 weeks |
| **P4** Launch | VPS deploy (nginx + pm2/systemd + Atlas), rate limits, helmet, UGC-free legal pass, leaderboards optional, analytics, MVP marketing page | public https URL serves 20 concurrent rooms from one box; security pass done; store live | ~1 week |

## 9. What this means for our version

1. **Monorepo, npm workspaces:** `apps/web` (Next.js 16 App Router — not 14; 14 was end-of-support in Oct-2025) + `apps/server` (Express 5.3 CommonJS + Socket.IO) + `packages/shared` (zod protocol) + `packages/rules-engine` (pure TS, zero IO — the game's soul).
2. Game needs a **long-lived Node process**: Vercel cannot host custom servers, so one cheap VPS runs server (Plan A: web there too behind nginx; Plan B: web on Vercel free, socket on VPS).
3. **Everything is authoritative on the server; rules-engine is deterministic** — injectable RNG + timestamps make replays byte-perfect for debugging, the single highest-leverage architecture decision for a bluffing game's integrity.
4. **The wire protocol IS the shared package** — zod 4 discriminated unions, versioned events, per-player snapshots that hide hands (no leaks by construction).
5. Client = a mostly-static Next.js shell around **one client-heavy game island** with zustand mirrors + version-gapped sync; motion timelines choreograph the reveal/gun drama independent of network jitter.
6. Mongoose 9 for the cold path only (accounts/purchases/matches); room state is memory-only.
7. Auth = stateless **JWT (jsonwebtoken 9)** shared across REST and socket handshake via one secret — guest-first.
8. PWA = **no plugin** (`app/manifest.ts` suffices); next-pwa is dead; Serwist only if we ever need offline caching.
9. Ship via phases P0 prototype → P1 real-rooms → P2 juice/mobile → P3 money → P4 launch; rules tests (17+ cases) gate every phase.
10. Owner's stack survives contact with 2026 intact: Next.js (bumped to the supported LTS major), Express CJS (now on the ACTIVE 5.x line), MongoDB/monorepo/npm — different versions of the same tools, not different tools.

---

### Sources (verified 2026-11-23)

- npm registry `latest` for every version in §3 (registry.npmjs.org/<pkg>/latest).
- Socket.IO × Next.js (custom server + "won't deploy on Vercel"): https://socket.io/how-to/use-with-nextjs
- Next.js custom-server limitation: https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
- Vercel WebSockets GA + instance pinning + `transports:['websocket']` requirement + billing:
  https://vercel.com/docs/functions/websockets, https://vercel.com/changelog/websocket-support-is-now-generally-available
- Next.js support policy (16 Active LTS / 15 Maintenance LTS until 2027-01-31 / 14 unsupported):
  https://nextjs.org/support-policy, https://nextjs.org/blog/november-2026-security-release
- Express 5.x = npm latest, LTS schedule: https://expressjs.com/en/blog/2025-03-31-v5-1-latest-release
- nanoid ESM-only + `require()` on Node ≥22.12: https://github.com/ai/nanoid#readme
- CRA deprecation (framework/Vite guidance): https://react.dev/blog/2025/02/14/sunsetting-create-react-app
- Next.js PWA guide (native manifest, Serwist for offline): https://nextjs.org/docs/app/guides/progressive-web-apps
- Serwist (maintained Workbox fork; successor to next-pwa): https://serwist.pages.dev/docs/next/getting-started
- mongoose vs native driver (scale + escape hatch): https://markaicode.com/vs/mongoose-vs-native-mongodb/
- Socket.IO multi-node scaling (Redis adapter + sticky sessions): https://socket.io/docs/v4/using-multiple-nodes/
- npm workspaces: https://docs.npmjs.com/cli/v11/using-npm/workspaces
- Cloudflare quick tunnels for pre-hosting playtests: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/create-local-tunnels/
