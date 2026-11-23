# 02 — Liar's Deck: The Definitive Rules Spec

> **Purpose:** THE authoritative rules document for Liar's Deck (Liar's Bar, Curve Animation)
> — precise enough to serve directly as our game engine's spec. Every rule is cross-checked
> across ≥2 independent sources; conflicts are collected in §10, not silently resolved.
> Compiled 2026-11-23. Baseline: `99-initial-search-notes.md`.

**Source keys** (full URLs in §Sources): `[D]` debigare.com full rules writeup (most rigorous;
in-game tutorials + dev comments) · `[N1]` liarsbar.net Liar's Deck · `[N2]` liarsbar.net Quick
Start · `[N3]` liarsbar.net Rules Summary · `[S1]` Steam "Ultimate Guide" (Lord) · `[S2]` Steam
"Liar's Deck Strategy" (Oka) · `[G]` TheGamer · `[9]` 9puz walkthrough · `[M]` Medium roulette
math · `[W]` Wikipedia · `[GP]` Google Play official mobile listing · `[SD-A]` Steam Discussion
"Liar auto call" · `[SD-T]` Steam Discussion "TIMER GLITCH" · `[SH]` shapes.inc · `[R]` Reddit
r/LiarsBar timeout note (single weak source).

---

## 1. Equipment & Setup

**R1. Players.** Officially **2–4 players** per game `[D][N1][G][GP]`. (Our clone supports 2–7;
see §10.A for the deck-capacity design note.)

**R2. The Liar deck (20 cards).**
- 6 **Kings**, 6 **Queens**, 6 **Aces**, 2 **Jokers**, and nothing else
  `[D][N1][N3][G][S1][9]`.
- **Jokers are wild**: a Joker always counts as the current Table rank (see R7), i.e. it is
  always a *Truth* `[D][N1][N2][G][S1]`.

**R3. The Table deck (3 cards).** A separate deck of **1 King, 1 Queen, 1 Ace**. Each round it
is shuffled and the top card revealed = that round's **Table Card** ("King's Table" / "Queen's
Table" / "Ace's Table"). Implemented as a uniform random pick among {K, Q, A} each round; the
same rank may repeat across rounds `[D][N3]`.

**R4. The Revolver ("revolver deck" model).** Each player has a personal 6-chamber revolver
with **exactly 1 live round** (a "Death") among 5 blanks.
- **Implementation model** `[D]`: each player gets a shuffled face-down 6-card deck
  (1 Death + 5 Blanks). Each lost challenge reveals the top card; revealed Blanks are
  discarded. This is exactly equivalent to a bullet at a uniform random fixed chamber
  position `b ∈ {1..6}`, and pull `n` is fatal iff `n = b`.
- **The bullet position is fixed for the entire MATCH, not re-randomized per round**
  `[D]` ("shuffled...before the start of the game") `[N2]` ("actual bullet position is fixed,
  guaranteed hit when that turn comes"). Never reset in the base game (the reset-after-shot
  rule belongs to the Chaos variant only) — see also §10.G.

**R5. Per-round deal.** Every round, the full Liar deck is reshuffled and **5 cards are dealt
to each living player**. With 4 players this deals the entire 20-card deck; with fewer players
some cards stay out of play (hidden), so card counting is only approximate `[D][N1][G]`.

**R6. Mapping to ours.** 8 of the 20 cards are "truths" each round (6 of the Table rank + 2
Jokers); the other 12 are "lies" `[G][N1]`. Consequence: **at most 8 honest card-slots exist
per round**, so heavy multi-card truthful claims are eventually mathematically impossible.

---

## 2. Round Structure

**R7. Table Card selection.** At the start of every round the Table deck is shuffled and its
top card revealed to all; that rank is the claim rank for the whole round `[D][N3]`. The Table
Card is displayed persistently (top-left corner in the real game) `[N2]` — our UI should do
the same. Within the round, a played card is **True** iff it is the Table rank **or a Joker**;
every other card is a **Lie** `[D]`.

**R8. Who goes first.**
- **Round 1:** seating order is random and one player is **randomly designated first player**
  `[D]`.
- **Every later round:** see R26 (round-loser starts, with a source disagreement flagged in
  §10.B).

**R9. Turn order.** Play proceeds **counter-clockwise** around the table `[D][N2][N3]`.
First-person framing used by the real game's guides: the player to your **left** is the
*previous* player (the one you may challenge); the player to your **right** is the *next*
player (the only one who may challenge you) `[N2][S1]`. (Top-down, "next" = one seat
counter-clockwise.) Dead players and empty-handed players are skipped (R27, R28).

**R10. A round always ends in a challenge.** A round cannot end peacefully: the only way a
round terminates is a **LIAR call** (voluntary or forced, R29), which always resolves into
exactly one roulette for exactly one player `[D][N1][G]` (inference, but consistent with every
source; see R29/R31 for the exhaustion proof).

---

## 3. Turn Structure

**R11. The exact choice.** On your turn you have exactly **two options** — there is no pass
and no other action `[D][N3]` ("if you don't have matching cards you must [bluff]" — i.e., you
can't decline to act) `[S2]`:
1. **Play 1–3 cards** from your hand face-down onto the central pile, or
2. **Call "LIAR"** on the immediately-previous player's play — **only if at least one play has
   already been made this round** (the first player of a round cannot call LIAR) `[D]`.

**R12. The implicit claim.** Playing N cards face-down asserts: *"all N of these cards are the
Table rank (Jokers acceptable)."* The number N is public info (shown on-screen; the real game
displays the previous play's quantity, top-left) `[N1][N2]`. The card faces are NOT revealed.
Lying is fully legal — that is the game `[N1][G]`.

**R13. Timer.** Each turn has a **30-second limit** for the decision, measured from the moment
the turn starts `[D][N1][N2]`.

**R14. Timeout behavior.** If the timer expires, the real game auto-plays the cards the player
had selected (the LIAR button does not auto-fire) `[R]`. Behavior when *no* cards are selected
at expiry: **UNVERIFIED** (single weak source; presumably the game auto-selects/plays
something). **Our spec decision:** on timeout, auto-play the current selection; if the
selection is empty, auto-select 1 card — either the leftmost or uniform-random from hand —
and play it. The forced LIAR case (R29) overrides: there the challenge auto-resolves and no
play happens.
**Engine note:** turn actions (play / LIAR / timeout) MUST be atomic and server-serialized:
the real game has a known exploit where pressing LIAR in the final second while simultaneously
playing a card challenges the previous play but judges *the caller's own just-played card*
`[SD-T]`. Our engine must lock the action set the instant one action commits.

**R15. Playing forfeits the challenge.** Once you play cards, your right to challenge the
previous play is gone — "if you choose to *ignore*, you play your cards and the player to the
right of you will choose" `[S1]`. The challenge privilege always sits with the actor of the
current turn only.

**R16. Challenge privilege = next player only.** **Only the player whose turn it is (i.e., the
player immediately after the one who just played) may call LIAR**, and only on the
*immediately-previous* play; earlier plays of the same round can never be challenged
`[D][N2][S2][9]`. Oka's strategy guide: "You are only playing against 1 person... the person
immediately after you... they are the only ones who can call your bluff" `[S2]`. Other players
may *talk* (in our clone: emote/chat) but cannot trigger a challenge. Cf. §10.C — Wikipedia
loosely says "at any time"; rejected as sloppy wording.

---

## 4. Challenge Resolution

**R17. Reveal.** On a LIAR call, **only the accused's most recent play** is revealed
(face-up, to all players) `[D][N1](contextual)[G][S1]`. Earlier plays and undealt cards stay
hidden (they get reshuffled at round end anyway, R25).

**R18. Judgment.** Let the revealed play contain cards `c1..cN`:
- If **every** `ci` is Table-rank-or-Joker → the accused told the truth → **the challenger
  (caller) is the round loser** and plays Russian Roulette `[D][N1][N2][G]`.
- If **at least one** `ci` is neither Table-rank nor Joker → the accused lied → **the accused
  is the round loser** and plays Russian Roulette `[D][N1][N2][G]`.
- **A mixed play (some true + some false) counts as a LIE** — one false card sinks the whole
  play; this is the source of the universal "don't mix truths and lies" tip `[N1][N3][9][S2]`.
  (Chaos-variant special cards are judged differently — out of scope.)

**R19. Who pulls the trigger.** The **round loser pulls the trigger on their own revolver,
pointed at themselves**. There is **no target selection in base Liar's Deck** — pointing at an
opponent is exclusively a Chaos-variant mechanic `[D][G][9]`. (This resolves the baseline-notes
question "sharpshooter variant to be confirmed": shooting *others* = Chaos mode, not base.)

**R20. After a judgment, the round ends immediately.** The loser proceeds to roulette (§5),
then the round transitions (R25). No further plays happen this round `[D][N1]`.

---

## 5. Russian Roulette Mechanics

**R21. The pull.** The round loser reveals the next card of their revolver deck (fixed order
since match start — R4) / equivalently pulls the next chamber:
- **Blank** → the player **survives**; the blank/chamber is **spent** (discarded) and can never
  come up again; the player continues the game into the next round `[D][N2]`.
- **Death (live round)** → the player is **eliminated**: dramatic death animation, they are out
  of the game permanently, and they **spectate** for the rest of the match
  `[D][G]` ("Once a player has died, they're out of the game... skipped in the turn order, and
  the game continues as normal").

**R22. Rising odds (fixed-bullet model — adopted).** Because the bullet position is fixed and
spent blanks never repeat, the death probability climbs deterministically:

| Pull # (n-th loss) | Death odds | Survival odds | Cumulative survival |
|---|---|---|---|
| 1 | 1/6 (16.7%) | 5/6 (83.3%) | 83.3% |
| 2 | 1/5 (20%) | 4/5 (80%) | 66.7% |
| 3 | 1/4 (25%) | 3/4 (75%) | 50.0% |
| 4 | 1/3 (33.3%) | 2/3 (66.7%) | 33.3% |
| 5 | 1/2 (50%) | 1/2 (50%) | 16.7% |
| 6 | **1/1 — guaranteed death** | 0% | 0% |

Confirmed by `[N2]` FAQ ("1 in 6 on the first pull, 1 in 5 on the second, then 1 in 4, 1 in 3
and 1 in 2, and a certain hit on the sixth"), `[G]` (their table is mislabeled "survival" but
the fractions are the same death odds), and a correcting comment on `[S1]`. **Expected number
of pulls until death: 3.5** (bullet position uniform 1–6) `[M]` scenario-1 math. The Medium
article argues the real game may instead add a bullet per pull (expected 2.77 pulls) — see
§10.D for why we reject that model.

**R23. Chamber indicators (UI).** Every player's pull counter is **public**: the real game
shows `(pulled/6)` — e.g. `(5/6)` means 5 pulls survived, so the **next loss is fatal**
`[N2]` ("death occurs after (5/6)") `[N3]` ("chamber status shown as (used|total), example
(5|6) means last chamber — next lost round is fatal"). A mobile reviewer describes the display
as *remaining* chambers ("3/6 to 2/6") — same info, opposite direction; our UI just needs to
show, per player: pulls survived + fatal-next flag `[GP]`. Design intent worth copying: the
table knows who is one loss from death, which drives endgame targeting.

**R24. No recovery, no healing, no resets.** Nothing in the base game removes a spent chamber,
moves the bullet, or revives the dead. Revolver state is strictly monotonic: 0/1 → … → 6.
(Chaos variant's "reload after a successful shot" is out of scope `[D]`.)

---

## 6. Round Transitions

**R25. After EVERY roulette** — blank or fatal — the round ends and the next round is fully
fresh `[D][N1]`:
1. All played/undealt cards return to the Liar deck; **shuffle all 20 cards** `[D]`.
2. Deal **5 to each living player** `[D][N1]`.
3. Draw a **new Table Card** (fresh shuffle of the table deck) `[D][N3]`.
4. Hands **never persist** between rounds in base mode — that is the Liar's Deck 2 variant
   `[D]`. Strategy consequence noted by `[S2]`: "Calling liar shuffles the deck. You just got
   a good hand. Another player calls liar. You lose that hand."

**R26. First player of the next round (primary rule).** **The round loser starts the next
round** `[N2]` ("the previous round's loser going first"):
- If the accused was caught lying → **the caught liar starts** `[D]` (explicit).
- If the challenger was wrong (accused was truthful) → **the wrong challenger starts** —
  this matches `[D]`'s clause "or the next player in turn order otherwise" under the natural
  reading (the challenger IS the next player after the accused), and matches `[N2]`.
- **Fallback (error-correcting spec):** if the designated starter is dead (eliminated in the
  roulette), the next **living** player in counter-clockwise order starts instead.
  *UNVERIFIED — no source addresses the dead-starter case; a design decision we must make.*
- **Dissent:** `[SH]` claims instead that the round *winner* starts — see §10.B. Unresolved; playtest
  recommended.

**R27. Dead players.** Eliminated players are skipped for all purposes: turn order, dealing,
challenges (their "next player" is skipped past) `[D]`. They spectate until game end —
in our clone: keep them in the room, show the table, no actions `[G]`.

---

## 7. Hand-Exhaustion Rules (the "empty hand" endgame)

**R28. Empty hand = safe + skipped.** A player who plays their last card(s) and is *not*
challenged has, for the rest of the round: no turn, no risk — they cannot be challenged
anymore (their last play can be challenged exactly once, by the next player, at the moment it
happens — after the turn passes it is unchallengeable, R15/R16) `[D][N1][N3][9]
("If you empty your hand and nobody calls you, your turns are skipped for the rest of the
round and you are safe")`. Design note: emptying your hand early is *good* — getting "out"
cleanly is the point of the game `[SD-A]`.

**R29. The forced LIAR call (auto-call).** The moment a play leaves **exactly one player
holding cards**, that last holder **must/does call LIAR on the play just made** `[D]` ("If only
1 player still have cards in hand, they must call LIAR on the previous player") `[N2][N3]
("With only one opponent left holding cards, they must call")`.
- The real-game behavior is known to the community as the **"auto-call"** and is **automatic**:
  the game adjudicates it without waiting for or consulting the forced caller
  `[SD-A]` ("you are forced to call liar when your opponent places all of their cards";
  "That's where the autocall comes from") `[G]` ("the last card will automatically be declared
  a lie by the other player").
- The forced caller has **no alternative** — they cannot play their cards instead
  `[SD-A]` (Kyren's complaint + community response: "if you're the last person with card(s)
  on their hands, the game punishes you by forcing you to call liar").
- **Adjudication of the auto-call is a normal challenge** (R18): if the accused's last play
  was all truths, the *forced caller* plays roulette; if it contained a lie, the accused does
  `[SD-A]` (community: "the opponent could leave the good cards for the last and force you to
  call liar").
- **Timing (our spec):** trigger the auto-call **immediately** after any play that reduces the
  holder count to 1 — don't wait for the holder's turn. UNVERIFIED nuance (sources don't pin
  the instant, but immediate trigger is observationally equivalent because all other players
  are empty and would be skipped anyway).

**R30. Two-player endgame.** In heads-up, when one player empties their hand, the opponent is
by definition the only holder → auto-called against that last play `[G]` ("if all cards end up
getting played, the last card will automatically be declared a lie by the other player").
So a 2-player round **always** ends via challenge; "playing everything out" is precisely the
auto-call. Endgame strategy (from `[S2]`): with a 1-1-1-1-1 hand pattern "you might be the
last one at the table and auto-call liar" — i.e., pace your discards so you are NOT the
last holder.
 Practical corollary: your **last play should be truthful by default**, since a truthful
 final play wins the auto-call for you.

**R31. All-empty is impossible.** Because the auto-call fires at holders == 1, the state
"zero holders" is unreachable — a round always ends in exactly one challenge and one
roulette `[D]` + inference (the loose `[GP]` wording conflicts — §10.F).

---

## 8. Winner Condition

**R32.** **The last living player wins; every eliminated player loses.** The game ends the
moment all-but-one have died — practically, when the second-to-last player loses a roulette
`[D]` ("If all but 1 player have been eliminated, the game ends with the remaining player
winning") `[G]`. There is exactly one winner; nobody else is ranked. Dead players spectate
until then `[G]`.
**Engine note:** the game can only end via a roulette death — there is no timeout/forfeit
path in the official rules (leaver handling is our product decision, not a rule).

---

## 9. Authoritative Game Loop (implementable spec)

Rules referenced `[Rn]` above. Server-authoritative; all RNG server-side. Notation:
`alive(p)` = not eliminated; `holding(p)` = alive AND hand non-empty.

### Phase A — Match initialization (once per game)

1. Seat N players around the table in random order; fix the counter-clockwise turn order
   `[R1, R9]`.
2. For each player p: `p.bulletPos ← uniform(1..6)`; `p.pulls ← 0`; `p.alive ← true`
   `[R4]`. **No revolver state is ever touched again after this step** (except pulls++)
   `[R24]`.
3. `starter ← random player` `[R8]`. `roundNo ← 0`.

### Phase B — Round start

4. `roundNo++`; `players ← {p : alive(p)}`.
5. `tableCard ← uniform({K, Q, A})`; broadcast to all (persistent UI) `[R7, R3]`.
6. Shuffle the 20-card Liar deck; deal 5 cards to each player in `players` (remaining cards,
   if any, stay face-down and hidden) `[R5, R25]`.
7. `current ← starter` (guaranteed alive by steps 26–27).
8. `pile ← []; holders ← players` (everyone holds 5).
9. Go to Phase C.

### Phase C — Turn loop

10. If `holders` == 1 → **auto-call**: go to Phase D with `challenger ←` the single holder,
    `accused ← pile.last.player` (the play that made holders == 1) — R29 immediate trigger.
11. `current ← next player counter-clockwise after current such that holding(current)`
    (skip empty-handed AND dead) `[R28, R27]`.
12. Start the 30-second turn timer for `current` `[R13]`.
13. Accept exactly one action from `current` (or the timer):
    a. **PLAY(S)** where S is 1–3 cards from hand, or
    b. **LIAR** — legal only if `pile` is non-empty (not the first play of the round)
       `[R11]`, or
    c. **TIMER EXPIRES** → auto-action: if a selection S exists, treat as PLAY(S)
       `[R14][R]`; if not, auto-select 1 card (our decision: uniform-random) and PLAY it
       `[R14, UNVERIFIED]`.
14. On **PLAY(S)** by `current`:
    a. Append `{player: current, cards: S}` to `pile`; broadcast count |S| face-down to all
       `[R12]`.
    b. Remove S from `current`'s hand. If hand is now empty, `current` leaves `holders`
       (safe for the rest of the round — R28). They may no longer act this round.
    c. Go to step 10 (which may fire the auto-call if `holders` just became 1; otherwise
       returns here).
    d. Loop to Phase C step 11 with the next holder.
15. On **LIAR** by `current`: go to Phase D with `challenger ← current`,
    `accused ← pile.last.player`, `play ← pile.last.cards` `[R16]`.

### Phase D — Challenge adjudication

16. Reveal `play` to all players `[R17]`.
17. `isTruth(c) := (c == tableCard) or (c == Joker)` `[R18]`.
18. If **any** c in `play` fails `isTruth` → verdict := LIED, else verdict := TRUTHFUL
    `[R18]`.
19. `loser ← accused` if verdict = LIED, else `loser ← challenger` `[R18]`.
20. Go to Phase E with `loser`.

### Phase E — Russian roulette

21. `loser.pulls++` (pull #`loser.pulls`).
22. If `loser.pulls == loser.bulletPos` (equivalently: this pull reveals the Death card):
    a. `loser.alive ← false`; play death animation; broadcast elimination `[R21]`.
    b. Go to step 24.
23. Else: broadcast survived + spent-chamber update (`(pulls/6)` indicator; flag
    "next pull fatal" when `pulls == 5`) `[R21, R22, R23]`; go to step 24.
24. If `count(alive(p)) == 1` → **game over**: the single living player wins `[R32]`; END.
25. If `count(alive(p)) == 0` → impossible in base mode (only reachable in Chaos) `[R32]`.

### Phase F — Round transition

26. `starter ← loser` (the round loser starts the next round) `[R26]`.
27. If `starter` is not alive → `starter ← next counter-clockwise living player`
    (error-correcting fallback, UNVERIFIED `[R26]`).
28. Go to Phase B (fresh shuffle, redeal, new table card) `[R25]`.

### Public vs private state (per event)

- **Public to all:** table card; each play's card *count* + player; each player's hand
  *size*; each player's `(pulls/6)` + alive/dead; reveal contents only on adjudication.
- **Private to player p:** p's hand; p's own bullet position. Opponents' bullet positions,
  opponent hands, undealt cards: hidden from clients AND from the server's client-visible
  payloads (anti-cheat: never trust the client; the `[9]`-cited anti-cheat writeups hinge on
  exactly this).
- **Atomicity:** steps 13–15 must be serialized; ignore any second action from the same
  client in the same turn window (prevents the `[SD-T]` last-second-LIAR-while-playing race).

---

## 10. Rules Ambiguities & Source Disagreements

**A. Deck capacity vs our 2–7 players.** Official rules cap at 4 players BECAUSE 20 cards
deals 5×4 exactly; our 2–7 requirement forces a design decision: (a) scale the deck for 5+
players (e.g., keep the 6/6/6/2 recipe per 4 seats → 40 cards for 8), preserving the
5-card hand and the ~"8 truths per 20" pressure, or (b) deal `floor(20/N)` cards (7 players
→ 2 cards each) keeping the deck pure. Recommend (a); flag for owner. No source gives
guidance — every source is 2–4 `[D][N1][G][GP]`.

**B. Who starts the round after a roulette (conflicting).**
- `[D]`: the *caught liar* starts; "or the next player in turn order otherwise" — ambiguous
  between (a) the challenger (= loser-first, since the challenger is the round loser) or
  (b) the player *after* the challenger.
- `[N2]`: "the previous round's loser going first" — supports (a).
- `[SH]` (lower-rigor fandom wiki): claims the **winner** starts ("the player who survives a
  penalty round or successfully catches a liar usually initiates the next round") — direct
  contradiction.
- A garbled YouTube transcript ("whoever was called out for me a liar... goes first") is
  unusable but roughly supports the caught-liar-first reading.
- **Adopted:** round loser starts (§9 step 26); playtest/ask owner before launch since it
  materially affects pacing.

**C. Who may call LIAR (conflicting).** Only-the-next-player-only is confirmed by four
strong sources `[D][N2][S2][9]` (Oka: "the only one who can call your bluff"; 9puz: "the
player after you is the only one who can punish your current play"). But `[W]` (Wikipedia)
says "each player can accuse others of lying at any time" — that describes the real-life
Cheat/BS family, not Liar's Deck's implementation. **Resolved: next-player-only.** Design
note: this rule *is* the game's tension ("you're playing against exactly 1 person" `[S2]`)
— keep it strict in our clone.

**D. Roulette math model (conflicting — important).**
- Fixed-bullet model (adopted): odds 1/6→1/5→1/4→1/3→1/2→certain; expected pulls 3.5
  `[D][N2][G]` + correcting comment on `[S1]` ("Every time you live to see the next time, the
  odds of the bullet being in any of the other chambers are equal... 83%, 80%, 75%, 67%, 50%,
  and 0%").
- `[M]` claims the game ACTUALLY adds a bullet per pull and re-randomizes (expected 2.77
  pulls), interpreting the `(x|6)` UI as a bullet counter.
- `[S1]`'s own original table (83/69/58/48/40 cumulative) was wrong under BOTH models and was
  corrected in its comments.
- **Resolution:** fixed-position model — `[D]`'s dev-derived revolver-deck description,
  `[N2]`'s "position is fixed, guaranteed hit when that turn comes", the `pulled/6`
  spent-chamber UI reading, and `[G]`'s "guaranteed 6th death" all agree. **Playtest
  flag:** a 5/6 player surviving their next pull is IMPOSSIBLE under this model — if that
  is ever observed in the original, `[M]`'s add-a-bullet model is live. Either way, the
  fixed model is the better clone UX (transparent odds).

**E. Turn timeout (weak sourcing).** 30 s/turn is confirmed `[D][N1][N2]`; timeout *behavior*
is single-sourced: the game auto-plays the selected cards (does NOT auto-call-liar) `[R]`.
Empty selection at expiry: UNKNOWN. No rule source (incl. `[D]`) states a timeout penalty
(e.g., forced roulette). Our step 13.c is a house rule by necessity; don't conflate with the
auto-call, which casual reports often mislabel as a "timeout".

**F. Hand exhaustion (official contradiction).** All Steam/rigorous sources: empty hand =
safe, skip the rest of the round `[D][N1][N3][G][9]`, plus the forced auto-call when one
holder remains `[D][G][SD-A]`. But the OFFICIAL Google Play description says: "If you run
out of cards, you're **forced into a sudden-death round of Russian roulette**!" `[GP]` —
probably marketing-garbling the heads-up auto-call (when you run out, the *other* player is
forced into roulette — see R30), or the mobile build genuinely differs. **Resolved per
Steam sources (4:1); UNVERIFIED against the mobile build.**

**G. Bullet reset with <4 players / any reset behavior.** No source describes ANY reset tied
to player count. `[N1]`'s setup section casually says "each player holds a revolver with 1
bullet randomly loaded in one of the 6 chambers" in the per-round setup list, which could be
misread as a per-round reload; the rigorous sources say the position is fixed for the whole
match `[D][N2]` and spent blanks persist `[D]`. A `[GP]` reviewer complained about players
"going from 3/6 to 2/6" (counter going backwards) — cheating or a mobile UI bug, not a rule.
**Resolved: no reset; per-match fixed.** (The one sanctioned reset in the game family is
Chaos's reload-after-successful-shot `[D]`.)

**H. Auto-call: automatic vs forced-choice.** `[G]` ("automatically declared") + the community
term "autocall" `[SD-A]` imply zero-interaction resolution; `[D]` ("must call") and
`[N2]/[N3]` could be read as mandatory-but-manual. **Resolved: implement as automatic**
(strongest player testimony + simplest + prevents stalling); a manual variant would need a
short window then auto-fire.

**I. Challenge timing window (minor wording drift).** `[D][G]` clearly say only the
*previous turn's play* is revealed/judged; `[N1]` once says "the system reveals the pile to
verify" ("the pile" = contextually the just-played cards — its own FAQ confirms only the
last play is judged). Earlier plays are never re-judged. **Resolved: last play only.**

**J. First-round special cases.** Round-1 first player random `[D]` — no source dissents, but
`[N2]` never states round-1 explicitly (only "previous round's loser"), so round 1 is
UNVERIFIED-by-critique; random is the only consistent reading (no loser exists yet).

**K. Dead designated-starter (gap).** No source covers "the round loser starts but died in
the roulette". Our rule (§9 step 27): pass to next living player counter-clockwise. UNVERIFIED
/ design decision.

**L. Devil/variants (out of scope, one conflict noted).** Our clone ships base rules only.
For the record: `[D]`'s Devil-variant adjudication ("everyone who still has cards plays
roulette") differs from `[N2]/[G]` ("every player except the Devil-player plays") — relevant
only if we ever add variants. (`[N2]` calls it Hell mode / Devil mode interchangeably.)

---

## 11. Playtest checklist (verify against real game before launch)

1. Next round's starter: caught liar? wrong challenger? dead-starter fallback? (§10.B/K)
2. 5/6 player can never survive pull 6 — confirm fixed-bullet (§10.D).
3. Auto-call fires the instant holders==1, even mid-seating-order (R29 timing); timeout with
   zero selection — what does the real game do? (§10.E)
4. Round-1 first player: any hidden dealer/lucky-seat effect beyond random? Mobile "run out of
   cards → sudden death" sentence vs Steam "empty = safe". (§10.F)

**Numeric facts** (pull from §1–§9 for balance/UI):
- Truths per round = 8/20 cards (40%); a 4-table deals 100% of the deck; 2-player game:
  10 of 20 cards dealt → 10 dead cards, so counts stay guesses `[N1][G]`.
- Expected pulls to death ≈ 3.5 (§5 R22); games rarely exceed ~3 rounds `[N1]` ("games
  rarely exceed three rounds") — `[M]` claims ~2–3 under its rejected 2.77-pull model.
- Turn timer: 30 s. Desktop reference controls: A/D select card, Space toggle, E play,
  X challenge `[N1][N2][N3]` (we re-map for touch anyway).

## Sources

- `[D]`  https://www.debigare.com/how-to-play-liars-deck-from-liars-bar-full-rules-and-variants (rev. 2026-08-31)
- `[N1]` https://www.liarsbar.net/g/liars-deck
- `[N2]` https://www.liarsbar.net/g/liars-bar-quick-start
- `[N3]` https://www.liarsbar.net/g/rules-summary-for-deck-dice
- `[S1]` https://steamcommunity.com/sharedfiles/filedetails?id=3353349539
- `[S2]` https://steamcommunity.com/sharedfiles/filedetails?id=3376301632
- `[G]`  https://www.thegamer.com/liars-bar-how-to-play-liars-deck
- `[9]`  https://9puz.com/2470-liars-bar-walkthrough
- `[M]`  https://medium.com/@karstencao/rushing-in-roulette-liars-bar-s-elimination-mechanics-31f6f3c9abfe
- `[W]`  https://en.wikipedia.org/wiki/Liar%27s_Bar
- `[GP]` https://play.google.com/store/apps/details?id=com.CurveAnimation.LiarsBar
- `[SD-A]` https://steamcommunity.com/app/3097560/discussions/0/4635986990492365307/ ("Liar auto call")
- `[SD-T]` https://steamcommunity.com/app/3097560/discussions/0/4635987888980412173/ (timer race exploit)
- `[SH]` https://shapes.inc/fandom/liar-s-bar/game-modes
- `[R]`  https://www.reddit.com/r/LiarsBar/comments/1gadqvi/i_found_a_bug/ (timeout auto-plays selection; unreachable via fetch — quote recovered from search index; single weak source)
