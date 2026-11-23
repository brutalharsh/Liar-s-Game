# STR/00 — INDEX (start here)

> **STR = distilled game documentation** for humans and AI agents working on
> Liar's Game. Deep background lives in `research/` (2,500+ lines per topic);
> STR is the fast, operational truth. Last updated: 2026-11-23.

## Project snapshot

| What | Value |
|---|---|
| Product | **Liar's Game** — browser multiplayer bluffing card game (Liar's Deck format) |
| Platform | Mobile + desktop web, instant-play via invite link, PWA |
| Players | 2–7 per room (free) · 8–10 "Big Table" (premium host perk) |
| Stack | **Full TypeScript**: Next.js 16.4 App Router + Express 5 + Socket.IO 4.8 + framer-motion + Tailwind + MongoDB Atlas |
| Scale target | ~1K concurrent users on one VPS (owner-provisioned) |
| Payments | **MOCK stub** (Buy → `POST /api/payments/create-order`) until owner names the provider |
| DB | MongoDB Atlas via `.env` only (`MONGODB_URI`; rotate password before launch — it was shared in chat) |
| Name | "Liar's Game" — trademark clearance pending pre-launch (Curve Animation holds "LIAR's Bar"; Japan has "Liar Game" manga IP) |

## The STR docs

| File | Content | Read when |
|---|---|---|
| `01-game-rules.md` | **THE rules spec** incl. our two amendments (execution dynamic, challenge windows), deck scaling, timers | Rules/engine work |
| `02-features.md` | Complete feature list, versioned v1/v1.x/later | Any feature work |
| `03-game-flow.md` | Screen flows + round state machine from the player's view | UI/UX work |
| `04-shop-and-economy.md` | Coins, packs, catalog prices, themes, XP curve, titles | Economy/shop work |
| `05-ui-ux-and-motion.md` | Two design modes, tokens, animation inventory, sound/haptics map | All frontend work |
| `06-architecture-and-stack.md` | Monorepo tree, pinned versions, server-authority pattern, deploy | Any dev work |
| `07-network-protocol.md` | Socket events + payloads, view-filtering, REST endpoints | Server/client wiring |
| `08-security-rules.md` | Non-negotiable anti-cheat + security rules | All server work |
| `09-data-model.md` | MongoDB collections, schemas, MatchRecord/stats shape | Backend work |
| `10-build-progress.md` | **LIVING STATUS** — waves, agent log, what's next | Every session start |

## Deep research (background, cite-able)

`research/00-SUMMARY.md` → index of 12 deep-dive docs (rules, probability, IP/legal,
networking, hosting, monetization, UI, assets, stack, security) + `13-locked-design-spec.md`
(owner's decisions verbatim) + `14-build-plan.md` (22 missions, 159 tasks).

## Rules of the folder

- STR/01 and STR/07 are **the source of truth** — if research/ disagrees, STR wins.
- Only the orchestrator edits `10-build-progress.md`.
- Everything here is plain Markdown — agents must read these BEFORE writing code.
