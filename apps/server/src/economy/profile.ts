/**
 * Profile service — STR/09 "Derived reads": account + derived coin balance +
 * title progress + last 10 match records. Response is the authed user's own
 * data, and STILL ships an explicit no-PII user projection: no email, no
 * provider identity (the web client already holds those from /api/auth/me).
 */
import { User } from '../models/user.js';
import { MatchRecord as MatchRecordModel } from '../models/match-record.js';
import { deriveBalance } from '../lib/wallet.js';
import { TitleProgress } from './models/title-progress.js';
import { computeLevel, levelProgress, type LevelProgress } from './levels.js';

export const RECENT_MATCH_RECORDS_LIMIT = 10;

/** Everything the web client may display about its own player. */
export interface ProfileUser {
  id: string;
  nickname: string;
  name: string;
  avatarUrl: string | null;
  avatarSpec: unknown;
  activeTitle: string | null;
  role: string;
  xp: number;
  level: number;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface ProfileMatchRecord {
  matchId: string;
  roomCode: string;
  endedAt: Date;
  capacity: number;
  theme: string;
  summary: { rounds: number; totalPulls: number; dareDevilMoments: number };
  /** The requesting player's own line of that match record. */
  you: {
    seat: number;
    nickname: string;
    titleAtPlay: string | null;
    stats: {
      kills: number;
      catches: number;
      falseAccusations: number;
      bluffSuccesses: number;
      deaths: number;
      pullsSurvived: number;
      roundsPlayed: number;
      won: boolean;
      xpEarned: number;
      coinsEarned: number;
    };
  };
}

export interface ProfileResponse {
  user: ProfileUser;
  /** Canonical level — recomputed from xp (never the stored column). */
  level: number;
  levelProgress: LevelProgress;
  /** Equipped title (idle); unlocked count rides separately. */
  title: string | null;
  coins: number;
  unlockedTitleCount: number;
  recentMatchRecords: ProfileMatchRecord[];
}

export class ProfileNotFoundError extends Error {
  constructor() {
    super('user not found');
    this.name = 'ProfileNotFoundError';
  }
}

interface LeanUserDoc {
  _id: unknown;
  nickname?: unknown;
  name?: unknown;
  avatarUrl?: unknown;
  avatarSpec?: unknown;
  activeTitle?: unknown;
  role?: unknown;
  xp?: unknown;
  level?: unknown;
  createdAt?: unknown;
  lastSeenAt?: unknown;
}

interface LeanPlayerDoc {
  seat?: unknown;
  nickname?: unknown;
  titleAtPlay?: unknown;
  accountId?: unknown;
  stats?: Record<string, unknown>;
}

interface LeanRecordDoc {
  matchId?: unknown;
  roomCode?: unknown;
  endedAt?: unknown;
  capacity?: unknown;
  theme?: unknown;
  summary?: Record<string, unknown>;
  players?: LeanPlayerDoc[];
}

export async function getProfile(userId: string): Promise<ProfileResponse> {
  const user = (await User.findById(userId)
    .select('nickname name avatarUrl avatarSpec activeTitle role xp level createdAt lastSeenAt')
    .lean()
    .exec()) as LeanUserDoc | null;
  if (!user) throw new ProfileNotFoundError();

  const [coins, unlockedTitleCount, records] = await Promise.all([
    deriveBalance(userId),
    TitleProgress.countDocuments({ accountId: userId }).exec(),
    MatchRecordModel.find({ 'players.accountId': userId })
      .sort({ endedAt: -1 })
      .limit(RECENT_MATCH_RECORDS_LIMIT)
      .lean()
      .exec() as unknown as Promise<LeanRecordDoc[]>,
  ]);

  const num = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const totalXp = num(user.xp);

  const recentMatchRecords: ProfileMatchRecord[] = [];
  for (const rec of records) {
    const mine = (rec.players ?? []).find(
      (p) => String(p.accountId ?? '') === String(user._id) || p.accountId?.toString() === userId,
    );
    if (!mine) continue;
    const s = mine.stats ?? {};
    recentMatchRecords.push({
      matchId: strOrNull(rec.matchId) ?? '',
      roomCode: strOrNull(rec.roomCode) ?? '',
      endedAt: rec.endedAt instanceof Date ? rec.endedAt : new Date(num(rec.endedAt)),
      capacity: num(rec.capacity),
      theme: strOrNull(rec.theme) ?? 'saloon',
      summary: {
        rounds: num((rec.summary ?? {})['rounds']),
        totalPulls: num((rec.summary ?? {})['totalPulls']),
        dareDevilMoments: num((rec.summary ?? {})['dareDevilMoments']),
      },
      you: {
        seat: num(mine.seat, -1),
        nickname: strOrNull(mine.nickname) ?? 'Player',
        titleAtPlay: strOrNull(mine.titleAtPlay),
        stats: {
          kills: num(s['kills']),
          catches: num(s['catches']),
          falseAccusations: num(s['falseAccusations']),
          bluffSuccesses: num(s['bluffSuccesses']),
          deaths: num(s['deaths']),
          pullsSurvived: num(s['pullsSurvived']),
          roundsPlayed: num(s['roundsPlayed']),
          won: s['won'] === true,
          xpEarned: num(s['xpEarned']),
          coinsEarned: num(s['coinsEarned']),
        },
      },
    });
  }

  return {
    user: {
      id: String(user._id),
      nickname: strOrNull(user.nickname) ?? 'Player',
      name: strOrNull(user.name) ?? '',
      avatarUrl: strOrNull(user.avatarUrl),
      avatarSpec: user.avatarSpec ?? {},
      activeTitle: strOrNull(user.activeTitle),
      role: strOrNull(user.role) ?? 'user',
      xp: totalXp,
      level: computeLevel(totalXp),
      createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(0),
      lastSeenAt: user.lastSeenAt instanceof Date ? user.lastSeenAt : new Date(0),
    },
    level: computeLevel(totalXp),
    levelProgress: levelProgress(totalXp),
    title: strOrNull(user.activeTitle),
    coins,
    unlockedTitleCount: Number(unlockedTitleCount) || 0,
    recentMatchRecords,
  };
}
