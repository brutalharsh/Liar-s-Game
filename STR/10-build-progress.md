# STR/10 — BUILD PROGRESS (LIVING STATUS — updated by orchestrator only)

> Every session starts here: what's done, what's in flight, what's next.
> Last updated: **2026-11-23 (kickoff)**

## Done

- ✅ 12 deep-dive research docs (`research/01–12`) + summary (`research/00`)
- ✅ Owner decisions locked → spec (`research/13`) incl. execution dynamic, challenge
  windows, deck scaling, timers, coins/economy, avatars, titles, leaderboard, TTS
- ✅ Build plan: 22 missions, 159 tasks (`research/14`)
- ✅ Stack approved by owner: **Full TypeScript** (Next 16.4 + Express 5 + Socket.IO +
  framer-motion + Tailwind + Atlas); scale target ≈1K concurrent, one VPS (owner has it)
- ✅ STR distilled docs 00–09
- ✅ AGENTS.md + root scaffold (`package.json`, `.env`, `.gitignore`, README)
- ✅ **OPEN SOURCE (owner decision, 2026-11-23):** MIT license, CONTRIBUTING,
  SECURITY, PR template, GitHub Actions CI (workspace-tolerant), OSS README,
  hardened .gitignore. Repo → https://github.com/brutalharsh/Liar-s-Game.git
  (foundation commit pushed by orchestrator; code waves land as they verify).

## In flight (Wave 1 — dispatched 2026-11-23)

| Agent | Mission | Territory | Status |
|---|---|---|---|
| F1 | Foundations: root toolchain + `packages/shared` (zod events, types, sanitizer, room codes, config loader) | root configs, `packages/shared` | 🏃 running |
| R1 | Rules engine: complete pure-TS Liar's Deck per STR/01 + 30+ vitest cases | `packages/rules-engine` | 🏃 running |
| W1 | Web shell: Next 16.4 + all app screens mock-first, two-mode responsive per STR/05 | `apps/web` | 🏃 running |

## Next up (queue — dispatch as prerequisites land)

1. **S1 — Game server** (`apps/server`): Express + Socket.IO + RoomManager + event
   router + timers + Mongo models per STR/07/09 — needs F1 + R1 outputs
2. **W2 — Game table UI** (`apps/web/table`): wire socket events to store, hand/pile/
   CHECK button states, reveal + shot cinematics per STR/03/05 — needs W1 + S1
3. **M1 — Motion pass**: full cinematic timeline polish (STR/05 §4) — needs W2
4. **E1 — Economy backend**: accounts, wallet, XP, titles, match records (STR/04/09)
5. **W3 — Shop/profile/leaderboard UI wiring** to real APIs (STR/04)

## Open items (owner, no rush)

- Payments provider TBD → everything is MockProvider until then
- Rotate the chat-shared MongoDB password before launch (noted in `.env`)
- Trademark clearance for "Liar's Game" before public launch (alternates benched)
- Owner's VPS details (provider, region, access) for the deploy wave

## Agent dispatch log

- Research wave (12 agents) — ✅ all completed 2026-11-23, docs verified
- Build wave 1 (F1, R1, W1) — dispatched 2026-11-23
