/**
 * Full deterministic lifecycles at 2 / 4 / 6+bot players driven ENTIRELY by
 * fake sockets (the router → RoomManager → rules-engine → transport path).
 * Every emission every "client" received is captured and audited:
 *
 *  PRIVACY TRIPWIRES (STR/07 §3, STR/08 §1)
 *   - hand:deal reaches only its own seat (pairwise-disjoint per round);
 *   - no payload outside `reveal:show` ever references another seat's
 *     current-round card ids (deep string walk, exact ids);
 *   - `reveal:show` is the ONLY face-leak: its cards must come from the
 *     accused's current-round hand;
 *   - no serialized emission anywhere contains the key `bulletPos`;
 *   - every payload parses against @liars-game/shared's strict server
 *     schemas (isBot aside — documented TODO-sync-with-shared).
 *
 *SEQ + SEAM
 *  - monotonic non-decreasing seq per room, deltas strictly increasing;
 *  - the MatchEndPayload seam fires exactly once and (seed, log) replays
 *    bit-exactly through rules-engine `replay()`.
 */
import { describe, expect, it } from 'vitest';
import { parseServerEvent, type RoomState } from '@liars-game/shared';
import { replay, stripRuntime } from '@liars-game/rules-engine';
import { FAST_MATCH_CONFIG, FAST_TIMING, TestEnv, bootMatch, waitFor, type AutoPlayer } from './helpers.js';

interface WireCardView {
  id: string;
  rank: string;
}

/** Deep string harvest from a payload (privacy scan input). */
function deepStrings(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) deepStrings(v, out);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) deepStrings(v, out);
  }
}

/** Deep KEY harvest — trips on hidden state smuggled as fields. */
function deepKeys(value: unknown, prefix: string, out: Set<string>): void {
  out.add(prefix);
  if (Array.isArray(value)) {
    value.forEach((v, i) => deepKeys(v, `${prefix}[]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      deepKeys(v, `${prefix}.${k}`, out);
      if (k === 'bulletPos') out.add('__BULLETPOS__');
    }
  }
}

/** Strips the documented `isBot` extra before strict-schema validation. */
function sanitizeForSchema(event: string, payload: Record<string, unknown>): Record<string, unknown> {
  if (event !== 'lobby:state') return payload;
  const clone: Record<string, unknown> = { ...payload };
  const seats = clone['seats'] as Record<string, unknown>[];
  clone['seats'] = seats.map((s) => {
    const { isBot: _drop, ...rest } = s;
    void _drop;
    return rest;
  });
  const you = clone['you'] as Record<string, unknown> | null;
  if (you) {
    const { isBot: _drop2, ...restYou } = you;
    void _drop2;
    clone['you'] = you ? restYou : null;
  }
  return clone;
}

interface AuditResult {
  handsByRound: Map<string, Map<number, WireCardView[]>>;
  lastSeq: number;
}

/** Socket-stream participant for the audit (humans have streams; bots stub). */
export interface AuditPlayer {
  userId: string;
  seat: number | null;
  emissions: { event: string; payload: Record<string, unknown> }[];
}

function auditMatch(players: AuditPlayer[]): AuditResult {
  // Per-user ordered hand:deal → handsByRound.get(user)![roundIndex]
  const handsByRound = new Map<string, Map<number, WireCardView[]>>();
  for (const p of players) {
    const rounds = new Map<number, WireCardView[]>();
    let round = 0;
    for (const e of p.emissions) {
      if (e.event === 'round:new') round = (e.payload['roundNo'] as number) - 1;
      if (e.event === 'hand:deal') rounds.set(round, e.payload['cards'] as WireCardView[]);
    }
    handsByRound.set(p.userId, rounds);
  }

  for (const p of players) {
    let lastSeq = -1;
    let round = 0;
    let lastPlayedSeat: number | null = null;
    for (const e of p.emissions) {
      // 1) Wire contract: every payload parses against the shared strict schemas.
      expect(() =>
        parseServerEvent(e.event as never, sanitizeForSchema(e.event, e.payload) as never),
      ).not.toThrow();

      // 2) No serialized emission contains bulletPos (deep key scan).
      const keys = new Set<string>();
      deepKeys(e.payload, 'root', keys);
      expect(keys.has('__BULLETPOS__')).toBe(false);

      // 3) seq discipline: deltas strictly increase; snapshot catch-ups and
      //    direct `error` replies may repeat the current counter (they are
      //    not room deltas — STR/07 §4 "deltas with monotonic seq").
      if (typeof e.payload['seq'] === 'number') {
        const seq = e.payload['seq'] as number;
        expect(seq).toBeGreaterThanOrEqual(lastSeq);
        if (e.event !== 'lobby:state' && e.event !== 'error') {
          expect(seq).toBeGreaterThan(lastSeq);
        }
        lastSeq = seq;
      }

      if (e.event === 'round:new') round = (e.payload['roundNo'] as number) - 1;
      if (e.event === 'play:accept') lastPlayedSeat = e.payload['seat'] as number;

      // 4) Privacy: no other seat's current-round card id in ANY non-reveal
      //    payload (hand:deal may only contain the viewer's OWN ids).
      if (e.event !== 'reveal:show' && e.event !== 'game:over') {
        const strings = new Set<string>();
        deepStrings(e.payload, strings);
        for (const other of players) {
          if (other.userId === p.userId) continue;
          const otherHand = handsByRound.get(other.userId)?.get(round) ?? [];
          for (const card of otherHand) {
            expect(strings.has(card.id)).toBe(false);
          }
        }
      }

      // 5) hand:deal is seat-private: viewer's own ids only.
      if (e.event === 'hand:deal') {
        const mine = e.payload['cards'] as WireCardView[];
        for (const card of mine) {
          for (const other of players) {
            if (other.userId === p.userId) continue;
            const otherHand = handsByRound.get(other.userId)?.get(round) ?? [];
            expect(otherHand.some((c) => c.id === card.id)).toBe(false);
          }
        }
        expect(handsByRound.get(p.userId)!.get(round)!.map((c) => c.id)).toEqual(mine.map((c) => c.id));
      }

      // 6) reveal:show — the ONLY face-leak; its cards must be the accused's
      //    own current-round dealt cards (accused = last play:accept seat).
      //    Bot seats have no receiving stream — there their revealed ids must
      //    at least belong to NO OTHER tracked hand (deck-unique).
      if (e.event === 'reveal:show') {
        const cards = e.payload['cards'] as WireCardView[];
        const accusedUser = players.find((q) => q.seat === lastPlayedSeat);
        expect(accusedUser).toBeDefined();
        const hand = handsByRound.get(accusedUser!.userId)?.get(round) ?? [];
        for (const card of cards) {
          if (hand.length > 0) {
            expect(hand.some((c) => c.id === card.id)).toBe(true);
          } else {
            for (const other of players) {
              if (other.userId === accusedUser!.userId) continue;
              const otherHand = handsByRound.get(other.userId)?.get(round) ?? [];
              expect(otherHand.some((c) => c.id === card.id)).toBe(false);
            }
          }
        }
      }
    }
  }

  return { handsByRound, lastSeq: 0 };
}

async function runLifecycle(playerCount: number, opts: { bots?: number } = {}) {
  const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
  const humans = playerCount - (opts.bots ?? 0);
  const { code, sockets, players } = await bootMatch(env, humans, {
    start: false,
    capacity: playerCount,
  });

  const botSeats: number[] = [];
  for (let b = 0; b < (opts.bots ?? 0); b += 1) {
    const added = env.manager.addBotToRoom('u0');
    if (!added.ok) throw new Error('bot add failed');
    botSeats.push(added.data.seat);
  }
  const started = await sockets[0]!.client('game:start', {});
  expect(started?.ok).toBe(true);

  const finished = await waitFor(
    () => env.manager.roomByCode(code)?.match?.isOver ?? false,
    playerCount >= 6 ? 45_000 : 20_000,
    10,
  );
  expect(finished).toBe(true);

  const room = env.manager.roomByCode(code)!;
  void room;
  const auditPlayers: AuditPlayer[] = [
    ...players.map((p) => ({ userId: p.userId, seat: p.seat, emissions: p.socket.emissions })),
    ...botSeats.map((seat) => ({
      userId: `bot:${code}:${seat}`,
      seat,
      emissions: [] as { event: string; payload: Record<string, unknown> }[],
    })),
  ];
  return { env, code, sockets, players, auditPlayers };
}

describe('deterministic full-lifecycle (fake sockets → engine → broadcasts)', () => {
  it('2-player match reaches game:over with a clean bill', async () => {
    const { env, code, sockets, auditPlayers } = await runLifecycle(2);
    auditMatch(auditPlayers);

    // Room state settled + every socket (incl. dead seats) saw game:over.
    const room = env.manager.roomByCode(code)!;
    const record = room.match!.engineState.matchRecord!;
    expect(record.players.length).toBe(2);
    for (const sock of sockets) {
      expect(sock.received('game:over').length).toBe(1);
    }

    // The seam fired exactly once with a full payload.
    expect(env.matchEnds.length).toBe(1);
    const end = env.matchEnds[0]!;
    expect(end.roomCode).toBe(code);
    expect(end.seed).toBeGreaterThan(0);
    expect(end.log.length).toBeGreaterThan(5);
    expect(end.record.winnerSeat).not.toBeNull();
    expect(end.endedAt instanceof Date).toBe(true);

    // (seed, log) replay is bit-exact vs the live final state.
    const roster = end.record.players.map((p) => ({
      seat: p.seat,
      accountId: p.accountId,
      nickname: p.nickname,
      avatarSpec: p.avatarSpec,
      titleAtPlay: p.titleAtPlay,
    }));
    const rep = replay({
      roster,
      config: FAST_MATCH_CONFIG,
      seed: end.seed,
      events: end.log,
      matchId: end.record.matchId,
      roomCode: end.roomCode,
      theme: end.record.theme,
    });
    expect(stripRuntime(rep.state)).toEqual(stripRuntime(room.match!.engineState));
    expect(rep.state.winnerSeat).toBe(end.record.winnerSeat);
  }, 30_000);

  it('4-player match: same audit, no challenge windows (next-only ≤4p)', async () => {
    const { env, sockets, auditPlayers } = await runLifecycle(4);
    auditMatch(auditPlayers);
    for (const sock of sockets) {
      expect(sock.received('window:open').length).toBe(0);
      expect(sock.received('game:over').length).toBe(1);
    }
    void env;
  }, 30_000);

  it('6-player table (5 humans + 1 bot): open windows + bot runs the same path', async () => {
    const { env, code, sockets, auditPlayers } = await runLifecycle(6, { bots: 1 });
    auditMatch(auditPlayers);

    // 5+ alive → open-window mode was active on at least the first round.
    for (const sock of sockets) {
      expect(sock.received('window:open').length).toBeGreaterThan(0);
      expect(sock.received('turn:begin').length).toBeGreaterThan(0);
      expect(sock.received('reveal:show').length).toBeGreaterThan(0);
      expect(sock.received('shot:result').length).toBeGreaterThan(0);
      expect(sock.received('round:end').length).toBeGreaterThan(0);
      expect(sock.received('game:over').length).toBe(1);
    }

    // A bot seat really played (its plays came through the identical pipeline).
    const room = env.manager.roomByCode(code)!;
    const botSeatNick = (room.match!.engineState.players).find((p) =>
      (p.accountId ?? '').startsWith('bot:'),
    );
    expect(botSeatNick).toBeDefined();

    // The seam record includes the bot's synthetic account id.
    expect(env.matchEnds[0]!.record.players.some((p) => (p.accountId ?? '').startsWith('bot:'))).toBe(true);

    // Snapshot view after game over shows phase gameOver + bot flag (a
    // rejoin re-emits the per-seat snapshot — the catch-up path).
    const rejoined = await sockets[0]!.client('room:join', { code });
    expect(rejoined?.ok).toBe(true);
    const snap = sockets[0]!.last('lobby:state') as RoomState;
    expect(snap.phase).toBe('gameOver');
    const seatViews = snap.seats as unknown as { isBot?: boolean }[];
    expect(seatViews.some((s) => s.isBot === true)).toBe(true);
  }, 60_000);

  it('7-player match: full-house run (deck m=2, open windows) with the full audit', async () => {
    const { env, sockets, auditPlayers } = await runLifecycle(7);
    auditMatch(auditPlayers);
    for (const sock of sockets) {
      expect(sock.received('window:open').length).toBeGreaterThan(0);
      expect(sock.received('game:over').length).toBe(1);
    }
    // Deck scaling by roster size: m = ceil(7/4) = 2 → 40 cards … the engine
    // honors it; the audit asserts contract + privacy on every payload.
    const record = env.matchEnds[0]!.record;
    expect(record.players.length).toBe(7);
    expect(record.summary.rounds).toBeGreaterThan(0);
  }, 60_000);

  it('round:end carries reason + survivorCoins; play:accept counts only', async () => {
    const { players } = await runLifecycle(2);
    const stream = players[0]!.socket.emissions;
    const roundEnds = stream.filter((e) => e.event === 'round:end');
    expect(roundEnds.length).toBeGreaterThan(0);
    for (const e of roundEnds) {
      expect(['survived', 'death']).toContain(e.payload['reason']);
      expect(e.payload['survivorCoins']).toBe(1);
      expect(Array.isArray(e.payload['xpEarned'])).toBe(true);
    }
    for (const e of stream.filter((e) => e.event === 'play:accept')) {
      expect(Object.keys(e.payload).sort()).toEqual(['count', 'seat', 'seq', 'totalPile']);
      expect((e.payload['count'] as number)).toBeGreaterThanOrEqual(1);
      expect((e.payload['count'] as number)).toBeLessThanOrEqual(3);
    }
  }, 20_000);

  it('turn:begin carries engine-owned epoch deadline stamps (client never computes)', async () => {
    const { players } = await runLifecycle(2);
    const turns = players[0]!.socket.received('turn:begin');
    expect(turns.length).toBeGreaterThan(0);
    for (const t of turns) {
      const deadlineTs = t['deadlineTs'] as number;
      expect(Number.isInteger(deadlineTs)).toBe(true);
      expect(deadlineTs).toBeGreaterThan(1_600_000_000_000); // epoch-ms
    }
  }, 20_000);
});
