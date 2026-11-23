import type { MatchRecord, PlayerState, RoomState, ViewPlayerState } from '../src/types.js';

export function makeViewPlayer(overrides: Partial<ViewPlayerState> = {}): ViewPlayerState {
  return {
    seat: 0,
    nickname: 'Foxy',
    avatarSpec: { base: 'fox' },
    connected: true,
    afk: false,
    isHost: true,
    handCount: 3,
    pulls: 0,
    alive: true,
    activeTitle: null,
    ...overrides,
  };
}

export function makeMe(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    seat: 0,
    nickname: 'Foxy',
    avatarSpec: { base: 'fox' },
    connected: true,
    afk: false,
    isHost: true,
    hand: [
      { id: 'c_01', rank: 'K' },
      { id: 'c_02', rank: 'J' },
      { id: 'c_03', rank: 'A' },
    ],
    handCount: 3,
    pulls: 0,
    alive: true,
    activeTitle: 'Sharp Eye',
    ...overrides,
  };
}

export function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomCode: 'AB2C9',
    name: 'The Saloon',
    capacity: 7,
    theme: 'saloon',
    visibility: 'public',
    phase: 'playing',
    hostSeat: 0,
    seats: [
      makeViewPlayer(),
      makeViewPlayer({
        seat: 1,
        nickname: 'Scubby',
        isHost: false,
        handCount: 1,
        pulls: 2,
        activeTitle: null,
        avatarSpec: null,
      }),
    ],
    you: makeMe(),
    spectator: false,
    seq: 42,
    roundNo: 3,
    tableCard: 'K',
    currentTurnSeat: 0,
    deadlineTs: 1794971053500,
    pileTotal: 4,
    challengeWindow: null,
    ...overrides,
  };
}

export function makeMatchRecord(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    matchId: 'm_0001',
    roomCode: 'AB2C9',
    startedAt: 1794970000000,
    endedAt: 1794975000000,
    capacity: 7,
    theme: 'saloon',
    players: [
      {
        accountId: 'acc_1',
        seat: 0,
        nickname: 'Foxy',
        avatarSpec: { base: 'fox' },
        titleAtPlay: 'Sharp Eye',
        stats: {
          kills: 1,
          catches: 2,
          falseAccusations: 0,
          bluffSuccesses: 3,
          deaths: 0,
          pullsSurvived: 1,
          roundsPlayed: 4,
          won: true,
          xpEarned: 12,
          coinsEarned: 13,
        },
      },
      {
        accountId: 'acc_2',
        seat: 1,
        nickname: 'Scubby',
        avatarSpec: null,
        stats: {
          kills: 0,
          catches: 0,
          falseAccusations: 1,
          bluffSuccesses: 0,
          deaths: 1,
          deathCause: 'executed',
          pullsSurvived: 0,
          roundsPlayed: 4,
          won: false,
          xpEarned: 4,
          coinsEarned: 3,
        },
      },
    ],
    summary: { rounds: 4, totalPulls: 2, dareDevilMoments: 1 },
    ...overrides,
  };
}
