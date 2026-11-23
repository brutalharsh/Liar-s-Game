/**
 * Catalog + coin-pack seed (npm run seed:catalog) — idempotent per STR/04.
 *
 * Re-runs are safe: rows are created ONLY when missing ($setOnInsert), so
 * admin dashboard edits to names/prices are NEVER clobbered. To reset a
 * value to spec, delete the row (or edit it in the dashboard) and re-run.
 *
 * Content per STR/04 §1/§3:
 *  - coin packs: starter ₹49/500 · popular ₹99/1200(+100) · big-bag
 *    ₹199/2500(+350) · whale ₹399/5500(+1000)
 *  - hair 6 (2 free) · beard 4 (1 free) · hat 5 · shirt 6 (2 free) ·
 *    glasses 3 · frames 8 (2 free, 4 level-locked) · anims 4 (1 free) ·
 *    voice packs 2 · themes 2 free + 6 premium
 */
import { loadConfig } from '@liars-game/shared/server';
import mongoose from 'mongoose';
import { CatalogItem } from '../src/models/catalog-item.js';
import { CoinPack } from '../src/models/coin-pack.js';

interface ItemSeed {
  _id: string;
  category:
    | 'hair'
    | 'beard'
    | 'hat'
    | 'shirt'
    | 'glasses'
    | 'frame'
    | 'anim'
    | 'voicePack'
    | 'theme';
  name: string;
  price: number;
  free?: boolean;
  tier?: 'common' | 'rare' | 'epic';
  levelReq?: number;
  sort: number;
  theme?: { bg?: string; felt?: string; cardBack?: string; ambience?: string };
}

const HAIR: ItemSeed[] = [
  { _id: 'hair:short', category: 'hair', name: 'Short Back', price: 0, free: true, sort: 1 },
  { _id: 'hair:braids', category: 'hair', name: 'Braids', price: 0, free: true, sort: 2 },
  { _id: 'hair:afro', category: 'hair', name: 'Afro', price: 50, sort: 3 },
  { _id: 'hair:man-bun', category: 'hair', name: 'Man Bun', price: 100, sort: 4 },
  { _id: 'hair:mohawk', category: 'hair', name: 'Mohawk', price: 120, tier: 'rare', sort: 5 },
  { _id: 'hair:pompadour', category: 'hair', name: 'Pompadour', price: 150, tier: 'rare', sort: 6 },
];

const BEARD: ItemSeed[] = [
  { _id: 'beard:clean-shaven', category: 'beard', name: 'Clean Shaven', price: 0, free: true, sort: 1 },
  { _id: 'beard:goatee', category: 'beard', name: 'Goatee', price: 75, sort: 2 },
  { _id: 'beard:moustache', category: 'beard', name: 'Handlebar Moustache', price: 100, sort: 3 },
  { _id: 'beard:full-beard', category: 'beard', name: 'Full Beard', price: 150, tier: 'rare', sort: 4 },
];

const HAT: ItemSeed[] = [
  { _id: 'hat:cap', category: 'hat', name: 'Flat Cap', price: 100, sort: 1 },
  { _id: 'hat:bowler', category: 'hat', name: 'Bowler', price: 150, sort: 2 },
  { _id: 'hat:fedora', category: 'hat', name: 'Fedora', price: 200, tier: 'rare', sort: 3 },
  { _id: 'hat:cowboy', category: 'hat', name: 'Cowboy', price: 250, tier: 'rare', sort: 4 },
  { _id: 'hat:sombrero', category: 'hat', name: 'Sombrero', price: 250, tier: 'rare', sort: 5 },
];

const SHIRT: ItemSeed[] = [
  { _id: 'shirt:white', category: 'shirt', name: 'Dealer White', price: 0, free: true, sort: 1 },
  { _id: 'shirt:red', category: 'shirt', name: 'Saloon Red', price: 0, free: true, sort: 2 },
  { _id: 'shirt:poncho', category: 'shirt', name: 'Poncho', price: 100, sort: 3 },
  { _id: 'shirt:vest', category: 'shirt', name: 'Leather Vest', price: 150, sort: 4 },
  { _id: 'shirt:waistcoat', category: 'shirt', name: 'Waistcoat', price: 200, tier: 'rare', sort: 5 },
  { _id: 'shirt:pinstripe', category: 'shirt', name: 'Pinstripe Suit', price: 300, tier: 'epic', sort: 6 },
];

const GLASSES: ItemSeed[] = [
  { _id: 'glasses:round', category: 'glasses', name: 'Round Shades', price: 75, sort: 1 },
  { _id: 'glasses:aviators', category: 'glasses', name: 'Aviators', price: 100, sort: 2 },
  { _id: 'glasses:monocle', category: 'glasses', name: 'Monocle', price: 150, tier: 'rare', sort: 3 },
];

const FRAMES: ItemSeed[] = [
  { _id: 'frame:plain', category: 'frame', name: 'Plain Frame', price: 0, free: true, sort: 1 },
  { _id: 'frame:wooden', category: 'frame', name: 'Wooden Frame', price: 0, free: true, sort: 2 },
  { _id: 'frame:brass', category: 'frame', name: 'Brass Frame', price: 150, sort: 3 },
  { _id: 'frame:neon', category: 'frame', name: 'Neon Frame', price: 250, tier: 'rare', sort: 4 },
  // Prestige frames: EARNED at level milestones — never purchasable.
  { _id: 'frame:prestige-bronze', category: 'frame', name: 'Prestige Bronze', price: 250, levelReq: 10, sort: 5 },
  { _id: 'frame:prestige-silver', category: 'frame', name: 'Prestige Silver', price: 300, levelReq: 20, sort: 6 },
  { _id: 'frame:prestige-gold', category: 'frame', name: 'Prestige Gold', price: 400, levelReq: 30, tier: 'epic', sort: 7 },
  { _id: 'frame:prestige-diamond', category: 'frame', name: 'Prestige Diamond', price: 500, levelReq: 40, tier: 'epic', sort: 8 },
];

const ANIMS: ItemSeed[] = [
  { _id: 'anim:idle-drunk', category: 'anim', name: 'Drunk Sway (idle)', price: 0, free: true, sort: 1 },
  { _id: 'anim:idle-whistler', category: 'anim', name: 'Whistler (idle)', price: 200, sort: 2 },
  { _id: 'anim:win-tipping', category: 'anim', name: 'Hat Tip (win)', price: 300, tier: 'rare', sort: 3 },
  { _id: 'anim:death-dramatic', category: 'anim', name: 'Dramatic Collapse (death)', price: 400, tier: 'epic', sort: 4 },
];

const VOICE_PACKS: ItemSeed[] = [
  { _id: 'voicePack:villain', category: 'voicePack', name: 'Villain Voice', price: 250, sort: 1 },
  { _id: 'voicePack:robot', category: 'voicePack', name: 'Robotic Voice', price: 500, tier: 'epic', sort: 2 },
];

function theme(slug: string, name: string, price: number, sort: number, tier: 'rare' | 'epic' = 'rare'): ItemSeed {
  return {
    _id: `theme:${slug}`,
    category: 'theme',
    name,
    price,
    tier,
    sort,
    theme: {
      bg: `themes/${slug}/bg`,
      felt: `themes/${slug}/felt`,
      cardBack: `themes/${slug}/card-back`,
      ambience: `themes/${slug}/ambience`,
    },
  };
}

const THEMES: ItemSeed[] = [
  { _id: 'theme:saloon', category: 'theme', name: 'The Saloon', price: 0, free: true, sort: 1, theme: { bg: 'themes/saloon/bg', felt: 'themes/saloon/felt', cardBack: 'themes/saloon/card-back', ambience: 'themes/saloon/ambience' } },
  { _id: 'theme:house-table', category: 'theme', name: 'House Table', price: 0, free: true, sort: 2, theme: { bg: 'themes/house-table/bg', felt: 'themes/house-table/felt', cardBack: 'themes/house-table/card-back', ambience: 'themes/house-table/ambience' } },
  theme('neon-district', 'Neon District', 400, 3),
  theme('jazz-speakeasy', 'Jazz Speakeasy', 500, 4),
  theme('casino-royale', 'Casino Royale', 600, 5),
  theme('kabuki-alley', 'Kabuki Alley', 600, 6),
  theme('haunted-inn', 'Haunted Inn', 700, 6),
  theme('orbital-cantina', 'Orbital Cantina', 800, 8, 'epic'),
];

const CATALOG: ItemSeed[] = [
  ...HAIR,
  ...BEARD,
  ...HAT,
  ...SHIRT,
  ...GLASSES,
  ...FRAMES,
  ...ANIMS,
  ...VOICE_PACKS,
  ...THEMES,
];

const PACKS = [
  { _id: 'starter', name: 'Starter Pack', priceMajor: 49, coins: 500, sortOrder: 1 },
  { _id: 'popular', name: 'Popular Pack', priceMajor: 99, coins: 1200, bonus: 100, sortOrder: 2 },
  { _id: 'big-bag', name: 'Big Bag', priceMajor: 199, coins: 2500, bonus: 350, sortOrder: 3 },
  { _id: 'whale', name: 'Whale Pack', priceMajor: 399, coins: 5500, bonus: 1000, sortOrder: 4 },
];

async function main(): Promise<void> {
  const config = loadConfig();
  await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDb });
  console.log(`[seed] connected to db "${config.mongodbDb}"`);

  let created = 0;
  for (const item of CATALOG) {
    const result = await CatalogItem.updateOne(
      { _id: item._id },
      { $setOnInsert: { ...item, active: true } },
      { upsert: true },
    ).exec();
    if (result.upsertedCount === 1) created += 1;
  }

  let packsCreated = 0;
  for (const pack of PACKS) {
    const result = await CoinPack.updateOne(
      { _id: pack._id },
      { $setOnInsert: { ...pack, active: true } },
      { upsert: true },
    ).exec();
    if (result.upsertedCount === 1) packsCreated += 1;
  }

  console.log(
    `[seed] catalog: ${created}/${CATALOG.length} created (${CATALOG.length - created} already present), ` +
      `packs: ${packsCreated}/${PACKS.length} created`,
  );
  console.log('[seed] existing rows are never modified — dashboard edits stay intact');

  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error('[seed] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
