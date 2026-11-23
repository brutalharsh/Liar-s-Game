import type { ThemeId } from "@/lib/wire";

/**
 * Shop catalog — mock items with coin prices per STR/04 §3 ranges.
 * Real purchases are server-validated (STR/04 §3); these ids/prices mirror
 * the `GET /api/catalog` shape for the W3 wiring wave.
 */

export type ShopCategory =
  | "hair"
  | "beard"
  | "hat"
  | "shirt"
  | "glasses"
  | "frame"
  | "animation"
  | "voice"
  | "theme";

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  price: number; // 0 = free starter item
  overlay: string; // mock preview emoji
  desc: string;
  levelReq?: number; // frames: earned via level, never purchasable
  themeId?: ThemeId; // for category === "theme"
}

export const SHOP_CATEGORIES: readonly { id: ShopCategory; label: string; emoji: string }[] = [
  { id: "hair", label: "Hair", emoji: "💇" },
  { id: "beard", label: "Beard", emoji: "🧔" },
  { id: "hat", label: "Hats", emoji: "🎩" },
  { id: "shirt", label: "Shirts", emoji: "👔" },
  { id: "glasses", label: "Glasses", emoji: "🕶️" },
  { id: "frame", label: "Frames", emoji: "🖼️" },
  { id: "animation", label: "Animations", emoji: "💫" },
  { id: "voice", label: "Voice packs", emoji: "🎙️" },
  { id: "theme", label: "Themes", emoji: "🎪" },
] as const;

export const SHOP_ITEMS: readonly ShopItem[] = [
  // hair — 2 free starter (STR/04 §3)
  { id: "hair-pompadour", category: "hair", name: "Slick Pompadour", price: 0, overlay: "💇", desc: "The house special." },
  { id: "hair-bleach", category: "hair", name: "Bleach Job", price: 0, overlay: "👱", desc: "Tells everyone you bluff." },
  { id: "hair-ginger", category: "hair", name: "Ginger Wake", price: 80, overlay: "🦰", desc: "Spicy and untrustworthy." },
  { id: "hair-brunette", category: "hair", name: "Deep Brunette", price: 100, overlay: "👨‍🦱", desc: "Subtle. Too subtle." },
  { id: "hair-mullet", category: "hair", name: "Wild Mullet", price: 150, overlay: "👨", desc: "Business up front, liar out back." },
  { id: "hair-silver", category: "hair", name: "Silver Fox", price: 150, overlay: "👨‍🦳", desc: "For distinguished deceivers." },
  // beard — 1 free
  { id: "beard-incognito", category: "beard", name: "Incognito", price: 0, overlay: "🥸", desc: "Nobody knows it's you." },
  { id: "beard-dock", category: "beard", name: "Full Dockhand", price: 90, overlay: "🧔", desc: "Salt, spray and whiskers." },
  { id: "beard-stubble", category: "beard", name: "Three-Day Stubble", price: 120, overlay: "✂️", desc: "Grit over grooming." },
  { id: "beard-longgrey", category: "beard", name: "The Elder", price: 150, overlay: "🧙", desc: "Speaks only in proverbs." },
  // hats
  { id: "hat-stetson", category: "hat", name: "Saloon Stetson", price: 100, overlay: "🤠", desc: "Genuine felt. Mostly." },
  { id: "hat-bowler", category: "hat", name: "Bowler", price: 120, overlay: "🎩", desc: "Respectable menace." },
  { id: "hat-newsboy", category: "hat", name: "Newsboy Cap", price: 150, overlay: "🧢", desc: "`Extra! Extra!` energy." },
  { id: "hat-feather", category: "hat", name: "Feather Trilby", price: 200, overlay: "🪶", desc: "One plume of pure smug." },
  { id: "hat-professor", category: "hat", name: "Professor's Mortarboard", price: 250, overlay: "🎓", desc: "Counts cards. Allegedly." },
  // shirts — 2 free
  { id: "shirt-vest", category: "shirt", name: "Saloon Vest", price: 0, overlay: "🎽", desc: "House dress code." },
  { id: "shirt-stringtie", category: "shirt", name: "String Tie", price: 0, overlay: "👔", desc: "Tie it like a noose." },
  { id: "shirt-denim", category: "shirt", name: "Denim Jacket", price: 150, overlay: "🧥", desc: "Won't wash out the guilt." },
  { id: "shirt-cardsharp", category: "shirt", name: "Card Sharp Blazer", price: 220, overlay: "🤵", desc: "Aces hide in the lining." },
  { id: "shirt-rouge", category: "shirt", name: "Rouge Dress Shirt", price: 260, overlay: "👕", desc: "Stained with blind trust." },
  { id: "shirt-hi-vis", category: "shirt", name: "Hi-Vis Vest", price: 300, overlay: "🦺", desc: "They'll see the lie coming." },
  // glasses
  { id: "glasses-shades", category: "glasses", name: "Dive Shades", price: 75, overlay: "🕶️", desc: "Eyes never blink." },
  { id: "glasses-goggles", category: "glasses", name: "Aviator Goggles", price: 120, overlay: "🥽", desc: "For card-toss turbulence." },
  { id: "glasses-monocle", category: "glasses", name: "Monocle", price: 150, overlay: "🧐", desc: "Inspects your nonsense." },
  // frames — 2 free, 4 level-locked, 2 purchasable (STR/04 §3)
  { id: "frame-plain", category: "frame", name: "Plain Hoop", price: 0, overlay: "⚪", desc: "Honest and boring." },
  { id: "frame-brass", category: "frame", name: "Brass Ring", price: 0, overlay: "🟡", desc: "Polished on weekends." },
  { id: "frame-mahogany", category: "frame", name: "Mahogany Frame", price: 150, overlay: "🔶", desc: "Aged like a grudge." },
  { id: "frame-ivory", category: "frame", name: "Ivory Inlay", price: 250, overlay: "💠", desc: "Probable cause, officer." },
  { id: "frame-vortex", category: "frame", name: "Signet Vortex", price: 500, overlay: "🌀", desc: "You can't look away." },
  { id: "frame-deputy", category: "frame", name: "Deputy Star", price: 0, levelReq: 10, overlay: "⭐", desc: "Earned at level 10." },
  { id: "frame-marshal", category: "frame", name: "Marshal Star", price: 0, levelReq: 20, overlay: "🌟", desc: "Earned at level 20." },
  { id: "frame-halo", category: "frame", name: "Legend Halo", price: 0, levelReq: 40, overlay: "💫", desc: "Earned at level 40." },
  { id: "frame-topshelf", category: "frame", name: "Top Shelf", price: 0, levelReq: 50, overlay: "🏆", desc: "Earned at level 50." },
  // animations — 1 idle free
  { id: "anim-sway", category: "animation", name: "Idle Sway", price: 0, overlay: "🌊", desc: "Just leaning on the bar." },
  { id: "anim-draw", category: "animation", name: "Slow Draw Nod", price: 250, overlay: "🎯", desc: "Idle: lets the silence talk." },
  { id: "anim-victory", category: "animation", name: "Victory Bow", price: 300, overlay: "🎭", desc: "Win: milk the applause." },
  { id: "anim-lastwords", category: "animation", name: "Last Words", price: 400, overlay: "🕯️", desc: "Death: leave 'em laughing." },
  // voice packs beyond the free 4 themes (STR/04 §3)
  { id: "voice-whisper", category: "voice", name: "Whisper Boss", price: 250, overlay: "🎙️", desc: "Every claim a threat." },
  { id: "voice-bard", category: "voice", name: "The Bard", price: 500, overlay: "🪕", desc: "Sings the verdicts." },
  // premium themes as catalog items (mirror of themes.ts; host-level room cosmetics)
  { id: "theme-neon", category: "theme", name: "Neon District", price: 500, overlay: "🌆", desc: "Cyberpunk felt & synth hum.", themeId: "neon" },
  { id: "theme-casino", category: "theme", name: "Casino Royale", price: 700, overlay: "🎰", desc: "Velvet, chips, bad decisions.", themeId: "royale" },
  { id: "theme-speakeasy", category: "theme", name: "Jazz Speakeasy", price: 600, overlay: "🎷", desc: "Sepia smoke, vinyl crackle.", themeId: "speakeasy" },
  { id: "theme-haunted", category: "theme", name: "Haunted Inn", price: 450, overlay: "👻", desc: "The candles watch you.", themeId: "haunted" },
  { id: "theme-orbital", category: "theme", name: "Orbital Cantina", price: 800, overlay: "🛰️", desc: "Poker at zero gravity.", themeId: "orbital" },
  { id: "theme-kabuki", category: "theme", name: "Kabuki Alley", price: 650, overlay: "🏮", desc: "Lanterns, drums, face paint.", themeId: "kabuki" },
] as const;

/** overlay emoji lookup shared with the try-on preview */
export const COSMETIC_OVERLAYS: Record<string, string> = Object.fromEntries(
  SHOP_ITEMS.map((item) => [item.id, item.overlay]),
);

export const STARTER_ITEM_IDS: readonly string[] = SHOP_ITEMS
  .filter((item) => item.price === 0 && !item.levelReq)
  .map((item) => item.id);

/** Featured carousel — shop landing. */
export const FEATURED_ITEMS: readonly ShopItem[] = [
  SHOP_ITEMS.find((i) => i.id === "theme-neon") ?? SHOP_ITEMS[0],
  SHOP_ITEMS.find((i) => i.id === "anim-victory") ?? SHOP_ITEMS[0],
  SHOP_ITEMS.find((i) => i.id === "voice-bard") ?? SHOP_ITEMS[0],
].filter(Boolean) as ShopItem[];

/** Coin packs (STR/04 §1). Payments are MOCK until the owner picks a provider. */
export interface CoinPack {
  id: string;
  name: string;
  priceInr: number;
  coins: number;
  bonus: number;
  badge?: string;
}

export const COIN_PACKS: readonly CoinPack[] = [
  { id: "pack-starter", name: "Starter", priceInr: 49, coins: 500, bonus: 0 },
  { id: "pack-popular", name: "Popular", priceInr: 99, coins: 1200, bonus: 100, badge: "MOST POPULAR" },
  { id: "pack-bigbag", name: "Big Bag", priceInr: 199, coins: 2500, bonus: 350 },
  { id: "pack-whale", name: "Whale", priceInr: 399, coins: 5500, bonus: 1000, badge: "BEST VALUE" },
] as const;
