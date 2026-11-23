# STR/08 — SECURITY RULES (non-negotiable)

> The genre died to cheaters (research/01/12): Liar's Bar lost 11 review points to
> card-peeking. These rules are why we won't. Every PR touching server/engine must
> respect every line here. Deep detail: research/12.

## The golden rules

1. **Zero hidden data on the wire.** Other players' card ranks, the deck order, your
   own `bulletPos` — never serialized into ANY payload, log, or error. The ONLY
   face-leak event is `reveal:show`. CI packet-recorder enforces this forever.
2. **One validating reducer.** Every client action → zod parse → server-side legality
   check (turn? owner? ≤3? window open? seat alive?) → `rules-engine.apply`. Rejected
   actions answer with `error`; they can never mutate state.
3. **Server owns all RNG.** `crypto.randomInt` for shuffle, table card, `bulletPos`,
   shot-assignment coin, win-coins. No `Math.random` anywhere in game paths.
   `bulletPos` is fixed at match start, never re-rolled.
4. **Timers are server events.** Client clocks render; server deadlines decide.
   Timeout actions go through the same reducer as human actions.
5. **Atomicity over races.** First-processed-wins; stale events rejected
   (`EVENT_STALE`); forced-call has priority. The original game's "play + call in
   the same instant" exploit is structurally impossible for us.
6. **Room codes are secrets.** 25^5 entropy + join rate-limit (10/IP/10min) + room
   capacity caps + empty-room GC (10 min idle).
7. **Identity & sanity.** Nicknames/room names through the sanitizer (18 chars,
   strip control/confusables, blocklist) — nicknames render as TEXT ONLY, never HTML.
   Avatar specs are category-checked server-side (owned + valid slugs).
8. **Transport hygiene.** Helmet, strict CORS (CLIENT_ORIGIN), per-event rate limits,
   max payload size, origin check on handshake, connection caps per IP.
9. **Economy authority.** Balances/XP/titles computed only from server-persisted
   match records. All grants idempotent (`{source}:{refId}` unique). Webhook
   verification (when real payments arrive) — signature + amount re-check + replay
   dedupe. The mock provider cannot credit coins today (UI demo only).
10. **Secrets & supply chain.** `.env` only (gitignored — the Atlas password was
    chat-shared: ROTATE BEFORE LAUNCH, lock Atlas to VPS IP). No secrets in client
    bundles (never `NEXT_PUBLIC_` a secret). Pinned lockfile, `npm audit`, minimal deps.
11. **Replayable justice.** Per-match append-only event log (hash-chained);
    any disputed round reconstructs deterministically (seed + events in the log).
12. **Logs minimal PII.** Store IDs + counts — not IPs beyond ops needs; no voice/
    text content ever (none exists).

## Threat model summary (what we accept)

- Friend-table collusion / Discord screen-sharing: accepted (it's half the fun).
- Multi-account coin farming: rate caps + record sanity checks; imperfect, fine.
- DDOS: Cloudflare free tier in front; connection caps; not a bank.
- The ONE unforgivable leak = hidden cards in payloads. That's what CI guards.
