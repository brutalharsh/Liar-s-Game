/**
 * FLOW (d) — spectator-only room: when every seated human leaves (grace
 * expiry in the lobby frees their seats), the room survives on spectators
 * alone: NO spectator is ever seated, the spectator walls hold, and
 * `game:start` is rejected INSUFFICIENT_PLAYERS until two humans sit again.
 * As soon as a second human DOES sit, the match starts — and the spectator
 * stays a spectator exactly as before (STR/08 §1: no private data reach).
 */
import { describe, expect, it } from 'vitest';
import { FAST_MATCH_CONFIG, FAST_TIMING, TestEnv, bootMatch, createRoom, joinRoom, waitFor, waitForHandsAndTurn } from './helpers.js';

async function errCodeOf(
  socket: import('./helpers.js').FakeSocket,
  event: string,
  payload: unknown,
): Promise<string> {
  const res = await socket.client(event, payload);
  if (res?.ok) throw new Error(`expected rejection for ${event}, got ok`);
  return (res?.error as { code: string }).code;
}

describe('FLOW spectator-only room: seats empty out, walls hold, INSUFFICIENT_PLAYERS gate', () => {
  it('both humans drop → seats free → game:start INSUFFICIENT_PLAYERS; spectator never in seats', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const alice = env.socket(env.user('alice'));
    const code = await createRoom(env, alice, { capacity: 2, visibility: 'private' });
    const bob = env.socket(env.user('bob'));
    const bobJoin = await joinRoom(env, bob, code);
    expect(bobJoin.yourSeat).toBe(1);

    // full room → sam becomes a spectator and sees the spectator's snapshot.
    const sam = env.socket(env.user('sam'));
    const samJoin = await joinRoom(env, sam, code);
    expect(samJoin.spectator).toBe(true);
    expect(samJoin.yourSeat).toBeNull();
    const snap = sam.last('lobby:state') as {
      spectator: boolean;
      you: unknown;
      seats: { nickname: string | null }[];
    };
    expect(snap.spectator).toBe(true);
    expect(snap.you).toBeNull();
    // the spectator is NOWHERE in the seats array (their nickname never lands)
    for (const seat of snap.seats) {
      expect(seat.nickname?.startsWith('Nick-sam')).toBe(false);
    }
    expect(env.manager.roomByCode(code)!.seatsTaken()).toBe(2);

    // — spectator walls in the lobby —
    expect(await errCodeOf(sam, 'play:cards', { cardIds: ['K1'] })).toBe('NOT_IN_ROOM');
    expect(await errCodeOf(sam, 'liar:call', { accusedSeat: 0 })).toBe('NOT_IN_ROOM');
    expect(await errCodeOf(sam, 'game:start', {})).toBe('NOT_HOST');
    expect(await errCodeOf(sam, 'emote:send', { emoteId: 'laugh' })).toBe('ILLEGAL_MOVE');

    // — both humans drop; lobby grace empties the seats (room = spectators only) —
    alice.disconnect();
    env.detach(alice);
    bob.disconnect();
    env.detach(bob);
    const emptied = await waitFor(
      () => env.manager.roomByCode(code)?.seatsTaken() === 0,
      4_000,
      5,
    );
    expect(emptied).toBe(true);

    // the room survived on the spectator alone; sam's binding is untouched.
    const room = env.manager.roomByCode(code)!;
    expect(room).not.toBeNull();
    expect(room.findSocket(sam.id)).toEqual({ roomSeat: -1, spectator: true });
    const empties = sam.last('lobby:state') as { seats: ({ nickname: string | null })[] };
    expect(empties.seats).toHaveLength(2);
    for (const seat of empties.seats) expect(seat.nickname).toBeNull();

    // the lone returning human is seated fresh (reconnected:false — the seat
    // was genuinely released) and cannot start a 1-player match.
    const alice2 = env.socket(env.user('alice'));
    const rejoin = await joinRoom(env, alice2, code);
    expect(rejoin.spectator).toBe(false);
    expect(rejoin.yourSeat).toBe(0);
    expect(rejoin.reconnected).toBe(false);
    const start = await alice2.client('game:start', {});
    expect((start?.error as { code: string }).code).toBe('INSUFFICIENT_PLAYERS');
    expect(room.match).toBeNull(); // lobby intact — nothing spun up
    expect(await errCodeOf(sam, 'game:start', {})).toBe('NOT_HOST'); // spectator still walled

    // a second human seats → the match CAN start, and sam spectates it.
    const dana = env.socket(env.user('dana'));
    const danaJoin = await joinRoom(env, dana, code);
    expect(danaJoin.spectator).toBe(false);
    expect(danaJoin.yourSeat).toBe(1);
    const go = await alice2.client('game:start', {});
    expect(go?.ok).toBe(true);

    const handsToTwo = await waitFor(
      () => alice2.received('hand:deal').length > 0 && dana.received('hand:deal').length > 0,
      5_000,
      5,
    );
    expect(handsToTwo).toBe(true);
    // spectator of a LIVE match: still never in seats, still zero private data.
    expect(sam.received('hand:deal')).toHaveLength(0);
    const liveSnap = sam.last('lobby:state') as { spectator: boolean; you: unknown };
    expect(liveSnap.spectator).toBe(true);
    expect(liveSnap.you).toBeNull();
    expect(await errCodeOf(sam, 'play:cards', { cardIds: ['K1'] })).toBe('NOT_IN_ROOM');
    // sanity: the two humans really can act (the witness route is healthy)
    const seat = await waitForHandsAndTurn(env, [alice2, dana]);
    const hand = [alice2, dana][seat]!.last('hand:deal')!['cards'] as { id: string }[];
    const played = await [alice2, dana][seat]!.client('play:cards', { cardIds: [hand[0]!.id] });
    expect(played?.ok).toBe(true);
    expect(sam.received('play:accept').length).toBe(1); // spectator SEES, never ACTS
  }, 25_000);
});
