import type { ComponentType, ReactElement, SVGProps } from "react";
import {
  Armchair,
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Coins,
  Copy,
  CreditCard,
  Crosshair,
  Crown,
  Dices,
  DoorOpen,
  Drama,
  Droplets,
  Eye,
  Flame,
  Frown,
  Ghost,
  Home,
  Hourglass,
  Info,
  KeyRound,
  Layers,
  LogIn,
  Lock,
  LockOpen,
  LogOut,
  Medal,
  Megaphone,
  Menu,
  MessageCircle,
  Package,
  Palette,
  Play,
  PlayingCard,
  PlayingCardsFan,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldBan,
  Skull,
  Smile,
  Sparkles,
  Store,
  Swords,
  Target,
  TriangleAlert,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from "lucide-react";

/**
 * ICON SYSTEM (T1) — the app's lucide wrappers. Emoji as UI iconography is
 * retired; gameplay CONTENT keeps its glyphs (emote presets, avatar animals,
 * catalog art overlays, in-table suit text). Rules live here so every wave
 * swaps glyphs through one module:
 *   - strokeWidth 2, `currentColor` stroke — icons ride the text color token.
 *   - Sizing tokens: 20px in-game marks, 18px page chrome (override via `size`).
 *   - `aria-hidden` decoration BY DEFAULT; pass `label` when the icon must be
 *     announced (it then renders role="img" + aria-label instead).
 */

export interface IconProps {
  size?: number;
  /** Accessible name — pass only when the icon itself carries meaning. */
  label?: string;
  className?: string;
}

export type IconComponent = (props: IconProps) => ReactElement;

/** Anything lucide-shaped (ForwardRefExoticComponent<LucideProps>-compatible). */
type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

/** Canonical map (glyph → lucide): crown→Crown, candle→Flame, coins→Coins,
 *  sound→Volume2, mute→VolumeX, chat→MessageCircle, shop→Store, home→Home,
 *  settings→Settings, leaderboard→Trophy, profile→User, logout→LogOut,
 *  rooms→DoorOpen, create→Plus, join→KeyRound, ghost→Ghost, bot→Bot,
 *  emote wheel open→Smile, spectator→Eye, admin→Shield, payments→CreditCard,
 *  catalog→Package, packs→Layers, audit→ScrollText, users→Users, close→X,
 *  back→ArrowLeft, copy→Copy, check→Check, warning→TriangleAlert, info→Info. */
function makeIcon(Base: SvgIcon, defaultSize: number): IconComponent {
  function Icon({ size = defaultSize, label, className }: IconProps): ReactElement {
    return (
      <Base
        size={size}
        strokeWidth={2}
        className={className}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable={false}
      />
    );
  }
  Icon.displayName = `Game${Base.displayName ?? "Icon"}`;
  return Icon;
}

// ── table / in-game marks (default 20px) ──────────────────────────────────
export const CrownIcon = makeIcon(Crown, 20); // host / winner
export const CandleIcon = makeIcon(Flame, 20); // candle → Flame (RIP marker)
export const CoinIcon = makeIcon(Coins, 20);
export const SkullIcon = makeIcon(Skull, 20); // nobody survived
export const GhostIcon = makeIcon(Ghost, 20);
export const BotIcon = makeIcon(Bot, 20);
export const LockIcon = makeIcon(Lock, 20);
export const LockOpenIcon = makeIcon(LockOpen, 20);
export const EmoteIcon = makeIcon(Smile, 20); // emote wheel open
export const SpectatorIcon = makeIcon(Eye, 20);

// ── site chrome (default 18px) ───────────────────────────────────────────
export const HomeIcon = makeIcon(Home, 18);
export const RoomsIcon = makeIcon(DoorOpen, 18);
export const ShopIcon = makeIcon(Store, 18);
export const TrophyIcon = makeIcon(Trophy, 18);
export const UserIcon = makeIcon(User, 18);
export const SettingsIcon = makeIcon(Settings, 18);
export const MenuIcon = makeIcon(Menu, 18); // drawer triggers (hamburger)
export const LogoutIcon = makeIcon(LogOut, 18);
export const SoundIcon = makeIcon(Volume2, 18);
export const MuteIcon = makeIcon(VolumeX, 18);
export const ChatIcon = makeIcon(MessageCircle, 18);
export const CreateIcon = makeIcon(Plus, 18);
export const JoinIcon = makeIcon(KeyRound, 18);
export const AdminIcon = makeIcon(Shield, 18);
export const PaymentsIcon = makeIcon(CreditCard, 18);
export const CatalogIcon = makeIcon(Package, 18);
export const PacksIcon = makeIcon(Layers, 18);
export const AuditIcon = makeIcon(ScrollText, 18);
export const UsersIcon = makeIcon(Users, 18);
export const CloseIcon = makeIcon(X, 18);
export const BackIcon = makeIcon(ArrowLeft, 18);
export const CopyIcon = makeIcon(Copy, 18);
export const CheckIcon = makeIcon(Check, 18);
export const WarningIcon = makeIcon(TriangleAlert, 18);
export const InfoIcon = makeIcon(Info, 18);

// ── named-use marks ───────────────────────────────────────────────────────
export const MedalIcon = makeIcon(Medal, 18); // titles + rank medals
export const SparkleIcon = makeIcon(Sparkles, 18); // XP
export const RulesIcon = makeIcon(BookOpen, 18); // RULES drawer
export const ThemeIcon = makeIcon(Palette, 18); // THEME picker
export const HourglassIcon = makeIcon(Hourglass, 18);
export const WrenchIcon = makeIcon(Wrench, 18);
export const PlayIcon = makeIcon(Play, 18);
export const RematchIcon = makeIcon(RefreshCw, 18);
export const EmptySeatIcon = makeIcon(Armchair, 18); // 🪑 no player at this seat
export const SweatIcon = makeIcon(Droplets, 18); // error-state "sweat"
export const CardIcon = makeIcon(PlayingCard, 20); // deal / table card
export const ThrowIcon = makeIcon(PlayingCardsFan, 20); // throw face-down
export const CallIcon = makeIcon(Megaphone, 20); // cry LIAR
export const RevealIcon = makeIcon(Search, 20); // the reveal
export const ShotIcon = makeIcon(Crosshair, 20); // the shot / stakes
export const KillsIcon = makeIcon(Swords, 20);
export const BluffIcon = makeIcon(Drama, 20); // bluffs — theater masks
export const PullsIcon = makeIcon(Dices, 20); // trigger pulls survived
export const MissIcon = makeIcon(Frown, 20); // false calls
export const TargetIcon = makeIcon(Target, 20); // match summary chip
export const BannedIcon = makeIcon(ShieldBan, 20); // 86'd by the house
export const ShareIcon = makeIcon(Share2, 18); // invite share
export const FlameIcon = makeIcon(Flame, 18); // kills (shares Flame with the RIP candle)

// ── how-to / law-table glyphs (rules-content icon slugs → components) ────
export type RuleIconSlug = "deal" | "throw" | "call" | "reveal" | "shot" | "win";

export const RULE_ICON: Record<RuleIconSlug, IconComponent> = {
  deal: CardIcon,
  throw: ThrowIcon,
  call: CallIcon,
  reveal: RevealIcon,
  shot: ShotIcon,
  win: TrophyIcon,
};
