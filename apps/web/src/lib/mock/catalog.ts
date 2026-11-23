import type { ThemeId } from "@/lib/wire";

/**
 * Shop catalog — mock items mirroring the SERVER SEED 1:1
 * (apps/server/scripts/seed-catalog.ts): ids are `category:slug`, categories
 * use the production set (…`anim` · `voicePack` · `theme` · `body`), and
 * prices/tiers/level-gates match the seed so the admin preview (and the
 * mock GET /api/catalog) is production-shaped. Real purchases remain
 * server-validated (STR/04 §3).
 *
 * `overlay` is CONTENT art (the mock shop tile glyph) — UI chrome icons
 * come from components/ui/icons, never from here.
 */

export type ShopCategory =
  | "hair"
  | "beard"
  | "hat"
  | "shirt"
  | "glasses"
  | "frame"
  | "anim"
  | "voicePack"
  | "theme"
  | "body";

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  price: number; // 0 = free starter item
  /** Explicit seed tier; unmarked items are tier "common" on the server. */
  tier?: "common" | "rare" | "epic";
  overlay: string; // mock preview emoji (content art)
  desc: string;
  levelReq?: number; // earned at level milestones — never purchasable
  themeId?: ThemeId; // for category === "theme"
}

export const SHOP_CATEGORIES: readonly { id: ShopCategory; label: string; emoji: string }[] = [
  { id: "hair", label: "Hair", emoji: "💇" },
  { id: "beard", label: "Beard", emoji: "🧔" },
  { id: "hat", label: "Hats", emoji: "🎩" },
  { id: "shirt", label: "Shirts", emoji: "👔" },
  { id: "glasses", label: "Glasses", emoji: "🕶️" },
  { id: "frame", label: "Frames", emoji: "🖼️" },
  { id: "anim", label: "Animations", emoji: "💫" },
  { id: "voicePack", label: "Voice packs", emoji: "🎙️" },
  { id: "theme", label: "Themes", emoji: "🎪" },
  { id: "body", label: "Bodies", emoji: "🧍" },
] as const;

export const SHOP_ITEMS: readonly ShopItem[] = [
  // hair — 2 free starter (seed)
  { id: "hair:short", category: "hair", name: "Short Back", price: 0, overlay: "💇", desc: "Nothing left for anyone to grab." },
  { id: "hair:braids", category: "hair", name: "Braids", price: 0, overlay: "💇", desc: "Rope for the bridges you'll burn." },
  { id: "hair:afro", category: "hair", name: "Afro", price: 50, overlay: "💇", desc: "Big enough to hide an ace in." },
  { id: "hair:man-bun", category: "hair", name: "Man Bun", price: 100, overlay: "💇", desc: "Artisanal suspicion." },
  { id: "hair:mohawk", category: "hair", name: "Mohawk", price: 120, tier: "rare", overlay: "💇", desc: "Reads the table loudly." },
  { id: "hair:pompadour", category: "hair", name: "Pompadour", price: 150, tier: "rare", overlay: "💇", desc: "The house special, kept." },
  // beard — 1 free
  { id: "beard:clean-shaven", category: "beard", name: "Clean Shaven", price: 0, overlay: "🧔", desc: "Nothing to hide. Allegedly." },
  { id: "beard:goatee", category: "beard", name: "Goatee", price: 75, overlay: "🧔", desc: "A tiny villain on your chin." },
  { id: "beard:moustache", category: "beard", name: "Handlebar Moustache", price: 100, overlay: "🧔", desc: "Steerable with two fingers." },
  { id: "beard:full-beard", category: "beard", name: "Full Beard", price: 150, tier: "rare", overlay: "🧔", desc: "Where crumbs go to testify." },
  // hats
  { id: "hat:cap", category: "hat", name: "Flat Cap", price: 100, overlay: "🎩", desc: "Keeps the rain off the tells." },
  { id: "hat:bowler", category: "hat", name: "Bowler", price: 150, overlay: "🎩", desc: "Respectable menace." },
  { id: "hat:fedora", category: "hat", name: "Fedora", price: 200, tier: "rare", overlay: "🎩", desc: "Tips itself before the bluff." },
  { id: "hat:cowboy", category: "hat", name: "Cowboy", price: 250, tier: "rare", overlay: "🎩", desc: "Ten gallons of attitude." },
  { id: "hat:sombrero", category: "hat", name: "Sombrero", price: 250, tier: "rare", overlay: "🎩", desc: "Shade for two reputations." },
  // shirts — 2 free
  { id: "shirt:white", category: "shirt", name: "Dealer White", price: 0, overlay: "👔", desc: "House dress code." },
  { id: "shirt:red", category: "shirt", name: "Saloon Red", price: 0, overlay: "👔", desc: "Stains hide in plain sight." },
  { id: "shirt:poncho", category: "shirt", name: "Poncho", price: 100, overlay: "👔", desc: "Conceals a shoulder holster, or lunch." },
  { id: "shirt:vest", category: "shirt", name: "Leather Vest", price: 150, overlay: "👔", desc: "Cracked in all the right places." },
  { id: "shirt:waistcoat", category: "shirt", name: "Waistcoat", price: 200, tier: "rare", overlay: "👔", desc: "Two buttons of credibility." },
  { id: "shirt:pinstripe", category: "shirt", name: "Pinstripe Suit", price: 300, tier: "epic", overlay: "👔", desc: "Aces hide in the lining." },
  // glasses
  { id: "glasses:round", category: "glasses", name: "Round Shades", price: 75, overlay: "🕶️", desc: "Eyes never blink." },
  { id: "glasses:aviators", category: "glasses", name: "Aviators", price: 100, overlay: "🕶️", desc: "Mirrored, like your motives." },
  { id: "glasses:monocle", category: "glasses", name: "Monocle", price: 150, tier: "rare", overlay: "🕶️", desc: "Inspects your nonsense." },
  // frames — 2 free, 4 level-locked prestige
  { id: "frame:plain", category: "frame", name: "Plain Frame", price: 0, overlay: "🖼️", desc: "Honest and boring." },
  { id: "frame:wooden", category: "frame", name: "Wooden Frame", price: 0, overlay: "🖼️", desc: "Splinters for the vain." },
  { id: "frame:brass", category: "frame", name: "Brass Frame", price: 150, overlay: "🖼️", desc: "Polished on weekends." },
  { id: "frame:neon", category: "frame", name: "Neon Frame", price: 250, tier: "rare", overlay: "🖼️", desc: "Buzzes when you lie." },
  { id: "frame:prestige-bronze", category: "frame", name: "Prestige Bronze", price: 250, levelReq: 10, overlay: "🖼️", desc: "Earned at level 10." },
  { id: "frame:prestige-silver", category: "frame", name: "Prestige Silver", price: 300, levelReq: 20, overlay: "🖼️", desc: "Earned at level 20." },
  { id: "frame:prestige-gold", category: "frame", name: "Prestige Gold", price: 400, levelReq: 30, tier: "epic", overlay: "🖼️", desc: "Earned at level 30." },
  { id: "frame:prestige-diamond", category: "frame", name: "Prestige Diamond", price: 500, levelReq: 40, tier: "epic", overlay: "🖼️", desc: "Earned at level 40." },
  // animations — 1 idle free
  { id: "anim:idle-drunk", category: "anim", name: "Drunk Sway (idle)", price: 0, overlay: "💫", desc: "Just leaning on the bar." },
  { id: "anim:idle-whistler", category: "anim", name: "Whistler (idle)", price: 200, overlay: "💫", desc: "Whistles past the graveyard." },
  { id: "anim:win-tipping", category: "anim", name: "Hat Tip (win)", price: 300, tier: "rare", overlay: "💫", desc: "Milk the applause politely." },
  { id: "anim:death-dramatic", category: "anim", name: "Dramatic Collapse (death)", price: 400, tier: "epic", overlay: "💫", desc: "Leave 'em laughing." },
  // voice packs
  { id: "voicePack:villain", category: "voicePack", name: "Villain Voice", price: 250, overlay: "🎙️", desc: "Every claim a threat." },
  { id: "voicePack:robot", category: "voicePack", name: "Robotic Voice", price: 500, tier: "epic", overlay: "🎙️", desc: "Bluffing at 44.1 kHz." },
  // themes (mirror of themes.ts; host-level room cosmetics)
  { id: "theme:saloon", category: "theme", name: "The Saloon", price: 0, overlay: "🎪", desc: "Sawdust, sweat and second chances.", themeId: "saloon" },
  { id: "theme:house-table", category: "theme", name: "House Table", price: 0, overlay: "🎪", desc: "The felt everybody knows.", themeId: "house" },
  { id: "theme:neon-district", category: "theme", name: "Neon District", price: 400, tier: "rare", overlay: "🎪", desc: "Cyberpunk felt & synth hum.", themeId: "neon" },
  { id: "theme:jazz-speakeasy", category: "theme", name: "Jazz Speakeasy", price: 500, tier: "rare", overlay: "🎪", desc: "Sepia smoke, vinyl crackle.", themeId: "speakeasy" },
  { id: "theme:casino-royale", category: "theme", name: "Casino Royale", price: 600, tier: "rare", overlay: "🎪", desc: "Velvet, chips, bad decisions.", themeId: "royale" },
  { id: "theme:kabuki-alley", category: "theme", name: "Kabuki Alley", price: 600, tier: "rare", overlay: "🎪", desc: "Lanterns, drums, face paint.", themeId: "kabuki" },
  { id: "theme:haunted-inn", category: "theme", name: "Haunted Inn", price: 700, tier: "rare", overlay: "🎪", desc: "The candles watch you.", themeId: "haunted" },
  { id: "theme:orbital-cantina", category: "theme", name: "Orbital Cantina", price: 800, tier: "epic", overlay: "🎪", desc: "Poker at zero gravity.", themeId: "orbital" },
  // bodies — the gated non-thin paper-doll builds (base slugs == the `body:` suffix)
  { id: "body:human-male-gym", category: "body", name: "Gym Build (Male)", price: 250, overlay: "🧍", desc: "Cardio was a bluff all along." },
  { id: "body:human-female-gym", category: "body", name: "Gym Build (Female)", price: 250, overlay: "🧍", desc: "Carries the kegs solo." },
  { id: "body:dog", category: "body", name: "Dog", price: 400, tier: "rare", overlay: "🧍", desc: "Loyal. Never honest." },
  { id: "body:cat", category: "body", name: "Cat", price: 400, tier: "rare", overlay: "🧍", desc: "Nine lives, zero guilt." },
  { id: "body:horse", category: "body", name: "Horse", price: 500, tier: "rare", overlay: "🧍", desc: "Taller tale than you." },
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
  SHOP_ITEMS.find((i) => i.id === "theme:neon-district") ?? SHOP_ITEMS[0],
  SHOP_ITEMS.find((i) => i.id === "anim:win-tipping") ?? SHOP_ITEMS[0],
  SHOP_ITEMS.find((i) => i.id === "voicePack:robot") ?? SHOP_ITEMS[0],
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
