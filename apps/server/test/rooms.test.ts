/**
 * GET /api/rooms — public room browser (integration-pass route).
 *
 * Reads the public_rooms mirror: public rows only, page envelope, and ONLY
 * the browser fields may leave — no members, no hidden state (STR/08 §1).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../src/models/public-room.js', () => ({
  PublicRoom: { find: vi.fn(), countDocuments: vi.fn() },
}));

import { createApp } from '../src/app.js';
import { PublicRoom } from '../src/models/public-room.js';
import { listen, request, TEST_CONFIG, type Listening } from './helpers/harness.js';

/** Flattened mirror docs as the lean() query returns them. */
const ROWS = [
  {
    _id: 'K7QX2',
    name: 'High Noon Saloon',
    hostNickname: 'Seth',
    theme: 'saloon',
    capacity: 4,
    seatsTaken: 3,
    visibility: 'public',
    updatedAt: new Date('2026-11-23T20:00:00Z'),
  },
  {
    _id: 'AB9JW',
    name: 'Quiet Table',
    hostNickname: 'Mary',
    theme: 'study',
    capacity: 2,
    seatsTaken: 2,
    visibility: 'public',
    updatedAt: new Date('2026-11-23T20:05:00Z'),
  },
];

/** Chainable stand-in for the mongoose query the route builds (honors skip/limit). */
function chainable(rows: unknown[]): unknown {
  let out = rows;
  const node: Record<string, unknown> = {
    exec: () => Promise.resolve(out),
  };
  node.sort = vi.fn(() => node);
  node.skip = vi.fn((n: number) => {
    out = out.slice(n);
    return node;
  });
  node.limit = vi.fn((n: number) => {
    out = out.slice(0, n);
    return node;
  });
  node.lean = vi.fn(() => node);
  return node;
}

describe('GET /api/rooms', () => {
  let app: Listening;

  beforeAll(async () => {
    app = await listen(createApp(TEST_CONFIG));
  });
  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(PublicRoom.find).mockImplementation(
      () => chainable(ROWS) as never,
    );
    vi.mocked(PublicRoom.countDocuments).mockImplementation(
      () => ({ exec: () => Promise.resolve(ROWS.length) }) as never,
    );
  });

  it('returns the page envelope with browser fields only', async () => {
    const res = await request(`${app.url}/api/rooms`);
    expect(res.status).toBe(200);
    const body = res.body as { rooms: unknown[]; page: number; perPage: number; total: number };
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(20);
    expect(body.total).toBe(2);
    expect(body.rooms).toHaveLength(2);
    expect(body.rooms[0]).toEqual({
      roomCode: 'K7QX2',
      name: 'High Noon Saloon',
      hostNickname: 'Seth',
      theme: 'saloon',
      capacity: 4,
      seatsTaken: 3,
      updatedAt: ROWS[0].updatedAt.toISOString(),
    });
    // Only browser fields ever leave — no extra mirror columns sneak out.
    expect(Object.keys(body.rooms[0] as object).sort()).toEqual(
      ['capacity', 'hostNickname', 'name', 'roomCode', 'seatsTaken', 'theme', 'updatedAt'].sort(),
    );
  });

  it('queries the public mirror and applies paging', async () => {
    const res = await request(`${app.url}/api/rooms?page=2&perPage=1`);
    expect(res.status).toBe(200);
    expect(PublicRoom.find).toHaveBeenCalledWith({ visibility: 'public' });
    const find = vi.mocked(PublicRoom.find).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
    expect(find.skip).toHaveBeenCalledWith(1);
    expect(find.limit).toHaveBeenCalledWith(1);
    const body = res.body as { rooms: unknown[]; page: number; perPage: number };
    expect(body.page).toBe(2);
    expect(body.perPage).toBe(1);
    expect(body.rooms).toHaveLength(1);
  });

  it('rejects out-of-range paging with 400 VALIDATION', async () => {
    const tooBig = await request(`${app.url}/api/rooms?perPage=51`);
    expect(tooBig.status).toBe(400);
    expect(tooBig.body).toEqual({ error: 'VALIDATION' });
    const zero = await request(`${app.url}/api/rooms?page=0`);
    expect(zero.status).toBe(400);
    expect(zero.body).toEqual({ error: 'VALIDATION' });
  });
});
