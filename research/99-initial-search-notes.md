# 99 — Initial Search Notes (raw material, 2026-11-23)

> Raw notes from the first research pass. These seed the deep-dive docs (01–12).
> Verified against multiple sources where noted. All deep-dive agents: read this file first.

---

## The product we are building (locked requirements from owner)

- **Web browser game**, fully responsive: **mobile + desktop**, no app store download
- Clone of **Liar's Bar (Steam)** but **Liar's Deck mode only** (cards — no Dice/Poker/Slots)
- **2–7 players** per room (Steam original is 2–4 at a table of 4)
- **No built-in voice chat** — players hop on Discord/WhatsApp voice themselves
- Core loop: throw 1–3 cards face-down claiming the table rank → anyone can **"Check"/Call Liar** →
  reveal → **loser gets shot / shoots themselves** (sharpshooter variant to be confirmed) →
  full **shooting animations** (player-select target, gun play, etc.)
- **Free-to-play**; **premium purchase unlocks cosmetic bar themes**
- Owner asked to "download images from Google" — ⚠️ flagged: copyright risk, research doc 10 covers safe alternatives
- Lobby: players take seats (2–7), room code invite, bar theme selection

---

## Game identity (verified)

- **Liar's Bar** — by **Curve Animation** (Ankara, Turkey; founded 2014 by Selçuk Yağcı & Ece Bilgehan; originally an animation studio)
- Engine: **Unity**. Steam **Early Access Oct 2, 2024**, price **$6.99**
- First-person, table of **4 players**, dark-humor anthropomorphic animals
- Characters: **Foxy** (fox), **Scubby** (dog), **Toar** (bull), **Bristle** (pig)
- Platforms: Windows (an Android build existed but is **delisted**)
- Content: Frequent Violence or Gore descriptor; 18+
- **4 modes now exist: Liar's Deck, Liar's Dice, Liar's Poker, Liar's Slots**
- Languages: EN (full audio), TR, RU, zh-CN

## Popularity / stats (verified)

- All-time peak **~113,798 CCU** on **Oct 21, 2024** (Game World Observer; steamcharts lists all-time peak 109,419 — minor source discrepancy)
- Went viral via **Twitch/YouTube streamers** (hundreds of videos, millions of views); 12th highest-grossing Steam product week of Oct 8–15 2024
- **2–5M owners** estimated (SteamSpy); **56k reviews, ~88% positive** (SteamDB, overall 87.98%; recent 30d: Mixed/Mostly Positive ~79%)
- **Won 2024 Steam Award — "Most Innovative Gameplay"**
- Nov 2026 status: still alive — ~380–1,050 concurrent players, 24h peak ~666–1,013 (steamcharts / steamplayerstats)
- Launch trajectory: ~2,000 CCU at launch → 100k+ in 19 days, almost fully organic/streamer-driven

---

## Liar's Deck — core rules (verified across 4+ independent sources)

Sources agree (debigare.com is the most rigorous, based on in-game tutorials + dev comments):

- **Players: 2–4** (we will support 2–7)
- **Deck: exactly 20 cards** — 6 Kings, 6 Queens, 6 Aces, **2 Jokers (wild — always count as the table rank)**
- A separate **table deck: 1 K, 1 Q, 1 A** → each round one is revealed = **Table Card** ("King's Table" etc.)
- Each player **dealt 5 cards, fresh every round** (full 4-player table = entire deck dealt)
- Play proceeds **counter-clockwise**; first player of round 1 is random
- **On your turn (30s limit): play 1–3 cards face-down** into a central pile. Playing them = declaring "these are all [Table Card]s". Lying allowed.
- **Jokers count as Truths** (wild). So per round exactly **8 cards are "truth"** (6 table rank + 2 jokers), 12 are "lies"
- **Only the NEXT player can call "LIAR!"** (challenge). They either believe (play own cards) or call liar. *This is confirmed by multiple strategy sources: "the player after you is the only one who can call your bluff."*
- On LIAR call: the accused's **last-played cards are revealed**:
  - ≥1 card not Table-rank/not Joker → **the liar loses** → plays Russian Roulette
  - All cards valid → **the challenger loses** → plays Russian Roulette
- **Russian Roulette**: each player has a personal **6-chamber revolver with exactly 1 live round**, randomly positioned at game start (position fixed for the match). Each loss = **pull the trigger once**. Blank → survive, that chamber is spent. Live → **death, elimination**, graphic death animation.
  - Death odds per pull: 1/6 → 1/5 → 1/4 → 1/3 → 1/2 → 6th pull is **guaranteed death** (TheGamer survival table: 83%/80%/75%/67%/50%/0%)
  - UI shows chamber status as **(pulled/6)**, e.g. "(5/6)" = next loss is fatal
  - Expected number of pulls before death ≈ **3.5**
- **After EVERY roulette (live or blank): round ends → cards are re-shuffled → re-dealt → NEW table card** → next round starts
- **New round's first player**: the player caught lying (if liar lost), else next in order
- **Empty hand**: skipped for rest of round, **safe** — playing your last card(s) unchallenged removes you from danger this round
- **Forced call**: if only ONE player still has cards, they **must call LIAR** on the previous play
- 2-player endgame: if all cards get played, last played cards are "automatically declared a lie" by the other (TheGamer: heads-up, "the last card will automatically be declared a lie") — i.e. the forced check resolves the round
- **Winner: last player alive.** Dead players spectate (skip turns)
- Turn timer: **30 seconds**

### Edge rules & tips (from guides)

- Don't mix truths and lies in one play (challenge punishes the whole play)
- With <4 players some cards sit out of play → card counting is approximate
- First round bluffing is common in public lobbies; games rarely exceed ~3 rounds?! (liarsbar.net tip — because roulette attrition is fast)
- Deck re-shuffles on every LIAR call result → "you just got a good hand" gets invalidated

---

## Official variants & other modes (for later optional features)

- **Devil (Liar's Deck)**: ONE card of the table rank becomes the **Devil Card** (red). Must be played **alone**. If challenged and revealed, **everyone EXCEPT the devil-player** must play roulette simultaneously
- **Devil's Deal (Liar's Deck 2 / Devil 2)**: may call "Devil's Deal" if ≥4 cards played this round → last 4 cards revealed: if all Truths (Deck 2) / all Lies (Devil 2 differs) → all others play roulette, else caller does
- **Liar's Deck 2**: 8K/8Q/8A/4J (28 cards), 7-card hands, hands can persist between rounds (no reshuffle unless ≤1 player holds cards), occasional **Joker-table rounds**
- **Chaos**: 3 cards dealt, 1 card/play, Aces removed, **Master + Chaos cards**, loser **points revolver at any opponent**; Chaos reveal = everyone points at anyone. Successful shooter reloads (new 1/6)
- **Liar's Dice**: 5 dice each, bid total quantity of a face, raise or challenge. **2 poison bottles = 2 lives**, drink both = dead. Traditional: 1s wild + exact-guess "SPOT ON"
- **Liar's Poker**: Texas Hold'em where you bet **bullets**; 8-shot revolver; loser of showdown loads all bet bullets and pulls once; Coward's Fold (fold early, 1-bullet pull), All-In
- **Liar's Slots**: slot machine reels, claim Hearts count (1/2/3), Pass, or JACKPOT (all 4 match, 1/64); Death Spin: survive by rolling a Heart (1/4); EXECUTE

Strategy sources also note: the ONLY opponent that matters is your immediate caller (next player) — "you're playing against 1 person" — important design insight for how tension works.

---

## Key source URLs

- https://www.debigare.com/how-to-play-liars-deck-from-liars-bar-full-rules-and-variants ← **best rules writeup**
- https://www.liarsbar.net/g/liars-bar-quick-start and /g/liars-deck and /g/rules-summary-for-deck-dice
- https://steamcommunity.com/sharedfiles/filedetails?id=3353349539 (Ultimate Guide)
- https://steamcommunity.com/sharedfiles/filedetails?id=3376301632 (Liar's Deck Strategy)
- https://www.thegamer.com/liars-bar-how-to-play-liars-deck
- https://en.wikipedia.org/wiki/Liar%27s_Bar
- https://store.steampowered.com/app/3097560/ + https://steamdb.info/app/3097560/info + https://steamcharts.com/app/3097560
- https://gameworldobserver.com/2024/10/21/liars-bar-100k-ccu-steam-curve-animation-turkey-success
- https://9puz.com/2470-liars-bar-walkthrough
- http://tvtropes.org/pmwiki/pmwiki.php/VideoGame/LiarsBar (variants detail)
- https://shapes.inc/fandom/liar-s-bar/game-modes
- https://medium.com/@karstencao/rushing-in-roulette-liars-bar-s-elimination-mechanics-31f6f3c9abfe (roulette math)
- https://www.liarsbar.net/ (fan/clone-ish site with guides + practice tools — exists as web precedent)
