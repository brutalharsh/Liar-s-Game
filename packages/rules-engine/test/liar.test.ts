import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import type { Effect, GameState, TableRank } from '../src/types';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

function first<T extends Effect['kind']>(effects: Effect[], kind: T) {
  return effects.find((e) => e.kind === kind) as Extract<Effect, { kind: T }> | undefined;
}

function handOf(s: GameState, seat: number): string[] {
  return s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);
}

const offOf = (t: TableRank): TableRank => (t === 'K' ? 'Q' : 'K');

describe('Resolution: reveal & judgment (R17/R18, doc-02 §11 checklist)', () => {
  it('jokers are wild — full-joker play is TRUTH; the accuser loses and always SELF-shots (A1 row 2)', () => {
    let s = startedMatch(3, 55);
    s = withBullets(s, { 0: 6, 1: 6, 2: 6 });
    const A = turnSeat(s);
    s = withHands(s, { [A]: ['JOKER', 'JOKER', 'JOKER', 'JOKER', 'JOKER'] });
    const B = (A + 1) % 3;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    expect(first(r.effects, 'REVEALED')).toMatchObject({
      verdict: 'TRUTH',
      loserSeat: B,
      accusedSeat: A,
      challengerSeat: B,
      forced: false,
    });
    expect(first(r.effects, 'SHOT_ASSIGNED')).toMatchObject({ loserSeat: B, shotKind: 'SELF' });
    expect(r.s.round!.resolution?.loserRole).toBe('accuser');
  });

  it('mixed truth+lie single play → LIE (one false card poisons the pile)', () => {
    let s = startedMatch(3, 56);
    s = withBullets(s, { 0: 6, 1: 6, 2: 6 });
    const A = turnSeat(s);
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [A]: [s.round!.tableCard, 'JOKER', off, off, off] });
    const B = (A + 1) % 3;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    expect(first(r.effects, 'REVEALED')).toMatchObject({ verdict: 'LIE', loserSeat: A });
    expect(r.s.round!.resolution?.loserRole).toBe('accused');
    const assigned = first(r.effects, 'SHOT_ASSIGNED')!;
    expect(['SELF', 'EXECUTE_BY_ACCUSER']).toContain(assigned.shotKind);
    if (assigned.shotKind === 'EXECUTE_BY_ACCUSER') expect(assigned.executorSeat).toBe(B);
  });

  it('joker + off-rank in one play → still LIE; a lone joker never lies', () => {
    let s = startedMatch(3, 57);
    s = withBullets(s, { 0: 6, 1: 6, 2: 6 });
    const A = turnSeat(s);
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [A]: ['JOKER', off, off, off, off] });
    const B = (A + 1) % 3;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    expect(first(r.effects, 'REVEALED')?.verdict).toBe('LIE');
  });

  it('voluntary LIAR on a round whose pile is empty → ERR_FIRST_PLAY (R11)', () => {
    const s = startedMatch(3, 58);
    const a = turnSeat(s);
    const next = (a + 1) % 3;
    const r = apply(s, { type: 'LIAR', seat: next, at: T0 + 5 });
    expect(r.err?.code).toBe('ERR_FIRST_PLAY');
  });

  it('only the accused LAST play is revealed; earlier plays stay hidden (R17)', () => {
    let s = startedMatch(3, 59);
    s = withBullets(s, { 0: 6, 1: 6, 2: 6 });
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    const C = (A + 2) % 3;
    const table = s.round!.tableCard;
    const off = offOf(table);
    s = withHands(s, {
      [A]: [table, table, table, table, table],
      [B]: [off, off, off, off, off],
      [C]: [table, table, table, table, table],
    });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B).slice(0, 1), at: T0 + 6 }).s;
    s = ok(s, { type: 'PLAY', seat: C, cardIds: handOf(s, C).slice(0, 1), at: T0 + 7 }).s;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 8 }).s;
    expect(turnSeat(s)).toBe(B);
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 9 });
    const revealed = first(r.effects, 'REVEALED')!;
    expect(revealed.accusedSeat).toBe(A);
    expect(revealed.cards).toHaveLength(1); // A's second play
    expect(revealed.cards[0].rank).toBe(table);
    expect(revealed.verdict).toBe('TRUTH');
    expect(revealed.loserSeat).toBe(B);
    // B's earlier LIE went unchallenged (C played after it) → bluff credit at closure:
    expect(r.s.players[B].stats.bluffSuccesses).toBe(1);
  });
});

describe('play+call same-tick atomicity ([SD-T] exploit — doc-02 R14 engine note)', () => {
  it("PLAY lands first → the follow-up LIAR can never judge the caller's own card", () => {
    let s = startedMatch(3, 60);
    s = withBullets(s, { 0: 6, 1: 6, 2: 6 });
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [A]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s; // A lies
    // Exploit attempt: B plays a card AND calls LIAR in the same tick — play lands first.
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B).slice(0, 1), at: T0 + 6 }).s;
    const r = apply(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    expect(r.err?.code).toBe('ERR_NOT_YOUR_TURN');
    expect(r.state.phase).toBe('TURN');
    expect(r.state.round!.resolution).toBeUndefined(); // nothing resolved against B's own card
  });

  it('LIAR lands first → resolves against the PREVIOUS play; the queued PLAY is stale', () => {
    let s = startedMatch(3, 61);
    s = withBullets(s, { 0: 6, 1: 6, 2: 6 });
    const A = turnSeat(s);
    const B = (A + 1) % 3;
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [A]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at: T0 + 5 }).s;
    const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
    expect(first(r.effects, 'REVEALED')).toMatchObject({ accusedSeat: A, verdict: 'LIE' });
    const stale = apply(r.s, {
      type: 'PLAY',
      seat: B,
      cardIds: handOf(r.s, B).slice(0, 1),
      at: T0 + 6,
    });
    expect(stale.err?.code).toBe('ERR_WRONG_PHASE');
  });

  it('window mode: the same-tick race judges only the pre-existing play', () => {
    let s = startedMatch(7, 62);
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6, [3]: 6, [4]: 6, [5]: 6, [6]: 6 });
    const A = turnSeat(s);
    const at = T0 + 5;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 1), at }).s;
    expect(s.phase).toBe('WINDOW');
    const B = (A + 1) % 7;
    const r = ok(s, { type: 'LIAR', seat: B, at: at + 2_500 });
    expect(first(r.effects, 'REVEALED')?.accusedSeat).toBe(A);
    const stale = apply(r.s, { type: 'PLAY', seat: B, cardIds: [], at: at + 2_500 });
    expect(stale.err?.code).toBe('ERR_WRONG_PHASE');
  });
});

describe('Forced auto-call (R29/R30 — holders == 1 fires instantly)', () => {
  it('heads-up: emptying your hand triggers the instant auto-call — the next player never gets a turn', () => {
    let s = startedMatch(2, 70);
    s = withBullets(s, { [0]: 6, [1]: 6 });
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s; // A: 3 of 5
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B).slice(0, 3), at: T0 + 6 }).s; // B: 3 of 5
    expect(s.phase).toBe('TURN');
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 7 }); // A empties
    expect(r.s.phase).toBe('REVEAL'); // jumped straight past TURN — no B decision ever
    expect(first(r.effects, 'REVEALED')).toMatchObject({
      forced: true,
      challengerSeat: B,
      accusedSeat: A,
    });
  });

  it('forced call on a TRUTHFUL last play: the forced caller is the false accuser (SELF shot)', () => {
    let s = startedMatch(2, 71);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    const table = s.round!.tableCard;
    s = withBullets(s, { [B]: 6 }); // B survives the blank so stats are inspectable
    s = withHands(s, { [A]: [table, table, table, table, table] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s;
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B).slice(0, 3), at: T0 + 6 }).s;
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 7 }); // empties, truthful
    expect(first(r.effects, 'REVEALED')).toMatchObject({
      forced: true,
      verdict: 'TRUTH',
      loserSeat: B,
    });
    expect(first(r.effects, 'SHOT_ASSIGNED')).toMatchObject({ loserSeat: B, shotKind: 'SELF' });
    expect(r.s.players[B].stats.falseAccusations).toBe(1);
    expect(r.s.players[B].pulls).toBe(1); // the pull is consumed deterministically at resolution
  });

  it('forced call on a LYING last play: the finisher is caught (bluff credit never given for revealed plays)', () => {
    let s = startedMatch(2, 72);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    const table = s.round!.tableCard;
    const off = offOf(table);
    s = withBullets(s, { [A]: 6 }); // A survives the blank
    // First play all-truth, final (emptying) play a LIE:
    s = withHands(s, { [A]: [table, table, table, off, off] });
    s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s;
    s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B).slice(0, 3), at: T0 + 6 }).s;
    const r = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 7 }); // empties with lie
    expect(first(r.effects, 'REVEALED')).toMatchObject({ verdict: 'LIE', loserSeat: A });
    expect(r.s.players[A].stats.bluffSuccesses).toBe(0); // caught ≠ bluff success
  });

  it('5p: mid-rotation holders==1 — forced challenger is the single holder, accused is the finisher', () => {
    let s = startedMatch(5, 73); // window mode; windows overlap the script (plays every 3s)
    s = withBullets(s, { [0]: 6, [1]: 6, [2]: 6, [3]: 6, [4]: 6 });
    const A = s.turn!.seat;
    const order = [A, (A + 1) % 5, (A + 2) % 5, (A + 3) % 5, (A + 4) % 5];
    // Everyone dumps 3, then the first three dump their last 2; the 4th dumper's
    // final play is the trigger; the 5th player is the single holder.
    let t = T0 + 5;
    const plays: { seat: number; count: number }[] = [];
    for (const seat of order) plays.push({ seat, count: 3 });
    for (const seat of order.slice(0, 4)) plays.push({ seat, count: 2 });
    let last: ReturnType<typeof apply> | undefined;
    for (const p of plays) {
      last = apply(s, {
        type: 'PLAY',
        seat: p.seat,
        cardIds: handOf(s, p.seat).slice(0, p.count),
        at: t,
      });
      expect(last.err, `play by ${p.seat}`).toBeUndefined();
      s = last.state;
      t += 3_000;
    }
    expect(s.phase).toBe('REVEAL');
    const res = s.round!.resolution!;
    expect(res.forced).toBe(true);
    expect(res.accusedSeat).toBe(order[3]); // the finisher who just emptied
    expect(res.challengerSeat).toBe(order[4]); // the single remaining holder
    const holdersLeft = s.players.filter((p) => p.alive && p.hand.length > 0).map((p) => p.seat);
    expect(holdersLeft).toEqual([order[4]]);
    expect(last!.state.log.every((e) => e.accepted)).toBe(true);
  });
});
