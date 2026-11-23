import { describe, expect, it } from 'vitest';
import { assignShotKind } from '../src/engine';
import { chamberBadge } from '../src/serialize';
import { SeededRng } from '../src/rng';
import { NodeCryptoRng } from '../src/rng';
import type { Effect, GameState, PlayerState, TableRank } from '../src/types';
import { ok, startedMatch, T0, turnSeat, withBullets, withHands } from './helpers';

const offOf = (t: TableRank): TableRank => (t === 'K' ? 'Q' : 'K');

function handOf(s: GameState, seat: number): string[] {
  return s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);
}

function shotOf(effects: Effect[]) {
  return effects.find((e) => e.kind === 'SHOT_RESULT') as
    Extract<Effect, { kind: 'SHOT_RESULT' }> | undefined;
}

/**
 * L (starter) is caught lying every round; the caught liar starts the next
 * round (STR/01 §2.3), so the loop keeps L on lead through every table card.
 */
function driveLadder(k: number) {
  let s = startedMatch(3, 900 + k);
  const L = turnSeat(s);
  s = withBullets(s, { [L]: k, [(L + 1) % 3]: 6, [(L + 2) % 3]: 6 });
  let t = T0 + 5;
  const outcomes: {
    pullNo: number;
    outcome: 'BLANK' | 'LIVE';
    badge: ReturnType<typeof chamberBadge>;
  }[] = [];
  for (let pull = 1; pull <= k; pull++) {
    // R4: the bullet stays in the SAME chamber for the whole match — never re-rolled:
    expect(s.players.find((p) => p.seat === L)!.bulletPos).toBe(k);
    const off = offOf(s.round!.tableCard);
    s = withHands(s, { [L]: [off, off, off, off, off] });
    s = ok(s, { type: 'PLAY', seat: L, cardIds: handOf(s, L).slice(0, 1), at: t }).s; // L lies 1 card
    expect(turnSeat(s)).toBe((L + 1) % 3);
    const r = ok(s, { type: 'LIAR', seat: (L + 1) % 3, at: t + 1 });
    expect(r.s.round!.resolution).toMatchObject({ verdict: 'LIE', loserSeat: L, pullNo: pull });
    const next = ok(r.s, { type: 'REVEAL_ACK', at: t + 2 });
    const shot = shotOf(next.effects)!;
    outcomes.push({
      pullNo: shot.pullNo,
      outcome: shot.outcome,
      badge: chamberBadge(r.s.players.find((p) => p.seat === L)!),
    });
    s = next.s;
    if (pull < k) {
      expect(shot.outcome).toBe('BLANK');
      expect(r.s.round!.resolution!.died).toBe(false);
      s = ok(s, { type: 'SHOT_ACK', at: t + 3 }).s;
      expect(s.phase).toBe('ROUND_END'); // blank also ends the round (R25)
      s = ok(s, { type: 'NEXT_ROUND', at: t + 4 }).s;
      s = ok(s, { type: 'BEGIN_TURNS', at: t + 5 }).s;
      expect(turnSeat(s)).toBe(L); // caught liar starts the next round
      t += 10;
    } else {
      expect(shot.outcome).toBe('LIVE'); // pulls === bulletPos ⇒ fatal
      expect(r.s.round!.resolution!.died).toBe(true);
      s = ok(s, { type: 'SHOT_ACK', at: t + 3 }).s; // 2 alive → ROUND_END (not game over)
      expect(s.phase).toBe('ROUND_END');
    }
  }
  return { s, L, outcomes };
}

describe('Revolver Model A (fixed bulletPos — R4/R21–R24)', () => {
  it.each([1, 2, 3, 4, 5, 6])('bulletPos=%s: earlier pulls blank, pull #%s is fatal', (k) => {
    const { s, L, outcomes } = driveLadder(k);
    expect(outcomes.map((x) => x.pullNo)).toEqual(Array.from({ length: k }, (_, i) => i + 1));
    expect(outcomes.map((x) => x.outcome)).toEqual([
      ...Array.from({ length: k - 1 }, () => 'BLANK' as const),
      'LIVE',
    ]);
    const loser = s.players.find((p) => p.seat === L)!;
    expect(loser.pulls).toBe(k);
    expect(loser.alive).toBe(false);
    expect(loser.stats.deaths).toBe(1);
    expect(loser.stats.pullsSurvived).toBe(k - 1); // blanks only — the fatal pull isn't "survived"
    expect(loser.stats.deathCause).toBe(
      s.round!.resolution?.shotKind === 'EXECUTE_BY_ACCUSER' ? 'executed' : 'selfRoulette',
    );
  });

  it('the 6th pull is guaranteed death: (pulled/6) badge climbs 1..6, pulls never reset (R22/R24)', () => {
    const { outcomes } = driveLadder(6);
    expect(outcomes.map((x) => x.badge.pulls)).toEqual([1, 2, 3, 4, 5, 6]);
    // After surviving the 50/50 pull #5 the public badge flags the next pull fatal:
    expect(outcomes[4].badge.fatalNext).toBe(true);
    expect(outcomes[3].badge.fatalNext).toBe(false);
    // The odds ladder itself (1/6→1/5→1/4→1/3→1/2→certain) is the emergent Model-A
    // consequence of a uniform fixed bulletPos — the engine adds NO pull-time RNG:
    expect([1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 1]).toHaveLength(6);
  });

  it('badge fatalNext is exactly (alive && pulls === 5-or-more at 5)', () => {
    const base = startedMatch(3, 977);
    const p: PlayerState = { ...base.players[0] }; // real PlayerState, no casts
    p.pulls = 0;
    p.alive = true;
    expect(chamberBadge(p)).toMatchObject({ pulls: 0, fatalNext: false });
    p.pulls = 4;
    expect(chamberBadge(p).fatalNext).toBe(false);
    p.pulls = 5;
    expect(chamberBadge(p).fatalNext).toBe(true); // (5/6): next loss is fatal
    p.alive = false;
    expect(chamberBadge(p).fatalNext).toBe(false); // dead seats have no next loss
  });
});

describe('Shot assignment (A1 — owner amendment)', () => {
  it('false accuser → SELF, always — no coin flip exists on that path (10k seeded)', () => {
    const rng = new SeededRng(909);
    for (let i = 0; i < 10_000; i++) {
      expect(assignShotKind('accuser', rng)).toBe('SELF');
    }
  });

  it('caught liar → fair coin: 100k Node-crypto flips within ±1.5% of 50/50 (mission spec)', () => {
    const rng = new NodeCryptoRng();
    const N = 100_000;
    let execute = 0;
    for (let i = 0; i < N; i++) {
      if (assignShotKind('accused', rng) === 'EXECUTE_BY_ACCUSER') execute++;
    }
    expect(Math.abs(execute - N / 2)).toBeLessThanOrEqual(N * 0.015);
  });

  it('seeded flips are deterministic and both outcomes occur', () => {
    const a = new SeededRng(1234);
    const b = new SeededRng(1234);
    const kinds = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const k = assignShotKind('accused', a);
      kinds.add(k);
      expect(assignShotKind('accused', b)).toBe(k);
    }
    expect(kinds.has('SELF')).toBe(true);
    expect(kinds.has('EXECUTE_BY_ACCUSER')).toBe(true);
  });

  it('integration: executor locked to the accuser, target locked to the loser; kills only on executed deaths', () => {
    const kinds = new Set<string>();
    let kills = 0;
    let selfDeaths = 0;
    for (let seed = 1; seed <= 60; seed++) {
      // 3p: A the starter lies; B catches; A's bulletPos = 1 → A dies.
      let s = startedMatch(3, seed * 7919);
      const A = turnSeat(s);
      const B = (A + 1) % 3;
      s = withBullets(s, { [A]: 1, [B]: 6, [(A + 2) % 3]: 6 });
      const off = offOf(s.round!.tableCard);
      s = withHands(s, { [A]: [off, off, off, off, off] });
      s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s;
      const r = ok(s, { type: 'LIAR', seat: B, at: T0 + 6 });
      const assigned = r.effects.find((e) => e.kind === 'SHOT_ASSIGNED') as
        Extract<Effect, { kind: 'SHOT_ASSIGNED' }> | undefined;
      expect(assigned!.loserSeat).toBe(A); // target locked to the loser
      kinds.add(assigned!.shotKind);
      const next = ok(r.s, { type: 'REVEAL_ACK', at: T0 + 7 });
      const shot = shotOf(next.effects)!;
      expect(shot.loserSeat).toBe(A);
      expect(shot.died).toBe(true);
      const loser = next.s.players.find((p) => p.seat === A)!;
      const accuser = next.s.players.find((p) => p.seat === B)!;
      if (assigned!.shotKind === 'EXECUTE_BY_ACCUSER') {
        expect(assigned!.executorSeat).toBe(B);
        expect(loser.stats.deathCause).toBe('executed');
        expect(accuser.stats.kills).toBe(1);
        kills++;
      } else {
        expect(loser.stats.deathCause).toBe('selfRoulette');
        expect(accuser.stats.kills).toBe(0);
        selfDeaths++;
      }
      expect(next.s.players.find((p) => p.seat === B)!.pulls).toBe(0); // B's gun never fires on A's shot
    }
    expect(kinds.size).toBe(2); // the coin explores both paths across seeds
    expect(kills).toBeGreaterThan(10);
    expect(selfDeaths).toBeGreaterThan(10);
  });

  it('forced calls resolve through the SAME A1 table (caught forced-liar also gets the coin)', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      // 2p: A (starter) lies into his emptying final play; B is force-called.
      let s = startedMatch(2, seed * 611);
      const A = turnSeat(s);
      const B = (A + 1) % 2;
      s = withBullets(s, { [A]: 1, [B]: 6 });
      const off = offOf(s.round!.tableCard);
      s = withHands(s, { [A]: [off, off, off, off, off], [B]: ['K', 'Q', 'A', 'K', 'Q'] });
      s = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 3), at: T0 + 5 }).s;
      s = ok(s, { type: 'PLAY', seat: B, cardIds: handOf(s, B).slice(0, 3), at: T0 + 6 }).s;
      const r = ok(s, { type: 'PLAY', seat: A, cardIds: handOf(s, A).slice(0, 2), at: T0 + 7 }); // empties with lies
      expect(r.s.round!.resolution?.forced).toBe(true);
      const assigned = r.effects.find((e) => e.kind === 'SHOT_ASSIGNED') as
        Extract<Effect, { kind: 'SHOT_ASSIGNED' }> | undefined;
      expect(assigned!.loserSeat).toBe(A);
      kinds.add(assigned!.shotKind);
    }
    expect(kinds.size).toBe(2);
  });
});
