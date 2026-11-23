# 03 — Liar's Bar Variants & Other Modes (research, 2026-11-23)

> Deep-dive: every official Liar's Deck variant (Basic / Devil / Chaos / Liar's Deck 2 /
> Devil 2 / Chaos 2) plus brief rules for Liar's Dice, Liar's Poker and Liar's Slots —
> so we can pick optional modes/house rules post-MVP. Read after 99-initial-search-notes.md.

**Primary source:** https://www.debigare.com/how-to-play-liars-deck-from-liars-deck-from-liars-bar-full-rules-and-variants
(correct URL: https://www.debigare.com/how-to-play-liars-deck-from-liars-bar-full-rules-and-variants —
fetched in full; the most rigorous writeup, based on in-game tutorials + dev comments, revised 2026-08-31)

**Official:** Steam announcements https://steamcommunity.com/app/3097560/announcements/ (patch notes)
**Supporting:** http://tvtropes.org/pmwiki/pmwiki.php/VideoGame/LiarsBar · https://9puz.com/2470-liars-bar-walkthrough ·
https://www.liarsbar.net/g/liars-bar-quick-start · https://www.liarsbar.net/g/arcade-bar-chaos-ruleset ·
https://www.liarsbar.net/g/liars-bar-2025-update-guide

Websearch returned no results for 3 queries during this session; the original Chaos-mode
update's launch date could not be pinned (marked UNVERIFIED).

---

## 1. Liar's Deck variant roster

The Steam game ships **six** Liar's Deck rulesets as of the Nov 13, 2026 patch: Basic,
Devil, Devil 2, Chaos, Chaos 2, Liar's Deck 2. All share the core skeleton from doc 99
(20-card deck, table card, 1–3 cards face-down, only-next-player LIAR call, 6-chamber
revolver with 1 Death + 5 Blanks, 30s turn).

### 1.1 Basic (reference — full rules in doc 99)

- 20-card Liar deck (6K/6Q/6A + 2 Jokers), 3-card table deck, 5-card hands re-dealt every round
- LIAR call: ≥1 Lie revealed → accused plays Russian roulette; all Truth → caller does
- Round always ends after a call → reshuffle, re-deal, new table card [debigare]

### 1.2 Devil (a.k.a. "Hell Mode" on liarsbar.net)

- Exactly **1 King, 1 Queen, 1 Ace** carry a devil mark (use Spades with a physical deck)
- When the round's table type is picked: **if 3+ players remain**, the devil-marked card of
  that type counts as a **Devil** instead of a Truth for the whole round. With 2 players
  left it behaves as a normal Truth (i.e. the Devil "deactivates") [debigare; TVTropes]
- The Devil card **must be played alone** — never bundled with other cards
- If the Devil is revealed during a LIAR call: **everyone except the accused must play
  Russian roulette simultaneously** — precise version per debigare: the **caller plus every
  other player who still holds cards**; empty-handed players are safe (they already escaped)
- Consequences: multiple simultaneous deaths are possible from one reveal; the Devil player
  walks away clean. liarsbar.net quick-start confirms: "everyone except the player who played
  it plays Russian Roulette" and calls the mode "Hell Mode" (two names, same ruleset)
- Strategy: every suspicious **single-card play becomes a potential trap**; never auto-call
  single cards in Devil lobbies [9puz]. Best Devil timing is mid-round, when a lone card
  looks like a desperate bluff

### 1.3 Chaos

Deck changes (no Aces at all):

- Liar deck: **5 Kings, 5 Queens, 1 Chaos card, 1 Master card** (12 cards)
- Table deck: **1 King, 1 Queen** (no Ace rounds possible)
- **Chaos and Master cards are never Truths or Lies**, regardless of table type
- **3 cards** dealt per player (a 4-player table consumes the entire 12-card deck)
- **Max 1 card played per turn** (no multi-card plays, no mixing issue)

LIAR-call consequences replace the normal roulette [debigare]:

| Revealed card | Consequence |
|---|---|
| Truth | Caller plays Russian roulette (unchanged from Basic) |
| **Lie** | **Caller plays *Shoot Opponent*** — picks who gets shot |
| **Chaos** | **All non-eliminated players play Shoot Opponent simultaneously** |
| **Master** | **The accused** (Master's player) plays Shoot Opponent |

So a caught lie is no longer punishment for the liar — it's **reward for the caller**, who
becomes the shooter. Master inversion: the caller "wins" the reveal and then discovers the
bluff they caught was a trap that hands the gun to the accused. Re-verified by 9puz
("Correctly exposing a normal lie lets the caller choose who to shoot. Master gives the
player who played it the targeting power when revealed. Chaos makes everyone choose a
target at the same time") and TVTropes.

- **Reload rule:** a player who reveals a live round via Shoot Opponent **and survives to
  the end of that round** has their revolver deck reset to its original shuffled state
  (fresh 1/6 odds) [debigare; TVTropes: "loads a new bullet and spins the chamber"]
- **Draw:** if all players get eliminated (mutual kills in a simultaneous volley), the
  game ends in a **draw** [debigare]
- Full Shoot Opponent spec: section 4.5 below

**Chaos mode update history** (official Steam patch notes):

- Introduced in the "Arcade Bar" update alongside Kudo (red panda character) and host
  migration. Original launch date UNVERIFIED (websearch dead; post-EA-launch update)
- **Jul 2, 2026 "Liar's Deck Remastered"**: Chaos was heavily reworked — cards no longer
  redistributed after a LIAR call (persistent hands), **Chaos cards activate immediately
  when played**, and "a successful 'Liar!' call lets you shoot **only the challenged
  player**"
- **Nov 13, 2026 "Season 6"**: "The original Chaos Mode is back to its previous version,
  while **Chaos 2 joins the game**" — the two now coexist as separate selectable rulesets

### 1.4 Liar's Deck 2

Bigger-deck, longer-game variant [debigare; TVTropes]:

- Liar deck: **8 Kings, 8 Queens, 8 Aces, 4 Jokers (28 cards)**
- Table deck: **1 K, 1 Q, 1 A, 1 Joker** — so some rounds have a **Joker table**
- **7-card hands** instead of 5
- **Persistent hands:** when a round ends, if **≥2 players still hold cards**, the deck is
  NOT reshuffled and everyone keeps their hand into the next round. A full re-deal happens
  only when ≤1 player still holds cards (TVTropes confirms: "all players only get a new
  hand if there is at most one player left with cards in hand")
- **Joker rounds:** if the table card is Joker, **Jokers are the only Truths** — brutal
  rounds where just 4 cards in the whole 28-card deck are safe plays [TVTropes: "the Jokers
  are the only viable play"]. After a Joker round the Joker is temporarily removed from
  the table deck until the next shuffle (no back-to-back Joker rounds) [debigare]
- **DEVIL'S DEAL call:** on your turn, if **≥4 cards have been played this round**, you may
  call Devil's Deal (in addition to normal options). The **last 4 played cards** are
  revealed. If **all 4 are Truths → everyone else** (other than the caller, players whose
  cards were among the revealed four, and cardless players) must play Russian roulette;
  **otherwise the caller does** [debigare — phrasing on exemptions is slightly ambiguous;
  TVTropes agrees on the all-Truths trigger]
- History: removed from the game in the Jul 2026 remaster ("stepped out for a quick
  coffee… will be back fully remastered", Jul 3 hotfix), **returned Nov 13, 2026**
  "fully remastered… a fresh new way to play" (official patch notes)
- debigare positions it as the "more long-term strategic plays" variant; card counting and
  hand planning actually survive between rounds

### 1.5 Devil 2

Identical to Devil, plus one rule [debigare]:

- **DEVIL'S DEAL call:** on your turn, if ≥4 cards have been played this round, you may
  call it → the last 4 played cards are revealed. If **all 4 are LIES** → **all other
  non-eliminated players** (not just card-holders) must play Russian roulette; otherwise
  the caller does
- debigare explicitly notes this rule "differs greatly" from Deck 2's Devil's Deal —
  **inverted trigger** (Lies, not Truths) and broader victim set (all alive players)
- Went live as "Devil's Deal in Devil Mode" in the Jul 2, 2026 official update:
  "If the last four cards are lies, everyone except the player who revealed Devil's Deal
  must pull the trigger on themselves"

### 1.6 Chaos 2 (bonus discovery — not in baseline notes)

Identical to Chaos except [debigare, revised Aug 31 2026]:

- **Persistent hands:** round ends with ≥2 players holding cards → no reshuffle, hands kept
- **Chaos card must be played face-up** and detonates immediately: all non-eliminated
  players play Shoot Opponent simultaneously, then **the round ends immediately**
- **Lie revealed on a LIAR call → the accused plays Russian roulette** (as in Basic) —
  NOT the caller shooting [debigare]. ⚠️ CONFLICT: the Jul 2 2026 official patch notes
  describe the then-current Chaos as "a successful LIAR call lets you shoot only the
  **challenged** player." The exact post-Nov-13 Chaos 2 lie consequence is therefore
  **UNVERIFIED** between sources (accused-self-roulette vs caller-shoots-accused).
  Debigare is the more rigorous rules source; patch notes may be loose phrasing

### 1.7 Official update timeline (Steam announcements page)

- Oct 2, 2024 — Early Access launch (Deck + Dice)
- Late 2024/2025 — Arcade Bar update: **Chaos mode**, Kudo, host migration (date UNVERIFIED)
- Mar 2025 — hand gestures (middle finger) added [TVTropes]
- 2025 — **Ranked** ladder; matchmaking left host-based → server → non-host auto-match;
  **Liar's Poker** added and later rebalanced (Switch reworked, no ALL-IN+Switch same turn,
  Switch options 4→2 late-round); **Liar's Deck remastered** (visuals only)
- ~Dec 2025 — **Liar's Slots** ships (patch notes Dec 23/25/26, 2025: hotfixes, cup
  execute/slot animations, **Double Spin** added Dec 25)
- Jan–Apr 2026 — stability/UI seasons, gamepad support across all modes
- Jul 2, 2026 — "Liar's Deck REMASTERED": Chaos rework + Devil's Deal added + Poker
  rebalance; Deck 2 temporarily removed (Jul 3 hotfix)
- Nov 6, 2026 — "100 LIARS WALK INTO A BAR" teaser; **Liar's Roulette**: a 100-player
  mode "coming", available only at select times daily
- Nov 13, 2026 — Season 6: monthly seasons, 62+4 Steam achievements, LEGENDS top-100 board,
  skins tab, like/dislike/report, **original Chaos restored + Chaos 2 added + Deck 2 back**

---

## 2. Liar's Dice (brief — different game, out of scope for us)

- Every player has **5 hidden dice** in a cup + **2 poison bottles = 2 lives**
- On your turn, bid a **total quantity of one face** across ALL dice at the table
  (5 × player count dice; 4-player table = 20 dice, avg ≈3.33 per face) [9puz]
- Bid must escalate: **same quantity + higher face**, or **higher quantity + any face**
- Challenge (X): all cups lift. Actual count **< bid → bidder drinks**; **≥ bid →
  challenger drinks**. One drink = one poison bottle; drink both = dead [liarsbar.net]
- In **basic Dice, 1s are NOT wild** (common beginner mistake) [9puz]
- **Traditional ruleset:** **1s are WILD** (count as any face, making high bids much more
  credible) + the **SPOT ON call**: instead of challenging, claim the bid is **exactly**
  right. Correct → *everyone else* drinks poison; wrong → you drink [TVTropes calls it
  a "Dangerous Forbidden Technique"; 9puz: use rarely, only when your cup + the bidding
  path all point to the exact number]. liarsbar.net phrases the exact-guess as a
  challenge-resolved rule — minor framing difference, mechanism agreed
- UNVERIFIED (not in fetched sources): whether the loser sits out a die in later rounds
- Drama note: poison is slower than the revolver — first bottle shows facial damage, tears
  and running makeup; death only on the second [TVTropes]

## 3. Liar's Poker (brief — Texas Hold'em where you bet BULLETS)

- Standard Texas Hold'em skeleton: **2 hole cards** each, **5 community cards** face down
- Your bet is paid in **bullets**; your revolver has **8 chambers** (bet max 8 bullets)
- Each player antes **1 bullet**. Every reveal round (street): **call** (place **+1
  bullet**) or **fold**. Hand ends when all but one fold, or at **showdown**
- **Showdown:** loser(s) **load all the bullets they bet** into their revolver, spin, and
  **pull the trigger once**. Fires → dead. Blank → survive, unload before next round
- **All-In:** during a reveal round, slam all **8 bullets** on the table. Others must match
  the All-In or fold — and if they fold against an All-In they *still pull the trigger with
  the bullets they'd already bet* [TVTropes]. If ≥1 other player matches → showdown, where
  losers load all 8 and fire (≈ certain death; TVTropes claims a 5% gun-malfunction escape —
  flavor, UNVERIFIED)
- **Coward's Fold:** once per game, fold on the first betting round and pull the trigger
  with just **1 bullet** (1/8 risk) instead of bleeding bullets through a bad hand
- **Switch:** once per hand (pre-showdown), swap one of your cards with one of several
  offered replacements — Jul 2026 rebalance: options shrink 4→2 as the round progresses,
  and you can't declare All-In on the same turn you Switch [official patch; TVTropes]
- Added 2025; part of the Ranked pool later that year [liarsbar.net update guide]

## 4. Liar's Slots (brief)

- Each player sits at their **own slot machine**: 4 slots, 4 suits; **Hearts are the
  scoring suit** [TVTropes: "counting score usually with Hearts"]
- On your spin, **one random slot is revealed to the other players** (you see your own)
- Then you must **claim**: **1/2/3 Hearts**, **Pass**, or **JACKPOT** (assert all four
  slots show the same suit — a truthful jackpot is a 1/64 event)
- Claims add to your score. **Double Spin:** spin again instead, once per game
  (feature added Dec 25, 2025 patch notes: "a second chance when it matters most")
- The **next player** either makes their own claim or **calls the previous claim a lie**:
  - Bluff exposed → liar is punished AND **their previously declared score is removed**
  - Claim was true → the caller is punished
- Punishment = **Death Spin**: roll the slots — **survive only by rolling a Heart (1/4)**,
  anything else eliminates you. (3/4 death — far deadlier than a fresh 1/6 roulette pull)
- **EXECUTE:** once any player reaches score **≥5**, the **highest scorer who is not tied**
  becomes the **Executor**. When their turn comes, they may **Execute the lowest scorer**
  (random pick if tied for lowest). Executor title shifts whenever someone overtakes [TVTropes]
- Last player alive wins (the game-wide rule). Exact execution animation/lethality is
  presumed instant elimination — UNVERIFIED from text sources alone

---

## 4.5 Shoot Opponent ("shoPOPONENT") — full mechanic spec

This is the interaction our owner explicitly wants ("winner shoots the loser"). It is
Chaos mode's signature: punishment flips from *self-roulette* to *aimed at another player*.

**Who shoots, when (original Chaos; debigare is canonical):**

1. **Lie revealed on a LIAR call → the CALLER shoots.** The winner of the call gets the
   gun and picks a target. This is precisely "winner shoots the loser" — although…
2. **Master revealed → the ACCUSED shoots** (the player who played the Master card picks
   the target — a trap that flips the call's outcome)
3. **Chaos revealed → EVERYONE shoots simultaneously** (all non-eliminated players pick
   a target at once and reveal together). TVTropes tropes it as "Mexican Standoff" with
   real "Mutual Kill" potential
4. **Jul 2 2026 variant:** "a successful LIAR call lets you shoot **only the challenged
   player**" — a *narrowed* rule where the winner can only shoot the loser, literal
   winner-shoots-loser. UNVERIFIED which exact rulesets carry this today (see 1.6 conflict)

**Aim phase — 9-second window:**

- The shooter has **9 seconds to point at a target** [debigare]. (Behavior on timeout —
  auto-pick/random/wasted shot — is UNVERIFIED from available sources)
- **Valid targets:** a *remaining* (non-eliminated) opponent who is **either the accused
  or one who still has a card in hand** [debigare]. Meaning:
  - Players who emptied their hand this round are **safe** (they earned safety by going
    out) — not shootable unless they're the accused
  - **Dead players can be pointed at — the shot is wasted** [TVTropes: "anyone pointing
    their gun at a dead person is wasting their shot chance"]. The kill only registers on
    a valid, living target
  - In simultaneous volleys you may target anyone valid — including the person aiming at you

**Trigger pull — blank vs lethal:**

- The shooter reveals the **top card of their own Revolver deck** — the exact same 6-card
  deck (1 Death + 5 Blanks) used for normal self-roulette, at its current spend state
- **Blank** → discarded (chamber spent), nothing happens to anyone
- **Death (lethal)** → the pointed opponent is **eliminated, if valid target**; the
  violence is done TO the target, never to the shooter — a shooter can never kill
  themselves with their own gun in Chaos

**Reload — the successful shooter's reward:**

- If you revealed a live round via Shoot Opponent **and are not eliminated before the end
  of that same round** (someone else's bullet can still find you first in a volley),
  your Revolver deck is **reset to its original state and reshuffled** — back to a fresh
  1/6 [debigare; TVTropes: "loads a new bullet and spins the chamber, getting a new
  1-in-6 chance"]
- Getting a kill is therefore also self-defense banking: your future self-roulette pulls
  are safer than everyone else's. A shooter who kills blanks their deck down 1 chamber.
- Blanks revealed during Shoot Opponent are simply discarded (no reset for surviving)

**Round/deck consequences:**

- Round still ends after a LIAR resolution, exactly like Basic. **Original Chaos:**
  cards re-shuffled and 3 fresh cards re-dealt next round (shootout changes nothing).
  **Chaos 2:** persistent hands — no re-deal while ≥2 players hold cards
- **All-eliminated ⇒ the game ends in a DRAW** (draw case exists because of Chaos
  simultaneous volleys) [debigare]
- Politics layer (why Chaos is FUN): being *right* is not enough — you must predict *who
  will be targeted after the reveal*. Favorites get dogpiled ("There's No Kill like
  Overkill": 3 loaded guns into one player is a legal outcome) [9puz; TVTropes]

---

## 5. Comparison table

Scores 1–5 (5 = most). "Cost" = incremental production cost for OUR web clone given the
Deck MVP already exists (card engine + revolver + animations + 2–7 players).

| Variant/mode | Fun factor | Rules complexity | Chaos level | Dev cost for us | One-line read |
|---|---|---|---|---|---|
| Basic Deck (ref) | 4 | 2 | 2 | (MVP) | The core loop — everything shares its skeleton |
| Devil | 4.5 | 2 (one added card rule) | 4 (multi-roulette reveals) | **1.5** | One marked card + "must play alone" validation + batch roulette resolution. Enormous drama per dev hour |
| Chaos | 5 | 3.5 (4 reveal outcomes) | 5 | **4** | Needs target-selection UI, 9s aim timer, simultaneous volley resolution, reload logic, death-at-target animations. THE owner-requested feature lives here |
| Liar's Deck 2 | 3.5 (strategy niche) | 4 (persistent hands, Joker rounds, Devil's Deal) | 2.5 | **3** | Persistent hands break our clean per-round reshuffle/reconnect model; 28-card counting is for veterans, not party players |
| Devil 2 | 3.5 | 3 (Devil + inverted Deal call) | 4 | **2** (2 increments: Devil + Deal) | Two teaching rules for one reveal; the all-LIES trigger is unintuitive vs Deck 2's |
| Chaos 2 | 3.5 | 4 | 4.5 | **2.5** (piggybacks Chaos) | Redundant with Chaos for casual audiences; splits the lobby pool like it did Steam's |
| Liar's Dice | 4 | 3 | 2.5 | **3.5** | A whole second game (dice UI, bid escalation, poison). Cheapest non-Deck mode, still out of scope |
| Liar's Poker | 4.5 (poker crowd) | 5 (streets, betting, showdown eval) | 4 | **5** | Full poker hand evaluator + bullet-betting economy + 8-shot gun system. Out of scope |
| Liar's Slots | 3.5 | 3.5 | 4 | **5** | 3D slot machines, per-player claim scoring, Death Spin (3/4 death!), Execute. Out of scope |

Chaos-level note: Dice/Poker/Slots aren't "variants" — they're separate games that merely
share the loser-pays-in-blood conceit. Only the Deck rulesets reuse our MVP engine.

---

## 6. What this means for our version

**Ranked recommendation for optional modes/house rules post-MVP:**

1. **ADOPT: Devil — first post-MVP mode.** Cheapest possible spice: mark one card of each
   rank, force solo play, and on reveal fan out a simultaneous roulette for caller +
   card-holders. No new UI paradigm, no targeting, one new card-visual. It converts every
   single-card play into a mind-game (9puz: "suspicious single cards can be traps") —
   maximum fun-per-line-of-code. Our 2–7 table scales it naturally; at 7 players a Devil
   reveal means up to 6 simultaneous roulette pulls (design the batch animation to be
   fast-forward/skip-able on mobile, or multi-eliminations will drag).
2. **ADOPT: the Shoot Opponent mechanic — our signature interaction, shipped in two tiers.**
   The owner explicitly wants winner-shoots-the-loser; Chaos is exactly that.
   - Tier 1 (cheap, do early): a **"Duel" house rule** = the Jul 2, 2026 official rule —
     on a successful LIAR call, the caller shoots *only the challenged loser*. It's the
     purest winner-shoots-loser form, needs just a target-tap step + 9s timer + a
     you-aim-at-one-player animation, and it removes simultaneous-volley complexity.
   - Tier 2 (later, flagship mode): **full Chaos** (12-card deck 5K/5Q/1Chaos/1Master,
     3-card hands, 1 card/turn) with Master inversions and the all-players-everyone-shoots
     Chaos-card detonation. Pre-commit all targets before resolving a simultaneous volley
     (no take-backs when your target dies mid-SWEEP) and resolve all reveals at once.
     Death-by-shot, never self-shot, plus the fresh-1/6 reload reward for successful
     shooters — keep that, it's the elegant part.
   - Mobile UX: aim = tap a player portrait/card; the 9s window is a radial timer. On a
     7-player table a Chaos volley of 7 aim-timers is extreme — consider capping full
     Chaos rooms at 5 players, or ganging 3+ shots on valid targets is fine but resolve
     visually in series.
3. **SKIP (for now): Liar's Deck 2.** Persistent hands poison our clean round-based
   state (reconnect/late-join/AFK handling all get harder), Joker rounds are a veteran
   thrill but a casual trap ("only 4 safe cards in the whole deck"), and its Strategy
   audience overlaps poorly with our free-to-play party-game players. Revisit only if a
   competitive scene forms around our clone.
4. **SKIP: Devil 2 and Chaos 2.** Both are stackable rule-deltas whose extra teaching cost
   exceeds their novelty; Steam itself bounced Chaos 2's design around before splitting
   it into two coexisting modes, and its own player pool fragmented. If we ever want the
   Devil's Deal flavor, port it as a standalone house rule on Devil (all-LIES trigger is
   too confusing for a one-tap lobby — if anything, use Deck 2's all-TRUTHS trigger).
5. **SKIP entirely: Dice, Poker, Slots.** Locked requirements say Deck-only, and each is
   a whole second game (Dice cheapest, Slots/Poker heavy). Also note both Slots (Death Spin
   = 3/4 death) and Chaos lean hard on graphic violence — our web F2P clone must handle
   age-gating/platform-policy review (see doc 10) before emulating these interactions.

**House-rule vault (cheap toggles we can add without new systems):** forced-LIAR on the
last card-holder (already planned, doc 99), "shoot defeated liar" Duel rule (above),
Devil's Deal-style batch-roulette reveals on a 4-card check (pure server logic + reuse of
Devil's batch animation, zero new mechanics).

**Open items for other docs:** our 2–7 player deck math (28-card Deck 2 math does NOT
stretch to 7×7 hands unmodified — doc 02), violence/asset guidelines (doc 10), and
whether "Draw" endings (all-eliminated) are acceptable UX for our lobbies (product call —
Steam shipped it, casuals may find a no-winner ending unsatisfying).
