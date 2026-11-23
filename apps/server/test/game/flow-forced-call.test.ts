/**
 * FLOW (b) — forced-call in 2p when a player has no legal play (STR/01 §8):
 * the instant only ONE player still holds cards, the ENGINE itself issues the
 * auto-LIAR on the last play (challenger = the single holder). The sequence
 * is driven entirely through the fake sockets (full router path):
 *
 *   dumper: plays 3, then dumps the remaining 2  → hand empty ("no legal play")
 *   holder: always plays exactly one card        → still holding (the challenger)
 *
 * Trips asserted:
 *   - the forced resolution fires SAME-TICK with the emptying play: the wire
 *     shows play:accept IMMEDIATELY followed by reveal:show — and the event
 *     log contains NO client LIAR at all (the challenge cannot have come
 *     from a client);
 *   - the empty-handed player's leftovers are dead: off-turn is
 *     ERR_NOT_YOUR_TURN, stale card ids are ERR_NOT_OWNED_CARD — rejected
 *     events never mutate the pile;
 *   - after resolution the table keeps moving: BLANK roulette → round 2
 *     re-deals both players.
 *
 * bulletPos is pinned to 6 (white-box, server-internal — never on the wire)
 * so pull #1 is a guaranteed BLANK and the round completes.
 */
import { describe, expect, it } from 'vitest';
import { FAST_MATCH_CONFIG, FAST_TIMING, TestEnv, bootMatch, waitFor, waitForHandsAndTurn } from './helpers.js';

const FORCED_CONFIG = { ...FAST_MATCH_CONFIG, turnTimerMsOverride: 2_000 };

interface WireCard {
  id: string;
  rank: string;
}

async function errCodeOf(
  socket: import('./helpers.js').FakeSocket,
  event: string,
  payload: unknown,
): Promise<string> {
  const res = await socket.client(event, payload);
  if (res?.ok) throw new Error(`expected rejection for ${event}, got ok`);
  return (res?.error as { code: string }).code;
}

describe('FLOW forced-call (2p): engine-issued LIAR when a player can no longer play', () => {
  it('holder==1 → the engine auto-calls on the last play; no client LIAR exists in the log', async () => {
    const env = new TestEnv({ matchConfig: FORCED_CONFIG, timing: FAST_TIMING });
    const { code, sockets } = await bootMatch(env, 2, {
      start: true,
      capacity: 2,
      drivers: false,
    });
    const firstHolder = await waitForHandsAndTurn(env, sockets);

    const room = env.manager.roomByCode(code)!;
    for (const p of room.match!.engineState.players) p.bulletPos = 6; // pull #1 = BLANK

    const dumper = firstHolder;
    const holder = 1 - dumper;

    const dumperHand = sockets[dumper]!.last('hand:deal')!['cards'] as WireCard[];
    const holderHand = sockets[holder]!.last('hand:deal')!['cards'] as WireCard[];
    expect(dumperHand.length).toBe(5);
    expect(holderHand.length).toBe(5);

    // — dumper's turn #1: throw 3 cards (5 → 2 left) —
    const dump1 = await sockets[dumper]!.client('play:cards', {
      cardIds: dumperHand.slice(0, 3).map((c) => c.id),
    });
    expect(dump1?.ok).toBe(true);

    // holder's turn arrived; the soon-empty dumper pokes from off-turn:
    const turnTwo = await waitFor(
      () => (sockets[holder]!.last('turn:begin')?.['seat'] ?? -1) === holder,
      5_000,
      2,
    );
    expect(turnTwo).toBe(true);
    expect(await errCodeOf(sockets[dumper]!, 'play:cards', { cardIds: [dumperHand[0]!.id] })).toBe(
      'ERR_NOT_YOUR_TURN',
    );

    // — holder plays exactly one —
    const hold1 = await sockets[holder]!.client('play:cards', { cardIds: [holderHand[0]!.id] });
    expect(hold1?.ok).toBe(true);

    // — dumper's turn #2: a stale (already-played) id is not theirs anymore —
    const turnThree = await waitFor(
      () => (sockets[dumper]!.last('turn:begin')?.['seat'] ?? -1) === dumper,
      5_000,
      2,
    );
    expect(turnThree).toBe(true);
    expect(await errCodeOf(sockets[dumper]!, 'play:cards', { cardIds: [dumperHand[0]!.id] })).toBe(
      'ERR_NOT_OWNED_CARD',
    );
    expect(room.match!.engineState.round!.pile.length).toBe(2); // rejects mutated nothing

    // — the dump: dumper empties their hand (2 → 0) → holders==1 → FORCED call —
    const dumpedIds = [dumperHand[3]!.id, dumperHand[4]!.id];
    const dump2 = await sockets[dumper]!.client('play:cards', { cardIds: dumpedIds });
    expect(dump2?.ok).toBe(true);

    const match = room.match!;
    const state = match.engineState;
    const res = state.round!.resolution!;
    expect(res.forced).toBe(true); // ENGINE-issued (R29 / STR/01 §8)
    expect(res.challengerSeat).toBe(holder); // the single remaining holder
    expect(res.accusedSeat).toBe(dumper); //   charged with the emptying play
    expect(state.players.find((p) => p.seat === dumper)!.hand).toHaveLength(0);

    // No client LIAR ever reached the engine — the challenge was engine-forced.
    expect(match.engineState.log.some((l) => l.event.type === 'LIAR')).toBe(false);

    // Same-tick wire order: the emptying play:accept is IMMEDIATELY followed
    // by reveal:show — no turn:begin for the holder in between (there was no
    // turn to hand over; the engine consumed it with the challenge).
    const stream = sockets[holder]!.emissions;
    const playIdx = stream.findIndex(
      (e) => e.event === 'play:accept' && e.payload['seat'] === dumper && e.payload['count'] === 2,
    );
    expect(playIdx).toBeGreaterThanOrEqual(0);
    expect(stream[playIdx + 1]!.event).toBe('reveal:show');
    const reveal = stream[playIdx + 1]!.payload;
    expect((reveal['cards'] as { id: string }[]).map((c) => c.id)).toEqual(dumpedIds);
    expect(stream[playIdx + 2]!.event).toBe('shot:assign');

    // The empty hand has no legal play left at all: rejects keep bouncing.
    expect(await errCodeOf(sockets[dumper]!, 'play:cards', { cardIds: [dumpedIds[0]!] })).toBe(
      'ERR_WRONG_PHASE',
    );

    // BLANK roulette → the round completes and the table re-deals both seats.
    const redealt = await waitFor(
      () =>
        sockets.every((s) => s.received('round:new').length >= 2 && s.received('hand:deal').length >= 2),
      5_000,
      5,
    );
    expect(redealt).toBe(true);
    expect(match.isOver).toBe(false); // a completed forced resolution is NOT game over
    expect(res.outcome).toBe('BLANK');
  }, 25_000);
});
