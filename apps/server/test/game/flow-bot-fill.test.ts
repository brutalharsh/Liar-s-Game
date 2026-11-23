/**
 * FLOW (c) — full bot-filled match to game:over (STR/02 host bot-fill):
 * ONE human host + bots in every other seat runs the whole pipeline — bots
 * drive the SAME applying path (PLAY/LIAR through rules-engine), the match
 * reaches a natural game:over, and the match-end seam carries the bots.
 *
 * Reward-skip fidelity (src/economy/grant.ts grantPlayer): a bot seat's
 * synthetic accountId must FAIL `mongoose.isValidObjectId` — the exact
 * predicate the grant uses to skip a seat ('skipped-no-account'): bots can
 * never be granted XP/coins. The wire `rewards` array still carries all four
 * seats (broadcast contract); the SKIPPING lives in the grant consumer.
 */
import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { parseServerEvent } from '@liars-game/shared';
import {
  FAST_MATCH_CONFIG,
  FAST_TIMING,
  TestEnv,
  createRoom,
  installAutoPlayer,
  waitFor,
} from './helpers.js';

describe('FLOW bot-fill: a full match where every bot id is skipped in rewards', () => {
  it('1 human + 3 bots → game:over; bot ids are bot:<roomCode>:<seat> and fail the grant ObjectId gate', async () => {
    const env = new TestEnv({ matchConfig: FAST_MATCH_CONFIG, timing: FAST_TIMING });
    const host = env.socket(env.user('host'));
    const code = await createRoom(env, host, { capacity: 4, visibility: 'private' });

    const botSeats: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const added = env.manager.addBotToRoom('host');
      if (!added.ok) throw new Error(`bot add failed: ${added.code}`);
      botSeats.push(added.data.seat);
    }
    expect(botSeats).toEqual([1, 2, 3]);

    const auto = installAutoPlayer(env, host, 'host');
    auto.seat = 0;

    const started = await host.client('game:start', {});
    expect(started?.ok).toBe(true);

    const over = await waitFor(
      () => env.manager.roomByCode(code)?.match?.isOver ?? false,
      60_000,
      20,
    );
    expect(over).toBe(true);

    // — the seam fired exactly once with the full payload —
    expect(env.matchEnds.length).toBe(1);
    const end = env.matchEnds[0]!;
    expect(end.roomCode).toBe(code);
    expect(end.seed).toBeGreaterThan(0);
    expect(end.log.length).toBeGreaterThan(5);
    expect(end.endedAt instanceof Date).toBe(true);

    // — record: four players, the human + three bots in bot id format —
    expect(end.record.players).toHaveLength(4);
    const bySeat = new Map(end.record.players.map((p) => [p.seat, p]));
    expect(bySeat.get(0)!.accountId).toBe('host');
    for (const seat of botSeats) {
      const acct = bySeat.get(seat)!.accountId!;
      expect(acct).toBe(`bot:${code}:${seat}`); // literal format, not src's builder
      expect(acct.startsWith('bot:')).toBe(true);
      // THE rewards-skip predicate (grant.ts grantPlayer → 'skipped-no-account'):
      expect(mongoose.isValidObjectId(acct)).toBe(false);
      // bots truly played the same pipeline
      expect(bySeat.get(seat)!.stats.roundsPlayed).toBeGreaterThan(0);
    }
    expect(
      end.log.some((l) => l.accepted && l.event.type === 'PLAY' && botSeats.includes(l.event.seat)),
    ).toBe(true);
    expect(end.record.summary.rounds).toBeGreaterThan(0);

    // — the wire side: strict shared zod accepts the bot-inclusive payloads —
    const gameOver = host.last('game:over')!;
    expect(gameOver).toBeDefined();
    expect(() => parseServerEvent('game:over', gameOver as never)).not.toThrow();
    const rec = gameOver['matchRecord'] as {
      players: { accountId: string; seat: number }[];
    };
    expect(rec.players).toHaveLength(4);
    for (const seat of botSeats) {
      expect(rec.players.find((p) => p.seat === seat)!.accountId.startsWith(`bot:${code}:`)).toBe(true);
    }

    // rewards ride the wire for ALL FOUR seats (broadcast contract) — the
    // bot skip lives in the grant consumer, keyed on the ids checked above.
    const rewards = gameOver['rewards'] as { seat: number; accountId?: string; xp: number; coins: number }[];
    expect(rewards).toHaveLength(4);
    const botRewards = rewards.filter((r) => (r.accountId ?? '').startsWith('bot:'));
    expect(botRewards).toHaveLength(3);
    for (const r of botRewards) {
      expect(mongoose.isValidObjectId(r.accountId)).toBe(false);
    }

    // exactly one winner; every player got an xp number (engine-computed)
    expect(end.record.players.filter((p) => p.stats.won)).toHaveLength(1);
    expect(end.record.players.every((p) => typeof p.stats.xpEarned === 'number')).toBe(true);
  }, 90_000);
});
