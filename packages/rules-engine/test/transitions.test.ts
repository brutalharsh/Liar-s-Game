import { describe, expect, it } from 'vitest';
import { apply, cloneState } from '../src/engine';
import { stripRuntime } from '../src/replay';
import type { ErrCode, GameEvent, GameState } from '../src/types';
import { emptyMatch, ok, startedMatch, T0, turnSeat } from './helpers';

const errCode = (s: GameState, ev: GameEvent): ErrCode | undefined => apply(s, ev).err?.code;

/** Gameplay projection (excludes log/seq/rng) for state-diff assertions. */
function projection(s: GameState): string {
  const { log: _l, rng: _r, eventSeq: _q, ...rest } = s;
  return JSON.stringify(rest);
}

function cloneWithDead(s: GameState, seat: number): GameState {
  const c = cloneState(s);
  const p = c.players.find((q) => q.seat === seat);
  if (p) p.alive = false;
  return c;
}

describe('State machine: illegal transitions are typed-rejected (doc-02 §9/R10 note)', () => {
  it('gameplay events are rejected before MATCH_START', () => {
    const s = emptyMatch(3);
    expect(errCode(s, { type: 'BEGIN_TURNS', at: T0 })).toBe('ERR_MATCH_NOT_STARTED');
    expect(errCode(s, { type: 'PLAY', seat: 0, cardIds: ['K1'], at: T0 })).toBe(
      'ERR_MATCH_NOT_STARTED',
    );
    expect(errCode(s, { type: 'TURN_TIMEOUT', seat: 0, at: T0 })).toBe('ERR_MATCH_NOT_STARTED');
    expect(errCode(s, { type: 'NEXT_ROUND', at: T0 })).toBe('ERR_MATCH_NOT_STARTED');
    expect(errCode(s, { type: 'STAGE', seat: 0, cardIds: [], at: T0 })).toBe(
      'ERR_MATCH_NOT_STARTED',
    );
    // presence events are tolerated in the lobby (they are just flags)
    expect(errCode(s, { type: 'DISCONNECT', seat: 0, at: T0 })).toBeUndefined();
  });

  it('MATCH_START twice → ERR_WRONG_PHASE (round 1 lands in ROUND_NEW)', () => {
    const s = emptyMatch(3);
    const s1 = ok(s, { type: 'MATCH_START', at: T0 }).s;
    expect(s1.phase).toBe('ROUND_NEW');
    expect(errCode(s1, { type: 'MATCH_START', at: T0 + 1 })).toBe('ERR_WRONG_PHASE');
  });

  it('driver events are phase-gated (spot matrix)', () => {
    const s = startedMatch(3); // phase TURN
    expect(errCode(s, { type: 'REVEAL_ACK', at: T0 })).toBe('ERR_WRONG_PHASE');
    expect(errCode(s, { type: 'SHOT_ACK', at: T0 })).toBe('ERR_WRONG_PHASE');
    expect(errCode(s, { type: 'NEXT_ROUND', at: T0 })).toBe('ERR_WRONG_PHASE');
    expect(errCode(s, { type: 'BEGIN_TURNS', at: T0 })).toBe('ERR_WRONG_PHASE');
    expect(errCode(s, { type: 'WINDOW_EXPIRE', at: T0 })).toBe('ERR_WRONG_PHASE');

    const A = turnSeat(s);
    const s2 = ok(s, {
      type: 'PLAY',
      seat: A,
      cardIds: s.players[A].hand.map((c) => c.id).slice(0, 1),
      at: T0 + 5,
    }).s;
    const C = turnSeat(s2);
    const liared = ok(s2, { type: 'LIAR', seat: C, at: T0 + 6 }).s;
    expect(liared.phase).toBe('REVEAL');
    expect(errCode(liared, { type: 'BEGIN_TURNS', at: T0 })).toBe('ERR_WRONG_PHASE');
    expect(errCode(liared, { type: 'PLAY', seat: C, cardIds: [], at: T0 })).toBe('ERR_WRONG_PHASE');

    const shot = ok(liared, { type: 'REVEAL_ACK', at: T0 + 7 }).s;
    expect(shot.phase).toBe('SHOT');
    expect(errCode(shot, { type: 'REVEAL_ACK', at: T0 + 8 })).toBe('ERR_WRONG_PHASE');

    const roundEnd = ok(shot, { type: 'SHOT_ACK', at: T0 + 9 }).s;
    expect(roundEnd.phase).toBe('ROUND_END');
    expect(errCode(roundEnd, { type: 'SHOT_ACK', at: T0 + 10 })).toBe('ERR_WRONG_PHASE');
    expect(errCode(roundEnd, { type: 'TURN_TIMEOUT', seat: 0, at: T0 })).toBe('ERR_WRONG_PHASE');

    const nextRound = ok(roundEnd, { type: 'NEXT_ROUND', at: T0 + 11 }).s;
    expect(nextRound.phase).toBe('ROUND_NEW');
    expect(errCode(nextRound, { type: 'NEXT_ROUND', at: T0 + 12 })).toBe('ERR_WRONG_PHASE');
  });

  it('after GAME_END, everything is rejected with ERR_MATCH_OVER', () => {
    const s = startedMatch(2);
    const r = ok(s, { type: 'LEAVE', seat: 0, at: T0 + 5 });
    expect(r.s.phase).toBe('GAME_END');
    expect(errCode(r.s, { type: 'PLAY', seat: 1, cardIds: ['x'], at: T0 })).toBe('ERR_MATCH_OVER');
    expect(errCode(r.s, { type: 'LIAR', seat: 1, at: T0 })).toBe('ERR_MATCH_OVER');
    expect(errCode(r.s, { type: 'STAGE', seat: 1, cardIds: [], at: T0 })).toBe('ERR_MATCH_OVER');
    expect(errCode(r.s, { type: 'DISCONNECT', seat: 1, at: T0 })).toBe('ERR_MATCH_OVER');
  });

  it('apply() never mutates the input state (pure reducer)', () => {
    const s = startedMatch(3);
    const before = JSON.stringify(stripRuntime(s));
    const A = turnSeat(s);
    const ids = s.players[A].hand.map((c) => c.id);
    ok(s, { type: 'PLAY', seat: A, cardIds: ids.slice(0, 2), at: T0 + 5 });
    apply(s, { type: 'PLAY', seat: (A + 1) % 3, cardIds: ids.slice(2), at: T0 + 6 });
    expect(JSON.stringify(stripRuntime(s))).toBe(before);
  });

  it('a rejected event mutates nothing but the log, which records it', () => {
    const s0 = startedMatch(3);
    const A = turnSeat(s0);
    const before = projection(s0);
    const r = apply(s0, {
      type: 'PLAY',
      seat: (A + 1) % 3,
      cardIds: s0.players[(A + 1) % 3].hand.map((c) => c.id).slice(0, 1),
      at: T0 + 5,
    });
    expect(r.err?.code).toBe('ERR_NOT_YOUR_TURN');
    expect(projection(r.state)).toBe(before);
    expect(r.state.log).toHaveLength(s0.log.length + 1);
    expect(r.state.log[r.state.log.length - 1]).toMatchObject({
      accepted: false,
      errCode: 'ERR_NOT_YOUR_TURN',
    });
  });

  it('LOBBY can not start below 2 present players', () => {
    const s = emptyMatch(3);
    let s1 = ok(s, { type: 'LEAVE', seat: 0, at: T0 }).s;
    s1 = ok(s1, { type: 'LEAVE', seat: 1, at: T0 + 1 }).s;
    expect(errCode(s1, { type: 'MATCH_START', at: T0 + 2 })).toBe('ERR_TOO_FEW_PLAYERS');
  });

  it('unknown seat → ERR_NOT_SEATED; dead seat → ERR_DEAD', () => {
    const s = startedMatch(3);
    expect(errCode(s, { type: 'PLAY', seat: 99, cardIds: ['K1'], at: T0 })).toBe('ERR_NOT_SEATED');
    expect(errCode(s, { type: 'LIAR', seat: 99, at: T0 })).toBe('ERR_NOT_SEATED');
    const dead = cloneWithDead(s, 0);
    expect(errCode(dead, { type: 'STAGE', seat: 0, cardIds: [], at: T0 })).toBe('ERR_DEAD');
  });

  it('log records every event with a monotonic seq (hash-chain input)', () => {
    let s = startedMatch(4);
    const seqs: number[] = [];
    const A = turnSeat(s);
    const events: GameEvent[] = [
      {
        type: 'STAGE',
        seat: A,
        cardIds: s.players[A].hand.map((c) => c.id).slice(0, 1),
        at: T0 + 2,
      },
      { type: 'PLAY', seat: 99, cardIds: [], at: T0 + 3 }, // rejected
      {
        type: 'PLAY',
        seat: A,
        cardIds: s.players[A].hand.map((c) => c.id).slice(0, 1),
        at: T0 + 4,
      },
    ];
    for (const ev of events) {
      s = apply(s, ev).state;
    }
    for (const e of s.log) seqs.push(e.seq);
    expect(seqs).toEqual(Array.from({ length: s.log.length }, (_, i) => i + 1));
    expect(s.log.length).toBe(2 + events.length);
  });
});
