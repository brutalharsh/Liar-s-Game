/**
 * title_progress — STR/09: cache from match_records, keyed per account+title.
 * Truth = cumulative stats recomputed on every grant (grant.ts); these rows
 * are the unlock ledger (unlockedAt + progress) that the profile page and
 * the `titles` leaderboard metric read.
 */
import { Schema, model } from 'mongoose';

export interface TitleProgressFields {
  accountId: unknown; // ObjectId ref users
  titleId: string;
  unlockedAt: Date;
  progress: number;
}

const TitleProgressSchema = new Schema<TitleProgressFields>({
  accountId: { type: Schema.Types.ObjectId, required: true },
  titleId: { type: String, required: true },
  unlockedAt: { type: Date, required: true },
  progress: { type: Number, required: true, min: 0 },
});

TitleProgressSchema.index({ accountId: 1, titleId: 1 }, { unique: true });
TitleProgressSchema.index({ accountId: 1 });

export const TitleProgress = model<TitleProgressFields>('title_progress', TitleProgressSchema);
