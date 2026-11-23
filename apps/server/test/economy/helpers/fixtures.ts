/**
 * Shared E1 test fixtures — a realistic rules-engine MatchRecord (hand-built
 * against @liars-game/rules-engine types, per the contract-fidelity test).
 *
 * Roster of five:
 *  - winner: 12 XP (win), 8 coins (3 rounds survived + randInt roll of 5)
 *  - liar:   died executed → 4 XP, 2 coins (2 rounds survived)
 *  - survivor: alive-to-the-end loser → 6 XP, 2 coins
 *  - leaver:  left mid-match → 0 XP (left-alive), KEEPS 1 round coin (R1 ⑧/⑩)
 *  - banned: would be granted 6 XP / 3 coins if not banned — expect skip
 */
import type { LogEntry, MatchRecord } from '@liars-game/rules-engine';

export const ACCOUNT_IDS = {
  winner: '507f1f77bcf86cd799439001',
  liar: '507f1f77bcf86cd799439002',
  survivor: '507f1f77bcf86cd799439003',
  leaver: '507f1f77bcf86cd799439004',
  banned: '507f1f77bcf86cd799439005',
  ghost: '507f1f77bcf86cd799439006',
} as const;

export const MATCH_ID = 'm_20261123_0001';
export const ROOM_CODE = 'XKD2P';
export const SEED = 987_654_321;
export const ENDED_AT = new Date('2026-11-23T21:30:00.000Z');

export function buildRecord(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    matchId: MATCH_ID,
    roomCode: ROOM_CODE,
    startedAt: ENDED_AT.getTime() - 600_000,
    endedAt: ENDED_AT.getTime(),
    capacity: 5,
    theme: 'saloon',
    aborted: false,
    winnerSeat: 0,
    summary: { rounds: 3, totalPulls: 4, dareDevilMoments: 1 },
    players: [
      {
        seat: 0,
        accountId: ACCOUNT_IDS.winner,
        nickname: 'Ron',
        avatarSpec: { base: 'default' },
        titleAtPlay: 'sharp-eye',
        stats: {
          kills: 1,
          catches: 2,
          falseAccusations: 0,
          bluffSuccesses: 3,
          deaths: 0,
          pullsSurvived: 1,
          roundsPlayed: 3,
          roundsSurvived: 3,
          won: true,
          xpEarned: 12,
          coinsEarned: 8,
        },
      },
      {
        seat: 1,
        accountId: ACCOUNT_IDS.liar,
        nickname: 'Snake',
        stats: {
          kills: 1,
          catches: 1,
          falseAccusations: 1,
          bluffSuccesses: 1,
          deaths: 1,
          deathCause: 'executed',
          pullsSurvived: 0,
          roundsPlayed: 2,
          roundsSurvived: 2,
          won: false,
          xpEarned: 4,
          coinsEarned: 2,
        },
      },
      {
        seat: 2,
        accountId: ACCOUNT_IDS.survivor,
        nickname: 'Lucky',
        stats: {
          kills: 0,
          catches: 1,
          falseAccusations: 0,
          bluffSuccesses: 2,
          deaths: 0,
          pullsSurvived: 2,
          roundsPlayed: 3,
          roundsSurvived: 2,
          won: false,
          xpEarned: 6,
          coinsEarned: 2,
        },
      },
      {
        seat: 3,
        accountId: ACCOUNT_IDS.leaver,
        nickname: 'Gone',
        stats: {
          kills: 1,
          catches: 0,
          falseAccusations: 0,
          bluffSuccesses: 0,
          deaths: 0,
          pullsSurvived: 0,
          roundsPlayed: 1,
          roundsSurvived: 1,
          won: false,
          xpEarned: 0,
          coinsEarned: 1,
        },
      },
      {
        seat: 4,
        accountId: ACCOUNT_IDS.banned,
        nickname: 'Outlaw',
        stats: {
          kills: 0,
          catches: 0,
          falseAccusations: 0,
          bluffSuccesses: 0,
          deaths: 1,
          deathCause: 'selfRoulette',
          pullsSurvived: 0,
          roundsPlayed: 3,
          roundsSurvived: 3,
          won: false,
          xpEarned: 6,
          coinsEarned: 3,
        },
      },
    ],
    ...overrides,
  };
}

export function buildLog(): LogEntry[] {
  return [
    { seq: 0, event: { type: 'MATCH_START', at: 1 }, accepted: true },
    { seq: 1, event: { type: 'PLAY', seat: 1, cardIds: ['c_01'], at: 2 }, accepted: true },
    { seq: 2, event: { type: 'LIAR', seat: 0, at: 3 }, accepted: false, errCode: 'ERR_TOO_EARLY' },
    { seq: 3, event: { type: 'SHOT_ACK', at: 4 }, accepted: true },
  ];
}

export interface LeanUserRow {
  _id: string;
  nickname: string;
  xp: number;
  level: number;
  banned: boolean;
}

export const USER_ROWS: Record<string, LeanUserRow> = {
  [ACCOUNT_IDS.winner]: { _id: ACCOUNT_IDS.winner, nickname: 'Ron', xp: 0, level: 1, banned: false },
  [ACCOUNT_IDS.liar]: { _id: ACCOUNT_IDS.liar, nickname: 'Snake', xp: 721, level: 1, banned: false },
  [ACCOUNT_IDS.survivor]: {
    _id: ACCOUNT_IDS.survivor,
    nickname: 'Lucky',
    xp: 0,
    level: 1,
    banned: false,
  },
  [ACCOUNT_IDS.leaver]: { _id: ACCOUNT_IDS.leaver, nickname: 'Gone', xp: 150, level: 1, banned: false },
  [ACCOUNT_IDS.banned]: { _id: ACCOUNT_IDS.banned, nickname: 'Outlaw', xp: 0, level: 1, banned: true },
  // ghost: deliberately NOT in the user rows — the "unknown user" skip path.
};

/** Mongo-shaped E11000 duplicate-key error. */
export function duplicateKeyError(key: string): Error {
  return Object.assign(new Error(`E11000 duplicate key error: ${key}`), { code: 11000 });
}
