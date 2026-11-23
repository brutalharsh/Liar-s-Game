/**
 * public_rooms — schema-only stub for wave S1 (game rooms). Registry mirror
 * for the public room browser; TTL index 10 min on updatedAt makes stale
 * rooms vanish automatically (STR/09).
 */
import { Schema, model } from 'mongoose';

export interface PublicRoomFields {
  name: string;
  hostNickname: string;
  theme: string;
  capacity: number;
  seatsTaken: number;
  visibility: string;
  updatedAt: Date;
}

const PublicRoomSchema = new Schema<PublicRoomFields & { _id: string }>(
  {
    _id: { type: String }, // room code (5 chars, secret — STR/08 §6)
    name: { type: String, required: true },
    hostNickname: { type: String, required: true },
    theme: { type: String, default: 'saloon' },
    capacity: { type: Number, required: true, min: 2, max: 10 },
    seatsTaken: { type: Number, required: true, min: 0 },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// TTL: rooms disappear 10 minutes after their last update.
PublicRoomSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 600 });

export const PublicRoom = model<PublicRoomFields & { _id: string }>(
  'public_rooms',
  PublicRoomSchema,
);
