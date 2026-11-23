/**
 * coin_packs — the pricing source of truth for real-money coin purchases
 * (STR/04 §1). `_id` is the pack key (starter|popular|big-bag|whale).
 * The billing flow ALWAYS prices from here — never from a request body.
 */
import { Schema, model } from 'mongoose';

export interface CoinPackFields {
  name: string;
  priceMajor: number; // INR major units (49 = ₹49.00) — the payment proxy converts to paise
  coins: number;
  bonus?: number;
  active: boolean;
  sortOrder: number;
}

const CoinPackSchema = new Schema<CoinPackFields & { _id: string }>({
  _id: { type: String }, // pack key: starter|popular|big-bag|whale
  name: { type: String, required: true },
  priceMajor: { type: Number, required: true, min: 1 },
  coins: { type: Number, required: true, min: 1 },
  bonus: { type: Number, min: 0 },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
});

export const CoinPack = model<CoinPackFields & { _id: string }>('coin_packs', CoinPackSchema);