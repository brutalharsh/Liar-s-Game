/**
 * FLOW (f) — expired / invalid socket sessions (STR/07 §0, STR/08): sessions
 * resolve ONCE per socket (router.ts resolveUser caches), so "expired" is
 * modelled the way the live gateway sees it: a NEW socket whose once-valid
 * cookie no longer verifies (authenticateSocket → null). Every play event
 * must bounce AUTH_REQUIRED — and every bounce is STATELESS: the room seq,
 * engine pile and phase never move, no error ever leaves the attacker's own
 * socket (other members receive nothing), and a FRESH minted session for the
 * same user still walks the normal rejoin path afterwards.
 */
import { describe, expect, it } from 'vitest';
import { FAST_MATCH_CONFIG, FAST_TIMING, TestEnv, bootMatch, waitForHandsAndTurn } from './helpers.js';

const PLAY_EVENTS: [string, unknown][] = [
  ['room:create', { name: 'X', capacity: 2, theme: 'saloon', visibility: 'private' }],
  ['room:join', { code: 'CODEX' }], // placeholder; overwritten with the real code below
  ['room:leave', {}],
  ['game:start', {}],
  ['play:cards', { cardIds: ['K1'] }],
  ['liar:call', { accusedSeat: 0 }],
  ['emote:send', { emoteId: 'laugh' }],
  ['profile:tts-say', { phraseId: 'liar' }],
];

describe('FLOW expired session: every play event bounces AUTH_REQUIRED; the live room never notices', () => {
  it('an expired session is fully stateless and a fresh session for the same user still lands', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const { code, sockets } = await bootMatch(env, 2, { start: true, capacity: 2, drivers: false });
    const seat = await waitForHandsAndTurn(env, sockets);
    const other = 1 - seat;

    const room = env.manager.roomByCode(code)!;
    const seqBefore = room.seq;
    const pileBefore = room.match!.engineState.round!.pile.length;
    const witness = sockets[other]!;
    const witnessEmissionsBefore = witness.emissions.length;

    // the once-valid session has EXPIRED: null'd BEFORE any event, so the
    // router's single per-socket resolution genuinely reads "no session".
    const expired = env.socket(env.user('u0'));
    env.authUsers.set(expired.id, null);

    const attempts: [string, unknown][] = PLAY_EVENTS.map(([event, payload]) =>
      event === 'room:join' ? ([event, { code }] as [string, unknown]) : ([event, payload] as [string, unknown]),
    );
    for (const [event, payload] of attempts) {
      const res = await expired.client(event, payload);
      expect(res?.ok).toBe(false);
      expect((res?.error as { code: string }).code).toBe('AUTH_REQUIRED');
    }

    // one user-safe error emission per bounce — eventRef'd, never state-bearing
    const errors = expired.received('error');
    expect(errors.length).toBeGreaterThanOrEqual(attempts.length);
    for (const e of errors) {
      expect(e['code']).toBe('AUTH_REQUIRED');
      expect(e['eventRef']).toBeTruthy();
      expect(typeof e['message']).toBe('string');
      expect((e['message'] as string).length).toBeGreaterThan(0);
      expect((e['message'] as string).length).toBeLessThanOrEqual(280);
    }
    // the expired socket received NOTHING but its own error emissions: no
    // lobby:state, no hand:deal — a session-less socket learns nothing.
    expect(expired.emissions.every((e) => e.event === 'error')).toBe(true);

    // — the live room is untouched by all eight bounces —
    expect(room.seq).toBe(seqBefore); // error replies reuse the counter; never advance it
    expect(room.match!.engineState.round!.pile.length).toBe(pileBefore);
    expect(room.match!.engineState.phase).toBe('TURN');
    expect(witness.emissions.length).toBe(witnessEmissionsBefore); // zero blast radius

    // — a FRESH minted session for the same user still lands: state was intact —
    const fresh = env.socket(env.user('u0'));
    const re = await fresh.client('room:join', { code });
    expect(re?.ok).toBe(true);
    const join = re?.data as { spectator: boolean; yourSeat: number; reconnected: boolean };
    expect(join.spectator).toBe(false);
    expect(join.yourSeat).toBe(0);
    expect(join.reconnected).toBe(true);
    const snap = fresh.last('lobby:state') as { phase: string; you: { hand: unknown[] } | null };
    expect(snap.phase).toBe('playing');
    expect(Array.isArray(snap.you?.hand)).toBe(true);

    // and the match still moves: the seated turn holder plays without a hitch.
    const hand = sockets[seat]!.last('hand:deal')!['cards'] as { id: string }[];
    const played = await sockets[seat]!.client('play:cards', { cardIds: [hand[0]!.id] });
    expect(played?.ok).toBe(true);
    expect(room.match!.engineState.round!.pile.length).toBe(pileBefore + 1);
  }, 20_000);
});
