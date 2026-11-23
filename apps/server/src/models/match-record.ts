/**
 * match_records — schema-only stub for wave S1 (game rooms). Written once at
 * `game:over`; THE only source of leaderboard/XP/titles (STR/09). No route
 * writes it in this wave — the admin drill-down only counts rows.
 */
import { Schema, model } from 'mongoose';

export interface MatchStatsFields {
  kills: number;
  catches: number;
  falseAccusations: number;
  bluffSuccesses: number;
  deaths: number;
  deathCause?: string;
  pullsSurvived: number;
  roundsPlayed: number;
  won: boolean;
  xpEarned: number;
  coinsEarned: number;
}

export interface MatchPlayerFields {
  accountId: unknown; // ObjectId ref users
  seat: number;
  nickname: string;
  avatarSpec: unknown;
  titleAtPlay?: string;
  stats: MatchStatsFields;
}

export interface MatchRecordFields {
  matchId: string;
  roomCode: string;
  startedAt: Date;
  endedAt: Date;
  capacity: number;
  theme: string;
  players: MatchPlayerFields[];
  summary: { rounds: number; totalPulls: number; dareDevilMoments: number };
}

const MatchRecordSchema = new Schema<MatchRecordFields>({
  matchId: { type: String, required: true },
  roomCode: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 2, max: 10 },
  theme: { type: String, default: 'saloon' },
  players: [
    new Schema(
      {
        accountId: { type: Schema.Types.ObjectId, required: true },
        seat: { type: Number, required: true },
        nickname: { type: String, required: true },
        avatarSpec: { type: Schema.Types.Mixed, default: {} },
        titleAtPlay: { type: String },
        stats: {
          type: new Schema(
            {
              kills: { type: Number, default: 0 },
              catches: { type: Number, default: 0 },
              falseAccusations: { type: Number, default: 0 },
              bluffSuccesses: { type: Number, default: 0 },
              deaths: { type: Number, default: 0 },
              deathCause: { type: String },
              pullsSurvived: { type: Number, default: 0 },
              roundsPlayed: { type: Number, default: 0 },
              won: { type: Boolean, default: false },
              xpEarned: { type: Number, default: 0 },
              coinsEarned: { type: Number, default: 0 },
            },
            { _id: false },
          ),
          required: true,
        },
      },
      { _id: false },
    ),
  ],
  summary: {
    type: new Schema(
      {
        rounds: { type: Number, default: 0 },
        totalPulls: { type: Number, default: 0 },
        dareDevilMoments: { type: Number, default: 0 },
      },
      { _id: false },
    ),
    required: true,
  },
});

MatchRecordSchema.index({ matchId: 1 }, { unique: true });
MatchRecordSchema.index({ 'players.accountId': 1 });
MatchRecordSchema.index({ 'players.stats.kills': -1 }, { sparse: true });
MatchRecordSchema.index({ endedAt: -1 });

export const MatchRecord = model<MatchRecordFields>('match_records', MatchRecordSchema);
