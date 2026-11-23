# @liars-game/shared

The wire contract for Liar's Game: zod event schemas (STR/07 §1–§2), domain
types (STR/09), nickname/room-name sanitizer, room-code helpers, and deadline
helpers. This package is the ONLY place event shapes may be defined
(AGENTS.md non-negotiable #4).

## Building

Dual output so the CommonJS server (`require`) and the Next.js web app
(`import`) both consume it cleanly:

```
npm run build -w packages/shared
```

- `dist/cjs/` — CommonJS (`.js`, per-dir `package.json` marker)
- `dist/esm/` — ES modules
- `exports` map picks the right format per consumer; `types` per branch.
- Rebuild after editing `src/` — consumers read `dist/`, not TS source.

## Importing

```ts
// Universal (web + server): events, types, sanitizer, room codes, timers
import { clientEventSchemas, sanitizeDisplayName, remainingMs } from '@liars-game/shared';

// Server ONLY (dotenv + node:fs — never import from web code!)
import { loadConfig } from '@liars-game/shared/server';
```

The root barrel intentionally excludes `config` so `dotenv`/`node:fs` can
never leak into a client bundle.

`loadConfig()` env-file selection (AGENTS.md rule 5): `NODE_ENV=production` →
repo-root `.env.production`; otherwise `.env.local`, falling back to `.env`
(walk-up from CWD). `LIARS_ENV_FILE` overrides; `loadConfig(env, { envFile })`
for tests. Missing keys are reported by NAME only — values never logged.

## Wire contract notes

- Every server→client payload carries a required monotonic `seq` per room
  (STR/07 §4). `lobby:state` (a full `RoomState`) doubles as the catch-up
  snapshot on (re)join.
- Every payload schema is a `z.strictObject` — unknown keys fail validation.
  That is a leak tripwire: a payload that smuggles card ranks past the server
  will not parse.
- `generateRoomCode(rng)` takes an injected `randomBelow(maxExclusive)` port —
  wire it to `crypto.randomInt` server-side; no `Math.random` in game paths.
- Ack envelope baseline (co-designed with S1/W2):
  `{ ok: true; data: T } | { ok: false; error: { code, message } }`.
- `sanitizeDisplayName` returns `''` for blocked/empty input — fall back to a
  default name.
- Unpinned by STR (choices made by F1, adjust in shared if needed): seq
  required on every server event incl. `error`; `dealtCounts` as
  `{seat, count}[]` pairs; `window:close` reasons `belief|expired|liar_called`;
  reveal payloads carry only `{cards, verdict, loserSeat}`.

Run tests: `npm test -w packages/shared` · Typecheck: `npm run typecheck -w packages/shared`
