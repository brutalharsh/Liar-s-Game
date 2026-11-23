/**
 * Host bot-fill (STR/02): bots occupy seats, are flagged `isBot` in views,
 * and drive the SAME applying pipeline as human plays — every bot action goes
 * through `rules-engine.apply()` as a ordinary `PLAY`/`LIAR` event, so the
 * broadcasts are bit-identical to a human's. Bots count for deck scaling and
 * window modes because they are plain roster entries (deck m = ceil(N/4) by
 * roster size; window mode derives from alive count).
 *
 * The brain is a pure policy over a RESTRICTED view (own hand, the public
 * table, public pile aggregates) — it never reads other hands or bulletPos.
 * Bots may use the injected RNG port (mission rule 7); since every bot action
 * lands in the engine event log, `replay(seed, log)` reproduces the match
 * without ever consulting the brain.
 */
import type { Card, RngPort, TableRank } from '@liars-game/rules-engine';

/** Saloon-flavoured preset names (blocklist-safe, ≤18 chars). */
export const BOT_NAMES: readonly string[] = Object.freeze([
  'Rusty',
  'Doc Holliday',
  'Deadeye Daisy',
  'Silent Sam',
  'Cactus Pete',
  'Maverick',
  'Wild Bill',
  'Cheyenne',
  'Lucky Luke',
  'Calamity Jo',
]);

/** Stable synthetic wire identity for a bot seat (bot has no account row). */
export function botAccountId(roomCode: string, seat: number): string {
  return `bot:${roomCode}:${seat}`;
}

/** Presentable bot profile (echo fields for roster + match record). */
export function botAvatarSpec(): { base: string } {
  return { base: 'bot' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Restricted view handed to the brain — public data + OWN hand only.
// ─────────────────────────────────────────────────────────────────────────────

export interface BotView {
  /** The bot's own hand (it may look at its own cards, of course). */
  hand: readonly Card[];
  /** Public table card this round. */
  tableCard: TableRank;
  /** True when a LIAR call is legal RIGHT NOW (armed window / next-only turn). */
  canCallNow: boolean;
  /** Card count of the play that could be challenged; null on a first play. */
  lastPlayCount: number | null;
}

export type BotDecision =
  | { action: 'play'; cardIds: string[] }
  | { action: 'call' }
  | { action: 'pass' };

/** True when a card is truth for the current table (Jokers wild — R2). */
function isTruth(card: Card, tableCard: TableRank): boolean {
  return card.rank === tableCard || card.rank === 'JOKER';
}

/**
 * Bot policy (pass-or-call heuristics):
 *  - challenge odds rise with the challenged play's size (bigger stacks lie);
 *  - truth-rich hands play truth (1–3 cards); lie hands sneak minimal lies;
 *  - forced-call compliance is automatic: when holders==1 the ENGINE issues
 *    the auto-call (bot never needs to);
 *  - never self-challenges, never calls on a first play (engine enforces both).
 */
export function createBotBrain(rng: RngPort): {
  decide(view: BotView): BotDecision;
} {
  const decide = (view: BotView): BotDecision => {
    if (view.canCallNow && view.lastPlayCount !== null) {
      // 22% base + 9pp per card beyond one — big claims attract CHECKs.
      const callChancePct = 22 + (view.lastPlayCount - 1) * 9;
      if (rng.int(0, 99) < callChancePct) return { action: 'call' };
      if (view.hand.length === 0) return { action: 'pass' }; // empty hand: can still call in open-window; chose pass
    }

    const hand = view.hand;
    if (hand.length === 0) return { action: 'pass' };
    const truths = hand.filter((c) => isTruth(c, view.tableCard));

    if (truths.length > 0) {
      // Mostly one truth; occasionally a bigger honest dump.
      const maxTruths = Math.min(3, truths.length);
      const count = rng.int(0, 99) < 70 ? 1 : rng.int(1, maxTruths);
      return { action: 'play', cardIds: truths.slice(0, count).map((c) => c.id) };
    }
    // No truth available: minimal lie (1 card), rarely 2 to look confident.
    const count = rng.int(0, 99) < 85 ? 1 : 2;
    return { action: 'play', cardIds: hand.slice(0, count).map((c) => c.id) };
  };

  return { decide };
}
