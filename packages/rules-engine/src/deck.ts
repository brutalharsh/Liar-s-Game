/**
 * Deck builder + deal — STR/01 §1/§2 (amendment A3):
 *   m × (6 Kings + 6 Queens + 6 Aces + 2 Jokers), m = ceil(N/4), N = capacity.
 *   2–4p → 20 cards · 5–8p → 40 · 9–10p → 60. Truth density 40% at every N
 *   (6m table-rank + 2m jokers of 20m), E[truths/hand] = 2.0 (research/04 §1.4).
 *
 * The deck is rebuilt and reshuffled fresh every round (R25); leftovers stay
 * hidden. Card ids are stable across a match: `${rank}${copy}` with the copy
 * index global per rank (K1..K12, J1..J4 at m=2).
 */
import { TABLE_RANKS } from './types';
import type { Card, TableRank } from './types';

const COPIES_PER_RANK_PER_MODULE = 6;
const JOKERS_PER_MODULE = 2;

/** Deck modules for a table of N players (A3). Clamped 1..3 for N = 2..10. */
export function deckModulesFor(playerCount: number): number {
  if (playerCount < 2 || playerCount > 10) {
    throw new Error(`deckModulesFor: playerCount ${playerCount} out of range 2..10`);
  }
  return Math.min(3, Math.ceil(playerCount / 4));
}

/** Builds the full liar deck in fixed order (all m copies of K, then Q, then A, then Jokers). */
export function buildDeck(modules: number): Card[] {
  if (!Number.isInteger(modules) || modules < 1 || modules > 3) {
    throw new Error(`buildDeck: modules must be 1..3, got ${modules}`);
  }
  const deck: Card[] = [];
  let king = 0;
  let queen = 0;
  let ace = 0;
  let joker = 0;
  for (let m = 0; m < modules; m++) {
    for (let i = 0; i < COPIES_PER_RANK_PER_MODULE; i++) {
      deck.push({ id: `K${++king}`, rank: 'K' });
    }
    for (let i = 0; i < COPIES_PER_RANK_PER_MODULE; i++) {
      deck.push({ id: `Q${++queen}`, rank: 'Q' });
    }
    for (let i = 0; i < COPIES_PER_RANK_PER_MODULE; i++) {
      deck.push({ id: `A${++ace}`, rank: 'A' });
    }
    for (let i = 0; i < JOKERS_PER_MODULE; i++) {
      deck.push({ id: `J${++joker}`, rank: 'JOKER' });
    }
  }
  return deck;
}

export const HAND_SIZE = 5;

/** True iff the card counts as the table rank (Joker is wild ⇒ always truth, R2). */
export function isTruth(card: Card, tableCard: TableRank): boolean {
  return card.rank === tableCard || card.rank === 'JOKER';
}

/** True iff the play contains ≥1 lie (mixed truth+lie ⇒ lie, R18). */
export function containsLie(cards: readonly Card[], tableCard: TableRank): boolean {
  return cards.some((c) => !isTruth(c, tableCard));
}

/**
 * Deal `HAND_SIZE` cards to each seat in `seats` (contiguous slices of the
 * freshly shuffled deck from the top; any deal is equivalent given the
 * shuffle). Returns `{ hands, leftover }`.
 */
export function dealHands(
  shuffled: readonly Card[],
  seats: readonly number[],
): { hands: { seat: number; cards: Card[] }[]; leftover: Card[] } {
  const dealt = HAND_SIZE * seats.length;
  if (shuffled.length < dealt) {
    throw new Error(
      `dealHands: deck of ${shuffled.length} cannot fund ${seats.length} × ${HAND_SIZE}`,
    );
  }
  const hands: { seat: number; cards: Card[] }[] = [];
  for (let i = 0; i < seats.length; i++) {
    hands.push({ seat: seats[i], cards: shuffled.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE) });
  }
  return { hands, leftover: [...shuffled.slice(dealt)] }; // rest stays hidden (R5)
}

/** STR/01 §2.1: table deck of 1 K / 1 Q / 1 A → uniform draw each round (R3). */
export function tableDeckRanks(): readonly TableRank[] {
  return TABLE_RANKS;
}
