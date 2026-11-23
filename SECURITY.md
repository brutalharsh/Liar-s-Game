# Security Policy

This is a party game — but it runs real (optional, cosmetic) payments one day, so
we treat security seriously.

## The two rules that matter most

1. **Hidden game data never leaves the server** — other players' cards, deck
   order, and revolver chamber positions are never serialized to clients.
   `reveal:show` is the only face-leak event (see `STR/08`).
2. **All game RNG is server-side crypto-random** via the injected RNG port —
   clients can't influence or predict shuffles, chamber positions, or coin flips.

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Instead use
GitHub's *private vulnerability reporting* on this repository, or email the
maintainer (see the repo owner's GitHub profile).

Include: steps to reproduce, impact, and any PoC. We aim to respond within 7
days and will credit reporters in release notes.

## Out of scope / accepted risk

- Friends colluding over Discord (it's half the fun; not fixable, not a bug)
- Cosmetic coin farming via multiplayer self-play — rate-limited, accepted at
  small scale (see `STR/04` §2)
- Social engineering / lying — literally the game.

## Hardening baseline (already enforced)

Helmet, strict CORS, per-event rate limits, zod validation on every input,
webhook signature verification when real payments arrive, gitignored secrets
(`.env.example` documents the contract), pinned lockfile, minimal dependencies.
