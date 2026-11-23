# STR/01 — GAME RULES (the implementable spec)

> Distilled from research/02 (authoritative, 4-source-verified) + owner amendments
> locked 2026-11-23. The rules engine (`packages/rules-engine`) implements THIS file.

## 1. Equipment

- **Liar deck**: `m × (6 Kings + 6 Queens + 6 Aces + 2 Jokers)` where `m = ceil(N/4)`:
  | N (players) | m | Deck |
  |---|---|---|
  | 2–4 | 1 | 20 cards |
  | 5–8 | 2 | 40 cards |
  | 9–10 | 3 | 60 cards |
- **Table deck**: 1 K, 1 Q, 1 A → each round one is drawn = **Table Card**.
- **Revolver (per player)**: 6 chambers, 1 live round, chamber position fixed at
  **match start** (uniform 1–6, server crypto RNG). Not re-rolled. Not reset.

## 2. Round structure

1. Draw + broadcast Table Card (K/Q/A).
2. Shuffle liar deck (`crypto` RNG), **deal 5 cards to each living player**; leftovers stay hidden.
3. **Starter**: first round = random; later rounds = the player **caught lying** last
   (if the liar lost), else next in order after the previous starter.
4. Turns proceed **counter-clockwise**; pass over dead players and empty hands.

## 3. A turn

Living player with cards has **one choice + timer** (30s @2–3p, 20s @4–5p, 15s @6–10p,
host "fast" toggle = 10s). The timer ladder AND the challenge mode (§4) track the
**current ALIVE count**, not lobby size — engine knobs allow overriding both:

- **PLAY 1–3 cards face-down.** Playing = implicit claim: "all of these are the Table Card."
  Lying allowed. Jokers are wild (always count as Table Card ⇒ always "truth").
- **CALL LIAR** (challenge the previous play only; illegal on the round's first play).

Timeout policy: auto-PLAY the pre-staged selection, else 1 random card.
**Never auto-call, never auto-shoot.** Disconnect: 60s grace → auto-play ("drunk under
the table", not eliminated).

## 4. Challenge windows (AMENDMENT A2)

- **2–4 players**: only the **next player** may call LIAR (authentic rule).
- **5–10 living players**: after a play lands there's an **open 10-second window** — ANY living
  player except the accused may CHECK (empty-handed players included). Server: 2s
  arm-delay after the play, **first event wins** (no race; a LIAR at exactly
  `armedAt`/`closesAt` is legal, late CHECKs are rejected), window closes when the
  next player commits a play (belief) or expires.

## 5. Resolution

Reveal the accused's LAST play:

- **Any card ≠ Table Card and ≠ Joker** → the accused **lied** → accused loses.
- **All cards valid** → challenge fails → **accuser loses**.

## 6. The shot (AMENDMENT A1 — owner's rule)

The challenge **loser** faces the revolver, decided by case:

| Loser | Who pulls | Aimed at |
|---|---|---|
| **Caught liar** | **50/50 coin flip** (server): the liar themselves **OR their accuser executes them** | always the loser — no other target selectable |
| **False accuser** | always themselves | themselves |

- Same revolver odds in every path: `pull # = 1..bulletPos`, death at `pulls == bulletPos`,
  **6th pull is guaranteed death** (1/6 → 1/5 → 1/4 → 1/3 → 1/2 → certain).
- Players, board, and spectators see only the public counter `(pulled/6)`.
- Blank = survive, counter +1, round ends. **Live = death + elimination** (spectator).

## 7. Round end & transitions

Every roulette (live or blank) **ends the round**: full reshuffle, new deal (5 each),
new Table Card, starter per §2.3. A round can never end without a roulette.

## 8. Hand exhaustion + forced call

- Empty hand = **safe**: skipped, can't be challenged, holds no risk this round.
- The instant only **one** player still holds cards → the game **auto-calls LIAR** on
  the last play (challenger = the single holder). Unfalsifiable last plays win rounds.
- 2-player game with all cards played resolves via this forced call.

## 9. Win

**Last player alive wins.** If players drop below 2 (disconnects), remaining wins by
default / match aborted.

## 10. Stats attribution (feeds STR/09 MatchRecord)

- `kills` — EXECUTE shots you fired where target died.
- `catches` — correct LIAR calls (the accused really lied).
- `falseAccusations` — wrong calls.
- `bluffSuccesses` — plays containing ≥1 lie that went unchallenged.
- `deaths` + `deathCause` {selfRoulette | executed}.
- `pullsSurvived`, `wins`, `roundsPlayed`. Winner's coins = `randInt(2..7) + survivedRounds`.

## 11. Condensed loop (server POV)

```
init: seat players ccw, bulletPos[p]=rand(1..6), starter=random
round:
  table=rand(K,Q,A); deal 5 each; pile=[]
  turn:
    if holders==1 -> auto LIAR(single holder -> resolve)
    current = next ccw holding player; start timer
    action = PLAY(1..3 valid own cards) | LIAR(legal per §4) | timeout(role per §3)
    PLAY: pile.append; broadcast COUNTS only; open window (§4)
    LIAR: reveal last play -> liar? loser=accused else accuser
  resolve:
    shotKind = assignShot(loser)   // §6 table
    result = pull(loser)           // spent chambers advance
    if dead: eliminate
    round end; goto round
win: last alive -> emit MatchRecord (§10)
```

Full 28-step loop with edge cases: research/02 §9. Ambiguity log: research/02 §10.
