/**
 * STR/01 §3/§5 conformance — jokers & the mixed-lie poison law, exhaustively.
 *
 * §3 "Jokers are wild (always count as the Table Card ⇒ always 'truth')".
 * §5 "Any card ≠ Table Card and ≠ Joker → the accused lied" (⇒ one false
 * card poisons the play; all-valid ⇒ the accuser loses).
 *
 * liar.test and deck.test pin a handful of samples. Pinned here IN FULL:
 * every possible face-down play of 1..3 cards over the four ranks (34
 * multisets) against every table card (3) — at helper level (containsLie /
 * isTruth) AND engine level (a real PLAY + LIAR per combination, checking
 * the REVEALED verdict, the loser per §5, and the §6 shot-kind rows).
 */
import { describe, expect, it } from 'vitest';
import { containsLie, isTruth } from '../src/deck';
import type { Effect, Rank, TableRank } from '../src/types';
import { cardsFor, handIds, ok, startedMatch, T0, turnSeat, withHands } from './helpers';

const RANKS: Rank[] = ['K', 'Q', 'A', 'JOKER'];
const TABLES: TableRank[] = ['K', 'Q', 'A'];

/** Every multiset of `size` ranks (combinations with repetition), fixed order. */
function combosOf(size: number): Rank[][] {
  const out: Rank[][] = [];
  const cur: Rank[] = [];
  const walk = (start: number): void => {
    if (cur.length === size) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < RANKS.length; i++) {
      cur.push(RANKS[i]);
      walk(i);
      cur.pop();
    }
  };
  walk(0);
  return out;
}

/** Every legal play size (§3: PLAY 1–3 cards). 4 + 10 + 20 = 34 plays. */
const ALL_COMBOS: Rank[][] = [1, 2, 3].flatMap(combosOf);

/** STR/01 §5 as a literal oracle: one off-table non-joker card ⇒ lie. */
const specLie = (ranks: readonly Rank[], table: TableRank): boolean =>
  ranks.some((r) => r !== table && r !== 'JOKER');

describe('STR/01 §3/§5 — joker & poison law, exhaustive (34 plays × 3 tables)', () => {
  it('helper level: containsLie === spec oracle; isTruth === (table rank OR joker), card by card', () => {
    expect(ALL_COMBOS).toHaveLength(34);
    for (const table of TABLES) {
      for (const combo of ALL_COMBOS) {
        const cards = cardsFor(0, combo);
        expect(containsLie(cards, table)).toBe(specLie(combo, table));
        for (const c of cards) {
          expect(isTruth(c, table)).toBe(c.rank === table || c.rank === 'JOKER');
        }
      }
    }
  });

  it('engine level: every combo goes through a real PLAY+LIAR and resolves per §5/§6', () => {
    const seedFor = (want: TableRank): number => {
      for (let seed = 7_000; seed < 7_200; seed++) {
        if (startedMatch(3, seed).round!.tableCard === want) return seed;
      }
      throw new Error(`no seed found for table ${want}`);
    };
    const seeds: Record<TableRank, number> = { K: seedFor('K'), Q: seedFor('Q'), A: seedFor('A') };

    for (const table of TABLES) {
      for (const combo of ALL_COMBOS) {
        const s0 = startedMatch(3, seeds[table]);
        expect(s0.round!.tableCard).toBe(table);
        const A = turnSeat(s0); // random starter per seed — seats are relative
        const B = (A + 1) % 3; // next-only: B receives the turn after A's play
        const s1 = withHands(s0, { [A]: combo }); // A's hand IS the play
        const r = ok(s1, { type: 'PLAY', seat: A, cardIds: handIds(s1, A), at: T0 + 5 });
        const call = ok(r.s, { type: 'LIAR', seat: B, at: T0 + 6 });
        const revealed = call.effects.find((e) => e.kind === 'REVEALED') as
          | Extract<Effect, { kind: 'REVEALED' }>
          | undefined;
        const shot = call.effects.find((e) => e.kind === 'SHOT_ASSIGNED') as
          | Extract<Effect, { kind: 'SHOT_ASSIGNED' }>
          | undefined;

        // The reveal shows exactly the accused's last play — the combo itself.
        expect(revealed?.cards.map((c) => c.rank).sort()).toEqual([...combo].sort());

        const lied = specLie(combo, table);
        expect(revealed).toMatchObject({
          accusedSeat: A,
          challengerSeat: B,
          verdict: lied ? 'LIE' : 'TRUTH',
          loserSeat: lied ? A : B, // §5: liar loses, else the accuser loses
        });
        expect(call.s.round!.resolution!.loserRole).toBe(lied ? 'accused' : 'accuser');

        if (lied) {
          // §6 row 1 — caught liar: 50/50 coin: SELF or the accuser executes them.
          if (shot?.shotKind === 'EXECUTE_BY_ACCUSER') expect(shot.executorSeat).toBe(B);
          else expect(shot?.shotKind).toBe('SELF');
        } else {
          // §6 row 2 — false accuser: always SELF, never accuser-executes.
          expect(shot).toMatchObject({ loserSeat: B, shotKind: 'SELF' });
          expect(shot?.executorSeat).toBeUndefined();
        }
      }
    }
  });
});
