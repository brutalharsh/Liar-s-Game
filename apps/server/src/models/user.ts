/**
 * users — Discord/Google identity row (login REQUIRED to play — STR/09).
 * MongoDB name: `users`. Balance is NEVER stored here — always derived from
 * wallet_ledger (append-only invariant, STR/04 §7).
 */
import { Schema, model } from 'mongoose';

export type OAuthProvider = 'discord' | 'google';

export interface UserAvatarSpec {
  base: string;
  hair?: string;
  beard?: string;
  hat?: string;
  shirt?: string;
  glasses?: string;
  frame?: string;
  anim?: string;
  voicePack?: string;
}

export interface UserFields {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  nickname: string;
  role: 'user' | 'admin';
  banned: boolean;
  banReason?: string;
  avatarSpec: UserAvatarSpec;
  activeTitle?: string;
  xp: number;
  level: number;
  createdAt: Date;
  lastSeenAt: Date;
}

const AvatarSpecSchema = new Schema(
  {
    base: { type: String, required: true, default: 'default' },
    hair: { type: String },
    beard: { type: String },
    hat: { type: String },
    shirt: { type: String },
    glasses: { type: String },
    frame: { type: String },
    anim: { type: String },
    voicePack: { type: String },
  },
  { _id: false },
);

const UserSchema = new Schema<UserFields>({
  provider: { type: String, enum: ['discord', 'google'], required: true },
  providerId: { type: String, required: true },
  email: { type: String },
  name: { type: String, required: true },
  avatarUrl: { type: String },
  nickname: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  banned: { type: Boolean, default: false },
  banReason: { type: String },
  avatarSpec: { type: AvatarSpecSchema, default: () => ({ base: 'default' }) },
  activeTitle: { type: String },
  xp: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 1, min: 1, max: 100 },
  createdAt: { type: Date, default: () => new Date() },
  lastSeenAt: { type: Date, default: () => new Date() },
});

UserSchema.index({ provider: 1, providerId: 1 }, { unique: true });
// Sparse: Discord's `identify` scope yields no email → many rows with no email.
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ level: -1 });
UserSchema.index({ banned: 1 });

export const User = model<UserFields>('users', UserSchema);
