import { describe, expect, it } from 'vitest';
import {
  clientEventSchemas,
  parseClientEvent,
  parseServerEvent,
  RoomCreatePayloadSchema,
  serverEventSchemas,
  TtsSayPayloadSchema,
} from '../src/events.js';
import type { ClientEventName, ServerEventName } from '../src/events.js';
import { EMOTE_PRESETS } from '../src/emotes.js';
import { CardSchema, ViewPlayerStateSchema } from '../src/types.js';
import { makeMatchRecord, makeRoomState, makeViewPlayer } from './fixtures.js';

const validClientPayloads: Record<ClientEventName, unknown> = {
  'room:create': { name: 'The Saloon', capacity: 7, theme: 'saloon', visibility: 'public' },
  'room:join': { code: 'AB2C9' },
  'room:leave': {},
  'game:start': {},
  'play:cards': { cardIds: ['c_01', 'c_02'] },
  'liar:call': { accusedSeat: 3 },
  'emote:send': { emoteId: 'laugh' },
  'profile:tts-say': { phraseId: 'tts_check' },
};

const validServerPayloads: Record<ServerEventName, unknown> = {
  'lobby:state': makeRoomState(),
  'round:new': {
    seq: 7,
    roundNo: 3,
    tableCard: 'Q',
    dealtCounts: [
      { seat: 0, count: 4 },
      { seat: 1, count: 5 },
    ],
  },
  'hand:deal': {
    seq: 8,
    cards: [
      { id: 'c_01', rank: 'K' },
      { id: 'c_02', rank: 'J' },
    ],
  },
  'turn:begin': { seq: 9, seat: 1, deadlineTs: 1794971053500 },
  'play:accept': { seq: 10, seat: 1, count: 2, totalPile: 6 },
  'window:open': { seq: 11, playSeat: 1, closesAtTs: 1794971053500 },
  'window:close': { seq: 12, reason: 'belief' },
  'reveal:show': {
    seq: 13,
    cards: [{ id: 'c_09', rank: 'Q' }],
    verdict: 'LIE',
    loserSeat: 1,
  },
  'shot:assign': { seq: 14, loserSeat: 1, kind: 'EXECUTE', executorSeat: 0 },
  'shot:result': { seq: 15, loserSeat: 1, pulls: 3, outcome: 'BLANK' },
  'round:end': { seq: 16, reason: 'survived', survivorCoins: 1, xpEarned: [] },
  'game:over': {
    seq: 17,
    winnerSeat: 0,
    matchRecord: makeMatchRecord(),
    rewards: [{ seat: 0, coins: 13, xp: 12, unlockedTitles: ['Bar Legend'] }],
  },
  'presence:update': {
    seq: 18,
    seats: [
      { seat: 0, connected: true, afk: false },
      { seat: 1, connected: false, afk: true },
    ],
  },
  'emote:broadcast': { seq: 19, seat: 2, emoteId: 'cheer' },
  error: { seq: 20, code: 'EVENT_STALE', message: 'That window closed.', eventRef: 'liar:call' },
};

describe('client event schemas (STR/07 §1)', () => {
  it('round-trips every valid client payload', () => {
    for (const [name, payload] of Object.entries(validClientPayloads)) {
      const result = parseClientEvent(name as ClientEventName, payload);
      expect(result, name).toBeTruthy();
    }
  });

  it('rejects unknown extra fields (strict objects)', () => {
    const bad = RoomCreatePayloadSchema.safeParse({
      name: 'X',
      capacity: 4,
      theme: 'saloon',
      visibility: 'public',
      adminOverride: true,
    });
    expect(bad.success).toBe(false);
  });

  it('play:cards: 1..3 unique ids only', () => {
    const schema = clientEventSchemas['play:cards'];
    expect(schema.safeParse({ cardIds: [] }).success).toBe(false);
    expect(schema.safeParse({ cardIds: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(schema.safeParse({ cardIds: ['a', 'a'] }).success).toBe(false);
    expect(schema.safeParse({ cardIds: ['a'] }).success).toBe(true);
  });

  it('liar:call requires an integer accused seat', () => {
    const schema = clientEventSchemas['liar:call'];
    expect(schema.safeParse({ accusedSeat: '3' }).success).toBe(false);
    expect(schema.safeParse({ accusedSeat: 42 }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('room:join rejects non-canonical codes', () => {
    const schema = clientEventSchemas['room:join'];
    expect(schema.safeParse({ code: 'ab2c9' }).success).toBe(false);
    expect(schema.safeParse({ code: 'IL0O1' }).success).toBe(false);
    expect(schema.safeParse({ code: 'AB2C9' }).success).toBe(true);
  });

  it('emote ids ARE the shared catalog — retired web-era ids reject', () => {
    for (const preset of EMOTE_PRESETS) {
      expect(
        clientEventSchemas['emote:send'].safeParse({ emoteId: preset.id }).success,
        preset.id,
      ).toBe(true);
      expect(
        serverEventSchemas['emote:broadcast'].safeParse({ seq: 1, seat: 0, emoteId: preset.id })
          .success,
        preset.id,
      ).toBe(true);
    }
    expect(clientEventSchemas['emote:send'].safeParse({ emoteId: 'call-my-bluff' }).success).toBe(false);
    expect(clientEventSchemas['emote:send'].safeParse({ emoteId: 'snake' }).success).toBe(false);
    expect(serverEventSchemas['emote:broadcast'].safeParse({ seq: 1, seat: 0, emoteId: 'party-parrot' }).success).toBe(false);
  });

  it('profile:tts-say never accepts an audio field', () => {
    expect(TtsSayPayloadSchema.safeParse({ phraseId: 'tts_check' }).success).toBe(true);
    expect(
      TtsSayPayloadSchema.safeParse({ phraseId: 'x', audio: 'data:audio/mp3;base64,…' }).success,
    ).toBe(false);
  });
});

describe('server event schemas (STR/07 §2)', () => {
  it('round-trips every valid server payload', () => {
    for (const [name, payload] of Object.entries(validServerPayloads)) {
      const result = parseServerEvent(name as ServerEventName, payload);
      expect(result, name).toBeTruthy();
    }
  });

  it('every server→client payload REQUIRES a monotonic seq', () => {
    for (const name of Object.keys(validServerPayloads) as ServerEventName[]) {
      if (name === 'lobby:state') continue; // seq lives inside RoomState itself
      const payload = { ...(validServerPayloads[name] as Record<string, unknown>) };
      delete payload['seq'];
      expect(serverEventSchemas[name].safeParse(payload).success, name).toBe(false);
    }
  });

  it('LEAK GUARD: play:accept rejects smuggled rank data (face values never ride)', () => {
    const payload = validServerPayloads['play:accept'] as Record<string, unknown>;
    const poisoned = { ...payload, ranks: [{ id: 'c_9', rank: 'A' }] };
    expect(serverEventSchemas['play:accept'].safeParse(poisoned).success).toBe(false);
  });

  it('LEAK GUARD: other players carry counts only — no hand field, none accepted', () => {
    const other = makeViewPlayer({ seat: 1, isHost: false });
    expect((other as unknown as Record<string, unknown>)['hand']).toBeUndefined();
    expect(ViewPlayerStateSchema.safeParse(other).success).toBe(true);
    expect(
      ViewPlayerStateSchema.safeParse({ ...other, hand: [{ id: 'c_9', rank: 'A' }] }).success,
    ).toBe(false);
  });

  it('LEAK GUARD: no schema field anywhere names a bullet/chamber position', () => {
    // bulletPos must never be serializable (STR/08 §1) — assert the wire types agree.
    const asText = JSON.stringify(makeRoomState()) + JSON.stringify(makeMatchRecord());
    expect(asText.includes('bullet')).toBe(false);
    expect(asText.includes('chamber')).toBe(false);
    expect(asText.includes('liveAt')).toBe(false);
  });

  it('reveal:show is the ONLY event whose cards carry ranks', () => {
    const payload = {
      seq: 21,
      cards: [{ id: 'c_09', rank: 'K' }, { id: 'c_10', rank: 'J' }],
      verdict: 'TRUTH',
      loserSeat: 0,
    };
    expect(serverEventSchemas['reveal:show'].safeParse(payload).success).toBe(true);
    for (const name of ['window:open', 'play:accept', 'turn:begin'] as ServerEventName[]) {
      const base = validServerPayloads[name] as Record<string, unknown>;
      const withCards = { ...base, cards: [{ id: 'c_1', rank: 'A' }] };
      expect(serverEventSchemas[name].safeParse(withCards).success, name).toBe(false);
    }
    expect(CardSchema.safeParse({ id: 'c_1', rank: 'A' }).success).toBe(true);
  });

  it('shot:assign enforces the SELF/EXECUTE executor coupling', () => {
    const schema = serverEventSchemas['shot:assign'];
    expect(schema.safeParse({ seq: 1, loserSeat: 1, kind: 'SELF' }).success).toBe(true);
    expect(schema.safeParse({ seq: 1, loserSeat: 1, kind: 'EXECUTE' }).success).toBe(false);
    expect(
      schema.safeParse({ seq: 1, loserSeat: 1, kind: 'SELF', executorSeat: 2 }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ seq: 1, loserSeat: 1, kind: 'EXECUTE', executorSeat: 2 }).success,
    ).toBe(true);
  });

  it('shot:result pulls are 1..6 and outcome is BLANK|LIVE', () => {
    const schema = serverEventSchemas['shot:result'];
    expect(schema.safeParse({ seq: 1, loserSeat: 1, pulls: 0, outcome: 'BLANK' }).success).toBe(
      false,
    );
    expect(schema.safeParse({ seq: 1, loserSeat: 1, pulls: 7, outcome: 'BLANK' }).success).toBe(
      false,
    );
    expect(schema.safeParse({ seq: 1, loserSeat: 1, pulls: 6, outcome: 'LIVE' }).success).toBe(
      true,
    );
  });

  it('hand:deal only accepts 1..5 cards', () => {
    const schema = serverEventSchemas['hand:deal'];
    expect(schema.safeParse({ seq: 1, cards: [] }).success).toBe(false);
    expect(schema.safeParse({ seq: 1, cards: [{ id: 'c', rank: 'K' }] }).success).toBe(true);
  });

  it('game:over validates the nested match record', () => {
    const schema = serverEventSchemas['game:over'];
    const valid = validServerPayloads['game:over'] as Record<string, unknown>;
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, matchRecord: { matchId: 'x' } }).success).toBe(false);
  });

  it('error payloads stay small and allow empty eventRef', () => {
    const schema = serverEventSchemas['error'];
    expect(schema.safeParse({ seq: 1, code: 'EVENT_STALE', message: 'm', eventRef: '' }).success).toBe(
      true,
    );
    expect(schema.safeParse({ seq: 1, code: 'x'.repeat(65), message: 'm', eventRef: '' }).success).toBe(
      false,
    );
  });

  it('lobby:state parses a lobby-phase snapshot too (the catch-up view)', () => {
    const snapshot = makeRoomState({
      phase: 'lobby',
      you: null,
      spectator: true,
      seq: 0,
      currentTurnSeat: null,
      deadlineTs: null,
      roundNo: undefined,
      tableCard: undefined,
      pileTotal: undefined,
      challengeWindow: undefined,
      seats: [makeViewPlayer(), makeViewPlayer({ seat: 1, isHost: false })],
    });
    expect(serverEventSchemas['lobby:state'].safeParse(snapshot).success).toBe(true);
  });
});
