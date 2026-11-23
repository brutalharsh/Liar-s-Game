import { describe, expect, it } from 'vitest';
import { apply, createMatch } from '../src/engine';
import { replay, stripRuntime } from '../src/replay';
import type { Effect, GameEvent, GameState } from '../src/types';
import { roster, T0 } from './helpers';

const handOf = (s: GameState, seat: number): string[] =>
  s.players.find((p) => p.seat === seat)!.hand.map((c) => c.id);

/**
 * Event-pure scripted match (NO white-box overrides — everything must derive
 * from (seed, events)). Includes intentional rejections so replay parity covers
 * rejected events too. Returns the final state + all effects.
 */
function driveEventPure(seed: number) {
  let s = apply(
    createMatch({ roster: roster(3), seed, matchId: 'm-replay' }),
    { type: 'MATCH_START', at: T0 },
  ).state;
  s = apply(s, { type: 'BEGIN_TURNS', at: T0 + 1 }).state;
  const effects: Effect[] = [];
  const errors: string[] = [];
  const push = (r: { state: GameState; effects: Effect[]; err?: { code: string } }) => {
    effects.push(...r.effects);
    if (r.err) errors.push(r.err.code);
    s = r.state;
  };
  let now = T0 + 2;
  let steps = 0;
  while (s.phase !== 'GAME_END' && steps++ < 500) {
    switch (s.phase) {
      case 'ROUND_NEW':
        push(apply(s, { type: 'BEGIN_TURNS', at: ++now }));
        break;
      case 'REVEAL':
        push(apply(s, { type: 'REVEAL_ACK', at: ++now }));
        break;
      case 'SHOT':
        push(apply(s, { type: 'SHOT_ACK', at: ++now }));
        break;
      case 'ROUND_END':
        push(apply(s, { type: 'NEXT_ROUND', at: ++now }));
        break;
      case 'TURN':
      case 'WINDOW': {
        const seat = s.turn!.seat;
        const roll = steps % 7;
        if (roll === 0 && s.phase === 'TURN' && s.round!.pile.length > 0) {
          // deliberate ILLEGAL call every so often (window closed / no window): recorded as rejected
          const nonHolder = s.players.find((p) => p.alive && p.seat !== seat)!;
          push(apply(s, { type: 'LIAR', seat: nonHolder.seat, at: ++now }));
        } else if (roll === 1) {
          // timeout at the legal clock
          const at = Math.max(s.turn!.deadline, now) + 1;
          push(apply(s, { type: 'TURN_TIMEOUT', seat, at }));
          now = at;
        } else if (roll === 2 && s.round!.pile.length > 0 && s.phase === 'TURN') {
          // the turn-holder challenges the previous play (next-only table = 3p)
          push(apply(s, { type: 'LIAR', seat, at: ++now }));
        } else if (s.phase === 'WINDOW') {
          // let the window expire (belief) at its clock:
          const at = Math.max(s.round!.window!.closesAt, now + 1);
          push(apply(s, { type: 'WINDOW_EXPIRE', at }));
          now = at;
        } else {
          // play cards: 1..3 of the holder's hand
          const ids = handOf(s, seat);
          const count = Math.min(ids.length, 1 + (steps % 3));
          push(apply(s, { type: 'PLAY', seat, cardIds: ids.slice(0, count), at: ++now }));
          // occasional deliberate rejection too (foreign card id):
          if (steps % 11 === 0) {
            push(apply(s, { type: 'PLAY', seat, cardIds: ['ghost-card'], at: ++now }));
          }
        }
        break;
      }
      default:
        throw new Error(`driver: unexpected phase ${(s as GameState).phase}`);
    }
  }

  if (s.phase !== 'GAME_END') throw new Error(`match never ended (phase ${s.phase}) after 500 steps`);
  return { s, effects, errors };
}

describe('Deterministic replay (mission: re-run a match from (seed, events[]))', () => {
  it('replay({seed, log}) reproduces the exact final state, effects and rejections', () => {
    const seed = 77_001;
    const run = driveEventPure(seed);
    const final = run.s;

    expect(final.phase).toBe('GAME_END');
    expect(final.matchRecord).not.toBeNull();
    expect(run.errors).toContain('ERR_NOT_YOUR_TURN'); // our deliberate rejections happened
    expect(run.errors).toContain('ERR_NOT_OWNED_CARD');

    const rp = replay({
      roster: roster(3),
      matchId: 'm-replay',
      seed,
      events: final.log,
    });
    expect(stripRuntime(rp.state)).toEqual(stripRuntime(final)); // bit-exact reproduction
    expect(rp.effects).toEqual(run.effects);                     // identical broadcast stream
    expect(rp.rejected.map((e) => e.code)).toEqual(run.errors);  // identical rejection sequence
  });

  it('replay is repeatable: two replays produce identical states', () => {
    const seed = 77_002;
    const run = driveEventPure(seed);
    const a = replay({ roster: roster(3), matchId: 'm-replay', seed, events: run.s.log });
    const b = replay({ roster: roster(3), matchId: 'm-replay', seed, events: run.s.log });
    expect(stripRuntime(a.state)).toEqual(stripRuntime(b.state));
  });

  it('a different seed diverges (the seed is load-bearing)', () => {
    const seed = 77_003;
    const run = driveEventPure(seed);
    const other = replay({ roster: roster(3), matchId: 'm-replay', seed: seed + 1, events: run.s.log });
    expect(JSON.stringify(stripRuntime(other.state))).not.toEqual(JSON.stringify(stripRuntime(run.s)));
  });

  it('replay accepts plain GameEvent[] (not just LogEntry[])', () => {
    const seed = 77_004;
    const run = driveEventPure(seed);
    const events: GameEvent[] = run.s.log.map((e) => e.event);
    const rp = replay({ roster: roster(3), matchId: 'm-replay', seed, events });
    expect(stripRuntime(rp.state)).toEqual(stripRuntime(run.s));
  });

  it('replayed matches satisfy the one-roulette-per-round law identically', () => {
    const seed = 77_005;
    const run = driveEventPure(seed);
    const rp = replay({ roster: roster(3), matchId: 'm-replay', seed, events: run.s.log });
    const shotThis = rp.effects.filter((e) => e.kind === 'SHOT_RESULT').length;
    expect(shotThis).toBe(run.s.completedRounds);
    expect(shotThis).toBe(run.s.matchRecord!.summary.totalPulls);
  });

  it('empty replay (no events) equals a fresh lobby state', () => {
    const seed = 77_006;
    const fresh = createMatch({ roster: roster(2), seed, matchId: 'x' });
    const rp = replay({ roster: roster(2), matchId: 'x', seed, events: [] });
    expect(stripRuntime(rp.state)).toEqual(stripRuntime(fresh));
  });
});
