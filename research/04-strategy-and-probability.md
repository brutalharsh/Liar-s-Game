# 04 — Strategy, Psychology & Probability of Liar's Deck

> Topic: strategy / psychology / probability math → balance for our 2–7p web clone.
> Inputs: `99-initial-search-notes.md` (rules baseline), Oka's Steam strategy guide [Oka],
> Karsten's Medium roulette math [Karsten], 9Puz walkthrough [9puz], liarsbar.net quick-start
> [liarsbar.net]. Own derivations marked **(MATH)**. Written 2026-11-23.

## 1. Card-counting math and deck scaling

### 1.1 The base case (4 players = the whole Steam game)

Deck = 6K + 6Q + 6A + 2 Jokers. With a table rank flipped, **truths = 6 + 2 wild Jokers = 8 of
20 = 40%**. At 4 players the full 20 cards are dealt, so exactly 8 truths are in play every
round. **(MATH)** E[truths per 5-card hand] = 5 × 8/20 = **2.00** — the anchor of every guide
heuristic ("with 2 safe cards you can tell the truth 66% of the time" [Oka]).

**(MATH)** Hand distribution at 4p — hypergeometric P(k) = C(8,k)·C(12,5−k)/C(20,5), C(20,5)=15,504:

| Truths in hand | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Probability | 5.1% | 25.5% | **39.7%** | 23.8% | 5.4% | 0.36% |

Mean 2.0, SD ≈ 0.97. Consequences driving all strategy:

- **70% of hands cannot fund a truthful 3-card play** (P(≥3 truths) = 29.6%) — why guides call big claims "almost guaranteed to be called" [Oka] while liarsbar.net simultaneously notes "three fake cards often discourage challenges" (the psychological gambit of playing *against* math).
- **5.1% of hands are pure desperation** (0 truths — must lie every turn); only **5.8%** hold 4+ truths (the "monster hand" that calls aggressively, §3.3).

### 1.2 What must stay invariant scaling to 5/6/7 players

Guide-derived strategy survives only if: (1) E[truths/hand] = 2.0; (2) truth density ≈ 40%; (3) Jokers ≈ 10% of deck; (4) hand size = 5.

### 1.3 Scaling derivation **(MATH)**

Deck for N players: r cards of each rank, j Jokers, full deal of 5N cards:

```
3r + j = 5N   (deck sized to full deal)
r  + j = 2N   (40% truths → E truths/hand = 2.0)
⇒ r = 1.5N,  j = 0.5N
```

N=4 gives r=6, j=2 → 6/6/6+2J = **exactly the original deck** (the Steam deck is the N=4 instance). Integer solutions exist only for even N. This is also why the owner's example formula "6N+2" fails both constraints (26 cards at N=4, ≠ 20; 44 at N=7, ≠ 35 dealt). The clean general family: **any m × (6/6/6 + 2J) = 20m cards, 8m truths, 40% density for all m**, with E[truths/hand] = 2.0 for any 5-card deal.

### 1.4 Deck option A (recommended): two decks, m = ceil(N/4)

**(MATH)** Full-deal constraint 5N ≤ 20m ⇒ m = ceil(N/4):

| Players | m | Deck | Ranks | Jokers | Truths | Density | Dealt | Sit out |
|---|---|---|---|---|---|---|---|---|
| 2–4 | 1 | **20** (original) | 6/6/6 | 2 | 8 | 40.0% | 10–20 | 0–10 |
| 5 | 2 | **40** | 12/12/12 | 4 | 16 | 40.0% | 25 | 15 |
| 6 | 2 | **40** | 12/12/12 | 4 | 16 | 40.0% | 30 | 10 |
| 7 | 2 | **40** | 12/12/12 | 4 | 16 | 40.0% | 35 | 5 |

- At 2–4p identical to Steam, including the authentic "cards sit out" quirk at 2–3p (liarsbar.net: with <4 players "card counting is approximate") — so partial deals at 5p have precedent.
- E[truths in play] = 5N × 8m/20m = **2N at every N** (4 at 2p … 14 at 7p).
- Hand texture invariant **(MATH)** — hypergeometric (40, 16, 5):

| Truths in hand | 0 | 1 | 2 | 3 | 4 | 5 | Mean |
|---|---|---|---|---|---|---|---|
| 4p, 20-card | 5.1% | 25.5% | 39.7% | 23.8% | 5.4% | 0.4% | 2.00 |
| 5–7p, 40-card | 6.5% | 25.8% | 36.9% | 23.5% | 6.6% | 0.7% | 2.00 |
| 2p, 20-card (10 dealt) | 2.4% | 23.8% | 47.6% | 23.8% | 2.4% | 0.0% | 2.00 |

  Bigger decks fatten tails slightly (P(0 truths) 5.1→6.5%, P(5) 0.4→0.7%) — within ±2 points of the original at every seat count; P(≥3 truths) = 30.8% so big-claim psychology is preserved. Counting is looser at 5p (15 cards sit out), nearly 4p-sharp at 7p (5 sit out).
- 3-card table-reveal deck (1K/1Q/1A) unchanged at all N.

### 1.5 Deck option B (alternative): granular near-full-deal

Maximum countability per N; even N exact, odd N compromise **(MATH)**:

| N | Dealt | Deck | Composition | Truths | Density | E truths/hand | Sit out |
|---|---|---|---|---|---|---|---|
| 2 | 10 | 10 | 3/3/3 + 1J | 4 | 40.0% | 2.00 | 0 |
| 3 | 15 | 17 | 5/5/5 + 2J | 7 | 41.2% | 2.06 | 2 |
| 4 | 20 | 20 | 6/6/6 + 2J | 8 | 40.0% | 2.00 | 0 |
| 5 | 25 | 26 | 8/8/8 + 2J | 10 | 38.5% | 1.92 | 1 |
| 6 | 30 | 30 | 9/9/9 + 3J | 12 | 40.0% | 2.00 | 0 |
| 7 | 35 | 36 | 11/11/11 + 3J | 14 | 38.9% | 1.94 | 1 |

(N=7 alternatives 10/10/10+5 = 42.9% or +2 = 37.1%; the 36-card deck is the best trade. N=5 is slightly lie-heavy, compensating for lower per-capita trial share at big tables, §3.1. Hand distributions stay within ±3 points of the 4p original: 36-card P(0)=7.0%, P(≥3)=28.7%.) **Recommendation:** ship option A (single config per room size); keep option B for playtests.

### 1.6 Scaling-invariant challenge evidence: the blocking table

Your hand convicts their claim. 4p full deal **(MATH)**: you hold y truths → 15 unseen cards hold 8−y truths → P(prev player's 3-card play all real) = C(8−y,3)/C(15,3), C(15,3)=455:

| Your truths (y) | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| P(their 3-play all real) | 12.3% | 7.7% | 4.4% | **2.2%** | 0.9% | 0.2% |

7p, 40-card deck: C(16−y,3)/C(35,3): y=0 → 8.6%, y=3 → 4.4% — same cliff shape, so **calling logic learned at 4p transfers unchanged**. Quantitative core of 9Puz's "call when your own hand blocks the claim."

## 2. Roulette math: which death model, and what it costs

### 2.1 Model A — fixed chamber position (what Steam actually does)

One bullet in one of six chambers, position fixed at match start; each loss spends one chamber [TheGamer table 83/80/75/67/50/0%; liarsbar.net FAQ: "the bullet's position is fixed from the start… a certain hit on the sixth"]. **(MATH)** With s safe chambers spent, death risk of next pull = 1/(6−s):

| Pull # | Risk of THIS pull (given alive) | Cumulative survival |
|---|---|---|
| 1 | 1/6 = 16.7% | 83.3% |
| 2 | 1/5 = 20.0% | 66.7% |
| 3 | 1/4 = 25.0% | 50.0% |
| 4 | 1/3 = 33.3% | 33.3% |
| 5 | 1/2 = 50.0% | 16.7% |
| 6 | 6/6 = 100% | 0% |

TheGamer's "83/80/75/67/50/0" is the *conditional per-pull* survival column — often misread as cumulative; both are above. **(MATH)** E[pulls to death] = (1+2+…+6)/6 = **3.50** (negative hypergeometric r(N+1)/(K+1) = 7/2; matches [Karsten]'s formula and 10,000-trial sim 3.50168). Median death pull = 3; only 16.7% survive to pull 5.

### 2.2 Model B — add a bullet each round and re-spin [Karsten]

Risk on pull k = k/6, re-randomized each pull (Markov chain in the article). **(MATH)** E[pulls] = Σ P(survive k) = 1 + 5/6 + 20/36 + 60/216 + 120/1296 + 120/7776 = 21,576/7,776 = **2.775** (Karsten: sim 2.7758, fundamental matrix 2.7747). Survival collapses 83% → 55.6% → 27.8% → 9.3% → 1.5% → 0.

### 2.3 Which model does Steam use — and which should we implement?

Karsten *concludes* the game follows Model B, but every direct rules source (TheGamer, liarsbar.net, debigare via doc 99: bullet "randomly positioned at game start, fixed for the match") describes **Model A**, and the strategy layer only makes sense under A — spent chambers are a public strategic resource (9Puz: "a correct call against a player near the end of their chamber count is far more valuable"). Karsten's is self-described inference ("shower math"); the rules writeups are direct. **Verdict: Steam = Model A; we implement Model A**, because:

1. **Authenticity** — the (x/6) UI and 6th-pull certainty are the game's signature.
2. **Legible risk = depth** — everyone sees who's a chamber from doom; callers and bluffers reprice off it (§3.2). Model B hides this.
3. **Dread curve** — safety front-loaded (16.7%), horror back-loaded (50% → certain): the emotional product our death animations sell.
4. **Determinism/anti-cheat** — zero RNG at pull time; outcome fixed at match start, nothing to leak, trivial server authority.
5. **Known balance math** — E = 3.5 exactly, so match-length tuning is predictable (§2.4).

UI note: surface the (5/6) state loudly (red chamber) — Steam's streamer moments come from that legibility; median lifespan is 3 losses, P(survive 4+ pulls) = 33%.

### 2.4 Match length math — the critical balance constraint **(MATH)**

Every round ends with exactly one pull (challenge → reveal → roulette → re-deal; forced-call guarantees no round ends without a reveal). Player i's death consumes exactly B_i pulls (their bullet position), so:

```
E[rounds] = 3.5·(N−1) + E[champion's surviving blanks]     (champion blanks ≤ 5)
```

| N | E[deaths] | E[rounds] (≈ +2 champion blanks) | Match length @ ~90–120 s/round |
|---|---|---|---|
| 2 | 1 | 3.5 + ~2 ≈ **5.5** | 6–10 min |
| 3 | 2 | 7 + ~2 ≈ **9** | 14–18 min |
| 4 | 3 | 10.5 + ~2 ≈ **12.5** | 19–25 min ✓ matches Steam VOD pacing |
| 5 | 4 | 14 + ~2 ≈ **16** | 24–32 min |
| 6 | 5 | 17.5 + ~2 ≈ **19.5** | 29–39 min |
| 7 | 6 | 21 + ~2 ≈ **23** | 35–46 min ⚠ |

Match time scales ~linearly with N and is **irreducible under Model A with 6-chamber guns** — the N−1 dead players each cost 3.5 losses. This is our hardest balance constraint (§6.5). (liarsbar.net's "games rarely exceed three rounds" conflicts; at 4p it fits better as *per-player lifespan* (~3.5 pulls) and public-lobby challenge-happiness — trust the derivation.)

## 3. Challenge economics — the "trial"

### 3.1 Oka's trial concept and the bystander share

[Oka]: "Calling liar guarantees your own trial: you face a 50% chance of losing that round, the player you called faces 50%, while the other 2 players face 0%… avoid this trial." Even a favorable coin-flip converts shared risk into a **private flip while everyone else watches at 0%**; corollary (9Puz): "make other players take trials." **(MATH)** Per-round chance of being in the one trial ≈ 2/N:

| N | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|
| Trial share per round | 100% | 67% | 50% | 40% | 33% | **29%** |

At 2p no bystander seat exists (every decision is dual); at 7p under next-only challenges you spectate ~71% of rounds — players 3–7 away from the acting pair are structurally idle (§6.3).

### 3.2 When calling is right: chamber-weighted thresholds **(MATH)**

Naive "call only if >50% sure" ignores gun state. With m_X = chambers remaining for player X (6 = fresh, 1 = at (5/6)), a pull risks 1/m. Call when p·(1/m_A) > (1−p)·(1/m_C), which solves to:

```
p* = m_A / (m_A + m_C)     p = credence that the accused played a fake
```

| Accused ↓ \ Caller → | fresh (m=6) | (2/6)=m5 | (3/6)=m4 | (4/6)=m3 | (5/6)=m2 |
|---|---|---|---|---|---|
| **fresh (m=6)** | 50% | 55% | 60% | 67% | 75% |
| **(2/6) (m=5)** | 45% | 50% | 56% | 63% | 71% |
| **(3/6) (m=4)** | 40% | 44% | 50% | 57% | 67% |
| **(4/6) (m=3)** | 33% | 38% | 43% | 50% | 60% |
| **(5/6) (m=2)** | **25%** | 29% | 33% | 40% | 50% |

**A fresh gun should call a (5/6) player on a 25% gut-read** (their bullet is 3× likelier to fire); **never challenge on <75% credence when *you* are at (5/6)**. 9Puz's "respect late penalties" numerizes directly. Card evidence (§1.6) supplies credence: holding 2+ truths makes a 3-card claim ≤4.4% likely real (credence ≥ 95.6% ≫ any threshold) — a *mandatory* call.

### 3.3 Information sources that move p

- **Blocking (your hand)** — strongest legal signal (§1.6). Community counterpoint (SilverDiamond, Oka's comments): "If you have a good hand you might actually call — the previous person is LESS likely to have the right cards." Reconciliation: a *monster* hand (4–5 truths, ~6.4%) is a calling hand; a *normal* hand (E=2) is an asset to protect (§3.4).
- **Claim size** — 3-card claims are bluff-majority (§1.1); 1-card claims are cheap to fund (P(≥1 truth) ≈ 95%). [Oka] on 2–3/3-2: "the odds of being called are almost guaranteed."
- **Turn position** — by an opponent's 3rd/4th play P(real) falls fast: hands funding 3 truthful plays ≈ 30%, 4 ≈ 5.8% [9Puz: "call late when an opponent is likely starved"].
- **Pattern history** — [Oka] "recognize your own pattern and break it"; punish theirs once.

### 3.4 The reshuffle option-value (calling ≈ folding in poker)

Every challenge ends the round and re-deals. [Oka]: "Calling liar shuffles the deck. You just got a good hand. Another player calls liar. You lose that hand." Calling carries hidden **hand-reset value: positive with a bad hand, negative with a good one** — and a starved caller's absent truths make others' claims less likely to be real (§1.6): the players with the best reason to call also have the best evidence.

### 3.5 Heads-up vs big tables

- **2p**: the next player is the whole table; no bystander exists; forced-call endgame (last play "automatically declared a lie" [TheGamer]) means heads-up always resolves in a reveal — bluff-catching is mandatory, and "in heads-up play, final cards must be Table cards" [liarsbar.net].
- **4p**: designed-for tension; Oka's whole guide lives here.
- **7p next-only (broken case)**: caller pairs are fixed adjacent seats; Oka's "you're only playing against 1 person" collapses to "only against your neighbor; everyone else is furniture" → open-challenge fix (§6.3).

## 4. Bluffing patterns from the guides

### 4.1 Pattern taxonomy [Oka]

Hand = 5 cards split into plays of 1–3; composition is a *bet-sizing schedule*:

| Pattern | Turns | Read [Oka] | Analysis |
|---|---|---|---|
| "50/50" (2–3 / 3–2) | 2 | "high risk… almost guaranteed to be called" | only 30% of hands fund one truthful big play; two in a row begs for a trial |
| "Roulette" (1-1-1-1-1) | 5 | "safest but longest… don't be the last one at the table [or you] auto-call liar" | minimal per-claim exposure; cost = forced-call risk at the end |
| 3-turn (1-1-3, 1-3-1, 3-1-1, 1-2-2, 2-1-2, 2-2-1) | 3 | "the average novice hand" | novices can't help calling; the big play's *position* is the tell |
| 4-turn (perms of 1-1-1-2) | 4 | "the average pro hand… almost never call liar" | slower = cheaper; endgame claim small and often true |

Placement reads: **3-1-1** = bluff loudly while suspicion is lowest (round 1), coast on truths after [Oka: spend truths early if your caller challenges early]; **1-1-3** = build credibility, then slam the final pile — if it passes you're *empty-handed and safe* that round, the real payoff of ending on a bluff.

### 4.2 "Never mix" is the reveal rule, not a preference

On a call the *whole play* is judged — one fake poisons the pile [99; Oka: "do not play true cards with lie cards (you will only hurt yourself)"; 9Puz: "one false card makes the whole play fail"]. Mixed plays are strictly dominated: they lose the trial even when 2 of 3 cards are real, wasting a truth that could have protected a future turn.

### 4.3 Quantity tells: math vs psychology in tension

- Math: big claims are bluff-majority (§1.1, §1.6) → *should* attract calls.
- Psychology: "three fake cards often discourage challenges" [liarsbar.net] — boldness as a meta-bluff that only works on opponents who don't know the blocking table.
- **Design rule for us: show each play's quantity** (Steam does) — the player's only bet-sizing language without voice.

### 4.4 Last-card dynamics and the forced call

- Emptying your hand unchallenged = immunity for the rest of the round [99] → a **race to dump** with a paradox: the *last* player still holding cards is *forced* to call the previous play [99; Oka's 1-1-1-1-1 warning]. Forced callers judge the previous finisher's final play, so skilled players make the hand-emptying play *truthful* and dress bluffs as quick mid-hand dumps that end in safety rather than scrutiny.
- 2p endgame: if all cards get played, the last play is "automatically declared a lie" [TheGamer].

### 4.5 Seat and caller management

[Oka]: "You are not playing against the other 3. You are playing against the person immediately after you… That player rotates as they are killed." Caller profiling drives truth-vs-bluff pacing: aggressive caller → spend truths early to bait bad challenges; passive caller → slip fakes by, save truths. First-round bluffs are the public-lobby norm [liarsbar.net; Oka] — least information, most trial-fear — so *expect* early chaos in our public rooms too.

## 5. Psychology without voice chat

### 5.1 The tells that survive removing voice

| Channel | What it leaks | Source |
|---|---|---|
| Play delay | hesitation on a 1-card claim ≈ suspicion; fast 3-card slam = performed confidence | [9puz]: "taking a long time does not prove you are lying, but it gives observant players a pattern"; advises uniform pacing of truthful vs bluff turns |
| Claim quantity | the only bet-sizing language (1 = modest, 3 = greed or trap) | §4.3 |
| Chamber state (x/6) | public "health bar"; who is desperate vs walking dead | §3.2 |
| Pattern history | repeat compositions, call cadence | [Oka]: "don't do the same thing twice" |
| Hand-empty timing | racing to dump vs camping on truths | §4.4 |

Removing voice removes tonal hesitation, table-talk manipulation of third parties (Oka's "controlling the crowd"), call-out peer pressure mid-timer, and post-reveal crowing — those channels must be rebuilt as mechanics or the game flattens into pure timing reads.

### 5.2 What to ADD to compensate (all cheap on web)

1. **Reaction emotes** — 8–10 preset character reactions (squint, laugh, sweat, "hmph", clap, skull-grin at the roulette); ~5 s cooldown. Replaces tonal tells AND enables bluffing *with* emotion (fake-sweat, then play truth — Oka's "make truthful plays look risky" made mechanical).
2. **Quick-chat presets** — manipulation as designed content: "Check him!", "I'd let it slide…", "Trust me", "Would I lie to you?" Presets (not free text) keep it fast, translatable, moderation-safe.
3. **Dramatic reveal cinema** — the challenge resolution is our emotional product: per-card flips staggered ~450 ms → 900 ms verdict beat → revolver: cylinder lift 0.7 s → spin 0.9 s → lock 0.4 s → hammer 0.5 s → click or BANG → 1.5 s blank relief or 3–4 s death animation. Streamer-bait; also the watcher's entertainment at 7p (71% bystanders).
4. **Timer theater** — final-5-seconds stinger (heartbeat + vignette) making deliberation dramatic instead of merely slow.
5. **Dead-player ghost reactions** — spectate view + ghosts-only chat + emotes; at 7p an early death waits 40+ minutes (§2.4) — keep ghosts engaged or they quit to lobby.
6. **Pre-staging** — off-turn card selection (mobile QoL), commit only on your turn; keeps *timer* tells alive while removing touch-input false tells.

### 5.3 Web-specific pitfalls

- **Mobile timing distortion**: touch selection is slower than mouse; without pre-staging, mobile players systematically "hesitate" and read as suspicious (hence 5.2 #6).
- **Emote spam/misuse**: cooldown + presets-only keeps moderation tractable.
- **Skill mix shifts**: no voice → counting (§1.6) and pattern-reading (§4) carry more weight; casual audience → lean on legibility (§2.3 UI note) so the math is learnable.

## 6. Balancing recommendations for 2–7 players

### 6.1 Round length **(MATH, assumption-flagged)**

Assume rounds consume ~60% of cards before a challenge fires and average play ≈ 1.5 cards (novice 3-turn ≈ 1.67/play, pro 4-turn ≈ 1.25) → **turns per round ≈ 0.6·5N/1.5 = 2N**:

| N | Turns/round ≈ | Round @ 20 s timer | Round @ 15 s timer |
|---|---|---|---|
| 2 | 4 | ~80 s | ~70 s |
| 4 | 8 | ~2.1 min | ~1.7 min |
| 7 | 14 | ~3.6 min | ~2.7 min |

### 6.2 Turn timer ladder

Steam's 30 s doesn't scale (7p could hit 7 min of thinking per round). Recommend **30 s at 2–3p, 20 s at 4–5p, 15 s at 6–7p**, plus a host "fast table" toggle (10 s). Timeout policy (never punishes into suicide): auto-commit a **1-card play (pre-staged selection, else random card)** — silence reads as "believe"; auto-**call** only in the forced-call state. Disconnects: 60 s grace as timeouts, then hand burns face-down ("drunk under the table" — no elimination).

### 6.3 Challenge model: next-only vs open window

- **2–4p: keep next-player-only** — authentic; preserves Oka's single-counter mind-game.
- **5–7p: open challenge window.** With next-only at 7p, trial share drops to 29% (§3.1) and non-adjacent players go whole rounds with zero decision power:
  - After a play lands, **any living player may challenge for 10 s**, concurrent with the next player's decision; the next player's committed play closes the window (= belief). Server-authoritative **first-come wins**; 2 s lockout from play-landing prevents reaction-time snipes; optional "armed" button pre-commits intent.
  - Rationale: restores trial share toward 4p levels, speeds challenge arrival (shorter rounds), makes any strong card-count actionable — not only your neighbor's.
- **Forced call** (last holder must call) kept unchanged at all N [99] — the round's natural clock; works fine at 7.

### 6.4 Optional 7p accelerators (playtest first)

- Allow **1–4 cards per play at 6–7p only** (compresses rounds ~15%); big-claim math holds: P(fund truthful 4-play) = P(≥4 truths) ≈ 6.6% on the 40-card deck → 4-plays are near-certain bluffs in equilibrium. One config value.
- Do **not** shrink hands below 5 — breaks the E=2 anchor (§1.2).

### 6.5 Match length management (the real 7p problem)

From §2.4, E[rounds] = 3.5(N−1) + ~2 is near-irreducible with 6-chamber Model-A guns; with §6.1–6.3 settings 7p lands at ~35–45 min. Options in order:

1. **Transparency** — show "Est. match: ~40 min" on 6–7p lobbies (2–4p ≈ 5–25 min); players self-select; surprise is the enemy, length isn't.
2. **Make watching fun** (§5.2 #3, #5): spectator emotes + reveal cinema turn bystander time into content.
3. **Optional "Quick Draw" variant** (6–7p toggle): revolvers load **2 bullets in 6 chambers** → E[pulls to first hit] = (6+1)/(2+1) = **2.33** **(MATH)** → E[rounds] at 7p ≈ 2.33·6 + ~1 ≈ 16 (~28–32 min), every pull ≥33% lethal — earlier, more dramatic deaths. (5-chamber guns are the weaker lever: E = 3.0.)
4. Position 7p as the "full bar" spectacle; balance for 4–5p as the competitive sweet spot.

### 6.6 Sharpshooter variant note

Owner TBD: loser self-roulette vs loser-picks-target (Chaos-style changes *attribution*, not per-pull odds, but adds kingmaking politics). Ship self-roulette (Model A, §2.3) as default; consider a "Chaos-lite" toggle later.

## 7. What this means for our version — balance parameter table

| Parameter | 2–3p | 4p | 5p | 6p | 7p | Rationale (source) |
|---|---|---|---|---|---|---|
| Deck | 20: 6/6/6+2J | 20: 6/6/6+2J | 40: 12/12/12+4J | 40 | 40 | 40% density & E=2 truths/hand at every N (§1.4) |
| Impact | = Steam exactly | same | partial deal, 15 out | 10 out | 5 out | precedent: Steam sits out cards at 2–3p (§1.4) |
| Hand size | 5 | 5 | 5 | 5 | 5 | E[truths]=2 anchor (§1.2) |
| Table-card deck | 1K/1Q/1A | same | same | same | same | unchanged [99] |
| Revolver | 6 chambers, 1 bullet, fixed at start (Model A) | same | same | same | same | authenticity + legible risk + RNG-free pulls (§2.3) |
| Per-pull death odds | 16.7→100% by pull 6 | same | same | same | same | Model A table (§2.1) |
| Expected match | ~5.5–9 rounds | ~12.5 | ~16 | ~19.5 | ~23 | 3.5(N−1)+2 (§2.4) |
| Turn timer | 30 s | 20 s | 20 s | 15 s | 15 s (10 s fast toggle) | 2N turns/round pacing (§6.2) |
| Timeout action | auto-play 1 card, auto-call only if forced | same | same | same | same | never punish into a challenge (§6.2) |
| Challenge rule | next-player only | next-only | next-only | open 10 s window | open 10 s window | 7p trial share 29% under next-only (§3.1, §6.3) |
| Window mechanics | — | — | — | 2 s arm delay, first-come stamp, closes on next commit | same | anti-snipe, clean flow (§6.3) |
| Forced call | yes | yes | yes | yes | yes | round clock; works at all N [99] |
| Max cards/play | 3 | 3 | 3 | 3 (test 4) | 3 (test 4) | optional 6–7p compression (§6.4) |
| Reveal/roulette cinematic | ~8–10 s staged sequence | same | same | same | same + ghost cam | no-voice replacement for table energy (§5.2) |
| Emotes / quick-chat | 8–10 presets, 5 s cooldown, ghosts keep access | same | same | same | same | rebuild tells + crowd control (§5.2) |
| Card pre-staging | off-turn select, on-turn commit | same | same | same | same | mobile timing fairness (§5.3) |
| Play quantity shown | yes | yes | yes | yes | yes | the bet-sizing tell (§4.3) |
| Quick Draw toggle | — | — | — | 2-bullet guns | 2-bullet guns | E first hit 2.33 pulls → 7p ≈ 30 min (§6.5) |
| Anti-cheat | server-authoritative; cards hidden until reveal; bullet position never sent until death | same | same | same | same | Model A = zero pull-time RNG (§2.3) |

Lobby preset labels: "Duel" (2p), "Table" (3–4p), "Full Bar" (5–6p), "Brawl" (7p + Quick Draw option).

## Sources

- [Oka] *Liar's Deck Strategy*, Steam Community guide 3376301632 (Jan 2025) — trial concept, pattern taxonomy, crowd control, caller profiling (+ commenters SilverDiamond/Twistzz). https://steamcommunity.com/sharedfiles/filedetails?id=3376301632
- [Karsten] *Rushing in Roulette: Liar's Bar's Elimination Mechanics*, Medium (Nov 4, 2024) — 3.5 vs 2.77 derivations, negative hypergeometric formula, Markov/simulation code. https://medium.com/@karstencao/rushing-in-roulette-liars-bar-s-elimination-mechanics-31f6f3c9abfe
- [TheGamer] *How to Play Liar's Deck* — per-pull survival table, heads-up auto-lie rule. https://www.thegamer.com/liars-bar-how-to-play-liars-deck
- [liarsbar.net] *Liar's Bar Quick Start* — tips (no mixing, three-fakes deter, heads-up final cards, first-round bluffs), fixed bullet FAQ, quantity display. https://www.liarsbar.net/g/liars-bar-quick-start
- [9puz] *Liar's Bar Walkthrough* (June 2026) — decision routes, hand-state table, reading players, revolver risk. https://9puz.com/2470-liars-bar-walkthrough
- [99] `research/99-initial-search-notes.md` — rules baseline & source verification.
- **(MATH)** = own derivations: hypergeometric hand/blocking distributions (§1), full-deal scaling r=1.5N, j=0.5N and the m×(6/6/6+2) family (§1.3–1.5), E[rounds] = 3.5(N−1) + champion blanks (§2.4), chamber-weighted challenge thresholds (§3.2), trial share 2/N (§3.1), 2-bullet expectation (6+1)/(2+1) (§6.5).
