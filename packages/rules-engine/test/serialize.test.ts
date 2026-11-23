import { describe, expect, it } from 'vitest';
import { chamberBadge, toPublicSnapshot } from '../src/serialize';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

describe('Public serializer (STR/07 §3 — zero hidden data)', () => {
  it('snapshot NEVER exposes bulletPos to anyone — not even the owner', () => {
    const s = startedMatch(3);
    for (const viewer of [0, 1, 2, undefined]) {
      const json = JSON.stringify(toPublicSnapshot(s, viewer));
      expect(json).not.toContain('bulletPos');
      expect(json).not.toContain('"bullet"');
    }
  });

  it('own hand is visible only to its owner; others see counts only', () => {
    const s = startedMatch(3);
    const own = toPublicSnapshot(s, 0);
    expect(own.viewer?.seat).toBe(0);
    expect(own.viewer?.hand).toEqual(s.players[0].hand);

    const other = toPublicSnapshot(s, 1);
    expect(other.viewer?.hand).toEqual(s.players[1].hand);
    const seatZeroCardIds = s.players[0].hand.map((c) => c.id).join(',');
    expect(JSON.stringify(other)).not.toContain(seatZeroCardIds);

    const spectator = toPublicSnapshot(s, undefined);
    expect(spectator.viewer).toBeNull();
    expect(spectator.players[0].handCount).toBe(5);
    expect('hand' in spectator.players[0]).toBe(false);
  });

  it('pile shows counts only; staged selections stay private', () => {
    const s0 = startedMatch(3);
    const A = turnSeat(s0);
    const ids = s0.players[A].hand.map((c) => c.id).slice(0, 2);
    const anySeat = (A + 1) % 3;
    const s1 = ok(s0, { type: 'PLAY', seat: A, cardIds: ids, at: T0 + 10 }).s;
    const snap = toPublicSnapshot(s1, anySeat);
    expect(snap.pile).toEqual([{ seat: A, count: 2 }]);
    expect(JSON.stringify(snap)).not.toContain(ids[0]);

    const stageIds = s1.players[anySeat].hand.map((c) => c.id).slice(0, 1);
    const s2 = ok(s1, { type: 'STAGE', seat: anySeat, cardIds: stageIds, at: T0 + 20 }).s;
    const json2 = JSON.stringify(toPublicSnapshot(s2, (anySeat + 1) % 3));
    expect(json2).not.toContain(stageIds[0]);
  });

  it('chamber badge shows (pulled/6) + fatalNext — never the chamber index', () => {
    const s = startedMatch(3);
    expect(chamberBadge(s.players[0])).toEqual({ pulls: 0, chambers: 6, fatalNext: false });
    s.players[0].pulls = 5;
    expect(chamberBadge(s.players[0]).fatalNext).toBe(true);
    expect(JSON.stringify(chamberBadge(s.players[0]))).toBe('{"pulls":5,"chambers":6,"fatalNext":true}');
  });

  it('MatchRecord (emitted at GAME_OVER) is bullet-free', () => {
    // 2p match; seat 0 leaves mid-round → seat 1 wins by default (abort).
    const s0 = startedMatch(2);
    const r1 = ok(s0, { type: 'LEAVE', seat: 0, at: T0 + 5 });
    const over = r1.effects.find((e) => e.kind === 'GAME_OVER');
    expect(over).toBeDefined();
    const json = JSON.stringify(r1.s.matchRecord);
    expect(json).not.toContain('bulletPos');
    expect(json).not.toContain('{"rank"'); // no card faces in the record either
  });

  it('a dead viewer gets no hand in the snapshot; a living winner does', () => {
    // Script a deterministic 2p death: A's final (emptying) play is TRUTHFUL →
    // forced caller B is the false accuser → B SELF-shots; B's bulletPos = 1 → dies.
    let s = startedMatch(2);
    const A = turnSeat(s);
    const B = (A + 1) % 2;
    const table = s.round!.tableCard;
    s = withHands(s, {
      [A]: Array.from({ length: 5 }, (_, i) => (i < 3 ? (table === 'K' ? 'Q' : 'K') : table)),
      [B]: ['K', 'Q', 'A', 'K', 'Q'],
    });
    s = withBullets(s, { [B]: 1 });
    const aIds = s.players[A].hand.map((c) => c.id);
    const bIds = s.players[B].hand.map((c) => c.id);
    s = ok(s, { type: 'PLAY', seat: A, cardIds: aIds.slice(0, 3), at: T0 + 10 }).s; // A: 3 lies
    s = ok(s, { type: 'PLAY', seat: B, cardIds: bIds.slice(0, 3), at: T0 + 12_000 }).s; // B: 3 cards
    s = ok(s, { type: 'PLAY', seat: A, cardIds: aIds.slice(3), at: T0 + 15_000 }).s; // A: truth, hand empty
    expect(s.phase).toBe('REVEAL'); // forced auto-call (R29): challenger B, accused A
    const r1 = ok(s, { type: 'REVEAL_ACK', at: T0 + 16_000 });
    const shot = r1.effects.find((e) => e.kind === 'SHOT_RESULT');
    expect(shot).toMatchObject({ loserSeat: B, outcome: 'LIVE', died: true });
    const r2 = ok(r1.s, { type: 'SHOT_ACK', at: T0 + 17_000 });
    expect(r2.s.phase).toBe('GAME_END');
    expect(r2.s.winnerSeat).toBe(A);

    const deadView = toPublicSnapshot(r2.s, B);
    expect(deadView.viewer).toBeNull();
    const aliveView = toPublicSnapshot(r2.s, A);
    expect(aliveView.viewer?.seat).toBe(A);
  });
});
