import { describe, expect, it } from 'vitest';
import type { Effect, MatchRecord, ShotKind, TableRank } from '../src/types';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

type S = ReturnType<typeof startedMatch>;

const handOf = (s: S, seat: number): string[] =>
  s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);

const first = <T extends Effect['kind']>(effs: Effect[], kind: T) =>
  effs.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;

const offOf = (t: TableRank): 'Q' | 'K' => (t === 'K' ? 'Q' : 'K');

const stat = (s: S, seat: number) => s.players.find((p) => p.seat === seat)!.stats;

const pullsOf = (s: S, seat: number) => s.players.find((p) => p.seat === seat)!.pulls;

describe('STR/09 MatchRecord: full-match stat attribution', () => {
  it('a fully scripted 5-round match: every stat, coin and XP lands exactly (STR/01 §10)', () => {
    /**
     * Seats relative to the random starter X: X, Y = X+1, Z = X+2.
     * bullets: X=2 (dies on 2nd pull), Y=1 (dies on 1st), Z=6 (never).
     *
     * r1: X lies, Y catches            → X pulls #1 (BLANK)
     * r2: X's lie passes (bluff), Y's truth, Z false-accuses → Z pulls #1 (BLANK, SELF)
     * r3: Y lies, Z catches           → Y pulls #1 (LIVE, dies — coin decides executor credit)
     * r4: Z lies, X catches           → Z pulls #2 (BLANK)
     * r5: Z plays TRUTH, X false-accuses → X pulls #2 (LIVE, dies, false accuser → always SELF)
     * → Z last alive → NORMAL win (no abort), record emitted at SHOT_ACK.
     */
    let s = startedMatch(3, 42);
    const X = turnSeat(s);
    const Y = (X + 1) % 3;
    const Z = (X + 2) % 3;
    s = withBullets(s, { [X]: 2, [Y]: 1, [Z]: 6 });
    let t = T0 + 100;
    const coinByRound: ShotKind[] = [];

    const lie = (seat: number) => {
      const off = offOf(s.round!.tableCard);
      s = withHands(s, { [seat]: [off, off, off, off, off] });
      s = ok(s, { type: 'PLAY', seat, cardIds: handOf(s, seat).slice(0, 1), at: ++t }).s;
    };
    const truth = (seat: number) => {
      const table = s.round!.tableCard;
      s = withHands(s, { [seat]: [table, table, table, table, table] });
      s = ok(s, { type: 'PLAY', seat, cardIds: handOf(s, seat).slice(0, 1), at: ++t }).s;
    };
    /** challenge → reveal → shot → (round advance). Returns ALL effects of the chain. */
    const call = (seat: number, accused: number): Effect[] => {
      const all: Effect[] = [];
      const r = ok(s, { type: 'LIAR', seat, accusedSeat: accused, at: ++t });
      all.push(...r.effects);
      coinByRound.push(first(r.effects, 'SHOT_ASSIGNED')!.shotKind);
      const shown = ok(r.s, { type: 'REVEAL_ACK', at: ++t });
      all.push(...shown.effects);
      const ended = ok(shown.s, { type: 'SHOT_ACK', at: ++t });
      all.push(...ended.effects);
      s = ended.s;
      if (s.phase === 'ROUND_END') {
        s = ok(s, { type: 'NEXT_ROUND', at: ++t }).s;
        s = ok(s, { type: 'BEGIN_TURNS', at: ++t }).s;
      }
      return all;
    };

    // ── r1 ── X caught by Y ──────────────────────────────────────────────────
    expect(turnSeat(s)).toBe(X);
    lie(X);
    const fx1 = call(Y, X);
    expect(first(fx1, 'REVEALED')).toMatchObject({
      verdict: 'LIE',
      loserSeat: X,
      accusedSeat: X,
      challengerSeat: Y,
      forced: false,
    });
    expect(first(fx1, 'REVEALED')!.cards).toHaveLength(1); // only the accused's LAST play
    expect(first(fx1, 'SHOT_RESULT')).toMatchObject({
      loserSeat: X,
      pullNo: 1,
      outcome: 'BLANK',
      died: false,
    });
    expect(stat(s, Y).catches).toBe(1);
    expect(pullsOf(s, X)).toBe(1);
    expect(turnSeat(s)).toBe(X); // caught liar starts r2

    // ── r2 ── X's lie unchallenged; Y truth; Z false-accuses ─────────────────
    lie(X);
    truth(Y);
    const fx2 = call(Z, Y);
    expect(first(fx2, 'REVEALED')).toMatchObject({
      verdict: 'TRUTH',
      loserSeat: Z,
      accusedSeat: Y,
    });
    expect(first(fx2, 'SHOT_ASSIGNED')).toMatchObject({ loserSeat: Z, shotKind: 'SELF' }); // false accuser
    expect(first(fx2, 'SHOT_RESULT')).toMatchObject({ loserSeat: Z, outcome: 'BLANK' });
    expect(stat(s, X).bluffSuccesses).toBe(1); // X's r2 lie passed, unchallenged & un-revealed
    expect(stat(s, Z).falseAccusations).toBe(1);
    expect(pullsOf(s, Z)).toBe(1);
    expect(turnSeat(s)).toBe(Y); // false-accusation branch: next-in-order after previous starter X

    // ── r3 ── Y lies, Z catches → Y dies ─────────────────────────────────────
    lie(Y);
    const fx3 = call(Z, Y);
    expect(first(fx3, 'REVEALED')!.verdict).toBe('LIE');
    expect(first(fx3, 'SHOT_RESULT')).toMatchObject({
      loserSeat: Y,
      pullNo: 1,
      outcome: 'LIVE',
      died: true,
    });
    expect(s.players.find((p) => p.seat === Y)!.alive).toBe(false);
    expect(turnSeat(s)).toBe(Z); // dead caught-liar Y → next living ccw

    // ── r4 ── Z lies, X catches → Z survives ─────────────────────────────────
    lie(Z);
    const fx4 = call(X, Z);
    expect(first(fx4, 'SHOT_RESULT')).toMatchObject({ loserSeat: Z, pullNo: 2, outcome: 'BLANK' });
    expect(stat(s, X).catches).toBe(1);
    expect(turnSeat(s)).toBe(Z); // caught liar Z (alive) starts r5

    // ── r5 ── Z truth, X false-accuses → X dies → Z wins ─────────────────────
    truth(Z);
    const fx5 = call(X, Z);
    expect(first(fx5, 'REVEALED')).toMatchObject({ verdict: 'TRUTH', loserSeat: X });
    expect(first(fx5, 'SHOT_ASSIGNED')).toMatchObject({ loserSeat: X, shotKind: 'SELF' });
    expect(first(fx5, 'SHOT_RESULT')).toMatchObject({
      loserSeat: X,
      pullNo: 2,
      outcome: 'LIVE',
      died: true,
      deathCause: 'selfRoulette',
    });
    // call() already advanced; the match must now be over:
    expect(s.phase).toBe('GAME_END');
    expect(s.winnerSeat).toBe(Z);
    expect(coinByRound[0]).toBeDefined();
    expect(first(fx5, 'GAME_OVER')).toBeDefined();

    for (const e of s.log) {
      expect(e.accepted).toBe(true); // the entire script was legal — no rejections
    }

    // ── MatchRecord verification ──────────────────────────────────────────────
    const record: MatchRecord = s.matchRecord!;
    expect(record.winnerSeat).toBe(Z);
    expect(record.aborted).toBe(false);
    expect(record.matchId).toBe('m-test');
    expect(record.roomCode).toBe('ABCDE');
    expect(record.players).toHaveLength(3);
    expect(record.players.find((p) => p.seat === Y)!.accountId).toBe(`acc-${Y}`);
    expect(record.players.find((p) => p.seat === X)!.nickname).toBe(`P${X}`);
    expect(record.summary).toEqual({ rounds: 5, totalPulls: 5, dareDevilMoments: 0 });
    expect(s.completedRounds).toBe(5);

    // X — bluffed once (passed), caught a liar, wrongly accused once, died:
    expect(stat(s, X)).toMatchObject({
      kills: 0,
      catches: 1,
      falseAccusations: 1,
      bluffSuccesses: 1,
      deaths: 1,
      pullsSurvived: 1,
      roundsPlayed: 5,
      roundsSurvived: 4,
      won: false,
      xpEarned: 4,
      coinsEarned: 4, // 4 survived rounds, no win roll (STR/04 §2: everyone +1/round)
    });
    expect(stat(s, X).deathCause).toBe('selfRoulette');

    // Y — caught once, died early:
    expect(stat(s, Y)).toMatchObject({
      kills: 0,
      catches: 1,
      falseAccusations: 0,
      bluffSuccesses: 0,
      deaths: 1,
      pullsSurvived: 0,
      roundsPlayed: 3,
      roundsSurvived: 2,
      won: false,
      xpEarned: 4,
      coinsEarned: 2,
    });
    // r3's caught-liar coin decides Y's cause and Z's kill credit:
    if (coinByRound[2] === 'EXECUTE_BY_ACCUSER') {
      expect(stat(s, Y).deathCause).toBe('executed');
      expect(stat(s, Z).kills).toBe(1);
    } else {
      expect(stat(s, Y).deathCause).toBe('selfRoulette');
      expect(stat(s, Z).kills).toBe(0);
    }

    // Z — the winner:
    expect(stat(s, Z)).toMatchObject({
      catches: 1,
      falseAccusations: 1,
      deaths: 0,
      pullsSurvived: 2,
      roundsPlayed: 5,
      roundsSurvived: 5,
      won: true,
      xpEarned: 12,
    });
    expect(stat(s, Z).coinsEarned).toBeGreaterThanOrEqual(5 + 2); // 5 rounds + randInt(2..7)
    expect(stat(s, Z).coinsEarned).toBeLessThanOrEqual(5 + 7);
  });

  it('coins: +1 per survived round for everyone; only the winner rolls randInt(2..7)', () => {
    // 3p, two scripted rounds (everyone alive at both ends), then two seats
    // leave → the remaining player wins the aborted match:
    let s = startedMatch(3, 43);
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6 });
    let t = T0 + 10;
    for (let round = 0; round < 2; round++) {
      const a = turnSeat(s);
      s = ok(s, { type: 'PLAY', seat: a, cardIds: handOf(s, a).slice(0, 1), at: t }).s;
      const r = ok(s, { type: 'LIAR', seat: turnSeat(s), at: t + 1 });
      s = ok(r.s, { type: 'REVEAL_ACK', at: t + 2 }).s;
      s = ok(s, { type: 'SHOT_ACK', at: t + 3 }).s;
      s = ok(s, { type: 'NEXT_ROUND', at: t + 4 }).s;
      s = ok(s, { type: 'BEGIN_TURNS', at: t + 5 }).s;
      t += 10;
    }
    s = ok(s, { type: 'LEAVE', seat: 0, at: t }).s;
    const aborted = ok(s, { type: 'LEAVE', seat: 1, at: t + 1 });
    expect(aborted.s.matchRecord!.aborted).toBe(true);
    expect(aborted.s.matchRecord!.winnerSeat).toBe(2);
    expect(aborted.s.matchRecord!.summary.rounds).toBe(2);
    // +1 coin per survived round for everyone alive at round end (STR/04 §2);
    // the win roll (randInt 2..7) is the winner's only:
    expect(stat(aborted.s, 0).coinsEarned).toBe(2);
    expect(stat(aborted.s, 1).coinsEarned).toBe(2);
    expect(stat(aborted.s, 2).coinsEarned - 2).toBeGreaterThanOrEqual(2);
    expect(stat(aborted.s, 2).coinsEarned - 2).toBeLessThanOrEqual(7);
  });

  it('dareDevilMoments: survived 50/50 pulls (#5) count; the certain 6th is just death', () => {
    // L is caught 6 rounds straight (bullet 6): blanks #1..#5 — surviving the
    // 50/50 pull #5 is a daredevil moment — then the guaranteed death at #6.
    let s = startedMatch(3, 44);
    const L = turnSeat(s);
    s = withBullets(s, { [L]: 6, [(L + 1) % 3]: 6, [(L + 2) % 3]: 6 });
    let t = T0 + 10;
    const devilByRound: boolean[] = [];
    for (let round = 1; round <= 6; round++) {
      expect(turnSeat(s)).toBe(L); // the caught liar keeps starting every round (alive until the last pull)
      const off = offOf(s.round!.tableCard);
      s = withHands(s, { [L]: [off, off, off, off, off] });
      s = ok(s, { type: 'PLAY', seat: L, cardIds: handOf(s, L).slice(0, 1), at: t }).s;
      const r = ok(s, { type: 'LIAR', seat: turnSeat(s), at: t + 1 }); // Z or Y catches — doesn't matter
      const shown = ok(r.s, { type: 'REVEAL_ACK', at: t + 2 });
      const ended = ok(shown.s, { type: 'SHOT_ACK', at: t + 3 });
      const roundEnded = first(ended.effects, 'ROUND_ENDED')!;
      devilByRound.push(roundEnded.dareDevil);
      s = ended.s;
      if (round < 6) {
        expect(s.phase).toBe('ROUND_END');
        s = ok(s, { type: 'NEXT_ROUND', at: t + 4 }).s;
        s = ok(s, { type: 'BEGIN_TURNS', at: t + 5 }).s;
      }
      t += 10;
    }
    expect(devilByRound).toEqual([false, false, false, false, true, false]);
    expect(s.phase).toBe('ROUND_END');
    expect(s.dareDevilMoments).toBe(1); // feeds MatchRecord.summary.dareDevilMoments
    expect(s.players.find((p) => p.seat === L)!.alive).toBe(false);
    expect(s.players.find((p) => p.seat === L)!.stats.pullsSurvived).toBe(5);
    expect(s.players.find((p) => p.seat === L)!.pulls).toBe(6); // Model A: died on the certain 6th
  });
});
