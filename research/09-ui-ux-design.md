# 09 — UX/UI Design Bible: Liar's Deck (web, 2-7 players)

> The design bible: layout, interaction, motion, theming. Everything downstream
> defers to this doc. Compiled 2026-11-23; read `99-initial-search-notes.md`
> first — this doc assumes those rules.

## Researched patterns we adopt (with sources)

- **Seat conventions (poker/table games)** — guandan-online-codex
  `card-game-ui-conventions.md` (github.com/xingfanxia): *"always display YOU at
  bottom-centre — the server seat rotates, the display never does"* (universal
  poker convention); 6-max arc ≈ clock 9:00/10:30/12:00/1:30/3:00; seat stack =
  avatar (36-56px desktop, 24-32px mobile) + name ≤12 chars + big mono number +
  card backs + **glow ring with countdown arc** for the active player; action
  buttons fixed to bottom edge, full-width on mobile (GGPoker one-hand portrait).
  欢乐斗地主 (dominant Chinese card app): the "PASS" chip floats over the seat
  that skipped — states must label the player, not a log.
- **Liar's Bar itself** — liarsbar.net + Steam community guides: table card
  pinned top-left as reminder; previous player's thrown COUNT shown near it;
  chamber state rendered `(x/6)`; 30s turn timer; keys **A/D move · Space
  select · E throw · X challenge**. Chaos mode = *the player who exposes a
  bluff points the revolver at anyone* — direct precedent for the owner's
  winner-picks-target variant (TheGamer + tvtropes variant writeups). An
  official 2-4p mobile port exists on Google Play — touch parity is proven.
- **Spectators** — Devin Williams' Liar's Bar spectator-HUD case study
  (devinwilliams.design, Nov 2026): dead players want dead-only chat, sticker
  emotes post-elimination, per-seat "attempts left (2/6)", host-toggled hand
  visibility — they stay to the end if we give them toys.
- **Rooms/invites** — skribbl.io (nickname → Create Private Room → copy link
  → host crown w/ kick/ban, votekick/mute/report, ≥2 to start); dev.to "a
  six-character room code is a product decision": codes are read aloud over
  Discord — unambiguous charset, format XXX-XXX, auto-advance, show expiry.
- **Emotes** — 8 Ball Pool (Miniclip support): preset messages + emoji only,
  global disable in settings, reorderable; free text only between mutual friends.
  Color Clash: "no free text in public rooms, ever." GGPoker/Zynga: emote bubble
  **floats above avatar ~2s then fades**.
- **Mobile-first is the platform** — Colonist 2025 summary: **65% of games
  are mobile**. Uno-Groovy (browser UNO): server-authoritative hands,
  resume-into-seat reconnect, portrait table, staged win screen, mute +
  reduced-motion settings. **Tech guides** (htmltoapp, nixiefx, MDN,
  PlayCanvas): cap DPR ≤2; zero per-frame allocation; CSS transforms only;
  `pointerdown` not click; `env(safe-area-inset-*)`; `visibilitychange`
  pause; MDN Vibration API is **Chromium-only** (Safari/Firefox don't ship
  it) → haptics are a progressive enhancement; WCAG C39: every juice fn opens
  `if (reducedMotion) return;`.

---

## 1. Screen map (flow)

```
        ┌──────────────────────────────────────────────┐
        │ SPLASH / HOME — logo · DEAL ME IN · [?] [M]  │
        └──────────────┬───────────────────────────────┘
                       │ once/device · localStorage
                       ▼
        ┌──────────────────────────────────────────────┐
        │ NICKNAME + AVATAR — name ≤12 chars ·         │
        │ 12 animal presets · [Continue] (edit later)  │
        └──────────────┬───────────────────────────────┘
            ┌──────────┴──────────┐
            ▼                     ▼
  ┌───────────────────┐   ┌───────────────────────────┐
  │ CREATE ROOM       │   │ JOIN WITH CODE             │
  │ code XXX-XXX      │   │ XXX-XXX keypad · auto-    │
  │ (read-aloud set:  │   │ advance/paste; 24h expiry │
  │ no 0/O/1/I/AEIOU) │   │                           │
  └─────────┬─────────┘   └────────────┬──────────────┘
            └────────────┬────────────┘
                         ▼
  ┌─────────────────────────────────────────────────────┐
  │ LOBBY — 2..7 seats (empty = "+ SHARE INVITE")       │
  │  room code huge · [Copy link] [Share ⤴]            │
  │  host crown: kick/ban · anyone: mute-a-player       │
  │  host settings: timer 20/30/45s · Sharpshooter    │
  │  off · theme picker w/ live preview swatch          │
  │  [START GAME] host-only; at <2 players shows        │
  │  "waiting for 1 more player…"                       │
  └──────────────────────┬──────────────────────────────┘
                         ▼
  ┌─────────────────────────────────────────────────────┐
  │ GAME TABLE (§2), preceded by COUNTDOWN overlay       │
  │ ("Dealing…" → 3 · 2 · 1 → deal cascade) — round     │
  │ loop: deal → throw or call → reveal (§3) → roulette  │
  │ cinematic (§4) → new round                            │
  └──────────────────────┬──────────────────────────────┘
                         │ last player alive
                         ▼
  ┌─────────────────────────────────────────────────────┐
  │ WINNER SCREEN — staged entrance: spotlight → avatar   │
  │ rises → bar cheers. Stats: rounds survived, bluffs    │
  │ caught, triggers pulled. Candles = reduced-motion     │
  │ confetti.                                              │
  └──────────────────────┬──────────────────────────────┘
                         ▼
  ┌─────────────────────────────────────────────────────┐
  │ BACK TO LOBBY — same roster/code/theme. Rematch =  │
  │ host taps START, others auto-ready (2nd game      │
  │ starts ≤5s — the rematch is the retention moment). │
  │ Disconnects: seat shows "reconnecting…" → 60s      │
  │ grace, then AI-replaced or freed (Uno-Groovy).     │
  └─────────────────────────────────────────────────────┘
```

Anti-fork rule: from the table, every screen is ≤1 tap on an edge rail; no
modal without a 10s auto-dismiss may block play.

---

## 2. THE GAME TABLE — 2 through 7 players

### 2.1 The core problem, and the rule we adopt

7 seats × ~56px avatar clusters ≈ 392px = the entire width of an iPhone 12-16.
So **on portrait phone we do not draw a round table** (needs ~2× width); we
compress the poker convention — *hero fixed at bottom, everyone else arranged
by turn distance* — into a **RAIL + WINGS** layout:

- **WINGS (flanking the felt):** the two players whose relation to me is a
  game mechanic — **LEFT = previous player (I can CALL LIAR on them)**,
  **RIGHT = next player (they can call ME)** — second-best real estate.
- **TOP RAIL:** everyone else, ordered so the counter-clockwise turn flow
  reads **bottom → right wing → rail (right-to-left) → left wing → bottom**
  — turn order stays spatially traceable at one glance.
- Desktop/tablet-landscape relax into a true **oval** (researched 8-max arc)
  with the same ordering rule, because width is free there.

Seats never move when turns change — only their glow does. All seats are
absolutely-positioned children of one `.seat-layer`, one CSS transform each.

### 2.2 (a) MOBILE PORTRAIT 390px — 7 players (worst case)

```
┌─────────────────────────────────────────┐
│ ☰ [♠K KING'S TABLE]      R3  ●●○○  ⏱24 │ 36px top strip: table
│        "LBLANC threw 2 as KINGs"        │ + context ribbon (prev play)
├─────────────────────────────────────────┤
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐                │ TOP RAIL ×4 seat
│ │SUE│ │TOA│ │FOX│ │BRI│   chips 86×64, │ chips: avatar 36px,
│ │●○○│ │●●○│ │●○○│ │○○○│   gaps 6px    │ name 10px, pips
│ │ 4c│ │ 0c│ │ 0c│ │ 5c│                │ + card-count chip
├───────┬───────────────────────┬─────────┤
│ ┌────┐│  PLAYED PILE          │┌───────┐│
│ │LBL ││  ~ ▦(LBL 2)  ▦(SUE 3)││ SCUBB ││ WINGS 92×64:
│ │▦2as││    ~ ▦(FOX 1) ▦(BRI 2)││ ▦next ││ left = prev player
│ │K?  ││   mini-stacks w/ count ││  can  ││  (I may call them)
│ │CALLable!│   badges; last play ││ CALLYOU!│ right = next player
│ └────┘│    has gold edge     │└───────┘│   (they may call me)
│ └────┘│                       │└───────┘│
├────────┴───────────────────────┴────────┤
│   ██ K · KING'S TABLE · ROUND 3 ██      │ table banner 40px
├─────────────────────────────────────────┤
│ ┌─────┐  YOU ●●○○ 2/6 · 5 cards  [🗨]  │ 56px hero strip
├─────────────────────────────────────────┤
│   ╔══╗╔══╗╔══╗╔══╗╔══╗                 │ FANNED HAND 5×64×92
│   ║K ║║Q ║║A ║║Jok║║K ║  ✓2 selected   │ tap = toggle (lift
│   ╚══╝╚══╝╚══╝╚══╝╚══╝   [CLEAR]       │ +8px + glow · −18px
│           [ THROW 2 as KINGs ]          │ overlap)
│          [ ─ CALL LBLANC A LIAR ─ ]     │ 64px challenge btn,
│                         ⊙rel=LEGAL      │ thumb zone bottom-R
└─────────────────────────────────────────┘
```

At ≤370px width rail chips shrink to 78px, names to initials. At 2-4 players
the rail disappears entirely (wings grow to 120×84 with last-throw ribbon):

```
┌─────────────────────────────────────────┐
│ ☰ [♠K KING'S TABLE]        R3  ⏱ 1:12 │
│      "TOAR threw 3 as KINGs"           │
│  ┌────────┐              ┌────────┐    │ only wings remain,
│  │ SCUBB ▦3│   PLAYED PILE │  TOAR  │    │ prev-left / next-
│  │ as K?   │  ▦(SUE 2)    │ can CALL │  │ right; wings grow
│  │ CALLable│  ▦(TOAR 3)   │   YOU!    │  │ to 120×84; hand
│  └────────┘              └────────┘    │  = the 7p layout
│      ██ K · KING'S TABLE · R3 ██        │
└─────────────────────────────────────────┘
```

### 2.2 (b) TABLET (≥1024px landscape) — desktop oval at 0.75 scale

Portrait ≤834px: rail+wings with 108×80 seats, 48px avatars, individual
fanned card backs. Landscape:

```
┌───────────────────────────────────────────────────────┐
│ ☰ [♠K KING'S TABLE · R3]              ⏱ 1:12 · 🔇 M │
│          SUE(2c)      TOAR(1c)      FOX(5c)          │
│           ○────────────────────────╮                  │
│     BRIS(3c)──┐                   ├──SCUBB(2c)       │
│               │   P L A Y E D     │      next = calls │
│   LBL=YOU ────┤   P I L E ▦▦▦▦    ├──────  YOU         │
│     (5c)      │  "4 as KINGs"     │                   │
│               └─────────┬─────────┘                   │
│           FANNED HAND 5 × 88×124 (scroll-snap)        │
│    [ THROW 2 as KINGs ]     [ CALL SCUBB A LIAR ]    │
└───────────────────────────────────────────────────────┘
```

### 2.2 (c) DESKTOP 1440px — true oval, seats at clock positions

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚙ ♠K KING'S TABLE · R3 · 8 TRUTHS STILL IN PLAY      ⏱ TOAR 0:24  │
│                                                                    │
│   MIGO(2c)   SUE(4c)   TOAR(1c)    FOX(5c)   BRIS(3c)   SCUB(0c)    │
│    9:00       10:15     11:30       12:45      2:00       3:15     │
│     ○──────────○─────────○──────────○─────────○──────────○       │
│   ╭─────────────────────────────────────────────────────────────╮ │
│MIGO║                P L A Y E D    P I L E                      ║SCUB║
│prev║  per-player stacks fan toward each owner:                  ║next║
│=you║  ▦(MIGO 1) ▦(SUE 2) ▦(TOAR 3) ▦(FOX 2) ▦(BRIS 1) ▦(SCUB 2)║=you║
│call║  your stack glowed gold while it was the last throw       ║call│
│    ║        throw zone: cards rise here ▽                     ║    │
│   ╰──────────────────────┬───────────────────────────────────╯   │
│                    LBL — YOU  ●●○○ 2/6 · 5 cards                 │
│         FANNED HAND 5 × 104×148 (hover-lift, click select)        │
│   [ THROW 2 as KINGs ]         [ CALL MIGO A LIAR ]  ⊙ legal     │
│ keys: 1/2/3 · A/D · Space · E throw · X call · M emote            │
└────────────────────────────────────────────────────────────────────┘
```

**Clock positions by player count** (hero always 6:00; opponents evenly spaced
across the 9:00→3:00 top arc; matches researched 6-max/8-max arcs):

| players | opponent positions |
|---|---|
| 2 | 12:00 (sole opponent = both prev & next) |
| 3 | 9:00 · 3:00 (sole two flanks) |
| 4 | 9:30 · 12:00 · 2:30 |
| 5 | 9:00 · 11:00 · 1:00 · 3:00 |
| 6 | 9:00 · 10:30 · 12:00 · 1:30 · 3:00 (= poker 6-max exactly) |
| 7 | 9:00 · 10:15 · 11:30 · 12:45 · 2:00 · 3:15 (even 30° spacing) |

**Seat cell contents by breakpoint:**

| element | 390px phone | tablet | 1440px |
|---|---|---|---|
| avatar | 36px circle | 48px | 56px |
| name | 10px, truncate 8ch | 12px, 12ch | 13px |
| card count | "4c" badge 11px | same | same |
| timer ring | 3px SVG arc, amber→red <10s | 4px | 4px |
| chambers | dots + "2/6" | 6 pips + n/6 | 6 pips + n/6 |
| dead | grayscale, tilt 8°, 40% opacity, "RIP 🕯" | + slump frame | + slump frame |

**Central played pile** is per-PLAYER, not one heap: each player's last
throw is a mini-stack (≤3 overlapped card backs) oriented from their seat
toward the center; rail players' stacks indent along the top of the pile.
The last throw carries a gold edge + floating label "2 as KINGs"; with the
top context ribbon, a spectator groks the state in seconds. Each stack tap
→ **peek** (§3). Round resets riffle-shuffle all stacks — also builds trust
in the shuffle (players blame software otherwise; researched poker case).

---

## 3. Core interaction spec

- **Multi-select ≤3.** Tap a card → toggles: lift +8px, gold edge, ✓ corner,
  floating badge "2 selected". Tap a 4th card → hard reject: shake + dull buzz
  (predictability over cleverness). Keyboard: 1/2/3 direct, A/D move, Space toggle.
- **Throw = live-labeled one tap.** The button states the action, so nobody
  misclicks a bluff of the wrong size: disabled "SELECT 1-3 CARDS" → enabled
  **"THROW 2 as KINGs"**. Tap → cards arc into your pile (300ms), button becomes
  "WAIT…". No confirm dialog: irreversibility is the game. **Undo = pre-throw
  only**: tap selected cards again or [CLEAR].
- **CALL LIAR** — rendered **only when legal** (it is your turn to judge and a
  previous throw exists; e.g. not on fresh round, not when you're dead). Illegal
  states show nothing, not a disabled hint. ≥64px tall, bottom-right thumb
  zone. Tap opens the **accidental-challenge guard** — bottom sheet, play NOT
  paused for others:

```
│       Call LBLANC a L LIAR ?      │ "Call SUE a LIAR?" — the
│                                    │ target's name IS the
│   he threw 2 as KINGs              │ guard: re-read who you
│   wrong call = YOU take the gun    │ accuse. Cost stated.
│   [ CANCEL ]      [ YES, CALL ]   │ 5s auto-dismiss/cancel.
```
  Keyboard: X opens, Enter/X confirms, Esc cancels.
- **Forced call:** sole card-holder's sheet auto-opens with "FORCED CALL"
  ribbon, no cancel (rule: last card-holder must call). Empty-hand players get
  a floating "safe · out of cards" chip over their seat (斗地主 PASS-float
  pattern) so everyone sees why they're skipped.
- **Peek-at-own-thrown:** 👁 icon on YOUR stack for 3s post-throw; tap = your
  cards flip face-up briefly. Server never ships other hands to any client
  (server-authoritative, Uno-Groovy cheat model).
- **Reveal sequence (on CALL LIAR resolve):** accused stack slides to center
  spotlight (0-400ms) → cards flip **one-by-one, 400ms apart**, 300ms
  `preserve-3d` flip each → per flip stamp: rank/Joker = green ring + ✓ + ding;
  off-rank = red ✗ + flat thud; drum builds each beat → last card +400ms →
  verdict slam **"LIAR!"** (red) or **"TRUTH!"** (green) + haptic, 600ms hold
  → "TOAR takes the revolver" (§4). 2 cards ≈ 2.0s call-to-gun: long enough to
  scream, short enough to not bore round 6.

---

## 4. Roulette / shooting cinematic

**Golden rule — PG-13 drama, zero gore.** Steam Liar's Bar is 18+ w/ gore
descriptor; we run in group chats/streams. Death = staged slump (lights
flicker, glass tips, seat grays out) — never a wound.

### 4.1 Self-roulette (classic), 2.5-3.5s of dread

| t | beat |
|---|---|
| 0.0 | spotlight narrows onto the LOSER's seat; ambient ducks −12dB |
| 0.4 | their avatar stands (scale 1.4); emote input freezes for all |
| 0.6 | revolver rises from center tray → glides to their hand (800ms) |
| 1.2 | **CYLINDER SPIN ≈1.2s** — 6 accelerating mechanical ticks (audio-locked, not per-frame), blur sprite |
| 2.4 | **HAMMER COCK** — single sharp click; stage zooms 1.06× toward seat |
| 2.55 | **DEAD AIR 350ms** — vignette to 85%, heartbeat ×2. Shared dread |
| 2.9 | ▼ **LIVE:** BANG — muzzle flash 80ms, screen shake ±6px 400ms (reduced-motion: red border flash), haptic [120ms], **slump** 1.2s: head drops, glasses slide, seat desaturates → gray + "RIP 🕯". No ragdoll. |
| | ▼ **BLANK:** dry *click* → 600ms of silence → **Zimmermann head-fake**: hard flinch 150ms, freeze mid-flinch, slow slump-back, nervous-laugh sting + "PHEW." toast + green SURVIVED stamp, haptic [10,40,10] |
| 3.3 | chamber pip spends (●●●○○○), toast "TOAR survives (2/6)" → deal |

The head-fake is the signature beat: the blank must be *funnier* than the bang.
Silence-then-exhale audio IS the pay-off; animation only sets it up.

### 4.2 SHARPSHOOTER variant (owner-requested: winner picks the target)

Lobby toggle (default OFF): "Sharpshooter — the winner of each challenge
picks who faces the gun." Precedent: Liar's Bar Chaos mode. Only the
prologue between verdict and trigger changes (§4.1 fork reused verbatim):

```
t=0.0   banner "SUE wins the call — pick your target"
        TARGET RING over every living opponent avatar:
┌──────────────────────────────────────┐
│   ◉( TOAR )◉      ◉( FOX )◉          │ pulsing reticles +
│      ◉( BRIS )◉                      │ names; avatars inflate
│        ▲ your crosshair — a hand+    │ 8%, tilt toward the
│          revolver sprite following   │ shooter
│          pointer / arrow keys        │
│      9s aim window = turn-timer ring  │
└──────────────────────────────────────┘
LOCK    tap → crosshair snap-locks; reticle rings shutter closed
+0.5s   gun sweep arc to target 500ms; all non-target avatars dim
FEAR    aimed player: 8Hz tremor ±2px, sweat-drop particle, lean-
        back 6px + wide-eyed portrait. Face only — never a 9s screen
        shake (motion sickness + it devalues the trigger's shake).
+1.0s   cock 200ms → dead air 400ms → identical bang/blank fork
        (blank = the TARGET does the flinch-head-fake)
No pick in 9s → random living target, toast says so (no stalemates).
```

### 4.3 Dead-player spectator experience

"YOU ARE OUT — spectating" shows once then minimizes. Spectators keep full
table view + **emotes** (post-elimination sticker use) and gain the
**ghost-lounge chat tab** — dead-only, invisible to living players
(trash-talk leaks nothing). Host may toggle "spectators see hands" for
teaching games. Dead seats stay visible to all — social proof someone got got.

---

## 5. Emotes (we ARE the table talk — no voice chat)

Preset bubbles only, **no free text ever** (8 Ball Pool / Color Clash model),
GGPoker delivery: **float above your avatar 2s → fade**. Launch set (10):

```
"Call me a liar. Go ahead."   "Deal me in."        "Oops."
"My condolences 🕊"           "HAHAHA"             snake🐍 ("classy")
skull 💀 ("well deserved")    "Prove it."          sweat😅 under fire
"Cheers 🥂" (survivor)        wolf-whistle (unlockable, post-MVP)
```

Anti-spam: one bubble per player on screen (new replaces old); 3000ms
per-player cooldown; server drops >3 msgs/10s per player (host votekick sees
repeat offenders). **Mute-all** toggle in settings + per-player mute
(long-press avatar → "Hide emotes from SCUBB"). Menu: radial on desktop
(M / right-click), grid on mobile, 48px targets, never covers the hand.

---

## 6. Feedback & juice (feel map)

**Haptics** — `navigator.vibrate()`, feature-detected; **Android-Chromium
only** (Safari/Firefox don't ship it) → graceful silence elsewhere, never
promised to iPhone users:

| event | pattern (ms) | note |
|---|---|---|
| deal | 3× [8] staggered | a tick per card landing |
| select card | 10 | confirm |
| throw | [10,30,20] | thock-thock |
| your turn | 20 | single attention tap |
| challenge confirm | [30,50,30] | ominous double |
| hammer cock | 40 | heavy |
| BANG (live) | 120 | the big one |
| blank click | — | silence is the point |
| win | [20,40,20,40,100] | |

**Sound design map** (WebAudio; unlock on first pointerdown; per-category
volume + master mute): select=tick · your turn=glass clink · other turn=low
thud+bar murmur · deal=card shuffle riffle · throw=whoosh+slap · emote=cork
pop · challenge=record scratch · truth flip=ding / lie flip=muted thud ·
cylinder=accelerating clicks · cock=sharp single click · **BANG=layered
gunshot + room reverb tail** · **blank=dry click → 600ms nothing → exhale
sting** · death=bar drops silent 1s → somber piano + glass-tip foley ·
survive=nervous-laughter sting · win screen=fanfare+crowd · countdown=3-2-1
woodblocks · toast=soft pop · theme ambient loop (§8).

**Toasts:** top-center under table strip, 3s auto-dismiss, max 2 stacked
("SUE joined", "TOAR survives (2/6)", "BRIS left → seat open").

**Reduced motion** (auto from `prefers-reduced-motion` + manual toggle; every
juice fn opens with the guard): screen shake → 8px red vignette flash; card
flights → 150ms crossfade; cylinder/hammer switch to 5-frame stepped
animation, no zoom; deal cascade → instant + tick sounds; confetti → candles.
Haptics halve. **Colorblind-safe:** verdicts pair color with shape AND text —
green ring+✓+"TRUTH" vs red ✗+"LIAR" (never color alone); active-turn gold
vs fatal-red differ in border style (solid vs dashed).

---

## 7. Responsive strategy, performance budgets

- **Touch ≥48px** (HIG floor 44, our default 48, primary actions 64). Fanned
  card overlap −18px is compensated by expanded hit boxes.
- **Safe areas:** `viewport-fit=cover`; backgrounds bleed to raw edge,
  interactive UI padded by `max(env(safe-area-inset-*), 12px)`. Hero bar
  respects the iPhone home indicator. `100dvh` not `100vh` (iOS address bar
  never eats cards); re-layout on `visualViewport` resize.
- **Budget:** DPR capped ≤2 (~55% pixels saved); seats/cards/text = DOM +
  **CSS transforms only** (`transform`/`opacity` animate; never
  `top/left/width`) → GPU-composited; ≤150 composited layers; pooled
  particles ≤64; **zero allocation in the raf loop** (retained DOM nodes,
  textContent diffs); `pointerdown` not `click`; `touch-action:none` on stage;
  WebGL never needed at our sprite counts. Targets: 60fps desktop, ≥50fps on
  a 3-yr-old midrange Android, input→visual <50ms, `visibilitychange` pauses
  raf + suspends audio (test on a real cheap phone, not emulation).
- **Orientation:** portrait-first (65% of play is mobile — Colonist). Phone
  landscape is fully supported, never prompted: rail seats condense into a
  left vertical rail, hand = bottom snap-scroller, THROW/CALL move to the
  right edge (still thumb zone). Tablet-landscape+ uses the oval.
- **Desktop keyboard parity** mirrors Steam exactly so Liar's Bar players
  feel at home: `1/2/3` select card 1-3 · `A/D` move · `Space` toggle ·
  `E` throw · `X` call liar · `Esc` cancel · `M` emote · `T` theme preview
  (one-time keymap toast on first desktop game).

---

## 8. Bar themes (the premium product)

A theme = **one token sheet + one asset pack + one ambient loop**. Applied as
CSS custom properties on `[data-theme]` — swapping is one attribute change, no
JS tree walk (components may ONLY consume these tokens; lint it):

```
--bg-backdrop   --felt   --felt-vignette   --wood-trim
--ink / --ink-dim        --accent (turn gold)  --accent-hot (CALL LIAR)
--success (shape-paired, §6)   --danger (lie red, fatal pips)
--card-back (pattern URL)      --card-face / --card-ink
--chip-metal (chamber pip brass)  --spotlight (cinematic overlay)
--font-display      --font-body
--banner-texture    --particle-style: dust|neon|embers|rain  --ambient-loop
```

Launch set: **Dive Saloon** (free default — whiskey-amber felt, dust motes,
piano-rag bed) · **Neon Karaoke** (1st premium — magenta/cyan felt, neon-spark
particles, synthwave hum) · **Speakeasy '28** (sepia, embers, vinyl-jazz
crackle) · **Rooftop Noir** (rain-streak glass, storm far below). Particles =
one pooled system parameterized by `--particle-style`. Ambient crossfades
800ms on lobby theme change; **never swap audio mid-round** — it breaks the
tension cueing. **Host-owns-theme rule** (Colonist membership precedent):
the host's unlocked theme applies to the whole room; guests see a "host
theme" badge; locked themes render with a premium ribbon → store
opens post-MVP, never blocks play.

---

## 9. What this means for our version — v1 cut list

**MUST (playable fun fails without these):**
1. Full §1 flow incl. rematch loop + reconnect-to-seat.
2. Rail+wings mobile layout + desktop oval, all counts 2-7; fan hand;
   per-player played-pile stacks + gold last-play; banner + context ribbon.
3. Multi-select ≤3 + live-claim THROW button + CALL-LIAR guard sheet + forced-call.
4. Staggered reveal (400ms/flip) with stamps — the suspense core.
5. Self-roulette cinematic: cylinder spin, head-fake blank, PG-13 slump,
   chamber pips (n/6), spectator + ghost-lounge.
6. 30s turn timer + active-seat spotlight arc.
7. Emotes (6 launch) + cooldowns + mute-all; toasts; §6 sound core.
8. Theme token system + 2 themes (Dive Saloon + one premium showpiece).
9. Reduced-motion + colorblind verdicts; safe-area/DPR/48px budgets; keyboard map.

**POST-MVP (default-off or later):** Sharpshooter §4.2 (owner-requested,
fully spec'd; ships v1.5 reusing timer + seat-layer + reticle components) ·
Devil-card variants · spectator see-hands · "best liar" vote · extra themes +
store · per-player emote mute · public matchmaking (v1 = private only) ·
localization · accounts/progress · advanced stats · key rebinding.

**Flagged risks:** (1) 7-player rail crowding on ≤360px phones — chips
shrink to 78px/initials; worst case cap mobile lobbies at 6. (2) Vibration
is Android-Chromium-only — never market "feel the bang" to iOS. (3) The
head-fake comedic timing is audio-dependent — budget real sound-design time
there; it IS the retention feature.
