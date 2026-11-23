import { describe, expect, it } from 'vitest';
import { apply, createMatch } from '../src/engine';
import { SeededRng } from '../src/rng';
import { challengeModeFor, containsLie } from '../src/index';
import { roster } from './helpers';
import type { GameState, Rank, TableRank } from '../src/types';

const aliveCount = (s: GameState) => s.players.filter((p) => p.alive).length;
const handOf = (s: GameState, seat: number): string[] =>
  s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);

interface DriveResult {
  s: GameState;
  steps: number;
  rejections: string[];
  reveals: { verdict: 'LIE' | 'TRUTH'; table: TableRank; cards: Rank[] }[];
}

/**
 * Event-pure fuzz wheel. The driver only ever submits legal events (zero
 * rejections expected — a rejection means the driver's legality model and
 * the engine disagree, which is a bug in one of them).
 */
function driveMatch(nPlayers: number, seed: number): DriveResult {
  const engineSeed = 1_000_000 + seed * 13;
  const my = new SeededRng(seed * 61_619 + 17); // driver decision stream (independent)
  let s = apply(createMatch({ roster: roster(nPlayers), seed: engineSeed, matchId: 'soak' }), {
    type: 'MATCH_START',
    at: 1,
  }).state;
  s = apply(s, { type: 'BEGIN_TURNS', at: 2 }).state;
  let now = 2;
  let steps = 0;
  const rejections: string[] = [];
  const reveals: DriveResult['reveals'] = [];

  const step = (ev: Parameters<typeof apply>[1]) => {
    const r = apply(s, ev);
    if (r.err) rejections.push(`${ev.type}:${r.err.code}`);
    for (const e of r.effects) {
      if (e.kind === 'REVEALED') {
        // Table card is read from the PRE-event state (the round being judged):
        reveals.push({
          verdict: e.verdict,
          table: s.round!.tableCard,
          cards: e.cards.map((c) => c.rank),
        });
      }
    }
    s = r.state;
  };

  while (s.phase !== 'GAME_END' && steps++ < 6000) {
    switch (s.phase) {
      case 'ROUND_NEW':
        step({ type: 'BEGIN_TURNS', at: ++now });
        break;
      case 'REVEAL':
        step({ type: 'REVEAL_ACK', at: ++now });
        break;
      case 'SHOT':
        step({ type: 'SHOT_ACK', at: ++now });
        break;
      case 'ROUND_END':
        step({ type: 'NEXT_ROUND', at: ++now });
        break;
      case 'TURN': {
        const seat = s.turn!.seat;
        const p = s.players.find((x) => x.seat === seat)!;
        // Liveliness churn: transient disconnects always reconnect before any
        // timeout could be forced — the drunk-seat edge lives in timeout tests.
        if (p.disconnectedAt !== undefined) {
          step({ type: 'RECONNECT', seat, at: ++now });
        }
        if (my.int(0, 24) === 0) {
          const victim = s.players.find(
            (x) => x.alive && x.seat !== seat && x.disconnectedAt === undefined,
          );
          if (victim) step({ type: 'DISCONNECT', seat: victim.seat, at: ++now });
          const comeback = s.players.find(
            (x) => x.alive && x.disconnectedAt !== undefined && x.seat !== s.turn?.seat,
          );
          if (comeback) step({ type: 'RECONNECT', seat: comeback.seat, at: ++now });
        }
        const pileEmpty = s.round!.pile.length === 0;
        const roll = my.int(0, 9);
        if (roll <= 5) {
          const count = Math.min(3, Math.max(1, my.int(1, 3)));
          const at = Math.min(s.turn!.deadline - 1, now + my.int(1, 5_000));
          step({ type: 'PLAY', seat, cardIds: handOf(s, seat).slice(0, count), at });
          now = Math.max(now, at);
        } else if (
          roll <= 7 &&
          !pileEmpty &&
          challengeModeFor(s.config, aliveCount(s)) === 'next-only'
        ) {
          step({ type: 'LIAR', seat, at: Math.min(s.turn!.deadline - 1, ++now) });
        } else {
          step({ type: 'TURN_TIMEOUT', seat, at: s.turn!.deadline + my.int(0, 4) });
          now++;
        }
        break;
      }
      case 'WINDOW': {
        const w = s.round!.window!;
        const seat = s.turn!.seat;
        const roll = my.int(0, 9);
        const eligible = s.players.filter(
          (x) =>
            x.alive && !x.abandoned && x.disconnectedAt === undefined && x.seat !== w.accusedSeat,
        );
        if (roll <= 2 && eligible.length > 0) {
          const challenger = my.pick(eligible);
          const at = Math.max(Math.min(w.armedAt + my.int(0, 8_000), w.closesAt), now + 1);
          step({ type: 'LIAR', seat: challenger.seat, at });
          now = Math.max(now, at);
        } else if (roll <= 6) {
          const at = Math.max(
            Math.min(w.openedAt + my.int(1, 9_000), Math.min(w.closesAt - 1, s.turn!.deadline - 1)),
            now + 1,
          );
          const count = Math.min(3, Math.max(1, my.int(1, 3)));
          step({ type: 'PLAY', seat, cardIds: handOf(s, seat).slice(0, count), at });
          now = Math.max(now, at);
        } else {
          step({ type: 'WINDOW_EXPIRE', at: Math.max(w.closesAt, ++now) });
        }
        break;
      }
      default:
        throw new Error(`soak: unexpected phase ${s.phase}`);
    }
  }

  return { s, steps, rejections, reveals };
}

describe('Soak: randomized full matches across 2/3/4/5/7/10 players', () => {
  it('every one of 150 fuzz matches ends cleanly with all invariants intact', () => {
    const sizes = [2, 3, 4, 5, 7, 10] as const;
    for (let seed = 0; seed < 150; seed++) {
      const n = sizes[seed % sizes.length];
      const { s, steps, rejections, reveals } = driveMatch(n, seed);
      expect(rejections, `seed ${seed} (${n}p)`).toEqual([]); // driver is legal-by-construction
      expect(s.phase, `seed ${seed} (${n}p) steps=${steps}`).toBe('GAME_END');
      expect(s.matchRecord, `seed ${seed}`).not.toBeNull();
      expect(s.aborted, `seed ${seed}`).toBe(false); // no leaves/abandons in the soak
      expect(reveals, `seed ${seed}`).not.toHaveLength(0);

      // 1) verdicts always match the reveal contents vs the round's table card:
      for (const rv of reveals) {
        const lied = rv.cards.some((r) => r !== rv.table && r !== 'JOKER');
        expect(rv.verdict === 'LIE', `seed ${seed}`).toBe(lied);
      }

      const record = s.matchRecord!;
      const alive = s.players.filter((p) => p.alive);
      const dead = s.players.filter((p) => !p.alive);

      // 2) last-alive win, exactly one winner:
      expect(alive).toHaveLength(1);
      expect(s.winnerSeat).toBe(alive[0].seat);
      expect(record.winnerSeat).toBe(alive[0].seat);
      expect(dead).toHaveLength(n - 1);

      // 3) one roulette per round, always:
      expect(record.summary.rounds).toBe(s.completedRounds);
      expect(record.summary.totalPulls).toBe(s.completedRounds);
      expect(record.summary.totalPulls).toBe(s.players.reduce((sum, p) => sum + p.pulls, 0));

      // 4) revolver law: death exactly at bulletPos; survivors under 6 pulls:
      for (const p of dead) {
        expect(p.pulls, `seed ${seed} seat ${p.seat}`).toBe(p.bulletPos);
        expect(p.stats.deaths).toBe(1);
        expect(p.stats.pullsSurvived).toBe(p.pulls - 1);
      }
      for (const p of alive) {
        expect(p.pulls, `seed ${seed} seat ${p.seat}`).toBeLessThan(6);
        expect(p.stats.pullsSurvived).toBe(p.pulls);
        expect(p.stats.roundsPlayed).toBe(s.completedRounds);
        expect(p.stats.won).toBe(p.seat === s.winnerSeat);
        expect(p.stats.xpEarned).toBe(12);
      }
      for (const p of dead) expect(p.stats.xpEarned).toBe(4);

      // 5) coin math: +1 per survived round for everyone; winner additionally rolls 2..7:
      for (const p of s.players) {
        if (p.stats.won) {
          expect(
            p.stats.coinsEarned - p.stats.roundsSurvived,
            `seed ${seed}`,
          ).toBeGreaterThanOrEqual(2);
          expect(p.stats.coinsEarned - p.stats.roundsSurvived, `seed ${seed}`).toBeLessThanOrEqual(
            7,
          );
        } else {
          expect(p.stats.coinsEarned, `seed ${seed}`).toBe(p.stats.roundsSurvived);
        }
      }

      // 6) roundsSurvived ≤ roundsPlayed ≤ completedRounds:
      for (const p of s.players) {
        expect(p.stats.roundsSurvived).toBeLessThanOrEqual(p.stats.roundsPlayed);
        expect(p.stats.roundsPlayed).toBeLessThanOrEqual(s.completedRounds);
      }

      // 7) the log is a strictly monotonic append-only replay input:
      for (let i = 0; i < s.log.length; i++) expect(s.log[i].seq).toBe(i + 1);

      // 8) daredevil bookkeeping: exactly the players who survived pull #5:
      expect(record.summary.dareDevilMoments).toBe(s.dareDevilMoments);
      expect(s.dareDevilMoments).toBe(
        s.players.reduce((sum, p) => sum + (p.stats.pullsSurvived === 5 ? 1 : 0), 0),
      );
    }
  });

  it('containsLie equals the engine verdict semantics used in 1)', () => {
    expect(containsLie([{ id: 'a', rank: 'K' }], 'K')).toBe(false);
    expect(
      containsLie(
        [
          { id: 'a', rank: 'K' },
          { id: 'b', rank: 'JOKER' },
        ],
        'Q',
      ),
    ).toBe(true); // K is off-table on Q
    expect(
      containsLie(
        [
          { id: 'a', rank: 'Q' },
          { id: 'b', rank: 'JOKER' },
        ],
        'Q',
      ),
    ).toBe(false);
    expect(containsLie([{ id: 'a', rank: 'K' }], 'Q')).toBe(true);
  });
});
