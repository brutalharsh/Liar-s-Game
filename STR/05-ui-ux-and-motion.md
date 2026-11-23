# STR/05 — UI/UX & MOTION

> Two designed modes, not one stretched layout. Source: research/09 (full wireframes
> live there). Monochrome black-red noir mood on both.

## 1. Two design modes

- **MOBILE (portrait, touch-first, ≥390px)**: hero seat pinned bottom-center; **wing
  seats** flanking the felt = previous player (left, "can call them liar") and next
  player (right, "can call you liar"); **top rail** stacks the remaining 2–4 seats.
  Turn flow reads bottom → right → rail → left in one glance. Modals = bottom sheets.
- **DESKTOP (landscape, pointer, ≥1024px)**: full oval table, you at 6 o'clock, seats
  distributed around the rim; side panels (room info, emote log). Modals = dialogs.
- Breakpoint switch `useViewportMode()`; both layouts share 100% of logic components,
  only table geometry + container shells differ. Verified at 390 / 768 / 1440.

## 2. Tokens (Tailwind → CSS variables; theme packs swap vars)

- **Palette — monochrome noir** (owner directive 2026-11-23): black/gray
  surfaces — page ground `#0a0a0a` (wood-deep), cards `#111111` (wood),
  raised `#1c1c1c` (wood-mid), table felt `#141414/#101010` (felt/felt-deep);
  near-white text `#f5f5f5` (ink/ivory, ≥15:1 on the blacks), neutral gray
  `#a3a3a3` (ink-dim). **Primary accent = RED** `#d92d20` (brass), hover/live
  `#e5484d` (brass-soft — same tone as blood-bright), pressed `#a71d14`
  (brass-deep); small red text uses `#f2554a` (`--color-red-text`, ≥4.5:1 on
  surfaces — the pure red lands 3.9–4.1:1 there). Danger "blood" reds
  `#b91c1c/#e5484d/#7f1d1d` are the SAME family (hues 359–4°). **Secondary
  accent = restrained gold** `#d4a94e` (lamp, soft `#ab8940`) — coins/count-up
  money + a few warm highlights ONLY, never primary actions. Verdict green
  is unchanged (colorblind-safe icon+text pairing, §7).
- **Token names are historical aliases** (noir re-skin, 2026-11-23): `wood*`/
  `felt*` = surface grays/blacks (were walnut/felt), `brass*` = PRIMARY RED
  (was brass gold), `lamp*` = secondary gold, `blood*` = the danger half of
  the red family. Names kept so every utility class keeps compiling — the
  values are the truth. New tokens: `brass-soft` (hover/live red) and
  `red-text` (small-text red tint).
- Fonts (owner directive 2026-11-23): classic system stacks — display
  **Georgia** (Iowan Old Style → Times New Roman → serif; formerly Smokum),
  body **system sans** (-apple-system stack; formerly Special Elite). Zero
  font downloads — no font-swap CLS/LCP.
- Radii: cards 12px, buttons 10px; shadows black/gray only; the spotlight
  glow is RED (active-turn "hot seat" tint — follows the pack); noise
  texture overlay 4% opacity.
- Touch targets ≥48px; safe-area insets on mobile; focus rings visible.

## 3. Hand + critical buttons

- Hand: fanned 5 cards, tap-toggle multi-select (≤3), badge counts, selected cards
  lift + tilt. THROW button shows live claim text: **"THROW 2 AS ACES"** (≥64px).
- **CHECK button** (thumb-zone bottom-right, ≥64px): states = disabled / armed (window
  countdown ring 10s) / confirm-guard sheet ("Call SUE a liar? She claims 2 Kings.").
- Per-player chamber counters `(x/6)` + risk tint (amber ≥3/6, red ≥5/6).
- Table card banner top; last-play stack center with owner nameplate + count chips.

## 4. Animation inventory (framer-motion; GPU transforms only)

| Event | Animation | Budget |
|---|---|---|
| Deal | cards slide from shoe to each seat, stagger | 600ms total |
| Throw | arc from hand to pile + settle | 400ms |
| Reveal | 3D flips 400ms stagger + verdict stamp scale-in | n×400 + 400ms |
| Window open | CHECK pulse + ring 10s | — |
| Cylinder spin | revolver center-stage, cylinder blur-spin, hammer cock | 1.2s + 1.2s dead air |
| BLANK | dry *click* + Zimmermann head-fake (whole camera lurches to bang then… nothing) + relief sting | 1.5s |
| BANG | muzzle flash, screen shake 300ms, slam to black 150ms | 800ms |
| Death | avatar slump + gray-out + spotlight fades to sepia | 800ms |
| Execute cinematic | accuser gun slides in → target lock reticle + fear tremor on loser → same pull beat | ≈3.4s total |
| Win | crown drop + confetti + count-up coins | 4s |
| Round end | banner slide + coins/XP toasts | 2s |

Every animation ships a `prefers-reduced-motion` instant/short variant. No gore:
stylistic slump + fade only (PG-13).

## 5. Voice + sound map

- SFX (howler): card flick, deal, flip, challenge slam, cylinder clicks, dry click,
  bang, death sting, win jingle, button clicks.
- TTS (SpeechSynthesis): claim announcer ("Two Aces"), "LIAR!", kill/death/win lines,
  ~5% random throw barks. Voice themes = {voice, pitch, rate} presets (Villain,
  Chipper, Robot, Drunk + free). Optional captions always (text of every spoken line).
- Haptics (navigator.vibrate): throw 10ms, window arm 20ms, blank 30ms, bang [40,60,80].

## 6. Emotes (no voice chat — this IS table talk)

10 presets (text+icon bubbles), 3s server-enforced cooldown (config knob),
lobby+table only, ghosts get their own dimmed set, mute-all in settings.
Server wire slugs (`EMOTE_CATALOG`): `tipping-hat, laugh, gasp, angry, sweat, cry,
cheer, shush, thinking, wink` — the server rejects any other id (`VALIDATION`).
⚠️ web mock + EmoteWheel still send the W-era name set ("Call my bluff"…, only
`laugh` overlaps) — reconciliation pending on the web side.

## 7. Accessibility checklist

48px targets · safe-area insets · reduced-motion alternates · colorblind-safe
verdict colors (never color-only: always icon+text) · captions toggle · font scale
support · focus order on dialogs/sheets.
