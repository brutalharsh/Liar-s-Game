# STR/03 — GAME FLOW (screens + states from the player's view)

> Source: doc 09 §1 + rules engine FSM. Wireframes: research/09 (ASCII per viewport).

## 1. Screen map

```
Home ─┬─ Login ──► [OAuth provider] ──► /auth/callback ──► back to Home/next
      ├─ Create ──► Lobby ──► [Countdown] ──► Table ──► Round* ──► Winner ──┬─ Lobby (rematch)
      ├─ Join (code/link /r/XXXXX) ─► Lobby ───────────────────────────────┤
      ├─ Public rooms (/rooms) ──► Lobby (as guest of the room, or spectator if full)
      ├─ How to play
      ├─ Leaderboard ── Profile (own only via /profile)
      ├─ Shop
      ├─ Profile (stats, titles, wallet) ── Settings
      └─ Admin dashboard (/admindashboard — env-credential login)

Game lobby/table routes: /lobby/[code], /table/[code] · /billing/return (payment
result page) · /motion-lab (internal animation preview)
```

## 2. Round state machine (what each player sees)

| State | Player sees | Player can do | Exit |
|---|---|---|---|
| **ROUND:NEW** | Table card flips into banner, cards dealt (stagger slide ~600ms) | watch | → TURN (starter) |
| **TURN (mine)** | spotlight ring + timer countdown; hand lifted into arc | select 1–3 cards → THROW; (or LIAR if legal) | YOUR play → WINDOW; LIAR → REVEAL; timeout → auto-play |
| **TURN (others)** | their spotlight + your hand dimmed; last play face-down stack appears with count chip | (≤4p: waiting) / (5–10p: CHECK button armed during window) | their play → WINDOW |
| **WINDOW** (5–10p) | 10s ring over CHECK button; last play glows | anyone-but-accused: CHECK | CHECK → REVEAL; timer/next-play → believe → TURN |
| **REVEAL** | accused stack flips one-by-one (400ms stagger); verdict stamp (TRUTH/LIE) | watch | → SHOT |
| **SHOT:SELF** | loser takes revolver; cylinder spins 1.2s → cock → dead air → *click* + relief OR *bang* + shake + slump | the loser: nothing (fate); rest: watch | → ROUND:END or GAME:OVER |
| **SHOT:EXECUTE** | accuser's gun slides in, target locked on loser (fear tremor), same pull beat | accuser: nothing (auto-pull); rest: watch | same |
| **ROUND:END** | banner: why it ended (caught liar / false call / survived); coins +XP toasts pop for the round | Ember/next countdown 2s | → ROUND:NEW |
| **GAME:OVER** | winner crown + confetti; all	stats→match record persisted; rewards reveal (coins randInt 2–7 + survived rounds, XP) | rematch / back to lobby | reset |
| **DEAD** | "ghost lounge": table dims to sepia, chat-emotes only, watch cam | emote only | persists till game over |

## 3. Reconnect flow

- Drop → toast "Waiting for Harsh…" 60s round-pause cap; auto-player covers turns.
- Seats bind to USER IDs (not sockets): re-join via the room link/code with the same
  session → `room:join` restores the seat + full catch-up snapshot (`seq` sync) →
  "Welcome back" banner. No reconnect token exists — the room code IS the seat
  authority (STR/07 §5). After the 60s grace expires the seat is ABANDONED
  ("seat lost" — auto-play continues, not eliminated); re-joining still shows the
  seat but the engine rejects further action input from it.
- Mid-SHOT disconnect: resolve on server, show result on return.

## 4. Winner screen

Crown + theme jingle + confetti, stats strip (bluffs survived, kills, catches),
**rewards reveal**: coins animated count-up, XP bar flash, any title unlock ceremony,
rematch button (host re-lobby, everyone one-tap accept).

## 5. Timings cheat sheet (feel target)

Deal 600ms stagger · throw 400ms · window ring 10s · reveal flips 400ms stagger +
400ms verdict beat · cylinder 1.2s + dead-air 1.2s + payoff beat · slump 800ms ·
round-end 2s · winner 4s. Full shot sequence ≈3.4s — never skippable logic, always
reduced-motion skippable visuals.
