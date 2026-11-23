/**
 * FLOW (e) — abandonment path (STR/01 §9 / STR/03 §3): transport drops hold a
 * seat through the engine's grace; the FIRST grace expiry ABANDONs the seat
 * and (below 2 present-alive) aborts the match. Two terminal shapes:
 *
 *  e1 win-by-default: the EARLIER dropper is abandoned first; the LATER
 *     dropper — still "present" (disconnected ≠ abandoned) — wins by default.
 *     The seam fires ONCE with a 0-round record: no roulette ever resolved,
 *     summary.rounds 0, abandoned xp 0, survivor xp 12. A spectator (the only
 *     socket still standing) witnesses the whole game:over on the wire.
 *
 *  e2 zero-winner "where rules dictate": both seats drop DURING a pending
 *     reveal/shot (interpretation ⑧ defers the abort to the resolution) and
 *     both grace clocks expire inside the deferral; the BLANK roulette leaves
 *     both alive-but-abandoned → presentAlivePlayers == 0 at SHOT_ACK →
 *     finishMatch(null) → game:over winnerSeat NULL on the wire (the shared
 *     schema carries the nullable winner path).
 *
 * bulletPos pinned to 6 in e2 (server-internal white-box, never on the wire)
 * so the deferred pull is a guaranteed BLANK — the zero-winner branches on
 * "all alive players abandoned", which a death would bypass.
 */
import { describe, expect, it } from 'vitest';
import { parseServerEvent } from '@liars-game/shared';
import {
  FAST_MATCH_CONFIG,
  FAST_TIMING,
  TestEnv,
  bootMatch,
  joinRoom,
  waitFor,
  waitForHandsAndTurn,
} from './helpers.js';

interface WireCard {
  id: string;
  rank: string;
}

function spectatorOn(env: TestEnv, code: string, userId: string): Promise<import('./helpers.js').FakeSocket> {
  return (async () => {
    const sock = env.socket(env.user(userId));
    const joined = await joinRoom(env, sock, code);
    expect(joined.spectator).toBe(true);
    return sock;
  })();
}

describe('FLOW abandonment: grace expiry → abort → win-by-default OR zero-winner', () => {
  it('e1 both drop mid-turn: earlier dropper abandoned first, later dropper wins by default, 0-round record', async () => {
    const env = new TestEnv({
      matchConfig: { ...FAST_MATCH_CONFIG, disconnectGraceMs: 300 },
      timing: FAST_TIMING,
    });
    const { code, sockets } = await bootMatch(env, 2, { start: true, capacity: 2, drivers: false });
    const sam = await spectatorOn(env, code, 'sam');

    const seat = await waitForHandsAndTurn(env, sockets);
    const firstDropper = seat;
    const survivor = 1 - firstDropper;

    // preserve an old-style snapshot of the pre-abandon room
    const seqBefore = env.manager.roomByCode(code)!.seq;

    sockets[firstDropper]!.disconnect();
    env.detach(sockets[firstDropper]!);
    await new Promise((r) => setTimeout(r, 120)); // ordering margin between drops
    sockets[survivor]!.disconnect();
    env.detach(sockets[survivor]!);

    const over = await waitFor(
      () => env.manager.roomByCode(code)?.match?.isOver ?? false,
      6_000,
      10,
    );
    expect(over).toBe(true);

    const match = env.manager.roomByCode(code)!.match!;
    const record = match.engineState.matchRecord!;
    expect(record.aborted).toBe(true);
    expect(record.winnerSeat).toBe(survivor);
    expect(record.summary.rounds).toBe(0); // ← the 0-round record
    expect(record.summary.totalPulls).toBe(0); // no roulette ever fired
    expect(record.players).toHaveLength(2);

    // stats: survivor won by default (full win credit), abandoner got nothing.
    const survivorStats = record.players.find((p) => p.seat === survivor)!.stats;
    const abandonerStats = record.players.find((p) => p.seat === firstDropper)!.stats;
    expect(survivorStats.won).toBe(true);
    expect(survivorStats.xpEarned).toBe(12);
    expect(abandonerStats.won).toBe(false);
    expect(abandonerStats.xpEarned).toBe(0); // left mid-match: no completion credit

    // engine seat truth: abandoned flag set on the earlier dropper only.
    expect(match.engineState.players.find((p) => p.seat === firstDropper)!.abandoned).toBe(true);

    // the seam fired EXACTLY once, carrying the same 0-round record.
    expect(env.matchEnds.length).toBe(1);
    const end = env.matchEnds[0]!;
    expect(end.record).toEqual(record);
    expect(end.record.aborted).toBe(true);
    expect(end.log.length).toBeGreaterThan(0);
    expect(end.seed).toBeGreaterThan(0);
    expect(end.endedAt instanceof Date).toBe(true);

    // the spectator (only live socket) witnessed game:over, strict-schema clean.
    const gameOver = sam.received('game:over')[0]!;
    expect(gameOver['winnerSeat']).toBe(survivor);
    expect(() => parseServerEvent('game:over', gameOver as never)).not.toThrow();
    const rewards = gameOver['rewards'] as { seat: number; xp: number }[];
    expect(rewards.find((r) => r.seat === survivor)!.xp).toBe(12);
    expect(rewards.find((r) => r.seat === firstDropper)!.xp).toBe(0);

    // the room stepwise state never regressed: seq only moved forward.
    expect(env.manager.roomByCode(code)!.seq).toBeGreaterThanOrEqual(seqBefore);
    void sockets;
  }, 25_000);

  it('e2 both abandoned during the deferred reveal: finishMatch(null) → game:over winnerSeat NULL on the wire', async () => {
    const env = new TestEnv({
      matchConfig: { ...FAST_MATCH_CONFIG, disconnectGraceMs: 250, turnTimerMsOverride: 2_000 },
      timing: { ...FAST_TIMING, revealAckMs: 700, shotAckMs: 700 },
    });
    const { code, sockets } = await bootMatch(env, 2, { start: true, capacity: 2, drivers: false });
    const sam = await spectatorOn(env, code, 'sam2');

    const seat = await waitForHandsAndTurn(env, sockets);
    const other = 1 - seat;
    const room = env.manager.roomByCode(code)!;
    for (const p of room.match!.engineState.players) p.bulletPos = 6; // deferred pull = BLANK

    // open a challenge so a reveal + shot are mid-flight when both drop
    const hand = sockets[seat]!.last('hand:deal')!['cards'] as WireCard[];
    const played = await sockets[seat]!.client('play:cards', { cardIds: [hand[0]!.id] });
    expect(played?.ok).toBe(true);
    const called = await sockets[other]!.client('liar:call', { accusedSeat: seat });
    expect(called?.ok).toBe(true);
    expect(room.match!.engineState.phase).toBe('REVEAL'); // deferral window open

    // both drop WITHIN the deferral: abandons land while the abort watch is paused
    sockets[seat]!.disconnect();
    env.detach(sockets[seat]!);
    sockets[other]!.disconnect();
    env.detach(sockets[other]!);

    // both grace clocks expire inside REVEAL/SHOT (250ms ≪ 700ms pacing) →
    // the resolution completes, SHOT_ACK finds ZERO present-alive → no winner.
    const over = await waitFor(
      () => env.manager.roomByCode(code)?.match?.isOver ?? false,
      8_000,
      10,
    );
    expect(over).toBe(true);

    const match = room.match!;
    const record = match.engineState.matchRecord!;
    expect(record.aborted).toBe(true);
    expect(record.winnerSeat).toBeNull(); // the zero-winner path
    expect(record.summary.rounds).toBe(1); // the round DID complete (bullet pulled)
    expect(record.summary.totalPulls).toBe(1);
    expect(record.players.every((p) => p.stats.won === false)).toBe(true);
    expect(match.engineState.players.every((p) => p.alive && p.abandoned)).toBe(true);

    expect(env.matchEnds.length).toBe(1);
    expect(env.matchEnds[0]!.record.winnerSeat).toBeNull();

    // the WIRE shape: winnerSeat null parses against the shared schema.
    const gameOver = sam.received('game:over')[0]!;
    expect(gameOver['winnerSeat']).toBeNull();
    expect(() => parseServerEvent('game:over', gameOver as never)).not.toThrow();
    // the deferred resolution fully reached the spectator…
    expect(sam.received('reveal:show')).toHaveLength(1);
    expect(sam.received('shot:assign')).toHaveLength(1);
    expect(sam.received('shot:result')).toHaveLength(1);
    expect(sam.received('shot:result')[0]!['outcome']).toBe('BLANK');
    expect(sam.received('hand:deal')).toHaveLength(0); // …but never a private deal
  }, 25_000);
});
