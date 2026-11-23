# 10 — Asset Manifest + Licensing Plan (2026-11-23)

> One of 12 deep-dive docs seeded by 99-initial-search-notes.md: every asset the game needs + a legally-safe source for each.
> The owner's "get images from Google" plan is **rejected** — §1 says why, §3–7 replace it. ⚠️ **Research, not legal advice.**

---

## 1. Legal foundations (plain English)

### 1.1 Why "images from Google" is not a license

- Google is a **search index**, not a distributor: an image found there is still owned by its maker, and default copyright
  is **all rights reserved**. Nothing is "free" unless explicitly licensed (CC0, CC-BY, purchase). Google's usage-rights
  filter just trusts site metadata and routinely mislabels. Rule: **no license text on the source page = no use.**
- Shipping someone else's art in a commercial product (we sell premium themes = commercial) is straightforward copyright
  infringement, plus DMCA-takedown exposure for our hosting/domain.

### 1.2 Liar's Bar (Steam) assets = doubly off-limits

- Everything in the Steam game — Foxy, Scubby, Toar, Bristle, character art, UI, store screenshots, trailer frames — is
  **copyrighted expression owned by Curve Animation**. Screenshots, traces, or look-alike portraits of their four named
  animals invite DMCA plus a trademark/unfair-competition argument ("Liar's Bar" is associated with their product). We copy
  **rules and game feel only**.
- What is *not* theirs: **mechanics/ideas are not copyrightable** (17 U.S.C. §102(b) — copyright covers expression, not
  systems; see https://www.copyright.gov/ai/). Russian roulette, bluff card play, 20-card deck, 30s timer — all fair game
  in our own expression.
- Anti-copy rules (binding, from doc 99): ✗ no fox/dog/bull/pig quartet, ✗ no Liar's Bar name/logo, ✗ no traced screenshots
  or Steam key art in OG/social images. ✓ our own species, guns, UI style, name (naming handled in another doc).

### 1.3 What IS safe (the ladder, best → worst)

| Tier | Source | Obligations | Notes |
|---|---|---|---|
| 1 | **CC0 / public domain** | None (attribution is courtesy) | Freesound CC0, Kenney, OpenGameArt CC0. ✅ commercial |
| 2 | **CC-BY (3.0/4.0)** | Attribution file required (TASL: title, author, source, license) | game-icons.net, Freesound BY, some OGA. ✅ commercial |
| 3 | **OFL / Apache fonts** | Keep license file; don't sell the font itself; OFL reserved names | Self-hosted webfonts. ✅ commercial |
| 4 | **AI-generated assets** | Follow generator's ToS; human edits if we want copyright of our own | ✅ commercial; messy copyright status — 1.4 |
| 5 | **Paid stock / commissioned** | Keep receipts/invoices | Zero copyright questions for the buyer |
| 6 | **Self-recorded / self-drawn** | None (we're the author) | Best quality control |
| ✗ | Google-harvested, "free wallpaper sites", rip-from-YouTube | — | Never |

### 1.4 AI art legal status as of 2026 (short version)

- **US Copyright Office position (unchanged through 2026):** purely AI-generated images have **no human author → no
  copyright**. Thaler v. Perlmutter upheld the refusal; on **Mar 2, 2026 the Supreme Court declined to hear the appeal**
  (https://www.reuters.com/legal/government/us-supreme-court-declines-hear-dispute-over-copyrights-ai-generated-material-2026-03-02/).
- **But** the Office's Jan 2025 report "Copyright and Artificial Intelligence, Part 2: Copyrightability"
  (https://www.copyright.gov/ai/, https://newsnet.copyright.gov/2025/1060.html) says AI-assisted works **can** be
  protectable where a *human* determined sufficient expressive elements — our prompting + **curation, compositing,
  inpainting, editing** protects the finished work, and the game as a whole (code, layout, selection) is ours regardless.
- **Commercial use: fine.** Generator terms assign whatever rights exist in outputs to the paying user. The real question
  is "can we stop others copying a hero image" — mitigated by human editing/compositing of the assets that matter (promo
  art in particular).
- **Platform precedent:** Steam requires disclosure of player-facing AI content (rule since Jan 2024, clarified Jan 2026 —
  https://partner.steamgames.com/doc/gettingstarted/contentsurvey, summary https://steamdb.com/en/ai/rules/); ~20% of 2025
  Steam releases disclosed GenAI use (videogameschronicle.com). **We are web-only, not on Steam — disclosure doesn't apply
  to us**, and Valve shipping thousands of AI-art games shows this is an accepted industry practice, not a gray zone. If
  we ever port to Steam, we just fill in the survey.
- Why still do it ourselves: prompts match our exact themes, $0 license fees for 8+ art sets, full style control. AI is
  right for big surface area (backgrounds, avatars), wrong for small precise assets (§4.7).

---

## 2. Full asset manifest

Legend: **AI** = we generate (§4 recipe exists) · **CC0** = download from named pack (§3) · **CC-BY** = ATTRIBUTED
download (goes into CREDITS.md, §6) · **CODE** = no raster asset needed (CSS/SVG/canvas assembled).

### 2.1 Cards & table

| # | Asset | Count | Source plan | Specs / notes |
|---|---|---|---|---|
| 1 | Card back — saloon (default) | 1 | AI (§4.4) | 300×420 raster; ornate frame, whiskey-glass motif; AI + human pass = ours |
| 2 | Card backs — premium theme variants | 7 | AI (§4.4) | Same template, theme palette/device swap |
| 3 | Card faces K/Q/A (each in 4 suits for flavor) | 12 | AI base art or CC0 (Kenney `playing-cards-pack`, restyled) | One atlas sheet; rank art only matters — suits cosmetic |
| 4 | Joker (wild) face | 2 | AI | Distinct jester-harlequin design per our style |
| 5 | Table-card banner (revealed rank plaque) | 1 design ×3 states | AI background plate + CODE rank letter | Plaque 512×256, lettering via webfont, per-theme tint |
| 6 | Table felt / play surface | 1 | AI (embedded in §4.1 themes) or CC0 texture (OpenGameArt felt) | Dark leather-tooled felt, alcohol stains, vignette |
| 7 | Chamber-count chip icons (0–6 ticks, "X/6") | 7 | CC-BY (game-icons.net bullet/skull glyphs) or CC0 schematic | Prefer CODE: SVG circles, no artistry needed |
| 8 | Chip / chip-stack icons (potential currency) | 3 | CC0 (Kenney `boardgame-pack` chips) | If we add cosmetic currency; skip at MVP otherwise |
| 9 | Discard pile stack (2–3 states) | 3 | CODE (stacked card backs + CSS offsets) | No unique art |

### 2.2 Characters & avatars (7+ player seats)

| # | Asset | Count | Source plan | Specs / notes |
|---|---|---|---|---|
| 1 | Avatar scheme decision | — | **Plan A (MVP):** poker-chip/silhouette avatars — player initial on a themed casino chip, CODE+SVG. **Plan B (post-MVP premium):** AI stylized animal busts (§4.2), **original species — never a fox/dog/bull/pig quartet** | Plan A avoids all character-likeness risk at launch |
| 2 | Avatar chips — base discs ×8 palette colors | 8 | CODE/SVG | 128×128, 9-slice ring, initial lettering via webfont |
| 3 | Animal avatars (Plan B) — e.g. raccoon, crow, goat, alligator, vulture, cat, donkey, owl | 8 | AI (§4.2) | Each: idle + dead + shot-flinch states |
| 4 | Avatar death / "hit" states | 2 per avatar | AI (same prompt continuation, §4.2) | X-eyes, smoke plume — cartoon, not gore-brand |
| 5 | Emote bubble (9-slice) + emote glyphs (skull, laugh, sweat, angry, heart, gun, shush, point, cry, fire) | 1 + 10 | CC-BY (game-icons.net: `skull-club`, `laugh`, etc. by Lorc/Delapouite) → CREDITS.md | SVG, `currentColor` tint |
| 6 | Empty-seat / spectator / eliminated slot art | 3 | CODE/SVG | chairs silhouettes |

### 2.3 Gun set

| # | Asset | Count | Source plan | Specs / notes |
|---|---|---|---|---|
| 1 | Revolver — side view hero sprite | 1 + 7 theme reskins | AI base (§4.5) for saloon; theme variants via palette/prop swap or CC-BY SVG (`game-icons.net` revolver by Lorc) | AI for the hero close-up; CC-BY glyph for HUD icons |
| 2 | Cylinder UI — 6 chambers, unspent / spent / live-reveal states | 3 frames ×6 cell art | AI/CC0 hybrid: cylinder plate AI, chamber dots CODE | Spent chambers rendered dark/knocked; next-chamber pulse via CSS |
| 3 | Muzzle flash | 1 set | **Sprite strip, not video** — 6 frames 256×256, +/- 30° variants (2 strips) | Alpha WebM has patchy iOS Safari support; WebP strip is universal |
| 4 | Smoke wisps post-shot | 4 sprites | CC0 (Kenney `smoke-particles`, 512×512, recolorable) | Canvas/WebGL particles |
| 5 | Sparks / impact bits | 6 sprites | CC0 (Kenney `particle-pack` — 80 sprites, 512×512) | Also used for UI click dust |
| 6 | Target reticle (player-select cursor) | 1 + hover state | CC0 (Kenney `crosshair-pack`) — whitelist: any of its 200 reticles | SVG-recolor two-tone |
| 7 | Bullet / tracer (future sharpshooter variant) | 1 | CODE | 4px CSS streak |

### 2.4 UI kit

| # | Asset | Count | Source plan | Specs / notes |
|---|---|---|---|---|
| 1 | Buttons — primary / secondary / danger / ghost, each normal–hover–pressed–disabled | 4×4 | AI base plates per theme (metal/wood scrim, §4.6) **over** CODE 9-slice | WebP 9-slices + CSS states; text via webfont |
| 2 | CALL LIAR button — special, oversized, western letterpress | 1 per theme + pulsing accent | AI panel + `Rye`/`Smokum` lettering | Red-ink branded rubber-stamp treatment |
| 3 | Turn-timer ring | 1 | CODE (SVG circle, dash-offset animation) | 30s sweep, amber→red |
| 4 | Room-code elements: code chip, copy icon, share sheet | 3 | CODE + CC-BY glyph (game-icons `copy`/`share`) | Big monospace code = the invite moment |
| 5 | Seat-slot frames: empty / occupied / dead / turn-active glow | 4 | CODE (SVG rings) + AI nameplate scrim | Turn-active = pulsing tungsten glow |
| 6 | Theme cards (store/lobby preview tiles) | 8 | AI thumbnails (downscaled §4.1 art) | 512×288 lazy-loaded |
| 7 | Panels / modals / tooltips 9-slice | 4 per theme | AI base texture (§4.6) + CODE borders | Leather/paper texture themes |
| 8 | Settings, sound, invite, spectator, host-crown misc icons | 12 | CC-BY (game-icons) or CC0 (Kenney `ui-pack`) → CREDITS.md if CC-BY | SVG sprite sheet (single request) |
| 9 | Loading screen / progress bar | 1 | AI saloon art (frames §4.1) + CODE bar | Doubles as lobby background |

### 2.5 Premium theme packs (8 venues; saloon = free ship, 7 = IAP)

Each pack = same schema; only art/audio/font/palette tokens change:

| Token | Contents | Format / budget |
|---|---|---|
| Background | 1 wide establishing shot (§4.1) + 9:16 mobile crop | 1920×1080 & 1080×1350 (center-crop); WebP q70 ≤ 250KB |
| Parallax prop layer | 1 transparent strip (bottles, neon signs, palm/ribcage/satellite) | PNG/WebP alpha ≤ 150KB, behind table |
| Alternative card back | 1 (per 2.1#2) | ≤ 60KB |
| Ambient loop | 15–30s seamless loop (§2.7#12) | OGG/Opus + AAC, ~64kbps ≤ 300KB |
| Font pairing accent | 1 display font (OFL/Apache, §3.6) | WOFF2 latin subset ≤ 40KB |
| Palette tokens | 6 colors (felt, wood/accent, lamp-light, danger, ink, text) | CSS custom props |

Theme list v1: **Saloon** (western, free) · Neon Cyberpunk · Pirate Cove · Vampire Crypt · Space Cantina · Prohibition Speakeasy · Voodoo Bayou · Arabian Nights hideout.

### 2.6 Motion & animation (code-assembled unless noted — all deterministic)

| # | Motion | Source plan |
|---|---|---|
| 1 | Card flick (throw to pile) | CODE: base card sprite + bezier arc + rotation overshoot (cubic-bezier / spring); one 2-frame motion-smear sprite optional |
| 2 | Card flip (face-down ↔ face-up) | CODE: 3D scaleX two-plate flip or 6-frame squash |
| 3 | Deal (round start) | Same as flick, staggered, to each seat |
| 4 | Shuffle | CODE: riffle offsets + Casino Audio shuffle SFX; optional 3-frame smear strip |
| 5 | Gun spin / cylinder spin | CODE: rotate assets 2.3#1/#2, ratchet easing (ticks = §2.7#6 SFX) |
| 6 | Muzzle flash | Sprite strip (2.3#3) 60–90fps playback, 0.4s |
| 7 | Screen shake | CODE (per @theme intensity, reduced-motion toggle) |
| 8 | Death pose transition | CODE swap 2.2#4 + smoke particles (2.3#4) + red vignette CSS |

### 2.7 Audio

| # | SFX | Source plan |
|---|---|---|
| 1 | Card flick (player throw) | CC0 — Kenney `casino-audio` (50 foley: card slides/flip/chip/dice) then restyled |
| 2 | Deal whoosh, 3. Flip slap, 4. Shuffle riffle | CC0 — Kenney `casino-audio` |
| 5 | "LIAR!" challenge slam (sting) | CC0 — Kenney `impact-sounds` (130 hits) layer + voice-style honk optional; else Mixkit SFX |
| 6 | Cylinder spin clicks (5–6 ticks) | CC0 Freesound (filter CC0) "ratchet/click" or record a ratchet toy (self = own rights) — consistent set from one pack |
| 7 | Dry-fire click | CC0 Freesound / Mixkit (gun hammer) |
| 8 | Gunshot (live round) | Mixkit SFX Free License (warfare category, games explicitly OK) |
| 9 | Blank-clack relief | Mixkit / Kenney `impact-sounds` |
| 10 | Death sting | Mixkit / CC0 Freesound brass/hit layer |
| 11 | Win jingle | CC0 — Kenney `music-jingles` (85 files) |
| 12 | Crowd murmur ambience ×8 (one per theme) | CC0 Pixabay/Mixkit ambient loops (bar, tavern, storm-deck, gothic choir, spaceship hum, jazz club, swamp, bazaar) — or AI-ambience as gap-filler |
| 13 | UI clicks / seat-claim / error | CC0 — Kenney `interface-sounds` (100 files) |
| 14 | Chip clink (dead seat out / cosmetic currency) | CC0 — Kenney `casino-audio` |

---

## 3. Safe sources deep-dive (all verified 2026-11-23)

### 3.1 Kenney.nl — CC0, $0, our icons/prototype backbone

- License: every pack page states **Creative Commons CC0** (verified on `casino-audio` + `playing-cards-pack` pages;
  https://creativecommons.org/publicdomain/zero/1.0/). Commercial ✓, no credit required ("Kenney" credit appreciated,
  not mandatory). Kenney's **logo is reserved** — never use it in our game.
- Pricing: **individual packs are 100% free** (donation prompt → "Continue without donating…", no account). The
  **All-in-1 bundle is paid (~$19.95 on itch.io)** — pure convenience, ignore it; download à la carte at
  https://kenney.nl/assets. Each ZIP ships a `License.txt` — keep copies in `_assets/licenses/`.
- Packs we need (all CC0):
  - **Playing Cards Pack** (kenney.nl/assets/playing-cards-pack) — 270 PNGs: all 52 cards + back + blank + 2 jokers at
    64/32/16px, pixel-art. Covers our whole deck for prototype; too pixel-casual for final → skeleton/reference only.
  - **Board Game Pack** — cards, backs, poker chips, dice in 7 colors **with SVG sources** + ~12 sounds. Starting point
    for our chip avatars (Plan A).
  - **Casino Audio** — 50 casino foley files (card slides/flips, chip clinks, dice; v1.1). Core of §2.7.
  - **Particle Pack** + **Smoke Particles** — 80× 512×512 sprites (sparks/glow) + smoke wisps → muzzle-flash surround,
    death smoke, UI poofs.
  - **Crosshair Pack** — 200 reticles → target-select cursor (2.3#6).
  - **UI Pack** (+ Adventure/Sci-Fi), **Interface Sounds** (100), **Impact Sounds** (130), **Music Jingles** (85).
- Style caution: Kenney's look is flat/casual. Use for MVP + hidden fallbacks; the shipped product must read as ours.

### 3.2 game-icons.net — CC-BY 3.0 (attribution required)

- License: **CC-BY 3.0** for ~4,000 icons (verified: https://game-icons.net/about.html). Free for commercial use **if we
  credit**; their own suggested line: `"Icons made by {Author}. Available on https://game-icons.net"`.
- Format: monochrome SVG (precisely what we want for theme reskin — `fill: currentColor` re-tints per venue). Custom
  color/size export via their Studio tool. Download per-icon individually.
- Relevant items (verify author per icon): revolver (`revolver`), bullets, skull variants, `poker-hands`, cards
  (`card-ace-clubs` etc.), `smoking-finger`, emote glyphs (laughing skull etc.), settings/share/copy utilities.
  Every icon used → one batched-by-author line in CREDITS.md (§6).

### 3.3 OpenGameArt.org — per-asset license, use only CC0 or CC-BY filters

- OGA hosts per-asset licenses: CC0, CC-BY, CC-BY-SA (**avoid SA — share-alike contaminates merged work**), GPL, legacy
  mixes. Every page shows its license block; the site auto-generates a CREDITS.txt for collections (still your
  responsibility to verify).
- Picks: **"Playing Cards (Vector & PNG)" by Byron Knoll** (https://opengameart.org/content/playing-cards-vector-png,
  CC0 — clean vector deck); **Lorc's ~700 RPG icons** (CC-BY 3.0, same author as game-icons); felt/wood textures via
  `license: CC0` search. **NC = banned site-wide** (incompatible with paid themes). Prefer Kenney direct over OGA
  mirrors (often stale).

### 3.4 Freesound.org — CC0 first, CC-BY with CREDITS.md, NC banned

- Freesound (https://freesound.org) offers exactly three licenses (verified FAQ, https://freesound.org/help/faq/):
  **CC0** · **CC-BY 4.0** · **CC-BY-NC 4.0**, plus legacy "Sampling+" on old uploads — **avoid Sampling+ too**
  (noncommercial-leaning, retired by CC). Filter: advanced search → license. For us NC + Sampling+ are banned site-wide
  (paid themes = commercial use).
- **CC-BY sounds require an attribution file.** Freesound's recommended format (from the FAQ):
  `"sound name" by username ( https://freesound.org/s/ID/ ) — CC BY 4.0`. They cite Minecraft's credits page
  (https://www.minecraft.net/en-us/attribution/sound) as the model — our CREDITS.md (§6) follows it, and their FAQ
  blesses the "one link to a full credits page" pattern for long lists.
- Self-recording tip (ratchet/cylinder clicks, glass knocks): record it ourselves → we're the author → zero licensing
  forever, and clip-consistent. Login required to download (free account); grab FLAC, transcode to Opus/AAC ourselves.

### 3.5 Mixkit + Pixabay — no-attribution SFX & ambience (read the per-site fine print)

- **Mixkit** (https://mixkit.co, Envato). Sound effects fall under the **"Sound Effects Free License"**
  (https://mixkit.co/license/#sfxFree — hub https://mixkit.co/license/): "Items … can be used in your commercial and
  non-commercial projects for free", **video games named as permitted**, no attribution, no signup. Fine print (verified
  from live license + Envato user terms): (1) never redistribute items **on their own** — as stock, in a tool/template,
  or with source files; a game that plays them is explicitly fine; (2) no Content-ID/rights-management registration;
  (3) 18+, no bulk scraping; (4) Envato's Acceptable Use Policy bans training AI on its assets (irrelevant to playback)
  and its sensitive-topics clause doesn't bite since we have no real-money gambling — keep purchases cosmetic-only.
  ⚠️ Music ≠ SFX license: music/ambience uses the separate **Stock Music Free License** — same pattern (free, no credit,
  no standalone resale); check each item's page before use.
- **Pixabay** (https://pixabay.com) Content License (https://pixabay.com/service/license-summary/): free commercial use,
  **no attribution required**, worldwide. Restrictions: no selling unaltered copies as-is; no implied endorsement; no
  commercial use of trademark-bearing content (scan photo-textures for labels); no defamatory use of people; no
  redistribution as standalone stock. Ideal for gunshot SFX, crowd loops, textures.
- Net: **both are safe-with-hygiene**; log every download in `_assets/ledger.csv` (URL, site, license, date).

### 3.6 Google Fonts — self-hosted OFL/Apache, our 3+ theme trio (verified)

| Font | Vibe/theme | License | File |
|---|---|---|---|
| **Smokum** | western slab-serif; game logo + saloon | **Apache 2.0** (Astigmatic) | https://github.com/google/fonts/blob/main/apache/smokum/LICENSE.txt |
| **Rye** | ornamental western display; CALL LIAR stamp | **SIL OFL 1.1** (Sorkin Type Co) | https://github.com/google/fonts/blob/main/ofl/rye/OFL.txt |
| **Special Elite** | typewriter noir; lobby fine print, body flavor | **Apache 2.0** (Astigmatic) | fontsource.org/fonts/special-elite/about |
| **Monoton** | neon-sign strokes; cyberpunk theme accent | **SIL OFL 1.1** (Vernon Adams) | https://github.com/google/fonts/blob/main/ofl/monoton/OFL.txt |
| Orbitron | space cantina | SIL OFL 1.1 | …/ofl/orbitron/OFL.txt |
| Pirata One | pirate/vampire gothic blackletter | SIL OFL 1.1 | …/ofl/pirataone/OFL.txt |

Rules for both licenses: free for commercial use **including webfonts**; keep each license file next to the font (the
"license travels with the font"); OFL fonts can't be sold standalone and modified versions can't reuse Reserved Font
Names; Apache 2.0 requires keeping the license text (we won't modify files). Self-host WOFF2 rather than the Google CSS
API — no third-party render-blocking request, latin subset ≈ 15–30KB each. OFL summary: https://openfontlicense.org/.

### 3.7 If we ever buy (currently expected: nothing)

Kept for completeness: itch.io packs, Envato Elements subscriptions, commissioned art (get written transfer). Our plan
spends **$0 on assets**; budget the money on an AI generator subscription instead.

---

## 4. AI-generation plan (primary path for hero art)

### 4.0 Global style anchors (paste verbatim into every prompt — consistency system)

- **STYLE BLOCK:** `painterly noir cartoon, muted desaturated palette, thick visible brush strokes, cinematic low-key bar
  lighting, warm tungsten rim light, deep shadows with one amber highlight pool, subtle film grain, stylized exaggerated
  proportions, empty center area for game table — no text, no watermark, no logo, no photorealism, no anime, no existing
  video game characters`
- **CONSISTENCY RULES:** one model (in-session image gen), one style block; approve-and-lock **one reference image** per
  category, then feed it as style/subject reference for every subsequent generation. Theme variants = swap ONE `[VENUE]`
  descriptor row, never the style block. Aspects: backgrounds 16:9 (render 2560×1440 → ship 1920×1080); avatars 1:1
  1024²; card backs 3:4.
- Human pass on every shipped asset: crop, grade (one shared LUT), badge/glyph compositing — this is what makes the
  finished art defensibly ours (§1.4).

### 4.1 Backgrounds ×8 (the flagship asset)

> `Interior of [VENUE], wide establishing shot from behind the card table, moody atmospheric depth, dust motes and
> cigarette haze in the light beams, empty round card table with scattered cards and a revolver in the foreground center,
> aged/richly textured environment, dramatic silhouette shapes around the edges of frame` + STYLE BLOCK

[VENUE] rows (one generation batch each):
1. Saloon — `a 19th century western saloon, mahogany bar counter, swinging doors, spittoons, oil lamps`
2. Neon cyberpunk — `a neon-lit cyberpunk dive bar, holographic signage, rain on the window, cracked leather booths`
3. Pirate — `the below-deck cabin of a galleon, lanterns swinging, cannonball racks, salt-crusted wood`
4. Vampire — `a gothic crypt wine cellar, cobwebbed candelabra, black chandeliers, coffin lids as benches`
5. Space — `a smuggling-rig space cargo bay, view of a nebula through a porthole, buzzing strip lights`
6. Speakeasy — `a 1920s prohibition-era speakeasy backroom, art-deco lampshades, cigar smoke, brass rails`
7. Voodoo bayou — `a Louisiana bayou shack interior, hanging bottles, moss, candle smoke, humid haze`
8. Arabian nights — `a smoky thieves' den, brass lanterns, ornate arches, fringed curtains`
Palettes must stay muted/low-key even on neon: only 1–2 accent hues per venue (maps to §2.5 palette tokens).

### 4.2 Avatars (Plan B animal set — original species only)

- Approved cast — raccoon, crow, goat, alligator, vulture, alley-cat, donkey, owl (**never** fox/dog/bull/pig).
- Prompt: `Head-and-shoulders cartoon portrait of a grizzled [SPECIES] gambler in [VENUE]-appropriate attire, world-weary
  expression, holding a playing card fan, [CHARACTER-QUIRK], centered bust composition, plain dark background` +
  STYLE BLOCK (same [VENUE] wardrobe row as the theme they're free with).
- Same seed per species for idle; then state passes with the same reference: `dead / X eyes, smoking hat, slumped`
  (comedic, never gore) and `flinch`. Compose the 3 states into a sheet ourselves — never ask the model for sprite
  sheets (frame alignment is unreliable).

### 4.3 Table / props

> Felt: `Top-down macro of a worn leather-tooled card table surface, whiskey ring stains, scattered cards, bullet
> casings around the edge, vignette edges, flat lay` + STYLE. Parallax strips: `[VENUE] shelf of bottles and bar
> props, seamless horizontal tiling strip, silhouetted against warm light` + STYLE.

### 4.4 Card back (1 saloon + 7 theme variants)

> `Ornate poker card back, flat vector-like border ornament, [DEVICE: crossed revolvers + wreath] in the center,
  [PALETTE], symmetrical lace frame, aged gold ink on dark leather texture, no lettering` + STYLE BLOCK.
> Saloon device = crossed six-shooters + horseshoe; theme device swaps: neon = circuit-winged skull with poker chips;
> pirate = skull-in-lifebuoy; vampire = bat + goblet; space = exploded planet + comet; etc. Render 512×716 → ship 300×420.

### 4.5 Gun set hero art

> `Antique six-shot revolver in perfect side view floating on a plain dark background, subtle oil sheen,
  dark cinema light from upper left, engraving detail on cylinder` + STYLE BLOCK. The cylinder plate separately:
  `Revolver cylinder opened, six empty chambers visible, top-down diagram-like but painterly, steel texture` + STYLE.
  Muzzle flash is NOT generated here — Kenney `particle-pack` (CC0) assembled at runtime beats an AI animation.

### 4.6 Promo art (highest effort, then human-finished)

> Two of our animals mid-standoff at the card table, one pointing a revolver across it, chips in the air, single hanging
> lamp between them, empty title space above (lettering added later by us in `Rye` — generated text always comes out
> mangled and stays out of the render) + STYLE BLOCK.
> Output: 1200×630 OG/social + 1080² crop; finished with human compositing + typography — the one asset that must be
  human-composited for §1.4 copyright strength.

### 4.7 DO NOT AI-GENERATE (CC0/code is strictly better)

- UI icons ×~15 — need pixel-perfect small-size legibility, single-weight lines, easy retheming: game-icons (CC-BY) and
  Kenney (CC0) win outright.
- SFX — models can't do crisp 60ms UI clicks or seamless ambience loops; CC0 libraries (Kenney/Freesound/Mixkit/Pixabay)
  cover all of §2.7.
- Fonts — served by OFL/Apache families, never generated.
- Animation frame sequences — frame inconsistency; assemble from static pieces (§2.6).

---

## 5. Technical specs & budgets (mobile-first)

### 5.1 Formats per asset type

| Asset | Format | Target |
|---|---|---|
| Backgrounds/theme art | **WebP** q70–75 (lossy, 4:2:0); AVIF only as progressive-enhancement layer (~97% browser support in 2026) with WebP fallback via `<picture>` | ≤ 250KB desktop hero; ≤ 150KB mobile-res re-encode |
| Avatars small / UI plates 9-slice | WebP q75 with alpha | ≤ 40/30KB each |
| Icons | **SVG** sprite (one HTTP request) or inline; inline only for above-the-fold icons | ≤ 150KB total sheet |
| Card faces | One **1024×1024 WebP atlas** (14 faces + regions), sprite-map slicing via CSS. Pixel-art prototype (Kenney) direct PNG | Complete atlas ≤ 150KB |
| Muzzle flash | **Sprite strip** (128×128 × 6 frames on one WebP with alpha), preferred over alpha-WebM (iOS Safari gaps) | ≤ 60KB |
| Audio SFX | OGG Opus + AAC/M4A dual encode (32–48 kbps mono ≈ 10–20KB per click-class sound) | total SFX bank ≤ 350KB |
| Ambience ×8 | 15–30s looped OGG Opus + AAC ~64–96 kbps, gate as clip (element or bufferSource) | 120–250KB each |
| Fonts | WOFF2, latin subset, `font-display: swap`, self-host on same CDN as app | 15–30KB per family |
| Lazy chunks | Individual files multiplexed over HTTP/2+3 — no mega-atlas needed outside the saloon set | — |

### 5.2 Size budgets (hard targets)

- **First load (saloon-only play): ≤ 2.5–3MB**, split ≈ JS 600–900KB (min+Brotli) · fonts ~50KB (2 families) · background
  220KB · cards+UI+avatars ~500KB · SFX ~400KB · one ambience loop ~250KB. Enforce with a build-budget gate in CI.
- **Per premium theme pack: ≤ 500KB–1MB** lazy chunk (bg 250 + parallax 150 + card back 60 + ambience 250 + font 40),
  fetched on purchase/preview only.
- **Total installed (all 8 themes cached): ≤ 15MB** — service-worker precache for the app shell, runtime cache for themes.
- Desktop: same bundles; extra headroom goes to an optional 2560-wide AVIF hero.

### 5.3 Preload strategy (codebase work, not art work)

- **Only the saloon blocks play:** `<link rel=preload as=image>` for its background + critical-palette CSS inlined at
  boot; fetch the card atlas + core SFX via `Promise.all` behind the lobby screen (a room-code join fills the wait).
- **Premium chunks** fetch on the store "preview" tap and on purchase confirmation; the free store ship includes 512px
  preview WebPs (~60KB) so buyers sample before paying. Reuse the loading screen's progress ring.
- **Audio:** pre-buffer all SFX (small) at boot via `decodeAudioData`; lazy-fetch ambience (big) only when its theme
  activates; the mute toggle gates both decode and fetch paths.

---

## 6. CREDITS.md (template — place at repo root and link from game menu + site footer)

```markdown
# Credits
We build on the generosity of open-asset creators. Thank you.

## Icons (CC BY 3.0)
- <Icon Name> by Lorc — available on https://game-icons.net
- <Icon Name> by Delapouite — available on https://game-icons.net
<one line per author-batch; CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/>

## Sounds (CC BY 4.0, Freesound.org)
- "<Sound Title>" by <username> (https://freesound.org/s/<ID>/) — CC BY 4.0
<one line per sound, TASL: Title · Author · Source-link · License>

## Sounds & assets (CC0 — no credit required, credited with thanks)
- Card sprites/UI chips/audio: Kenney — https://kenney.nl
- Particles & reticles: Kenney (Particle Pack, Crosshair Pack)

## Sound effects & ambience (Mixkit Sound Effects Free License / Pixabay Content License)
- © their respective creators — https://mixkit.co/license/ · https://pixabay.com/service/license-summary/

## Fonts
- Rye © Sorkin Type Co — SIL Open Font License 1.1 — https://openfontlicense.org
- Monoton © Vernon Adams — SIL OFL 1.1
- Orbitron © Matt McInerney — SIL OFL 1.1
- Pirata One — SIL OFL 1.1 (fill © holder from its OFL.txt at ship)
- Smokum © Astigmatic — Apache 2.0 — https://www.apache.org/licenses/LICENSE-2.0
- Special Elite © Astigmatic — Apache 2.0

## Original & AI-assisted art
- Backgrounds, avatars, card backs, promo art: original works for this game.
  AI-assisted (image model), art direction, compositing and editing by our team.
```

Hygiene: every CC-BY asset maps 1:1 to a line here **before** it ships; the ledger (`assets/ledger.csv`) is the source of
truth. Mixkit/Pixabay/Kenney lines are courtesies — the only binding rule there is Mixkit's no-standalone-redistribution,
which shipping-in-game satisfies.

---

## 7. What this means for our version (the recommended plan)

**Rule of thumb: AI for big expressive hero art, CC0 for utility, code for motion, CREDITS.md for the rest. Zero purchases.**

**We AI-generate (≈14 hero assets + variants):**
- 8 themed bar backgrounds + parallax prop strips (§4.1, §4.3)
- 7 premium card backs + 1 saloon (§4.4)
- 8 original animal avatars ×3 states (post-MVP, §4.2) — never the original game's species
- Revolver + cylinder hero art (§4.5)
- Promo/OG/composite art, human-finished (§4.6)

**We take from CC0 (safe, instant):**
- Kenney: Board Game Pack (chips/SVG), Playing Cards Pack (prototype), Casino Audio (card/chip foley), Particle Pack +
  Smoke Particles (muzzle/death FX), Crosshair Pack (reticle), UI Pack (menus prototype), Interface/Impact Sounds,
  Music Jingles (win stings)
- Freesound (CC0 filter), Pixabay & Mixkit (their free licenses): gunshots, dry-fire, ambience loops ×8 — no-credit
  sources with clean terms
- OpenGameArt CC0 (Byron Knoll vector cards; felt/wood textures)

**We take from CC-BY with attribution (CREDITS.md):**
- game-icons.net SVG icons (emote glyphs, settings/share, backup revolver glyph) — one line per author
- Any Freesound CC-BY 4.0 sound we can't find CC0 — TASL line each

**We buy: nothing.** (If art direction later demands a name illustrator for promo art, that's a commission — see §3.7.)

**Banned forever:** Google-scraped images (no license), anything from the Steam game / Curve Animation or
screenshots/traces/OG images thereof, anything NC / ND / Sampling+ / GPL (noncommercial or viral).

**Pre-ship checklist:** ledger updated → CREDITS matches ledger → per-pack `License.txt` files committed under
`_assets/licenses/` → premium-pack WebP/Opus sizes pass budget gate → mixkit/pixabay files never served standalone.
