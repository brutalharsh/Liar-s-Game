# 07 — Hosting & Deployment: the full decision document

> Research date: 2026-11-23. All prices verified against official pricing pages or
> dated third-party trackers (Oct–Nov 2026) unless marked ⚠ stale.
> FX used for INR figures: **1 USD ≈ ₹93** (mid-market ~₹92.7–93.0 on 20–22 Nov 2026,
> wise.com/in/currency-converter/usd-to-inr-rate). Prices exclude GST unless noted.

**Our stack being hosted:** one Node.js process — Express serving the Next.js static
export + Socket.IO rooms (2–7 players) + optional MongoDB for accounts/purchases.

---

## 1. The fundamental split (for a non-DevOps owner)

A web game like ours is really **two different animals** with opposite hosting needs:

| Piece | What it is | Wants | Perfect home |
|---|---|---|---|
| **Frontend** (Next.js: HTML/JS/CSS, images, animations) | Static files | A CDN close to every player, zero ops | Vercel / Netlify / Cloudflare Pages (all have free tiers) |
| **Game server** (Node + Socket.IO) | A **long-lived, stateful process** that holds every room's cards, revolver chambers and turn order in memory | A computer that never sleeps, holds thousands of open TCP sockets for hours, runs the *authoritative* game logic | A plain Linux VPS ($5–12/mo) or a container PaaS |

Why the game server is special: each connected player keeps a **WebSocket open for the
whole session**. All players in a room must land on the **same running process holding
that room's memory** — if that process dies or sleeps, every table freezes. A lobby can't
tolerate "waking up, please wait 60 seconds"; roulette tension dies with a half-second
stutter mid-reveal. That inverts every design choice of a serverless platform.

### Why Vercel/Netlify/Cloudflare-Pages can't own the game server

Serverless platforms run *functions*: short-lived, disposable workers. **2026 update:**
Vercel functions now DO support WebSockets (public beta June 22 2026, GA Oct 20 2026 —
vercel.com/changelog/websocket-support-is-now-generally-available). But Vercel's own docs
still make it a wrong home for a persistent Socket.IO lobby:

- **Hard connection-lifetime cap.** "A WebSocket connection closes when a Vercel Function
  reaches its maximum duration" (vercel.com/docs/functions/websockets). Max duration:
  **Hobby 300s; Pro 800s default-max, 1,800s beta**
  (vercel.com/docs/functions/limitations). Translation: even paying $20/mo, Vercel
  **force-kills every connection every ~13 minutes**, mid-hand. Your client must
  reconnect + re-auth + re-sync state constantly.
- **No shared memory across instances.** Each connection pins to one ephemeral instance;
  rooms span instances, so all game state must move to an **external Redis/DB** and be
  reloaded on every reconnect (Vercel's own KB:
  vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).
  You rebuild the "stateful server" you were trying to avoid, with more moving parts.
- **Billed while open.** Function pricing = Active CPU + Provisioned Memory; an open
  connection keeps its instance's memory billable until closed.
- **Cold starts** on first spawn (region default iad1; single region) add handshake
  latency spikes.
- **License problem on free tier:** Hobby is **non-commercial only** — our F2P game with
  cosmetic IAP is commercial use → must be Pro, $20/mo/seat
  (vercel.com/docs/plans/hobby, vercel.com/pricing).

Netlify Functions and Cloudflare Pages Functions share the same run-to-completion,
no-long-lived-process model (Cloudflare's answer is Workers + Durable Objects — see §4).
**Verdict: use Vercel/Netlify/CF Pages for the static frontend if you like; the Socket.IO
game server lives elsewhere.** (Simplest architecture for us is actually §6: everything
on one VPS box, frontend included — no split hosting needed.)

---

## 2. Option A — Ubuntu VPS (the recommended lane)

One $5–12/mo Linux box you fully control: install Node, Caddy, run the server 24/7.
You own the process; nothing sleeps, nothing force-disconnects, memory is yours.

### 2026 VPS price table (cheapest usable → small production)

| Provider & plan | Price/mo (USD) | Specs | India region? | Notes (source) |
|---|---|---|---|---|
| **DigitalOcean Basic 1GB** | **$6** | 1 vCPU / 1 GB / 25 GB / 1 TB transfer | **Yes — Bangalore BLR1** (Basic droplets available there) | Per-second billing since Jan 2026, capped at monthly price; same price every region (digitalocean.com/pricing/droplets; docs.digitalocean.com/platform/regional-availability). DO's own FAQ names Bangalore as its India DC. $4/512MB, $12/2GB, $18/2vCPU-2GB, $24/2vCPU-4GB. |
| **Linode (Akamai) Nanode** | **$5** | 1 vCPU / 1 GB / 25 GB / 1 TB | **Yes — Mumbai AND Chennai**, no surcharge | Best India pick per the Oct 2026 FreeTierWatch latency test: 3.6ms from Indian broadband, full 1TB vs Lightsail's half (akamai.com pricing via vpsproviders.net; dev.to/karthik_yk measured Oct 2026). 2GB = $12. |
| **Vultr Regular 512MB** | $3.50 | 1 vCPU / 512 MB / 10 GB | Yes — Mumbai, Bangalore, Delhi NCR | Cheapest India IP; the advertised $2.50 tier is IPv6-only (dev.to/karthik_yk, prices verified 2026-10-09). 512MB is tight; fine for a pure Socket.IO box. |
| **AWS Lightsail 1GB** | **$7** (IPv4) | 2 vCPU / 1 GB / 40 GB / **1 TB in Mumbai (half the 2 TB global allowance)** | Yes — Mumbai (ap-south-1) | ⚠ Mumbai bundles get **half** data transfer; India overage $0.13/GB. $5/0.5GB, $12/2GB, $24/4GB. Indian accounts billed in INR + GST via AWS India/AISPL (aws.amazon.com/lightsail/pricing; ownkube.io/compare/aws-lightsail-pricing-explained). AllestDu included in AWS Free Tier for new accounts. |
| **Hetzner CX23** (was CX22) | **€5.99** (~$6.5) incl. IPv4 + 38–72% after two 2026 hikes | 2 vCPU / 4 GB / 40 GB NVMe / 20 TB | **No** (EU DE/FI only; Singapore costs more w/ 0.5TB traffic) | Best RAM-per-euro anywhere, but CX22 is **renamed CX23 and repriced twice in 2026** (€3.99→€5.49 excl. VAT, trackvps.com/hetzner-cloud-pricing); CX/CAX lines **frequently sold out to new customers since June 2026** (hostingsift.com). For India-first players ping is ~120–250ms. ⚠ brief's "~€4" figure is stale. |
| **Contabo Cloud VPS 4** | €5.50 promo ~€4.40 first 24 mo (~$6) + setup fee on monthly | **4 vCPU / 8 GB / 100 GB** | Yes — an Asia location listed; ⚠ verify Mumbai at checkout (contabo.com/en-us/vps; vpspricecompare.com lists India) | Most RAM per dollar; shared vCPU + 200Mbit port; check current Mumbai stock. |
| **OVH VPS-1** | from $5.35 (~€4.49) | 2 vCPU / 4 GB / 40 GB NVMe, unmetered | India (Mumbai) offered ⚠ verify | "From" price varies by commitment/location; unlimited traffic is the seller (us.ovhcloud.com via stackrates.ai; vpspricecompare.com lists India). |
| **E2E Networks (Indian)** E1LC-2.6GB | ₹894 (~$9.6) excl. GST | 2 vCPU / 6 GB, NCR/Chennai/Mumbai | Yes — Indian DC, INR billing, UPI, GST invoice | Cheapest plan from a listed Indian cloud; prices raised Aug 2026; brand now GPU/AI-first (e2enetworks.com; icsdc.com Nov 2026). Local billing & MeitY empanelment are the actual perks. |
| Hostinger KVM 2 (India DC) | ₹599 **24-month prepay**, renews ₹999 | 1 vCPU / 4 GB / 50 GB | Yes — India DC | Cheap headline, big lock-in + renewal jump (flarelax.com Nov 2026). MilesWeb ₹549→₹949 same pattern. |

**Setup effort:** ~half a day following DigitalOcean's Node.js + Nginx community tutorials
(free, excellent). Everything below (§6) is copy-paste-able. No DevOps background
needed beyond SSH.

---

## 3. Option B — PaaS (push code, no server to manage)

Container hosts that run one always-on Node service with real WebSockets, no expiry.

| Platform | Cheapest always-on Node | Free tier reality | WebSocket | Fit |
|---|---|---|---|---|
| **Render** (render.com/pricing) | **$7/mo Starter** (0.5 CPU/512MB, Hobby workspace $0); $25 for 1CPU/2GB | Free web service (512MB/0.1CPU) **spins down after 15 min** without inbound HTTP/WS traffic, ~1-min cold wake, 750 instance-hours/mo; docs: "Do not use for production" (render.com/docs/free). Since Feb 2026 WS messages *do* keep it alive — a 24/7 lobby that sleeps at night still spins down | ✅ native | Easiest deploys (GitHub push). Cheapest production-quality PaaS for us. No India region-friendly pricing note: regions US/EU/Frankfurt/Singapore. |
| **Railway** (railway.com/pricing) | **Hobby $5/mo** = $5 usage credit (≈ 512MB RAM + trickle CPU always-on ≈ $5–6.5/mo usage; rates $10/GB RAM-mo + $20/vCPU-mo + $0.05/GB egress) | Free $0 with only **$1/mo credit**, service sleeps when idle → unusable for lobbies; 30-day trial starts $5 one-time | ✅ native | Best metered value; boring-simple. Bangkok/mumbai? ⚠ regions are global-major only (US/EU/Asia hubs), no India edge. |
| **Fly.io** (fly.io/pricing, updated Oct 1 2026) | **shared-cpu-1x 256MB = $2.19/mo** always-on; ~$4.39/512MB; $6.70/1GB (docs.fly.io/about/pricing) ⚠ two sources disagree slightly on 512MB price | **Free plan: $5 usage credit EVERY month** (card required, ≤3 machines) — enough to run a tiny socket server + bandwidth for $0/mo (fly.io/pricing) | ✅ real VMs, no execution-time limits | Ultra-cheap hobby scale-out; no India region (Singapore/Tokyo nearest; India egress $0.12/GB). Genial for global audiences, mid for India-first. |

**Why not PaaS as main pick?** No cold-start problem on the paid tiers and WebSockets
work — they're genuinely fine. But for pure capacity per dollar they lose to a VPS
($7 gets 512MB on Render vs 1–4GB on a VPS), and none of the cheap tiers sit in an
Indian region. Choose PaaS if you never want to touch a terminal; choose VPS if you
want headroom + India latency. All three are legitimate **beta-phase** hosts.

---

## 4. Option C — Realtime / game backend platforms

| Platform | Pricing (2026) | Our verdict for a Socket.IO clone |
|---|---|---|
| **PartyKit** | ⚠ Dead as a hosted product: platform **shut down Oct 23 2026**. Successor **PartyServer** (open-source) runs as a Cloudflare Worker + Durable Objects **in your own Cloudflare account** — platform fee $0, you pay Cloudflare usage (Workers paid $5/mo incl. 10M req; Durable Objects paid tier: 1M req + 400K GB-s incl., then $0.15/M req, $12.50/M GB-s) (blog.partykit.io/posts/hosted-platform-shutdown; docs.partykit.io) | Architecture is lovely (rooms = DOs, hibernate up to 32K conns/room) — but it's a **different programming model** (server classes + partysocket client), not our planned Socket.IO code. Viable Plan-B if we ever want edge-multi-region. |
| **Colyseus** | Framework MIT & free self-hosted (it's itself a Node room framework — an *alternative* to Socket.IO, own JS/Unity SDKs). **Colyseus Cloud from $15/mo**, no CCU/DAU/MAU caps, managed SSL, 32 regions incl. Mumbai, zero-downtime deploys; no free tier, no auto-scaling (colyseus.io/pricing) | If we adopt Colyseus we get managed hosting cheap — but it's a rewrite of the server to their room/state-sync model. For a Socket.IO codebase: not applicable unless we swap frameworks and pay $15/mo. |
| **Nakama (Heroic Labs)** | OSS free (Apache-2.0) self-host — Go server, own protocol, needs PostgreSQL. Managed **Heroic Cloud ≈ $600+/mo** entry (1 Nakama CPU + 1 DB CPU, usage-billed daily; calculator) ; support $2k–$6k/mo; Satori LiveOps $600/mo (heroiclabs.com/pricing; usagepricing.com/blueprint/heroic-labs, Nov 2026) | Grossly over-provisioned enterprise pricing for us. No. |
| **Supabase Realtime** | Not a game server — pub/sub + presence. Free: 200 concurrent connections, 100 msg/s, 2M msgs/mo; Pro $25/mo: 500 conns, 500 msg/s, 5M msgs, then $2.50/M msgs + $10 per extra 1k conns; **fan-out billed** (broadcast to 4 listeners = 5 messages) (supabase.com/pricing; supabase.com/docs/guides/realtime/limits) | Fine for chat/presence, but authoritative card logic would live in Edge Functions (max 150s) or client — unacceptable for an anti-cheat game. Free projects also pause after 7 days idle. Skip as the game engine; fine as a sidecar DB. |
| **Firebase RTDB** | Spark free: **100 simultaneous connections**, 1 GB stored, 10 GB/mo download; Blaze: 200K conns/DB, $5/GB stored, $1/GB downloaded (firebase.google.com/pricing; firebase.google.com/docs/database/usage/limits) | 100-connection cap = ~14 full tables on free tier; no server-side logic; Firestore/RTDB is a synced-database mentality, not a dealer. Skip. |

**Lock-in summary:** Socket.IO-on-VPS = zero lock-in (move box, change DNS). Colyseus =
MIT but their APIs. PartyServer/Supabase/Firebase = platform-native SDK lock-in.
Nakama OSS is portable but Go + Postgres. Refactoring cost is why we stay vanilla.

---

## 5. Databases

**MongoDB Atlas free M0 is genuinely enough to launch:**
- **$0 forever**: 512 MB storage (documents + indexes), shared vCPU/RAM, **100 ops/sec**,
  **500 max connections**, 10 GB in + 10 GB out per rolling 7-day window, 1 free cluster
  per project, no backups, **auto-pause after 30 days of zero connections**
  (mongodb.com/pricing; mongodb.com/docs/atlas/reference/free-shared-limitations — read Oct–Nov 2026).
- **Is 512 MB plenty?** Our write load is: user account (username, hashed password
  ~2 KB), cosmetic purchase records (~0.5 KB each), maybe match history (~1 KB/match).
  At ~2.5 KB/user → **~200K users before hitting the cap**. Reads are login + one-time
  purchase checks — nowhere near 100 ops/sec until thousands of logins/minute. ✅
- Paid when needed: **Flex** ≈ **$8/mo** (5 GB, banded by ops/sec, caps at $30/mo;
  $0.011/hr) → **Dedicated M10 ≈ $56.94/mo** ($0.08/hr). ⚠ MongoDB **retired the old
  M2 $9 / M5 $25 shared tiers** (migrated Jan 22 2026) though its own pricing page
  still shows them — treat M2/M5 as stale (usagepricing.com/blueprint/mongodb-atlas).
- Caveats on M0: **no backups** (free backups still preview, $0.10/day) → run a weekly
  `mongodump`/`mongoexport` for free; the 30-day-inactivity pause won't bite a live game.

**Zero-cost alternative — SQLite on the VPS (our actual recommendation):** one
`game.db` file, driver via `better-sqlite3` (~50MB RAM, no server). For ≤100K rows =
few MB. Backups = cp the file (or Litestream ~free to S3/B2 for continuous). Downsides:
no web dashboard, no managed scaling — irrelevant at our size. **Start SQLite, move to
Atlas free M0 or Flex only if/when you want the cloud dashboard + a second server
needing shared DB access.** (MongoDB itself stays optional: room state is in-memory,
never persisted.)

---

## 6. The full stack on one box (the recommended architecture)

Everything runs on a single $5–12 VPS — one URL, one process, nothing else to pay for.

```
player browser ──HTTPS/WSS──> Cloudflare free proxy (DDoS + TLS + CDN)
                                  └──> VPS: Caddy 80/443
                                          ├── static: Next.js export  (gzip, cache headers)
                                          └── reverse-proxy /socket.io → Node :4000
                                                  ├── Express (health, cosmetics, payments)
                                                  ├── Socket.IO (rooms, game logic)
                                                  └── better-sqlite3 file DB + nightly dump
```

- **Web server + TLS:** **Caddy** (~2-line config, Let's Encrypt auto-renews) or nginx
  + certbot (more tutorials). Both free; reverse-proxy the `/socket.io` path with
  standard `Upgrade`/`Connection` headers — standard recipe in Socket.IO docs.
- **Process manager:** **PM2** (`pm2 startup` + `pm2 save`) or a systemd unit — auto-restart
  on crash/reboot, `LimitNOFILE=100000` for many sockets (websocket.org connection-limits).
- **Frontend:** `next build && next export`-style static output (or a small Node SSR
  process) copied to `/var/www`; cache CSS/JS aggressively — they're fingerprinted.
- **Cloudflare free in front** (mandatory in our book): unmetered L3–7 **DDoS protection,
  Universal SSL, global anycast CDN, unlimited proxied WebSockets on all plans incl. Free**
  (developers.cloudflare.com/network/websockets; developers.cloudflare.com/ddos-protection).
  Gotchas: enable the WebSockets toggle; 100s inactivity timeout at the edge — **Socket.IO's
  default ping every 25s keeps it alive automatically**; hide your origin IP (proxy on),
  firewall ports 80/443 to Cloudflare IPs only. Cloudflare edge restarts occasionally
  drop sockets → Socket.IO auto-reconnects (game rooms keyed by room code re-attach).
- **Domain:** ~**$11/yr** — Cloudflare Registrar sells .com **at cost $11.17** (new Verisign
  wholesale $10.97 + $0.20 ICANN since Nov 1 2026); Porkbun $11.81 flat; avoid Namecheap's
  $19.98 renewal (namecheap.com price-change notice; dnsdoctor.dev/domain-prices/com).
  Or a fun TLD (.gg/.games) for more.

**Working hands: first server ≈ 3–6 hours following tutorials; every deploy after =
`git pull && pm2 reload`.** Skill ceiling never rises — scaling is "bigger droplet" until
5-figure CCU.

---

## 7. Latency analysis — a turn-based game is forgiving

- Liar's Deck is **discrete-action play**: wait (up to 30s turn timer) → play cards →
  optional challenge → reveal. There is no per-frame movement, no aim, no hit detection.
  **Human-perceived ceiling ≈ 200–300ms RTT** before "felt lag"; poker/casino sites
  run live tables at 100–300ms happily. The Steam original tolerates far worse than any
  FPS.
- Therefore **a single region can serve the whole world**: EU-central VPS ≈ 120–180ms
  from India, 80–120ms from US/EU — playable. But if the audience is **India-heavy
  (owner's expectation), buy an India region** and everyone else still plays fine:
- **Best-in-India options (measured & verified Oct 2026, dev.to/karthik_yk):**
  - **Linode (Akamai) Mumbai/Chennai — 3.6ms** from Indian broadband, $5/mo, full 1TB.
  - **Vultr Mumbai/Delhi NCR/Bangalore — 3.6ms**, from $3.50/mo.
  - **DigitalOcean Bangalore (BLR1) — 17ms**, $6/mo for 1GB.
  - **AWS Lightsail Mumbai** — same city, $7, but half the transfer allowance.
  - (E2E Networks NCR / Hostinger India DC — Indian IP + UPI billing, a bit pricier.)
- Ping matters here for **feel** more than rules: the "LIAR!" call reveal and gun
  animation should snap for the majority audience. India-region box = sub-20ms for
  Indian players, and EU/US friends join at 150–250ms without complaint.
- Cloudflare proxy adds ~0–30ms but shields the origin; for WebSocket frames it's a
  thin pass-through, fine at our message rates (websocket.org/guides/infrastructure/cloudflare).

---

## 8. Capacity math — how many players on a $5–12 box?

**Memory per connection (2026 benchmarks):**
- Socket.IO (default `ws` engine): **~52KB per connected client**, practical single-process
  cap ~120K connections (single-threaded handshake ceiling) — Evil Martians benchmark,
  June 2026 (evilmartians.com/chronicles/choose-your-fighter-benchmarking-5-websocket-servers-for-nodejs);
  official Socket.IO docs confirm memory "scales linearly" with clients and publish
  0→10,000-client benches (socket.io/docs/v4/memory-usage).
- Plain `ws` server: ~6.6KB/connection real system RAM (3.6KB in-heap + 3KB kernel
  buffers) — a **$6 DO 1GB droplet held 99,770 idle connections** before the RAM wall,
  CPU 0–1% the whole way (dev.to/remdore, Sep 2026). Community planning figure:
  **~80K idle connections per GB** (idle sockets cost no CPU — only handshakes + messages do).
- Our traffic is tiny: a play is ~5 msg/s for <1s, rooms sit idle between turns.

**Our per-room state:** 7 players × (≤5 cards, 6 chamber bools, seat, theme, nick) ≈
**1–2KB serialized**; call it 10KB with overhead → **1,000 live rooms ≈ 10MB**. Noise.

**The math for the recommended 1–2GB VPS:**

| Budget | RAM available to Node | Concurrent players @52KB (Socket.IO) | Rooms (avg 4.5 players) |
|---|---|---|---|
| DO 1GB / Linode 1GB ($5–6) | ~700MB | **~13,000** | ~2,900 tables |
| 2GB ($12) | ~1.6GB | **~30,000** | ~6,700 tables |
| 4GB ($24) | ~3.4GB | ~65,000 (needs 2 processes: Node heap ~1.5–2GB/process — run PM2 cluster of 2 + Socket.IO Redis adapter) | — |

CPU check: 10,000 CCU × ~10 tiny messages/min ≈ **~1,700 msg/s** — ws handles
100K–2M msg/s; a turn-based lobby is CPU-idle 99% of the time. Bandwidth: 10K CCU
evening peak ≈ **~3–4GB/day ≈ 100GB/mo** — fits any VPS's 1TB allowance with 10× headroom.

**Verdict: one $6 droplet genuinely handles ~10,000+ concurrent players** for this game
— 100× the CCU a web Liar's-Bar clone realistically sees at launch (the Steam hit itself
peaked ~114K CCU; a web clone planning for 100–1,000 CCU is sane). Spend zero time on
multi-server until you actually see >10K CCU for a week.

---

## 9. Cost summary (USD + ₹93/USD)

| Path | What runs where | Monthly | Year-1 total | Year-1 INR |
|---|---|---|---|---|
| **0 — Dev/friends playtest ($0)** | Server = localhost, friends join via **free `cloudflared` quick tunnel** (trycloudflare.com URL, WebSocket-capable, no account). DB = SQLite file or Atlas M0. No domain. | **$0** | **$0** | **₹0** |
| **1 — Beta (public link, 50–300 CCU)** | 1GB VPS chosen by audience: **DigitalOcean BLR $6** (or Linode Mumbai $5 / Vultr Mumbai $3.50 512MB / Render Starter $7 no-India) + Cloudflare free + Let's Encrypt + SQLite + domain | **~$5–7 + $1 (domain)** | **~$72–95** | **~₹6,700–8,800** |
| **2 — Production (few thousand CCU)** | 2GB VPS $12 (DO/Linode; +30% weekly backups ≈ +$3) + Atlas M0/Flex $0–8 if not SQLite + domain + PM2 + UptimeRobot free | **~$15–23** | **~$180–280** | **~₹16,700–26,000** |
| **3 — Viral (10K+ CCU, multi-region)** | 2× 4GB VPS $48 + Cloudflare LB/Traffic Manager (or DO LB $12) + Redis adapter ($0 self-hosted or Upstash free) + Atlas Flex $8–30 + object storage for theme assets ~$1–5 | **~$100–150** | **~$1,200–1,800** | **~₹1.1–1.7 lakh** |

**Recommended year-1 budget: ~₹9,000–13,500 ($95–145)** — i.e. 6 months beta on a $5–6
India box, then a $12 box when CCU >500, domain included, everything else free tiers.
India payment notes: AWS-Lightsail bills INR+GST via AISPL; DO/Linode/Vultr bill USD on
card (add ~1–3% forex); E2E/Hostinger accept UPI but cost more. GST on cloud services
adds 18%.

---

## 10. What this means for our version

**Answer to "Ubuntu VPS or Vercel-type?" — Ubuntu VPS (an India-region one), plus Vercel
only if you want a pretty frontend pipeline. The frontend is trivial either way; the game
server needs a process that never sleeps, holds sockets for hours, and keeps room state
in memory — every Vercel-type platform caps or kills exactly that (300–1,800s function
lifetime, external-Redis state, memory billed while open). A $5–6 VPS beats every
serverless/PaaS option on price, capacity, latency-for-India, and code simplicity
(plain Socket.IO, no adapters).**

**Tiered plan:**
1. **Now → first playable (weeks 1–6): localhost + `cloudflared` tunnel + SQLite.**
   Cost $0. Friends open the trycloudflare URL, play rooms via Socket.IO; real
   network behaves identically (TLS + proxy) so no rework later.
2. **Beta → public invite (trigger: first strangers, need a real URL): DigitalOcean
   Bangalore BLR1 1GB $6/mo** (or Linode Mumbai $5 — pick if measured 3.6ms matters more
   than DO's 17ms + you want the extra Indian presence; same architecture either way).
   Caddy + Let's Encrypt + PM2 + Cloudflare free proxy + $11 domain + Atlas M0 for
   accounts/purchases (or SQLite). Single-box stack from §6, deployed in an afternoon.
   Optional PaaS alternative if terminals scare you: Render Starter $7 (accepts global
   latency, no India region).
3. **Growth (trigger: sustained >500 CCU or upgrades hurt): resize to 2GB ($12) or
   snap to DO/Linode 4GB ($24), add PM2 cluster-2 + Redis adapter (self-hosted free)
   + weekly snapshots, move DB to Atlas Flex ($8) if two servers need shared state.**
4. **India scale-out (trigger: >10K CCU for a week —恭喜): second VPS in EU/Frankfurt or
   Singapore behind a geographic router (Cloudflare LB), Fuse Redis adapter across
   regions; consider Colyseus Cloud ($15/mo, 32 regions incl. Mumbai) only if
   simultaneously rewriting the server anyway. Otherwise never leave the two-box
   VPS world — it's ~$100/mo at viral scale, less than one day of cosmetics revenue.**

**Non-goals confirmed:** No Nakama/PlayFab ($600+/mo enterprise tiers), no PartyKit
(hosted platform dead Oct 2026; PartyServer-only if we ever adopt Workers), no
Vercel Functions for the game (connection-capped β→GA limits per their own docs),
no Firebase/Supabase as the game engine (connection caps + no authoritative logic).

**Primary sources:** vercel.com/docs/functions/{limitations,websockets},
vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections,
digitalocean.com/pricing/droplets, docs.digitalocean.com/platform/regional-availability,
aws.amazon.com/lightsail/pricing, hetzner.com/cloud + trackvps.com/hetzner-cloud-pricing,
linode/akamai via vpsproviders.net + dev.to/karthik_yk (Oct 2026 India latency+price audit),
render.com/{pricing,docs/free}, railway.com/pricing + docs.railway.com/pricing/plans,
fly.io/pricing + fly.io/pricing-update (Oct 2026), colyseus.io/pricing,
heroiclabs.com/pricing, supabase.com/{pricing, docs/guides/realtime/limits},
firebase.google.com/{pricing, docs/database/usage/limits}, mongodb.com/pricing +
mongodb.com/docs/atlas/reference/free-shared-limitations, contabo.com/en-us/vps,
developers.cloudflare.com/{network/websockets, ddos-protection}, cloudflare registrar
pricing via dnsdoctor.dev/domain-prices/com, evilmartians.com WebSocket benchmark
(Jun 2026), dev.to/remdore $6-droplet WebSocket test (Sep 2026), socket.io/docs/v4/memory-usage.
