# 08 — Monetization: Premium Bar Themes

> Deep-dive 8 of 12 · 2026-11-23 · Research-backed plan for the owner's locked model:
> **game 100% free → one-time cosmetic purchases unlock bar themes.**
> Facts verified via provider pricing pages and 2025–26 industry sources (URLs inline + at bottom).

---

## 1. Why the theme plan works

**Cosmetic-only is the most player-friendly monetization that still makes money.**

- **We literally cannot sell power.** Liar's Deck is a fixed-rule bluffing game: 20-card deck, 1–3
  cards face-down, roulette on a caught lie. No stats, no upgrades, no boosters exist in the design.
  There is nothing to sell except looks. That kills the pay-to-win accusation *by construction* —
  the #1 community-killing backlash for small multiplayer games.
- **The model has precedents at every scale:**
  - **Fortnite** — cosmetics-only ("free-to-win", Epic's own framing) → $5.5B in 2018, and industry
    research shows cosmetics buyers are driven by *self-presentation in front of others*
    (Clemson study on Fortnite skin spending: identifiability correlates with spend).
    https://www.deconstructoroffun.com/blog/2018/4/21/aegai526kyjvsn69xm6uc2x02we48
  - **Among Us** — free on mobile, sells pure cosmetics: skin packs **$1.99**, pet bundles **$2.99**
    (Steam store listings). Small prices, friend-group audience, huge revenue during its moment.
    https://store.steampowered.com/bundle/16867/Among_Us_Starter_Pack
  - **Goose Goose Duck** — the closest comp genre-wise (social deduction, friend groups, F2P):
    monetizes via cosmetics only, hit **700k CCU and #13 on Steam's global revenue chart** while free.
    https://newsletter.gamediscover.co/p/how-goose-goose-duck-hit-700k-ccu
- **Our game has an unusually good environment for cosmetic flexing** (this is the core insight):
  - A table of 2–7 friends, on a call, staring at the *same room* for 15–30 minutes. A theme isn't
    a background nobody notices — it's the stage for every dramatic reveal and every death.
  - **Lobby-visible bragging rights = the ad.** If the HOST's theme decorates the room, six friends
    see it every round. The purchase is self-demonstrating; we never pay for that impression.
  - **Gifting dynamics:** one friend buys Neon District → the rest of the group experiences it for
    free → "wait, where'd you get this?" → they open the picker. Among-Us-style friend-group
    virality (one crewmate with a pet → everyone asks) is the whole funnel.
  - Design implication: **premium themes should be selected by the host and render for everyone in
    the room** (ownership required to pick it), NOT a private client-side skin only the owner sees.
    Visibility is what we're selling.
- **Anti-example avoided:** the original Liar's Bar is $6.99 *upfront* — a paywall is exactly what
  suppresses the friend-group growth loop (the friend who won't pay blocks the whole group from
  playing together). Free-with-cosmetics keeps all 7 seats fillable; every free player is both
  a potential buyer *and* the social context that makes a buyer's purchase worth showing off.

---

## 2. Theme catalog design (1 free + 8 premium)

A "theme" = a room skin bundle. Per theme, what actually differs:

- **Visual:** room backdrop (walls, window, lighting), table + felt color/texture, prop sprites
  (lamps, bottles, signs, curtains), ambient particles (dust, neon haze, fog), UI accent color.
- **Audio:** one looping music track (~60–90s seamless), ambience bed (rain, crowd murmur, hum),
  two stingers (liar-caught sting, death sting).
- **Avatar-neutral:** themes reskin the *room*, not the 4 animals, so no per-character art needed
  per theme (cheap to produce, important for a solo dev).

| # | Theme | Price | One-line vibe | Palette / audio mood |
|---|-------|-------|---------------|----------------------|
| 1 | **The Saloon** | FREE | Default western spit-and-sawdust bar (the Liar's Bar identity) | Warm browns, amber lantern light, swinging doors / honky-tonk piano, wood creaks |
| 2 | **Neon District** | ₹99 | Cyberpunk dive under a broken holo-sign | Black + teal/magenta neon, rain reflections / dark synthwave, bass hum |
| 3 | **Dead Man's Cove** | ₹99 | Rotting pirate tavern at the water's edge | Sea-green, barnacled wood, ropes, lanterns / accordion shanty, gulls + waves |
| 4 | **Crimson Lounge** | ₹99 | Vampire goth velvet lounge, candelabras flicker with each lie | Deep red + black velvet, gold trim / pipe organ, distant thunder |
| 5 | **Orbital Cantina** | ₹99 | Retro space-diner with a window full of stars | Navy + chrome, starfield, purple neons / jazzy sci-fi cocktail music, console beeps |
| 6 | **Kabuki Alley** | ₹99 | Tokyo-noir back-alley izakaya, lanterns + neon signage | Ink black + vermilion + cool blue / shamisen lofi, distant train, rain |
| 7 | **The Speakeasy** | ₹99 | 1920s prohibition bar behind a password door | Sepia + brass + emerald felt / hot-jazz 78rpm crackle, crowd laughter |
| 8 | **Haunted Inn** | ₹99 | Derelict ghost-tavern; candles flicker, chairs rock alone | Desaturated blue-grey, flicker-lighting / music-box lullaby, wind, whispers |
| 9 | **The Gilded Room** | ₹99 | Opulent gold-and-marble high-rollers' parlor | Gold + royal purple, chandeliers / lush strings + harp, champagne pops |
| 10 | **The Adda** | ₹99 | Indian chai-dhaba terrace — rounds under a Diwali-night sky | Indigo night + marigold, string lights, cutting chai steam / tabla-flavored lofi, street ambience |

Notes:
- The Adda is our local-market feather (the audience is Indian friend groups; festive/rakhi/Diwali
  drops are where India's strongest spending moments land).
- Naming caution: theme #9 deliberately avoids the word "casino" on any *payment-facing* copy.
  Indian payment gateways screen merchant websites for gambling-adjacent language and a "casino
  bar game" description risks KYC rejection or account review (see §5, Razorpay gaming KYC).
- Production cost note for the solo dev: 1 backdrop + felt + ~6 props + lighting grade + 1 music
  loop + 3 SFX stingers per theme ≈ the cheapest possible "expansion pack" in gamedev.

---

## 3. What else can be premium WITHOUT breaking fairness

Everything below is pure output-layer cosmetics — zero effect on information, timing, or odds:

| Item | What the buyer (and the table) sees | Price idea |
|------|--------------------------------------|-----------|
| **Table felt patterns** | Felt texture/pattern variants (crimson damask, neon grid, palm print) inside any theme | ₹49 |
| **Card back designs** | The back of face-down cards — seen by ALL players every round (highest-visibility cheap item) | ₹49 |
| **Avatar portraits** | Original character busts (do NOT use Liar's Bar's animals — see doc 10, copyright) + frame colors | ₹49 |
| **Kill-quotes** | Custom one-liners in chat when you're eliminated ("Nothing personnel, kid.") | ₹49 |
| **Win poses** | Your character's victory flourish on the last-alive screen | ₹49 |
| **Death effects** | Roulette vapor confetti color + muzzle flash color (pink neon death in Neon District, ghost-wisp in Haunted Inn) | ₹49 |
| **Lobby badges** | "Founder '26", "First 100 Rooms", Discord-linked badge on your nameplate | ₹99 or event-earned |
| **Emote packs** | Safe: gestures only, no gameplay signal. Ship AFTER a "no mid-round intel" review (emotes can't reveal anything a player couldn't say aloud) | ₹49 |
| **Room name plates** | Fancy nameplate frame on the table | ₹49 |

**Price ladder (3 tiers):**

1. **Single theme** — ₹99 — the flagship SKU, seen by everyone.
2. **"Bar Crawl Pass" bundle** — all themes, ₹399 (perceived: "8 themes for ₹400 < 8×₹99") — the
   best-value anchor; the bundle is what an invested friend-group host actually wants (variety per
   session). This mirrors Among Us's All-in-one bundle ($29 incl. everything).
3. **"House Regular" Supporter Pack** — ₹499: bundle + exclusive supporter badge + golden revolver
   death effect + future themes included for one year + Discord role. Buys identity, not power —
   the "I support this game" tier. (Lean on the proven pattern: players spend to support indie
   devs they've put hundreds of hours into.)

**Explicitly never selling:** extra cards, vote weight, more roulette-time, table hints,
animated tells for opponents, loot boxes (India is uniquely sensitive post-2023 online-gaming
crackdown — deterministic "you see exactly what you buy" is a feature), paid rooms/seats.

---

## 4. Pricing research + concrete recommendation

**Benchmarks (2025–26):**

- **Among Us:** skin packs $1.99, pet bundles $2.99 (mobile/PC, friend-group audience — our closest
  price anchor). https://store.steampowered.com/bundle/16828/Among_Us_Allinone
- **India in-app purchase reality:** the comfortable micro-spend band is small — sources cite a
  **₹10–30 sweet spot per microtransaction** and note porting a $4.99 pack to ₹415 fails outright.
  ₹49/₹99/₹199/₹499 are the recognized "charm" thresholds (left-digit effect: ₹99 vs ₹100 measurably
  shifts Indian buyers; literal store chains are built on ₹99 pricing).
  https://blog.gamemantra.ai/iap-pricing-india-southeast-asia · https://vmobify.com/blog/in-app-purchase-pricing-experiments · https://upstox.com/news/upstox-originals/investing/why-india-loves-a-good-99-deal/article-181614
- **75% of Indian gamers now pay for IAPs** (mostly in small amounts) — the objection isn't paying,
  it's paying a US-converted price. UPI makes a ₹99 buy near-impulse-grade.
  https://vmobify.com/blog/how-to-increase-in-app-purchases
- **UPI-first checkout is non-negotiable:** UPI is ~87% of India's retail payment volume
  (CareEdge via ETBFSI) and ~57% of e-commerce spend (dLocal). No stored credentials needed; a
  payer taps GPay/PhonePe and done. https://bfsi.economictimes.indiatimes.com/news/financial-services/upis-market-share-expands-more-at-debit-credit-cards-expense/133606233
- **First 2–4 weeks after install = peak IAP conversion window**, and a first purchase makes a
  player **~4–6× more likely to buy again** — so optimize for "the first ₹49", not the first ₹99.
  https://vmobify.com/blog/in-app-purchase-pricing-experiments

**Concrete recommendation (v1):**

| SKU | India | Global (USD) |
|-----|-------|-------------|
| Single theme | **₹99** | **$2.99** (not $1.99 — MoR fixed fees punish $2 price points, see §5) |
| First-purchase offer (one per account, first 14 days) | **₹49** ("First drink's on us" — 50% off any one theme) | $1.49 |
| Bar Crawl Pass (all themes bundle) | **₹399** | **$9.99** |
| Small cosmetics (card backs, vapor colors, quotes, felt) | **₹49** | $1.49 |
| Supporter pack | **₹499** | $12.99 (ship later) |
| Seasonal/theme event (e.g., Diwali Adda variant) | ₹149 limited window | $3.99 |

Keep prices **country-localized, never FX-converted** (₹99 ≠ $1.18 ≠ ₹415-from-$4.99 — the research
is unambiguous that local anchors beat conversion rates in both directions).

---

## 5. Payment rails for a solo web dev (2026 fees)

**The two honest paths:** (a) an **Indian gateway** (you are the merchant — cheapest, UPI, but more
paperwork), or (b) a **Merchant of Record** (they are the legal seller — the MoR *is* the shop of
record: it collects and remits every country's VAT/GST/sales tax, handles fraud/chargebacks, and
you just invoice them — the entire tax/compliance department of a business, rented per transaction).

| Provider | Model | Fees (2026) | India UPI? | Catches |
|----------|-------|-------------|-----------|---------|
| **Razorpay** | Indian gateway (you = merchant) | **2% + 18% GST on fee** domestic (UPI/cards/netbanking); 3% intl cards; **0% platform fee for first 90 days for new merchants** | ✅ 50+ UPI apps | Proprietorship KYC (PAN + bank). **"Gaming" category needs a legal "game of skill" opinion** — register as digital-goods/software instead. Settlement T+2 | 
| **Cashfree** | Indian gateway | **1.95%** cards/UPI; **0% fee promo up to ₹20L GMV** for new merchants; T+1 payout offer | ✅ | Same KYC world; smaller brand mindshare |
| **Stripe India** | Indian gateway | 2% domestic cards (+GST); 4.3% + 2% FX intl | ❌ card-focused | **Invite-only** — can't self-serve sign up; no regional pricing if you can't get in |
| **Paddle** | MoR (they = merchant) | **5% + $0.50 per checkout** all-inclusive | ❌ (cards/PayPal/etc.) | Best global tax coverage; fixed fee hurts $2 items, fine at $9.99 |
| **FastSpring** | MoR | quote-only; reported ~5.9% + $0.95 or flat 8.9% | ❌ | Sales-led, double-digit effective % on small tickets |
| **Lemon Squeezy** | MoR | 5% + $0.50 (+surcharges) | ❌ | **Winding down** — stores must migrate to Stripe Managed Payments by Mar 31, 2027. Avoid for new builds |
| **Stripe Managed Payments** | MoR (new, 2026) | 3.5% MoR fee **on top of** ~2.9%+$0.30 processing | ❌ | ~6.4%+ all-in; successor to Lemon Squeezy; young |

Sources: https://razorpay.com/payment-gateway-charges-india · https://razorpay.com/blog/razorpay-0-percent-platform-fee-offer-90-days-new-merchants-2026 · https://cashfree.com/payment-gateway-charges · https://cashfree.com/blog/payment-gateway-charges-india-free-payment-gateway · https://stripe.com/in/pricing · https://support.stripe.com/questions/how-can-i-open-a-stripe-account-in-india · https://paddle.com/pricing · https://docs.lemonsqueezy.com/migration/faq · https://paas.build/fastspring-alternative

**Recommendation: Razorpay primary, Cashfree fallback, Paddle later for global.**

1. **Razorpay** — because the audience is India and the audience pays with UPI (Razorpay covers
   50+ UPI apps natively with one checkout integration). Merchant = you (sole proprietorship:
   personal PAN + a bank account; no registered company needed). Hosted Checkout + webhooks +
   payment links are all documented single-day integrations for a solo dev, and the first-90-days
   0% offer means launch-month fees are literally zero. Two practical cautions:
   - **Onboard as "digital goods / software"**, never "gaming" (gaming triggers the skill-vs-luck
     legal-opinion KYC burden). Keep site copy PG-descriptor-friendly: "buy cosmetic room themes",
     no "betting/casino/gambling" wording anywhere on the paywalled site.
   - Don't show UPI issuer-brand noise; keep the Razorpay Checkout popup in its default state — it
     renders GPay/PhonePe intents correctly on mobile.
2. **Cashfree** — the legitimate plan-B: often cheaper (1.95%, with the 0%-fee up to ₹20L GMV
   promo for new accounts), comparable UPI checkout, T+1 settlement offer. If Razorpay KYC
   stalls or fees creep, port the checkout in an afternoon (same order→verify→webhook flow).
3. **Paddle later** — only once non-Indian players start emailing to buy. Single $9.99 bundle sales
   internationally are viable at 10% all-in with *every* VAT/GST obligation handled; single $2.99
   themes via Paddle lose 21% to fees, so internationally we push the $9.99 bundle.

**GST/refunds/tax lite-notes (not advice; keep an accountant friend on speed dial):**
- **28% GST is for real-money gaming** (stakes — Supreme Court-upheld, Gameskraft, May 2026). We
  take no stakes — we're a F2P card game selling cosmetics → we are NOT in that bucket, and our
  ads/copy should never blur that line. https://economictimes.indiatimes.com/tech/technology/video-game-developers-write-to-government-seek-distinction-from-real-money-gaming-platforms/printarticle/102144415.cms
- Services GST registration threshold is ₹20L turnover/year — below it you don't register and
  simply absorb tax in your (₹99) price. Past it: get a GSTIN + CA (~₹2k/yr filings). Razorpay
  auto-generates the fee invoices either way.
- **Refunds:** digital cosmetics are revocable, so a generous **72-hour no-questions refund**
  (Razorpay refund API + revoke entitlement) costs almost nothing and converts fence-sitters.
- **RBI awareness:** auto-recurring payments (subscriptions) need the **e-mandate framework 2026**
  (mandate registration, pre-debit alerts, ₹15,000 no-OTP threshold). *This is exactly why v1 is
  one-time purchases only* — no e-mandate plumbing, no UPI-Autopay, no RBI recurring-rule edge cases
  (e.g., failed mandates mid-rampage during a Diwali sale). If a "season pass" is ever added, plan
  UPI-Autopay properly at that point. https://m.rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=13374 · https://assets.kpmg.com/content/dam/kpmgsites/in/pdf/2026/06/reserve-bank-of-india-rbi-digital-payments-e-mandate-framework-2026.pdf.coredownload.inline.pdf

---

## 6. Entitlement implementation sketch (Mongo, Solo-Node stack)

**Principle: the server is the only thing that believes money moved.** Never trust the client-side
checkout success callback (players close tabs mid-UPI-intent all the time); the webhook + a
server-side order-status poll are the sources of truth.

**Collections:**

```js
users        { _id, name, provider, providerId, createdAt }        // lightweight account
orders       { _id, userId, sku, amount, currency, gateway,
               gatewayOrderId, status: "created|paid|failed|refunded", createdAt, paidAt }
entitlements { userId, sku, active, source, orderId, grantedAt }   // unique index {userId, sku}
webhookEvents{ eventId, processedAt, payload }                     // unique index {eventId}
```

**Flow:**

1. Player clicks a locked theme → **preview modal** (auto-playing showcase loop + price + Buy).
2. If guest: step 0 of checkout is a **lightweight account claim** ("keep your themes forever"):
   email-OTP or Google OAuth → userId created → then continue. (Purchases tied to a userId, never
   to a browser fingerprint/session — restore-purchases and support both become trivial.)
3. Server creates a gateway order via Razorpay API: `amount 9900 (paise), currency INR,
   receipt orderId, notes {userId, sku}` → return `gatewayOrderId` + key_id.
4. Client opens Razorpay Checkout → player pays via UPI intent / card.
5. **Webhook `payment.captured` → handler, in this order:**
   1. Verify HMAC signature with webhook secret (reject & log on mismatch).
   2. `webhookEvents.insertOne({eventId})` — unique index: if dup key → **ack 200 & stop** (this is
      your idempotency guarantee against Razorpay's at-least-once retries).
   3. Load order by `gatewayOrderId`; verify **amount + currency + notes.userId match the order**
      (never trust the webhook's amount field alone).
   4. Grant: `entitlements.updateOne({userId, sku}, {$set: {active:true, ...}}, {upsert:true})`
      — upsert = replay-safe; then `orders.status = "paid"`.
   5. Push/signal the client (socket or 5s poll) → theme picker unlocks with a little sparkle.
6. **Belt-and-braces:** on page load, client polls `GET /my/purchases`; if any `order.status ==
   created` older than 10 min, server fetches order status from Razorpay API directly and applies
   the same idempotent grant logic (covers missed webhooks).
7. **Restore purchases** = "log in and they're there." For support cases: player gives order ID
   from the payment SMS/Razorpay receipt → admin lookup → manual `entitlements` sync.
8. **Refund:** admin action → Razorpay refund API → set `entitlements.active=false` (keep the row —
   history), `orders.status="refunded"`. Room reverts to Saloon on next round start.
9. Host-visibility rule: room theme selection lists themes the *host* owns; server validates
   `entitlements` before applying the room's theme (client can't claim Neon District via socket spoof).

**Anti-theft in v1 is modest and appropriate:** server-validates entitlements, webhooks signed +
dedup + verified; no keys to crack. Accept that a determined pirate can't be stopped on the web —
make buying easier than pirating (UPI one-tap + ₹49 first purchase does that).

---

## 7. Conversion design (where & how to sell)

- **Lobby theme picker = the storefront.** Everyone taps it while waiting for the last friend.
  Locked themes show their **preview loop playing muted** + price; a "coming soon" ghost tile at the
  end of the carousel ("Haunted Inn — this Friday") manufactures the return visit.
- **Post-round hooks (context, not popups):**
  - Win screen: caption "You looked good winning in Neon District." → [Keep this bar → ₹99].
  - Death screen after a cool animation is an emotional-peak moment — show a single tasteful line.
  - Never an ad-break feel; one line max, skippable, zero mid-game popups.
- **First-time nudge:** after a player's **2nd finished game** (peak intent, inside the 2–4-week
  conversion window), toast: "That Saloon is a bit dusty. First theme is ₹49 for your first drink":
  linking the one-per-account first-purchase offer.
- **Trial experience:** **rotating weekly "on the house" theme** — one premium theme free for all
  hosts each week. The group plays Haunted Inn Friday night, loves it, discovers the picker, and
  the *bundle* pitch ("all of them, ₹399") lands right after the fun. Trials rotate discovery; each
  week also becomes a soft "what's new" retention touch.
- **Gifting (post-v1 but high-leverage):** "gift a theme to [player at table]" — friend-group
  gifting is the Among Us pet-bundle engine. Requires accounts on both ends, so ship after
  account claim is stable.
- **Refund/tolerance:** 72h no-questions refund, one-click from a "My purchases" page (we revoke
  and refund; a ₹99 refund is cheaper than a Reddit thread titled "scam").
- **Subscriptions: no (v1).** RBI e-mandate rules mean recurring = mandate registration + pre-debit
  notifications + bank-side failures we don't want to babysit. One-time + bundle = the whole menu.

---

## 8. Revenue reality check (honest version)

Assumptions: 2–5% of *monthly unique players* ever buy (industry F2P conversion benchmarks: ~2%
typical, 1.5–5% range; PC/web friend-group audiences trend HIGH end when they convert because the
social flex is the point, but web retention trends LOW — call it 2.5–4% expected).
https://gamewiki.blog/how-many-players-spend-money-f2p-games · https://www.lucabarberis.com/operator-atlas/free-to-play-gaming/conversion-to-repayer-curve
Average paying-user spend ≈ **₹110** (mix of ₹49 first buys / ₹99 themes / occasional ₹399 bundle).

| Monthly unique players | Buyers (2.5%–4%) | Gross ₹/mo | Net after ~2.4% fees | What that is |
|------------------------|------------------|-----------:|---------------------:|--------------|
| 500 (the friend circle of friend circles) | 10–20 | ₹1,100–2,200 | ~₹1,050–2,150 | Chai money |
| 2,000 (a college goes viral one weekend) | 50–80 | ₹5,500–8,800 | ~₹5,300–8,500 | Hosting + domain paid |
| 20,000 (a real meme moment / streamer clip) | 500–800 | ₹55k–88k | ~₹53k–85k | Meaningful side income |
| 100,000 (Liar's-Bar-scale spike; Steam peaked 113k CCU) | 2,500–4,000 | ₹2.75L–4.4L | ~₹2.7L–4.3L | "Plot twist" territory — but spikes decay |

**Honest notes:**
- For the first 6–12 months, this is a **passion project with a tip jar**: expect the first two
  rows. Steam Liar's Bar's own trajectory (2000 CCU at launch, viral spike later) and its *current*
  ~380–1k CCU in Nov 2026 show how spiky this genre is even at its peak.
- Friend-group web games live and die by **moments** (a clip, a college fest, a streamer). Revenue
  is bursty; the bundle + seasonal drops are how we monetize a burst when it happens
  (salience during a spike: homepage banner "New theme this week").
- Every free player is still an asset: seat-filler, theme-advertiser (someone has to *see* the
  buyer's purchase for it to be worth ₹99), and a future ₹49-first-buyer.
- Keep money expectations boring so the game can stay fun: it funds hosting and proves demand
  with ~zero incremental work (item production timeline = art hours, not code).

---

## 9. What this means for our version — v1 cut list

**Ships in MVP (v1.0):**
- FREE default theme: **The Saloon** (part of core art budget, not monetization work).
- **3 premium themes: Neon District, Dead Man's Cove, The Adda** (target: broadest India-friend
  appeal, one western + one pirate + one local; each = 1 room kit as specced in §2 —
  postcard-completable solo scope).
- SKUs: theme ₹99, **first-purchase offer ₹49** (one per account, 14-day window), **Bar Crawl
  Pass ₹249** for all 3 (vs ₹297 à la carte — a real deal, plus the "I'll just get the pass" nudge;
  reprices to ₹399 as more themes join the pass).
- **Razorpay** hosted checkout (UPI-first) + webhook entitlement system per §6; Cashfree keys
  stubbed in config as a fallback (same flow, different SDK).
- Theme picker UX in lounge: locked themes, muted preview loops, one "coming soon" ghost slot.
- `My purchases` page with restore + 72h self-serve refund request → admin approves, API revokes.
- One post-win one-liner hook (a single static caption — no targeting logic in v1).

**v1.1–v1.3 (after first revenue signal or first 100 players/week):**
- Weekly rotating free-theme trial; first-time nudge after 2nd game; kill-quote + card-back packs
  (₹49) as cheap add-on SKUs; Crimson Lounge + Kabuki Alley; guest checkout account-claim polish.

**Later (v2, when international demand appears / MMR felt):**
- Remaining themes (Orbital Cantina, Speakeasy, Haunted Inn, Gilded Room); **Paddle** MoR for
  non-INR sales ($2.99/$9.99 tiers); Supporter Pack ₹499 w/ golden death effect + badge; **gifting**;
  seasonal Diwali/Halloween limited themes (₹149 window pricing); emote packs.

**Never ships:** pay-to-win anything (impossible anyway), loot boxes, subscriptions (until we
want e-mandate ops), ads interstitials (brand death for a dark-humor party game), player data sale.

---

## Sources (key URLs)

- Razorpay pricing & offers — https://razorpay.com/payment-gateway-charges-india · https://razorpay.com/blog/razorpay-0-percent-platform-fee-offer-90-days-new-merchants-2026
- Razorpay KYC / gaming note — https://razorpay.com/docs/payments/business-types-kyc-documents
- Cashfree pricing/promos — https://cashfree.com/payment-gateway-charges · https://cashfree.com/blog/payment-gateway-charges-india-free-payment-gateway
- Stripe India (invite-only, card rates) — https://stripe.com/in/pricing · https://support.stripe.com/questions/how-can-i-open-a-stripe-account-in-india
- Paddle MoR 5%+50¢ — https://paddle.com/pricing
- Lemon Squeezy wind-down / Stripe Managed Payments — https://docs.lemonsqueezy.com/migration/faq · https://stripe.com/managed-payments
- FastSpring real costs — https://paas.build/fastspring-alternative
- Among Us cosmetic prices — https://store.steampowered.com/bundle/16828/Among_Us_Allinone
- Goose Goose Duck F2P-cosmetics case — https://newsletter.gamediscover.co/p/how-goose-goose-duck-hit-700k-ccu
- Fortnite cosmetics-only economy — https://www.deconstructoroffun.com/blog/2018/4/21/aegai526kyjvsn69xm6uc2x02we48
- India IAP pricing/psychology — https://blog.gamemantra.ai/iap-pricing-india-southeast-asia · https://vmobify.com/blog/in-app-purchase-pricing-experiments · https://upstox.com/news/upstox-originals/investing/why-india-loves-a-good-99-deal/article-181614
- UPI dominance — https://bfsi.economictimes.indiatimes.com/news/financial-services/upis-market-share-expands-more-at-debit-credit-cards-expense/133606233 · https://dlocal.com/the-local-code/the-market-atlas/india
- GST: real-money-gaming 28% vs other gaming — https://economictimes.indiatimes.com/tech/technology/video-game-developers-write-to-government-seek-distinction-from-real-money-gaming-platforms/printarticle/102144415.cms · https://cleartax.in/s/gst-on-online-gaming
- RBI e-mandate framework 2026 — https://m.rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=13374
- F2P conversion benchmarks — https://gamewiki.blog/how-many-players-spend-money-f2p-games · https://www.lucabarberis.com/operator-atlas/free-to-play-gaming/conversion-to-repayer-curve
