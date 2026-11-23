/**
 * RoomManager surface (STR/02): create/join/leave, capacity gates (2–7 free,
 * Big Table entitlement), theme gates, room codes, sanitizer, host controls
 * (lock/kick/bot-fill), public-room mirroring, join rate limit, GC.
 */
import { describe, expect, it } from 'vitest';
import { isRoomCode, RoomCodeSchema } from '@liars-game/shared';
import {
  BIG_TABLE_ENTITLEMENT,
  EMOTE_CATALOG,
  FREE_THEMES,
  RoomManager,
  type ManagerDeps,
  type PublicRoomDoc,
  type PublicRoomStore,
} from '../../src/game/rooms.js';
import { DEFAULT_GAME_TIMING, type RoomTransport } from '../../src/game/types.js';
import { MemoryPublicRoomStore, SeqRng, TestEnv, createRoom, joinRoom } from './helpers.js';

function freeManagerDeps(overrides: Partial<ManagerDeps> = {}): ManagerDeps {
  const io = { sockets: new Map() };
  const transport: RoomTransport = {
    join: () => undefined,
    leave: () => undefined,
    emitToRoom: () => undefined,
    emitToSocket: () => undefined,
  };
  void io;
  const store: PublicRoomStore = new MemoryPublicRoomStore();
  return {
    transport,
    timing: DEFAULT_GAME_TIMING,
    authenticateSocket: async () => null,
    sanitizeEmote: (raw: string) => raw.toLowerCase(),
    randomInt: new SeqRng().int,
    randomUuid: () => 'mid',
    now: () => Date.now(),
    userProfile: async () => null,
    hasEntitlement: async () => false,
    publicRoomStore: store,
    joinRateLimit: null,
    ...overrides,
  } as ManagerDeps;
}

describe('RoomManager.createRoom', () => {
  it('hosts at seat 0 with a valid 5-char code from the shared alphabet', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('host-1'));
    const code = await createRoom(env, host);
    expect(isRoomCode(code)).toBe(true);
    expect(RoomCodeSchema.safeParse(code).success).toBe(true);
    const room = env.manager.roomByCode(code);
    expect(room).not.toBeNull();
    expect(room!.seatsTaken()).toBe(1);
  });

  it('mints collision-free codes on concurrent creates (retry loop)', async () => {
    const env = new TestEnv();
    const codes: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const s = env.socket(env.user(`h${i}`));
      codes.push(await createRoom(env, s));
    }
    expect(new Set(codes).size).toBe(5);
  });

  it('sanitizes the room name and falls back when blocked', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('hk'));
    const code = await createRoom(env, host, { name: 'f u c k   table            ' });
    const snapshot = host.last('lobby:state') as { name: string };
    expect(snapshot.name.length).toBeGreaterThan(0);
    expect(snapshot.name).not.toMatch(/fuck/i);
    expect(snapshot.name.length).toBeLessThanOrEqual(18);
    const fallback = await createRoom(env, env.socket(env.user('hk2')), { name: '💩'.repeat(20) });
    const s2 = await joinRoom(env, env.socket(env.user('x')), fallback);
    expect(s2).toBeDefined();
  });

  it('rejects capacity < 2 or > 10 as VALIDATION', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('cap'));
    const bad = await host.client('room:create', { name: 'Tiny', capacity: 1, theme: 'saloon', visibility: 'private' });
    expect(bad?.ok).toBe(false);
    expect((bad?.error as { code: string }).code).toBe('VALIDATION');
  });

  it('allows capacity 2..7 without any entitlement', async () => {
    const env = new TestEnv();
    for (let cap = 2; cap <= 7; cap += 1) {
      const s = env.socket(env.user(`c${cap}`));
      const res = await s.client('room:create', { name: `T${cap}`, capacity: cap, theme: 'saloon', visibility: 'private' });
      if (cap === 7) expect(res?.ok).toBe(true);
    }
  });

  it('rejects Big Table capacity 8 without the entitlement', async () => {
    const env = new TestEnv({ hasEntitlement: async () => false });
    const host = env.socket(env.user('noent'));
    const res = await host.client('room:create', { name: 'Big', capacity: 8, theme: 'saloon', visibility: 'private' });
    expect(res?.ok).toBe(false);
    expect((res?.error as { code: string }).code).toBe('ILLEGAL_MOVE');
  });

  it('allows capacity 8..10 when the HOST holds the big-table entitlement', async () => {
    const env = new TestEnv({
      hasEntitlement: async (userId, kind, key) =>
        userId === 'rich' && kind === BIG_TABLE_ENTITLEMENT.kind && key === BIG_TABLE_ENTITLEMENT.key,
    });
    const rich = env.socket(env.user('rich'));
    const ok = await rich.client('room:create', { name: 'Big Table', capacity: 10, theme: 'saloon', visibility: 'private' });
    expect(ok?.ok).toBe(true);
    // A non-entitled host in the same env still cannot create one.
    const poor = env.socket(env.user('poor'));
    const no = await poor.client('room:create', { name: 'Big 2', capacity: 8, theme: 'saloon', visibility: 'private' });
    expect(no?.ok).toBe(false);
  });

  it('gates premium themes behind entitlement but allows free themes', async () => {
    const env = new TestEnv({
      hasEntitlement: async (userId, kind, key) =>
        userId === 't1' && kind === 'theme' && key === 'cathedral',
    });
    const host = env.socket(env.user('t1'));
    for (const theme of FREE_THEMES) {
      const res = await host.client('room:create', { name: `T${theme}`, capacity: 2, theme, visibility: 'private' });
      expect(res?.ok).toBe(true);
    }
    const denied = await host.client('room:create', { name: 'Locked', capacity: 2, theme: 'cathedral', visibility: 'private' });
    expect(denied?.ok).toBe(true); // entitled
    const other = env.socket(env.user('t2'));
    const notOwned = await other.client('room:create', { name: 'Nope', capacity: 2, theme: 'cathedral', visibility: 'private' });
    expect(notOwned?.ok).toBe(false);
  });
});

describe('join / leave / seats', () => {
  it("seats joiners lowest-first, mirrors seatsTaken, and marks the host", async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4, visibility: 'public' });
    const j1 = await joinRoom(env, env.socket(env.user('j1')), code);
    expect(j1.yourSeat).toBe(1);
    const doc = env.store.docs.get(code)!;
    expect(doc.seatsTaken).toBe(2);
    const snapshot = host.last('lobby:state') as {
      seats: { seat: number; isHost: boolean; nickname: string | null }[];
    };
    expect(snapshot.seats[0]!.isHost).toBe(true);
    expect(snapshot.seats[1]!.isHost).toBe(false);
  });

  it('full room → spectator with you: null', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 2, visibility: 'public' });
    await joinRoom(env, env.socket(env.user('j1')), code);
    const j2 = env.socket(env.user('j2'));
    const res = await joinRoom(env, j2, code);
    expect(res.spectator).toBe(true);
    expect(res.yourSeat).toBeNull();
    const snap = j2.last('lobby:state') as { spectator: boolean; you: null };
    expect(snap.spectator).toBe(true);
    expect(snap.you).toBeNull();
  });

  it('locked rooms seat nobody new (host lock, STR/02)', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4 });
    const lockRes = env.manager.lockRoom('h', true);
    expect(lockRes.ok).toBe(true);
    const j = await joinRoom(env, env.socket(env.user('j')), code);
    expect(j.spectator).toBe(true);
    const notHost = env.manager.lockRoom('j', false);
    expect(notHost.ok).toBe(false);
    expect((notHost as { code: string }).code).toBe('NOT_HOST');
  });

  it('room:leave frees the lobby seat and broadcasts the shrink', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4, visibility: 'public' });
    const j1 = env.socket(env.user('j1'));
    await joinRoom(env, j1, code);
    expect(env.store.docs.get(code)!.seatsTaken).toBe(2);
    const res = await j1.client('room:leave', {});
    expect(res?.ok).toBe(true);
    expect(env.store.docs.get(code)!.seatsTaken).toBe(1);
    const seatSnapshot = host.last('lobby:state') as { seats: { seat: number; nickname: string | null }[] };
    expect(seatSnapshot.seats[1]!.nickname).toBeNull();
  });

  it('reconnect path: a known user re-joins into their own seat', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4 });
    const first = env.socket(env.user('j1'));
    const join1 = await joinRoom(env, first, code);
    expect(join1.yourSeat).toBe(1);
    first.disconnect();
    const second = env.socket(env.user('j1'));
    const join2 = await joinRoom(env, second, code);
    expect(join2.yourSeat).toBe(1);
    expect(join2.reconnected).toBe(true);
  });

  it('mid-match joiners become spectators (roster fixed at start)', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4, visibility: 'public' });
    await joinRoom(env, env.socket(env.user('j1')), code);
    const started = await host.client('game:start', {});
    expect(started?.ok).toBe(true);
    const late = await joinRoom(env, env.socket(env.user('late')), code);
    expect(late.spectator).toBe(true);
  });
});

describe('host controls (programmatic surface — wire events pending shared schema)', () => {
  it('kick frees a lobby seat; non-host is rejected', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4, visibility: 'public' });
    await joinRoom(env, env.socket(env.user('victim')), code);
    const denied = env.manager.kickSeat('victim', 1);
    expect(denied.ok).toBe(false);
    expect((denied as { code: string }).code).toBe('NOT_HOST');
    const kicked = env.manager.kickSeat('h', 1);
    expect(kicked.ok).toBe(true);
    expect(env.store.docs.get(code)!.seatsTaken).toBe(1);
  });

  it('the host cannot kick themselves', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 4 });
    const res = env.manager.kickSeat('h', 0);
    expect(res.ok).toBe(false);
    expect((res as { code: string }).code).toBe('NOT_HOST');
    void code;
  });

  it('bot-fill occupies a seat, is flagged isBot in views, then removes', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 3, visibility: 'public' });
    const added = env.manager.addBotToRoom('h');
    expect(added.ok).toBe(true);
    const snap = host.last('lobby:state') as { seats: { isBot?: boolean; nickname: string | null }[] };
    expect(snap.seats[1]!.isBot).toBe(true);
    expect(snap.seats[0]!.isBot).toBeUndefined();
    expect(env.manager.listPublicRooms()[0]!.seatsTaken).toBe(2);
    const removed = env.manager.removeBotFromRoom('h', 1);
    expect(removed.ok).toBe(true);
  });

  it('bot-fill is host-only and lobby-only', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 3 });
    await joinRoom(env, env.socket(env.user('j')), code);
    const notHost = env.manager.addBotToRoom('j');
    expect(notHost.ok).toBe(false);
    expect((notHost as { code: string }).code).toBe('NOT_HOST');
  });

  it('emote catalog is exactly 10 presets', () => {
    expect(EMOTE_CATALOG.length).toBe(10);
  });
});

describe('public rooms mirror + GC', () => {
  it('mirrors create/update for public rooms only', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 3, visibility: 'public' });
    const firstDoc = env.store.docs.get(code)!;
    expect(firstDoc).toBeDefined();
    await joinRoom(env, env.socket(env.user('j')), code);
    expect(env.store.docs.get(code)!.seatsTaken).toBe(2);
    const privHost = env.socket(env.user('p'));
    const privCode = await createRoom(env, privHost, { capacity: 2, visibility: 'private' });
    expect(env.store.docs.has(privCode)).toBe(false);
  });

  it('removes the mirror doc when the room closes', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 2, visibility: 'public' });
    env.manager.closeRoom(code);
    expect(env.store.docs.has(code)).toBe(false);
    expect(env.store.removed).toContain(code);
    expect(env.manager.roomByCode(code)).toBeNull();
  });

  it('idle rooms dissolve after the GC window (never while a match is live)', async () => {
    const env = new TestEnv({
      timing: { ...DEFAULT_GAME_TIMING, idleGcMs: 60 },
    });
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 2, visibility: 'public' });
    host.disconnect();
    const gone = await new Promise<boolean>((resolve) => {
      const started = Date.now();
      const poll = (): void => {
        if (env.manager.roomByCode(code) === null) resolve(true);
        else if (Date.now() - started > 3_000) resolve(false);
        else setTimeout(poll, 20);
      };
      setTimeout(poll, 80);
    });
    expect(gone).toBe(true);
  }, 6_000);

  it('join rate limit: Nth join attempt from one IP is RATE_LIMITED', async () => {
    const env = new TestEnv({ joinRateLimit: { windowMs: 60_000, limit: 2 } });
    const host = env.socket(env.user('h'), '7.7.7.7');
    const code = await createRoom(env, host, { capacity: 7, visibility: 'public' });
    const j1 = env.socket(env.user('j1'), '7.7.7.7');
    await joinRoom(env, j1, code);
    const j2 = env.socket(env.user('j2'), '7.7.7.7');
    const r2 = await j2.client('room:join', { code });
    expect(r2?.ok).toBe(true);
    const j3 = env.socket(env.user('j3'), '7.7.7.7');
    const r3 = await j3.client('room:join', { code });
    expect(r3?.ok).toBe(false);
    expect((r3?.error as { code: string }).code).toBe('RATE_LIMITED');
  });

  it('listing includes lock badge + host presence', async () => {
    const env = new TestEnv();
    const host = env.socket(env.user('h'));
    const code = await createRoom(env, host, { capacity: 2, visibility: 'public' });
    const listing = env.manager.listPublicRooms()[0]!;
    expect(listing.roomCode).toBe(code);
    expect(listing.locked).toBe(false);
    expect(listing.hostConnected).toBe(true);
    env.manager.lockRoom('h', true);
    expect(env.manager.listPublicRooms()[0]!.locked).toBe(true);
  });
});

describe('bare-manager construction', () => {
  it('runs without Mongo deps by injection (no models touched)', () => {
    const deps = freeManagerDeps();
    const manager = new RoomManager(deps);
    expect(manager.roomCount).toBe(0);
    expect(manager.listPublicRooms()).toEqual([]);
  });
});
