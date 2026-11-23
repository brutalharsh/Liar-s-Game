import { describe, expect, it } from 'vitest';
import { buildDeck, containsLie, dealHands, deckModulesFor, HAND_SIZE, isTruth } from '../src/deck';

function rankCounts(deck: ReturnType<typeof buildDeck>) {
  const counts = { K: 0, Q: 0, A: 0, JOKER: 0 } as Record<string, number>;
  for (const c of deck) counts[c.rank] += 1;
  return counts;
}

describe('Deck builder (A3 scaling)', () => {
  it.each([
    ['2', 2, 1],
    ['3', 3, 1],
    ['4', 4, 1],
    ['5', 5, 2],
    ['7', 7, 2],
    ['8', 8, 2],
    ['9', 9, 3],
    ['10', 10, 3],
  ])('deckModulesFor(%sp) === m=%s', (_n, n, m) => {
    expect(deckModulesFor(n)).toBe(m);
  });

  it('m=1 deck: exactly 20 cards, 6/6/6 + 2 Jokers, unique ids (Steam deck)', () => {
    const deck = buildDeck(1);
    expect(deck).toHaveLength(20);
    expect(rankCounts(deck)).toEqual({ K: 6, Q: 6, A: 6, JOKER: 2 });
    expect(new Set(deck.map((c) => c.id)).size).toBe(20);
  });

  it('m=2 deck: 40 cards 12/12/12 + 4 Jokers (5–8 players)', () => {
    const deck = buildDeck(2);
    expect(deck).toHaveLength(40);
    expect(rankCounts(deck)).toEqual({ K: 12, Q: 12, A: 12, JOKER: 4 });
    expect(new Set(deck.map((c) => c.id)).size).toBe(40);
  });

  it('m=3 deck: 60 cards 18/18/18 + 6 Jokers (9–10 Big Table)', () => {
    const deck = buildDeck(3);
    expect(deck).toHaveLength(60);
    expect(rankCounts(deck)).toEqual({ K: 18, Q: 18, A: 18, JOKER: 6 });
    expect(new Set(deck.map((c) => c.id)).size).toBe(60);
  });

  it.each([
    ['1', 1, 20],
    ['2', 2, 40],
    ['3', 3, 60],
  ])('truth density is exactly 40%% for every table rank at m=%s', (_m, m, total) => {
    const deck = buildDeck(m);
    for (const table of ['K', 'Q', 'A'] as const) {
      const truths = deck.filter((c) => isTruth(c, table)).length;
      expect(truths / total).toBe(0.4); // 6m rank + 2m jokers of 20m
    }
  });

  it('dealHands: 5 cards each; 4p full-deal, 2p sits 10 out, 10p deals 50 of 60, overflow throws', () => {
    expect(HAND_SIZE).toBe(5);
    const d4 = dealHands(buildDeck(1), [0, 1, 2, 3]);
    expect(d4.hands).toHaveLength(4);
    for (const h of d4.hands) expect(h.cards).toHaveLength(5);
    expect(d4.leftover).toHaveLength(0); // 4p lays out the whole 20-card deck

    const d2 = dealHands(buildDeck(1), [0, 1]);
    expect(d2.leftover).toHaveLength(10); // authentic sit-out quirk at <4p

    const d10 = dealHands(buildDeck(3), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const h of d10.hands) expect(h.cards).toHaveLength(5);
    expect(d10.leftover).toHaveLength(10); // 60-card deck, 50 dealt

    expect(() => dealHands(buildDeck(1), [0, 1, 2, 3, 4])).toThrow(); // 20 cards can't fund 5 seats
  });

  it('dealHands deals to the REAL seat numbers — dead middle seats must not steal a deal', () => {
    // seats {0, 2} alive (seat 1 died): only 0 and 2 receive hands, 1 gets nothing
    const d02 = dealHands(buildDeck(1), [0, 2]);
    expect(d02.hands.map((h) => h.seat)).toEqual([0, 2]);
    expect(d02.leftover).toHaveLength(10);
  });

  it('containsLie: mixed truth+lie is a lie; jokers never lie (R18)', () => {
    const K = { id: 'k', rank: 'K' as const };
    const Q = { id: 'q', rank: 'Q' as const };
    const A = { id: 'a', rank: 'A' as const };
    const J = { id: 'j', rank: 'JOKER' as const };
    expect(containsLie([K, K], 'K')).toBe(false);
    expect(containsLie([K, Q], 'K')).toBe(true); // one false card sinks the play
    expect(containsLie([Q, J], 'K')).toBe(true);
    expect(containsLie([J, J, J], 'K')).toBe(false); // jokers wild → truth
    expect(containsLie([A, J, K], 'K')).toBe(true);  // A is off-table → mixed play is a lie
    expect(containsLie([Q, A], 'K')).toBe(true);
  });

  it('rejects invalid module counts and player counts', () => {
    expect(() => buildDeck(0)).toThrow();
    expect(() => buildDeck(4)).toThrow();
    expect(() => deckModulesFor(1)).toThrow();
    expect(() => deckModulesFor(11)).toThrow();
  });
});
