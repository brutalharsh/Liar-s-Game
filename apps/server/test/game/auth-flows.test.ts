/**
 * Router hardening: AUTH_REQUIRED, strict zod rejections, host/seat/role
 * guards, ghost-lounge enforcement (dead seats receive but only emote),
 * spectator walls, emote relay semantics, TTS no-op.
 */
import { describe, expect, it } from 'vitest';
import {
  EMOTE_CATALOG,
} from '../../src/game/rooms.js';
import {
  FAST_MATCH_CONFIG,
  FAST_TIMING,
  TestEnv,
  bootMatch,
  joinRoom,
  waitFor,
  waitForHandsAndTurn,
} from './helpers.js';

async function errorCode(socket: import('./helpers.js').FakeSocket, event: string, payload: unknown): Promise<string> {
  const res = await socket.client(event, payload);
  if (res?.ok) throw new Error(`expected failure for ${event}, got ok`);
  return (res?.error as { code: string }).code;
}

describe('auth gate (STR/07 §0: login REQUIRED to play)', () => {
  it('unauthenticated sockets bounce AUTH_REQUIRED on every play event', async () => {
    const env = new TestEnv();
    const anon = env.socket(null);
    const attempts: [string, unknown][] = [
      ['room:create', { name: 'X', capacity: 2, theme: 'saloon', visibility: 'private' }],
      ['room:join', { code: 'AAAAA' }],
      ['room:leave', {}],
      ['game:start', {}],
      ['play:cards', { cardIds: ['K1'] }],
      ['liar:call', { accusedSeat: 0 }],
      ['emote:send', { emoteId: 'laugh' }],
      ['profile:tts-say', { phraseId: 'liar' }],
    ];
    for (const [event, payload] of attempts) {
      const res = await anon.client(event, payload);
      expect(res?.ok).toBe(false);
      expect((res?.error as { code: string }).code).toBe('AUTH_REQUIRED');
    }
    const errors = anon.received('error');
    expect(errors.length).toBeGreaterThanOrEqual(attempts.length);
    for (const e of errors) {
      expect(e['code']).toBe('AUTH_REQUIRED');
      expect(e['eventRef']).toBeTruthy();
      expect(e['message']).toBeTruthy();
    }
  });

  it('the error payloads parse safely — no state leaked in messages', async () => {
    const env = new TestEnv();
    const anon = env.socket(null);
    await anon.client('room:create', { name: 'X', capacity: 2, theme: 'saloon', visibility: 'private' });
    const error = anon.last('error')!;
    const msg = error['message'] as string;
    expect(msg.length).toBeLessThanOrEqual(280);
    expect(msg).not.toMatch(/[{}[\]]/); // no serialized state in messages
  });
});

describe('zod validation (shared strict schemas reject junk)', () => {
  it('play:cards rejects 4 cards, duplicates, non-arrays, and extra fields', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets } = await bootMatch(env, 2, { start: true, drivers: false });
    const turnSeat = await waitForHandsAndTurn(env, sockets);
    const holder = sockets[turnSeat]!;
    const hand = holder.last('hand:deal')!['cards'] as { id: string }[];
    expect(await errorCode(holder, 'play:cards', { cardIds: [...hand.map((c) => c.id), 'ZZ9'].slice(0, 4) })).toBe('VALIDATION');
    expect(await errorCode(holder, 'play:cards', { cardIds: [hand[0]!.id, hand[0]!.id] })).toBe('VALIDATION');
    expect(await errorCode(holder, 'play:cards', { cardIds: 'K1' })).toBe('VALIDATION');
    expect(await errorCode(holder, 'play:cards', { cardIds: hand.map((c) => c.id), extra: 1 })).toBe('VALIDATION');
    // Control: the same hand plays fine when the payload is well-formed.
    const good = await holder.client('play:cards', { cardIds: [hand[0]!.id] });
    expect(good?.ok).toBe(true);
  }, 10_000);

  it('room:join rejects malformed codes; unknown codes are ROOM_NOT_FOUND', async () => {
    const env = new TestEnv();
    const user = env.socket(env.user('w'));
    expect(await errorCode(user, 'room:join', { code: 'A1B2C' })).toBe('VALIDATION'); // '1' not in alphabet
    expect(await errorCode(user, 'room:join', { code: 'TOOLONGCODE' })).toBe('VALIDATION');
    expect(await errorCode(user, 'room:join', { code: 'ZZZZZ' })).toBe('ROOM_NOT_FOUND');
    expect(await errorCode(user, 'room:join', {})).toBe('VALIDATION');
  });

  it('liar:call without accusedSeat fails strict-object validation', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets } = await bootMatch(env, 2, { start: true, drivers: false });
    expect(await errorCode(sockets[1]!, 'liar:call', {})).toBe('VALIDATION');
  }, 10_000);});

describe('roles + legality', () => {
  it('game:start is host-only (NOT_HOST) · double start is ILLEGAL_MOVE', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets } = await bootMatch(env, 2, { start: false, drivers: false });
    expect(await errorCode(sockets[1]!, 'game:start', {})).toBe('NOT_HOST');
    const host = await sockets[0]!.client('game:start', {});
    expect(host?.ok).toBe(true);
    const again = await sockets[0]!.client('game:start', {});
    expect((again?.error as { code: string }).code).toBe('ILLEGAL_MOVE'); // already live
  }, 10_000);

  it('spectators cannot play, call, emote, or speak', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets, code } = await bootMatch(env, 2, { start: false, drivers: false });
    const spectator = env.socket(env.user('watcher'));
    const joined = await joinRoom(env, spectator, code);
    expect(joined.spectator).toBe(true);
    expect(await errorCode(spectator, 'play:cards', { cardIds: ['K1'] })).toBe('NOT_IN_ROOM');
    expect(await errorCode(spectator, 'liar:call', { accusedSeat: 0 })).toBe('NOT_IN_ROOM');
    expect(await errorCode(spectator, 'emote:send', { emoteId: 'laugh' })).toBe('ILLEGAL_MOVE');
    expect(await errorCode(spectator, 'profile:tts-say', { phraseId: 'liar' })).toBe('ILLEGAL_MOVE');
  }, 10_000);

  it("out-of-turn play bounces the engine's typed ERR_NOT_YOUR_TURN", async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets } = await bootMatch(env, 2, { start: true, drivers: false });
    const turnSeat = await waitForHandsAndTurn(env, sockets);
    const other = sockets[turnSeat === 0 ? 1 : 0]!;
    const otherHand = other.last('hand:deal')!['cards'] as { id: string }[];
    expect(await errorCode(other, 'play:cards', { cardIds: [otherHand[0]!.id] })).toBe('ERR_NOT_YOUR_TURN');
  }, 10_000);

  it('ghost lounge: a dead seat keeps RECEIVING but may only emote', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { code, sockets, players } = await bootMatch(env, 3);
    const gotDeath = await waitFor(
      () => sockets.some((s) => s.received('shot:result').some((r) => r['outcome'] === 'LIVE')),
      20_000,
      5,
    );
    expect(gotDeath).toBe(true);
    const deadEvent = sockets[0]!.received('shot:result').find((r) => r['outcome'] === 'LIVE')!;
    const deadSeat = deadEvent['loserSeat'] as number;
    const deadPlayer = players.find((p) => p.seat === deadSeat)!;
    const deadSocket = deadPlayer.socket;
    const emissionsAtDeath = deadSocket.emissions.length;
    for (const p of players) p.stop();

    // Ghost keeps receiving ALL events (table keeps playing).
    const receiving = await waitFor(() => deadSocket.emissions.length > emissionsAtDeath + 1, 10_000, 10);
    expect(receiving).toBe(true);

    // Ghosts' only legal action is emote. (Engine checks phase first, so we
    // poke during a TURN phase — where a ghost's play is a legality error.)
    const inTurnPhase = await waitFor(
      () => env.manager.roomByCode(code)?.match?.engineState.phase === 'TURN',
      10_000,
      2,
    );
    expect(inTurnPhase).toBe(true);
    const hand = deadSocket.last('hand:deal')?.['cards'] as { id: string }[] | undefined;
    if (hand) {
      expect(await errorCode(deadSocket, 'play:cards', { cardIds: [hand[0]!.id] })).toBe('ERR_DEAD');
    }
    expect(await errorCode(deadSocket, 'liar:call', { accusedSeat: (deadSeat + 1) % 3 })).toBe(
      'ERR_DEAD',
    );
    const emote = await deadSocket.client('emote:send', { emoteId: EMOTE_CATALOG[3] });
    expect(emote?.ok).toBe(true);
    expect(deadSocket.received('emote:broadcast').some((b) => b['seat'] === deadSeat)).toBe(true);
  }, 40_000);
});

describe('emote cooldown (3s default, test env overrides here)', () => {
  it('relays once then RATE_LIMITED inside the window; unknown emotes are VALIDATION', async () => {
    const env = new TestEnv({ timing: { ...FAST_TIMING, emoteCooldownMs: 250 } });
    const { sockets } = await bootMatch(env, 2, { start: false });
    const host = sockets[0]!;
    const res = await host.client('emote:send', { emoteId: EMOTE_CATALOG[0] });
    expect(res?.ok).toBe(true);
    const broadcast = sockets[1]!.received('emote:broadcast');
    expect(broadcast.length).toBe(1);
    expect(broadcast[0]!['seat']).toBe(0);
    expect(broadcast[0]!['emoteId']).toBe(EMOTE_CATALOG[0]);

    expect(await errorCode(host, 'emote:send', { emoteId: EMOTE_CATALOG[1] })).toBe('RATE_LIMITED');
    expect(await errorCode(host, 'emote:send', { emoteId: 'party-parrot' })).toBe('VALIDATION');
    // Host-configurable cooldown length: after 300ms it passes again.
    await new Promise((r) => setTimeout(r, 300));
    const later = await host.client('emote:send', { emoteId: EMOTE_CATALOG[1] });
    expect(later?.ok).toBe(true);
  }, 15_000);
});

describe('profile:tts-say (client-local audio — nothing ever broadcast)', () => {
  it('acks seated members and emits nothing to other members', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { sockets } = await bootMatch(env, 2, { start: false });
    const before = sockets[1]!.emissions.length;
    const res = await sockets[0]!.client('profile:tts-say', { phraseId: 'liar' });
    expect(res?.ok).toBe(true);
    const added = sockets[1]!.emissions.slice(before);
    expect(added.filter((e) => /tts|audio|voice/i.test(e.event + JSON.stringify(e.payload))).length).toBe(0);
  });
});
