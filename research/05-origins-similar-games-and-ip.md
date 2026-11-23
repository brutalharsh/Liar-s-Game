# 05 — Origins of the Underlying Game, Competitive Landscape & IP Risk

> Deep-dive topic: where Liar's Deck's rules come from, who else is building similar games,
> and what intellectual-property law actually blocks us from doing.
> Date: 2026-11-23. Read `99-initial-search-notes.md` first (done).

**⚠️ Disclaimer:** This is research, **not legal advice**. Facts below are marked **[V]** (verified
against cited sources on 2026-11-23) or **[A]** (analysis / legal reasoning by the research agent).
A final name and any launch decision should be confirmed with an IP attorney and a formal
trademark clearance search.

---

## 1. The real-world parent game

### 1.1 Cheat / Bullshit / I Doubt It — the folk ancestor [V]

Liar's Deck is not an original invention of Curve Animation. It is a direct digital adaptation of
the centuries-old shedding/bluffing card game **Cheat** (Britain), a.k.a. **Bullshit / B.S.** (US),
a.k.a. **I Doubt It** (the name used in Hoyle-branded rulebooks and "polite" school versions)
([Wikipedia — Cheat (game)](https://en.wikipedia.org/wiki/Bullshit_%28game%29),
[Guardan card-games guide, 2008](https://www.theguardian.com/lifeandstyle/2008/nov/22/rules-card-games-cheat),
[Pagat — Cheat/Bullshit/I Doubt It](https://www.pagat.com/beating/cheat.html)).

Traditional rules **[V]** (Wikipedia + Pagat):

- **Players:** 3–10 (52 cards; two decks for 5+). All cards dealt out; hands are hidden.
- **Cycle of ranks:** the first player discards face-down and declares **Aces**, the next declares
  **Twos**, the next Threes… up to Kings, then back to Aces. The *required rank rotates every turn*.
- **The lie:** you may discard *any* cards while claiming the required rank. Lying is expected —
  if you hold none of the required rank you are forced to lie.
- **The challenge:** any player who suspects a lie calls **"Cheat!" / "Bullshit!" / "I doubt it!"**.
  The last play is flipped. Liar → **picks up the whole discard pile**; wrongly-accused honest
  player → the *challenger* picks up the pile. Once the next player plays, it's too late.
- **Win condition:** first player to shed all cards (and survive a challenge on the final play).
- In print since at least the 1910s under "I Doubt It"; older than that in oral tradition
  ([kiblitz.blog](https://kiblitz.blog/games/cheat), [Denexa — I Doubt It](https://www.denexa.com/blog/doubt/)).

### 1.2 The *fixed-rank* branch — Liar's Deck's true parent [V]

Pagat documents a second family of the game that is even closer to Liar's Deck than cycling Cheat:
**I Doubt It / "Bluff"**, where **all players must claim the SAME rank for the whole round** —
exactly Liar's Bar's "Table Card" mechanic
([Pagat — I Doubt It (fixed rank)](https://www.pagat.com/beating/doubt.html)):

- A **lead** starts the round by playing a card face-down and **announcing a rank** — the rank is
  fixed until the round ends (= the Table Card).
- Each player passes or plays cards claimed to be that rank (**Bluff variant, West Bengal: several
  cards per turn, all claimed as the announced rank**) — = Liar's Deck's "play 1–3 cards".
- **Jokers:** in the Bengal Bluff variant played with jokers, *"the jokers are wild and are always
  the truth, no matter what rank is supposed to be played"* — **word-for-word Liar's Deck's joker rule**.
- **Challenge:** any player calls "Bluff"/"Doubt"; the last play is revealed; the loser **picks up
  the pile**.
- Russian **Верю — не верю** (*Verish' ne Verish'*, "I believe / I don't believe", played ~a century
  in Russia with a 36-card deck) is the same fixed-rank family, with a *"veryu" / "ne veryu"*
  call structure; one documented Russian variant even deals **5-card hands**, **refills hands**,
  and **forces a player with no cards to make a call** — prefiguring Liar's Deck's fresh-deal rounds
  and forced-call endgame ([Wikipedia §Veryu Ne Veryu](https://en.wikipedia.org/wiki/Bullshit_%28game%29#Veryu_Ne_Veryu),
  [Russian Wikipedia — Верю не верю](https://ru.wikipedia.org/wiki/%D0%92%D0%B5%D1%80%D1%8E_%D0%BD%D0%B5_%D0%B2%D0%B5%D1%80%D1%8E)).
- **Canadian/Spanish "Bluff" / Fourshit / Eightshit:** fixed rank per round, two decks,
  **four jokers, wild** — again the same skeleton ([Wikipedia §Canadian/Spanish Bluff](…)).

**Rule-by-rule DNA table [V]:**

| Element | Cycling Cheat (UK/US) | Fixed-rank I Doubt It / Bluff (Bengal) / Verish' ne Verish' (RU) / Fourshit (CA-ES) | **Liar's Deck (Curve)** |
|---|---|---|---|
| Claimed rank | rotates A→K each turn | **fixed per round** (leader/table picks) | **fixed per round (Table Card)** |
| Cards per turn | 1+ | 1 (IDI) / **1+ (Bluff)** | 1–3 |
| Jokers | none standard | **wild, always truth (Bluff/joker variant; Fourshit)** | **2 jokers, always truth** |
| Hand | entire deck dealt out | fixed hands; RU variant: 5-card refill hands | **5 fresh cards every round** |
| Challenge window | until next play | until next play | **only the next player** |
| Caught-liar penalty | pick up pile | **pick up pile** | **Russian-roulette trigger pull** |
| Everyone-else-safe? | n/a | n/a | Devil variant: all-but-player pull |
| Winner | first to shed | first to shed (RU sometimes last-with-cards loses) | **last player alive** |
| Deck | 52 | 52 / 36 (RU) | 20 (6K/6Q/6A/2J) |

The *only* genuinely new ingredients Curve added are: (a) the compressed 20-card deck, (b)
restricting the challenge to the next player (a house rule that also appears in the 2006
*Pirates of the Caribbean: Dead Man's Chest* Liar's Dice scene per fan analysis —
[TV Tropes, YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PiratesOfTheCaribbeanDeadMansChest)),
and (c) **replacing "pick up the pile" with Russian roulette elimination**.

### 1.3 The Russian-roulette penalty is also borrowed [V]

The roulette layer is a folk trope, not Curve's: the term "Russian roulette" first appears in
Georges Surdez's short story in *Collier's*, 30 Jan 1937 (OED-confirmed first written use; the
story itself sets it among Russian officers ~1917, unproven historically) —
[Swiss National Museum blog](https://blog.nationalmuseum.ch/en/2025/01/invention-of-russian-roulette),
[Wikipedia — Russian roulette](https://en.wikipedia.org/wiki/Russian_roulette).
A bluffing contest punished 1-bullet-in-6 trigger pulls is a stock party mechanic (drinking-game
"shot roulette" versions are mass-market products). **[A]** Conclusion mechanics-level: Liar's Deck
= **fixed-rank Cheat (Blöf/Bluff/Verish' family) + 1937-fictionalized roulette penalty, wrapped in
a 20-card deck.** Even the fansite liarsbar.net concedes the lineage in its own guide:
*"built on the same idea as the classic party game Cheat (also called BS or I Doubt It)"*
([liarsbar.net/g/liars-deck](https://www.liarsbar.net/g/liars-deck)).

### 1.4 Liar's Dice — the sibling folk game [V]

- Origin: **Dudo** ("I doubt"), a cup-and-dice bluffing game of the Andes/Inca world (15th-c. claim
  per Wikipedia; historians treat the Inca story as legend-ish, origin "murky")
  ([Wikipedia — Liar's dice](https://en.wikipedia.org/wiki/Liar%27s_dice),
  [levigoode.com history](https://levigoode.com/feature/the-history-of-liars-dice-and-how-to-play-it),
  [BGG thread](https://boardgamegeek.com/thread/1560165/richard-borg-invented-liars-dice)).
- Known worldwide as Perudo, Cachito, Menteur, Bluff, Call My Bluff (a Liar's Dice variant **won the
  1993 Spiel des Jahres** — [Wikipedia](https://en.wikipedia.org/wiki/Liar%27s_dice)).
- Pop-culture burst: **Pirates of the Caribbean: Dead Man's Chest (2006)** — Will Turner challenges
  Davy Jones to Liar's Dice, wagering years of service; the scene follows real rules and drove
  mainstream interest; merchandised as "Pirate's Dice"
  ([Pirates fandom wiki](https://pirates.fandom.com/wiki/Liar%27s_Dice),
  [IMDb quotes](https://www.imdb.com/title/tt0383574/characters/nm0631490)).
- **[A]** Note: Curves' "Liar's Dice" mode (poison instead of roulette) is the same folk game with a
  live-count penalty. Nothing in either mode is Curve-authored at the mechanics level.

### 1.5 Regional names of the Cheat family worldwide [V]

Good naming / marketing material (all from
[Wikipedia — Cheat (game), international variants](https://en.wikipedia.org/wiki/Bullshit_%28game%29)
and its interlanguage links; Pagat):

| Region | Name(s) |
|---|---|
| Britain / US | Cheat / Bullshit / B.S. / I Doubt It |
| Germany / Austria | Mogeln, Schwindeln, Lügen, Zweifeln (Vorarlberg: Lüga) |
| Russia | Верю — не верю ("I believe, I don't believe") |
| Sweden | **Båg** (the Swedish Cheat; *bluffstopp* is a related bluffing shedding game) |
| Turkey | **Blöf** (Curve Animation's home country has its own national name for it!) |
| China (Fujian) | 吹牛 chuī niú "bragging" / 说谎 shuōhuǎng "lying" |
| Japan / Korea | ダウト (Dauto/Doubt) / 다우트 (Doubt) |
| France / Italy / Spain / Portugal | Menteur / Dubito / Mentiroso / Desconfia |
| Netherlands / Poland / Romania / Hungary | Liegen / Oszust / Trombon / Hazudós |
| Greece / Hebrew / Persian / Slovenian | Μπλόφα / שקר / بلوف / Lažnivec |
| India (Bengal) | Bluff |
| Canada | "Bluff", a.k.a. Fourshit/Eightshit |

---

## 2. Competitive landscape (as surveyed 2026-11-23)

### 2.1 Direct "Liar's Bar-like" products found [V]

| Product | Platform | Players | Monetization | Quality | Legal posture observed |
|---|---|---|---|---|---|
| **Liar's Bar** (Curve Animation, Steam EA) | Windows; an Android build existed, now delisted (99-notes) | 2–4 | $6.99 buy-to-play; in-game currency/custom clothing on roadmap | High (88% positive, 56k reviews) | Trademark applicant (see §3.3); AI-voiced characters ([SteamDB AI disclosure](https://steamdb.info/en/ai/rules)) |
| **HopBar** (hoplobby.com) | **Web browser** | 1–4 + bots | Free-to-play, no visible IAP yet | Competent; updated Oct 2026 | Web clone using Curve's mode names ("Liar's Deck", "Devil's Deck") ([hoplobby.com/games/hopbar](https://hoplobby.com/games/hopbar)) |
| **liars-deck** (GitHub, walidmansour101-gif) | Web (Node/Express/Socket.IO) | 2–6 + bots | Free, open source | Hobby | Open-source full clone incl. roulette; still live ([github.com](https://github.com/walidmansour101-gif/liars-deck)) |
| **Liar's Bar 2D** (High Level, itch.io) | HTML5, single-player | 1 vs bots | Free, open source | Hobby prototype | Fan remake, self-labeled ([itch.io](https://high-level.itch.io/liars-bar-2d)) |
| "Liar's Bar (Browser)" (Reddit r/playmygame) | Web | multiplayer | F2P | Unknown, solo dev | Named after the original game ([reddit post](https://reddit.com/r/playmygame/comments/1sfm5jj/game_title_liars_bar_browser)) |
| **liarsbar.net** | Web site (NOT a game) — guides + roulette/deck/dice simulators, 19 languages | n/a | Ads ("Advertise" page) | Polished SEO | Independent fan site, states "not affiliated" ([liarsbar.net](https://www.liarsbar.net/)) |
| **liars-bar.com** | Web site — describes the game, FAQ | n/a | Affiliate-ish ("Get it on Steam - $6.99") | Medium | Fan site ([liars-bar.com](https://liars-bar.com/)) |
| SEO "free Liar's Bar online" portals: glazegames, gamehubarena.fun, freeh5games.org, gameilo.com, jumpcade.com, tops.games, storytellergame.io, pl2w.com | Web pages | varies | Ad-portal | Low; partly SEO-bait of unclear content **[U]** | Ride the "Liar's Bar" keyword openly |

### 2.2 Folk-game (Cheat) implementations — the genre we actually sit in [V]

| Product | Platform | Players | Notes |
|---|---|---|---|
| **CardzMania — Cheat** | Web | 3–12 | Free, "No ads", 175 rule variations, long-running 24k users — proof the un-themed folk game survives fine online ([cardzmania.com/Cheat](https://cardzmania.com/Cheat)) |
| GameNoa — Cheat (BS) | Web | vs AI up to 5 | Free ([gamenoa.com](https://gamenoa.com/en/doubt)) |
| App Store "Cheat! – Bluffing Card Game" / Google Play "Bluff: Card Game" | iOS/Android | 1 + AI/online | Ad-supported standard apps |
| RuStore "Блеф Онлайн" (Believe-Not-Believe) | Android (RU market) | online | The Russian fixed-rank variant sold as its own game |
| Zynga **Bluff Plus** | Mobile (2020-era) | social | Major-publisher treatment of the same folk game (Zynga catalog, [practicalecommerce.com](https://www.practicalecommerce.com/93-mobile-games-of-zynga)) |

### 2.3 Roblox

- **Liar's Table** (Let's Make Games) — *"based on the paid Steam game Liar's Bar and adapted for
  Roblox"* ([Roblox fandom wiki](https://roblox.fandom.com/wiki/Let%CB%88s_Make_Games/Liar%27s_Table)).
- **Liar's Game** (SoraYuuV) — tagline *"Inspired by Liar's bar"*
  ([roblox.com](https://roblox.com/games/92693743891259/Liars-Game)).
- Various "Liar's Club"/Liar's Bar TikTok-played experiences. Typical Roblox monetization
  (Robux passes) — none observed to be actioned. **[V] for existence, [A] for monetization pattern**

### 2.4 Piracy (different lane, shows ecosystem) [V]

itch.io hosts collections/blog pages called "Liar's Bar Free Download (v0.98 + Co-op)" with crack
links ([itch.io collection](https://itch.io/c/6852748/liars-bar-free-download-v098-co-op),
[itch.io blog](https://itch.io/blog/1689516/liars-bar-free-download)) — outright copyright
piracy of Curve's build. Distinct from rule-cloning, but illustrative: even pirates haven't been
visibly purged.

### 2.5 Enforcement observed

- **No public reports** of DMCA takedowns, C&Ds, or lawsuits from Curve Animation against any
  clone, fan site, or Roblox experience were found (searched 2026-11-23: "Liar's Bar clone takedown
  DMCA legal action" → zero results). **[V as absence-of-evidence]**
- **But** Curve filed for trademark protection one month after going viral (§3.3) — they are
  actively building an IP portfolio, so non-enforcement so far is not permission. **[A]**

### 2.6 Gap analysis [A]

Nobody currently occupies the "**free, browser, 2–7 players, polished, cosmetic-monetized**" slot:
the official game is paid + 2–4 players; HopBar is 1–4 and unmonetized; the GitHub clone is
hobby-grade; CardzMania has no roulette hook; the SEO portals are low quality. The quality bar in
the clone tier is **low** — a properly produced web version can immediately lead the niche. The
trademark filing, not current competition, is the real constraint.

---

## 3. IP / legal research

### 3.1 Copyright: rules of a game are generally NOT copyrightable [V]

- US Copyright Office (FL-108): *"Copyright does not protect the idea for game, its name or title,
  or the method or methods for playing it. Nor does copyright protect any idea, system, method…"*
  ([ABA Landslide summary](https://americanbar.org/groups/intellectual_property_law/publications/landslide/2014-15/march-april/its-how-you-play_game_why_videogame_rules_are_not_expression_protected_copyright_law.html)).
- 17 U.S.C. §102(b) idea/expression dichotomy; courts add **merger** and **scènes à faire** doctrines
  — elements "inevitable" to a game type get no protection
  ([Mitchell Hamline Cybaris](https://open.mitchellhamline.edu/cgi/viewcontent.cgi?article=1062&context=cybaris)).
- Same principle internationally: an Indian court held in the Scrabulous matter that because
  gameplay isn't copyrightable, the board/rules necessary to it aren't either
  ([Marquette I.P. blog](http://law.marquette.edu/facultyblog/2008/10/15/the-indian-scrabulous-decision));
  Chinese and Korean courts likewise: rules not copyrightable but their **expression** is
  ([Jipyong PDF](https://www.jipyong.com/a/181230_SSC.pdf),
  [ResearchGate comparative study](https://www.researchgate.net/publication/397098759_Copyrightability_of_game_rules_in_the_United_States_and_China)).

### 3.2 What IS protected even when rules aren't [V]

Expression, not mechanics: code, art (characters, card faces, UI), text (tutorials/lore),
audio/music, and — at the extreme — a game's overall "look and feel"/trade dress when copied
wholesale. **Tetris Holding, LLC v. Xio Interactive, Inc.**, 863 F. Supp. 2d 394 (D.N.J. 2012):
Xio *admitted copying the rules* (believing §102(b) shielded it — the court agreed rules are
unprotectable) but **lost anyway**: the clone's expression (board dimensions, piece colors/design,
rendering) was substantially similar to Tetris's, i.e. infringing expression + trade dress
([Wikipedia](https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.),
[loeb.com](https://loeb.com/en/insights/publications/2012/06/tetris-holding-llc-v-xio-interactive-inc),
[counterpoint](https://cardozoaelj.com/2013/12/23/tetris-holding-v-xio-interactive-isnt-as-great-a-case-as-video-game-developers-think-it-is)).

**Precedent scoreboard [V]:**

| Case / event | What happened | Lesson for us |
|---|---|---|
| Tetris v. Xio (Mino) | Rule-copier still liable for copied look-and-feel | Copy mechanics only, never surface |
| Hasbro v. Scrabulous (RJ Softwares, 2008) | suit dropped after the game was changed/renamed **Lexulous** | Word-game rules survived; the *name* was the flashpoint ([Reuters](https://reuters.com/article/hasbro-settlement/hasbro-withdraws-suit-against-scrabulous-creator-idUSN1541432720081215), [BetaNews](https://betanews.com/2008/12/16/scrabulous-case-d-i-s-m-i-s-s-e-d/)) |
| Spry Fox v. 6Waves/LOLApps (Triple Town v Yeti Town, 2012) | Copyright claim partially survived; **settled with the clone's IP transferred to the original dev** | Fast-follow clones CAN lose hard ([GameDeveloper](https://www.gamedeveloper.com/business/there-is-substantial-similarity-between-i-triple-town-i-and-i-yeti-town-i---u-s-court), [GamesIndustry.biz](https://gamesindustry.biz/spry-fox-wins-ownership-of-yeti-town-as-part-of-triple-town-settlement)) |
| Threes v. 2048 (2014) | **No legal action was possible.** Creator Asher Vollmer: *"My copyright on Threes only covers the look and feel of the game, and 2048 looks very different. My trademark only covers the icon and name… My only hope would be to patent the game mechanics, which I will never do."* | The definitive statement of the industry's real rules ([Engadget](https://www.engadget.com/2015-05-05-threes-2048-google-play-app-store.html), [The Verge](https://www.theverge.com/22914955/threes-2048-ketchapp-copycats-clones-mobile-games), [creators' letter](https://asherv.com/threes/threemails)) |

### 3.3 Trademark: "LIAR'S BAR" is claimed territory [V]

From Justia Trademarks / USPTO record for Serial **79415828**:

- **Word mark:** LIAR'S BAR. **Owner:** CURVE ANIMASYON PRODUKSIYON (joint-stock company = Curve
  Animation, Ankara).
- **International registration (Madrid Protocol)** IRN **1836234**; international registration date
  **2024-11-25** *(one month after the viral spike)*; **priority claimed 2024-10-23**;
  published 2025-01-30. USPTO status at that snapshot: **"New Application — Record Initialized
  Not Assigned To Examiner"**; US auto-protection date 2026-07-30; renewal 2034-11-25
  ([Justia](https://trademarks.justia.com/794/15/liar-s-79415828.html)).
- **Nice classes:** **9** (downloadable game software, mobile apps), **41** (online entertainment /
  providing online games), **42** (online non-downloadable software / SaaS) — i.e. **exactly the
  classes of a browser game like ours**, including the free-to-play web delivery model.
- Caveat: this is a Madrid application record; current per-country status (US/EU/others) must be
  re-verified in Madrid Monitor/TSDR and national registers before launch. Resellers also treat
  the name as Curve's mark ([allkeyshop boilerplate](https://www.allkeyshop.com/blog/en-us/buy-liars-bar-cd-key-compare-prices/)).
- No patent, design patent, or registered copyright by Curve on *mechanics* surfaced in any search
  we ran. Game-mechanic patents are rare in this genre, and prior art (the entire Cheat family +
  mass-market roulette-drinking games) is abundant. **[A — no evidence found ≠ non-existent]**

### 3.4 Legality verdict for a mechanic-identical clone [A]

**Mechanics: buildable.** Every rule of Liar's Deck predates Liar's Bar by decades-to-centuries and
is documented as folk-game material (§1). Free-to-play + cosmetic monetization adds nothing
infringing (business model ≠ protected expression). The GitHub/itch/Roblox clones have operated
openly for 2+ years without enforcement.

**What we MUST NOT do [A, from §3.2 precedents]:**

1. **Do not title the game "Liar's Bar"** (or "Liar's Bar Online", "LiarsBar", "Liar's Bar Web" —
   confusable variants). Pending Madrid application in exactly our classes + common-law rights +
   identical game genre = straightforward likelihood-of-confusion case, and platform stores will
   side with the mark holder. Worst single decision available to this project.
2. **Do not copy characters** — Foxy (gothic fox), Scubby (Dobermann), Toar (buffalo), Bristle (pig)
   are Curve's expression. Avoid anthropomorphic-animal bar-patrons in similar style; use different
   framing (silhouettes, emblems, original creatures or no characters).
3. **Do not copy art/UI**: their card faces & backs, bar scene design, revolver models, death
   animations, HUD layout copied too closely. Our 2-D presentation must be its own expression
   (recall *Tetris v. Xio*: the ASCII-level similarity is what kills).
4. **Do not copy their tutorial/store text** (literary expression), their music, or their
   AI-generated voices — even AI-voiced audio is their fixed expression.
5. **Do not copy Google images** for any asset (owner's standing idea — already flagged in doc 99;
   doc 10 covers safe sourcing of original art).
6. **Do not use their mode names verbatim** as branding: "Liar's Deck", "Liar's Dice" as *titles*.
   Use mechanically descriptive alternatives ("The Deck", "Cheat Deck", etc.). HopBar's use of
   "Liar's Deck" as a mode name is a calculated risk we don't need to take.
7. **Do not SEO/bid on "Liar's Bar" keywords** ("liar's bar free online", etc.) — that's trading on
   their mark (and platforms penalize it; cf. Threes being *itself* briefly delisted from Google
   Play over keyword stuffing — [Engadget](https://www.engadget.com/2015-05-05-threes-2048-google-play-app-store.html)).

**What is SAFELY free [A]:** the full rule set (table card, 1–3 face-down cards, jokers-always-true,
next-player-only challenge, 1-in-6 fixed live round, persistent chamber counter, empty-hand/forced-
call/resolved-roulette-ends-round), the "call the bluff / russian roulette" fantasy, the bar setting
as a *concept*, cosmetic-theme monetization, describing the game as "a modern online take on the
classic card game Cheat / B.S. / I Doubt It" (truthful, and drafting on *public-domain* names).

### 3.5 Jurisdictional notes [V where cited; A otherwise]

- The idea/expression rule and "titles/names are trademark territory" pattern hold in the US, EU,
  and (per the Scrabulous judgment) India; China protects expression of game rules even while
  denying protection to rules (Jipyong, ResearchGate, §3.1).
- Curve is Turkish and filed internationally via Madrid (which includes US, EU; designations per
  IRN 1836234 — verify list). Our market (English-language web, global) collides with their
  classes regardless of venue.

---

## 4. Name candidates (vibe preserved, trademark dodged)

All candidates need a clearance pass (USPTO/EUIPO/TURKIYE + domain + app stores) before commit. **[A]**

| # | Name | Pros | Cons / risk |
|---|---|---|---|
| 1 | **Liar's Tavern** | Keeps owner's vibe almost exactly | Still "Liar's ___" near a claimed mark; weaker distinctiveness; shortens the distance we need |
| 2 | **Bluff Bar** | "Bluff" is the generic folk-game word (used on 4 continents); bar vibe intact | Generic, hard to own; crowded in mobile app stores |
| 3 | **The Cheat's Den** | Direct lineage nod to Cheat; den = seedy bar vibe | "Cheat" word is used by existing apps (Zynga etc.); mild |
| 4 | **Dead Man's Hand** | Genuinely card-native (Wild Bill Hickok's aces-and-eights) + mortal stakes | Historic phrase, fairly crowded in the poker space; could distract |
| 5 | **Blind Tiger** | Prohibition-slang for speakeasy — PERFECT bar+vice vibe, no "liar" morpheme | Must check few existing blind-tiger brands (bars often use it) |
| 6 | **Six Chambers** | Evokes revolver mechanic 1:1; ownable, brandable, zero "liar" overlap; works as "Six Chambers Saloon" for bar theme | Explains revolver but not lying; thin lore otherwise |
| 7 | **Crooked Deck** | Cards + cheating double meaning; strong for the Deck-only product | Needs TM clearance ("crooked deck" appears in poker vernacular) |
| 8 | **Doubt It!** | The literal folk name of the parent game — truthful heritage; two-word legacy brand | Genericness/low registrability; existing "I Doubt It" apps exist |
| 9 | **Last Round** | Saloon double meaning + "final round" of roulette | Common phrase; collision check needed |
| 10 | **Snake Oil Saloon** | Original, comedic, bar-theme fits cosmetic skins | Long; doesn't signal revolver |
| 11 | **Truth or Lead** | Punny, tense, unique | Alternates meaning may read awkward |
| 12 | **Verish' / Ne Verish'** | Deep lineage flex (Russian parent game); differentiated, memorable | Hard to pronounce for EN market |
| 13 | ~~Liar's Table~~ | — | Already a Roblox game (Let's Make Games) — AVOID |
| 14 | ~~HopBar~~ | — | Existing competitor — AVOID |

**Top 3 shortlist [A]:**

1. **Six Chambers** — most brandable, mechanic-native, cleanest distance from "Liar's" marks; pairs
   with a saloon theme stack for cosmetics ("Six Chambers Saloon").
2. **Crooked Deck** — best fit for a cards-only product; evocative of bluffing + the 20-card deck.
3. **Doubt It!** — the heritage play: it IS the public-domain name of the parent game, positions us
   as the classic rather than a copy, and dodges any Curve claim; downside is weaker registrability.

---

## 5. What this means for our version

**Risk verdict [A]:**

- **Mechanic-identical game: GREEN LIGHT.** The rule set is folk material, documented for 100+ years
  across at least 15 national traditions (§1), and clones of all shapes have operated without
  enforcement (§2.5). Copyright does not reach it (§3.1); precedent says only expression matters
  (§3.2).
- **The name "Liar's Bar": RED LIGHT.** Curve has a pending international trademark (IRN 1836234,
  classes 9/41/42 = our exact product classes, priority Oct 2024), and a same-name same-genre
  product is a textbook confusion case **[V for the filing, A for the conclusion]**.
- **Everything visible must be ours:** characters/cards/scene/audio/tutorial text/UI look
  (Tetris-v-Xio lesson, §3.2). No Google-image assets (see doc 10). Verbatim "Liar's Deck" as a
  branded mode name: avoid.
- **Monetization:** F2P + cosmetic bar themes is legally unproblematic and, in the current
  landscape, a point of differentiation (nobody else in the web tier has serious cosmetic systems).

**Naming recommendation:** Do not launch as "Liar's Bar". Go with **Six Chambers** (primary) or
**Crooked Deck**/**Doubt It!** per §4, after a formal clearance (USPTO TESS + EUIPO + TÜRKPATENT +
Madrid Monitor for IRN 1836234, plus domain/social handle check). Budget one short IP-attorney
consult before public launch to bless the final name + a fresh similarity check. **[A]**

**Positioning:** market it as *"the classic bluffing card game Cheat / B.S. / I Doubt It, reborn
as a free browser game with a deadly twist"* — truthful lineage statement that claims the
public-domain side of the family and never mentions the trademarked side. Keep SEO on generic terms
("bluffing card game online", "Cheat card game multiplayer", "doubt it game"), never on "Liar's Bar"
or its near-variants.

---

## Source URL index

**Folk game & history**
- https://en.wikipedia.org/wiki/Bullshit_%28game%29 (Cheat/BS/I Doubt It + international variants incl. Verish', Fourshit, bluffstopp/Båg, chuī niú)
- https://www.pagat.com/beating/cheat.html (canonical cycling-Cheat rules)
- https://www.pagat.com/beating/doubt.html (fixed-rank I Doubt It / Bengal "Bluff" — jokers-wild rule)
- https://www.pagat.com/beating/verish.html (Russian Verish' ne Verish')
- https://www.denexa.com/blog/doubt/ , https://kiblitz.blog/games/cheat (print history)
- https://ru.wikipedia.org/wiki/%D0%92%D0%B5%D1%80%D1%8E_%D0%BD%D0%B5_%D0%B2%D0%B5%D1%80%D1%8E
- https://en.wikipedia.org/wiki/Liar%27s_dice , https://pirates.fandom.com/wiki/Liar%27s_Dice (PotC scene)
- https://blog.nationalmuseum.ch/en/2025/01/invention-of-russian-roulette (1937 Surdez origin, OED)
- https://en.wikipedia.org/wiki/Russian_roulette
- https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PiratesOfTheCaribbeanDeadMansChest (next-player-call house rule)

**Landscape**
- https://hoplobby.com/games/hopbar (HopBar — closest web competitor)
- https://github.com/walidmansour101-gif/liars-deck (open-source 2–6p web clone)
- https://high-level.itch.io/liars-bar-2d (fan remake)
- https://www.liarsbar.net/ , https://www.liarsbar.net/g/liars-deck (fan site; lineage admission)
- https://liars-bar.com/ (fan site #2)
- https://cardzmania.com/Cheat (folk-game web precedent)
- https://gamenoa.com/en/doubt , App Store "Cheat! – Bluffing Card Game", Google Play "Bluff: Card Game", RuStore "Блеф Онлайн"
- https://roblox.fandom.com/wiki/Let%CB%88s_Make_Games/Liar%27s_Table , https://roblox.com/games/92693743891259/Liars-Game
- https://itch.io/c/6852748/liars-bar-free-download-v098-co-op , https://itch.io/blog/1689516/liars-bar-free-download (piracy)
- https://reddit.com/r/playmygame/comments/1sfm5jj/game_title_liars_bar_browser
- https://glazegames.com/game/liar-s-bar , https://tops.games/game/liars-bar , https://storytellergame.io/liars-bar/ (SEO portals)

**IP / legal**
- https://americanbar.org/groups/intellectual_property_law/publications/landslide/2014-15/march-april/its-how-you_play_game_why_videogame_rules_are_not_expression_protected_copyright_law.html (USCO FL-108, rules not copyrightable)
- https://open.mitchellhamline.edu/cgi/viewcontent.cgi?article=1062&context=cybaris (merger / scènes à faire)
- https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc. , https://loeb.com/en/insights/publications/2012/06/tetris-holding-llc-v-xio-interactive-inc , https://cardozoaelj.com/2013/12/23/tetris-holding-v-xio-interactive-isnt-as-great-a-case-as-video-game-developers-think-it-is
- http://law.marquette.edu/facultyblog/2008/10/15/the-indian-scrabulous-decision , https://reuters.com/article/hasbro-settlement/hasbro-withdraws-suit-against-scrabulous-creator-idUSN1541432720081215 , https://betanews.com/2008/12/16/scrabulous-case-d-i-s-m-i-s-s-e-d/
- https://gamesindustry.biz/spry-fox-wins-ownership-of-yeti-town-as-part-of-triple-town-settlement , https://www.gamedeveloper.com/business/there-is-substantial-similarity-between-i-triple-town-i-and-i-yeti-town-i---u-s-court
- https://www.engadget.com/2015-05-05-threes-2048-google-play-app-store.html , https://www.theverge.com/22914955/threes-2048-ketchapp-copycats-clones-mobile-games , https://asherv.com/threes/threemails
- https://www.jipyong.com/a/181230_SSC.pdf , https://www.researchgate.net/publication/397098759_Copyrightability_of_game_rules_in_the_United_States_and_China
- **https://trademarks.justia.com/794/15/liar-s-79415828.html (LIAR'S BAR — Curve Animasyon, IRN 1836234) — the key record**
- https://steamdb.info/en/ai/rules (AI-voice disclosure for Liar's Bar)
