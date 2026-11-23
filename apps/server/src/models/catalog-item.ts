/**
 * catalog_items — every purchasable/claimable cosmetic (STR/09 §catalog).
 * `_id` is the composite `category:slug` (e.g. `hair:mohawk`,
 * `theme:neon-district`). Art references keep {imageId, imageUrl}
 * TOGETHER — never URL-only (image-server lifecycle rule).
 *
 * Admin dashboard may PATCH name / price / active (+ art fields + tier,
 * levelReq, sort). lvimReq marks level-locked (earned) items — the shop
 * rejects purchases below that level.
 */
import { Schema, model } from 'mongoose';

export const CATALOG_CATEGORIES = [
  'hair',
  'beard',
  'hat',
  'shirt',
  'glasses',
  'frame',
  'anim',
  'voicePack',
  'theme',
  'body',
] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const CATALOG_TIERS = ['common', 'rare', 'epic'] as const;
export type CatalogTier = (typeof CATALOG_TIERS)[number];

export interface ThemeFields {
  bg?: string;
  felt?: string;
  cardBack?: string;
  ambience?: string;
}

export interface CatalogItemFields {
  name: string;
  category: CatalogCategory;
  price: number;
  free: boolean;
  active: boolean;
  tier: CatalogTier;
  levelReq?: number;
  artSlug?: string;
  imageId?: string;
  imageUrl?: string;
  imageName?: string;
  sort: number;
  theme?: ThemeFields;
}

const CatalogItemSchema = new Schema<CatalogItemFields & { _id: string }>({
  _id: { type: String }, // composite `category:slug` — the shop's canonical item key
  name: { type: String, required: true },
  category: { type: String, enum: CATALOG_CATEGORIES, required: true },
  price: { type: Number, default: 0, min: 0 },
  free: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  tier: { type: String, enum: CATALOG_TIERS, default: 'common' },
  levelReq: { type: Number, min: 1, max: 100 },
  artSlug: { type: String },
  imageId: { type: String },
  imageUrl: { type: String },
  imageName: { type: String },
  sort: { type: Number, default: 0 },
  theme: {
    type: new Schema(
      {
        bg: { type: String },
        felt: { type: String },
        cardBack: { type: String },
        ambience: { type: String },
      },
      { _id: false },
    ),
  },
});

CatalogItemSchema.index({ active: 1, category: 1, sort: 1 });

export const CatalogItem = model<CatalogItemFields & { _id: string }>(
  'catalog_items',
  CatalogItemSchema,
);