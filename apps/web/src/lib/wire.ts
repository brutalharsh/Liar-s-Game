/**
 * ============================================================================
 * WIRE TYPES (LOCAL) — TODO-sync-with-shared
 * ============================================================================
 * While `@liars-game/shared` is under construction (agent F1), these types
 * mirror STR/07 §§1–2 1:1 so the zustand store + mock socket adapter can be
 * built ahead of it. When `packages/shared` lands, delete this file and
 * re-export from `@liars-game/shared` instead:
 *
 *   export type * from "@liars-game/shared";
 *
 * STR/08 §1 / STR/07 §3 apply EVEN to these mocks: other players' card ranks,
 * deck order, and any bullet position never appear in these payload types.
 * `reveal:show` is the only face-leak event.
 * ============================================================================
 */

export type TableCardRank = "K" | "Q" | "A";
export type CardRank = "K" | "Q" | "A" | "JOKER";
export type Verdict = "TRUTH" | "LIE";
export type Visibility = "private" | "public";
export type ThemeId =
  | "saloon"
  | "house"
  | "neon"
  | "royale"
  | "speakeasy"
  | "haunted"
  | "orbital"
  | "kabuki";

/** Guest avatar: base animal + equipped cosmetic ids (wire-level avatarSpec). */
export type AvatarAnimal =
  | "fox"
  | "wolf"
  | "bear"
  | "owl"
  | "eagle"
  | "deer"
  | "raccoon"
  | "boar"
  | "cat"
  | "rabbit"
  | "gator"
  | "snake";

export interface AvatarSpec {
  animal: AvatarAnimal;
  hat?: string;
  glasses?: string;
  frame?: string;
}

/** Public seat view — everything here is visible to the whole room (STR/07 §3). */
export interface SeatView {
  seat: number;
  nickname: string | null; // null = empty seat
  avatar: AvatarSpec | null;
  isHost: boolean;
  connected: boolean;
  alive: boolean; // table only
  pulled: number; // public counter (pulled/6)
  cardCount: number | null; // public face-down count; null before game / when hidden
  locked: boolean; // lobby seat lock (host)
  isBot: boolean;
}

export interface LobbySnapshot {
  code: string;
  name: string;
  theme: ThemeId;
  capacity: number;
  visibility: Visibility;
  hostSeat: number;
  seats: SeatView[]; // ascending seat number; length === capacity
  estMatchMinutes: number; // server-computed estimate chip
  roomLocked: boolean;
}

export type GamePhase =
  | "idle"
  | "lobby"
  | "round-new"
  | "turn"
  | "window"
  | "reveal"
  | "shot"
  | "round-end"
  | "game-over";

export interface PlayedStack {
  seat: number;
  count: number;
}

export interface RevealState {
  seat: number; // accused seat
  cards: { id: string; rank: CardRank }[];
  verdict: Verdict;
  loserSeat: number;
}

export interface ShotState {
  loserSeat: number;
  kind: "SELF" | "EXECUTE";
  executorSeat: number | null;
  outcome: "BLANK" | "LIVE" | null; // null = trigger pending
  pulls: number; // loser's new pulled counter
}

export interface RoundEndState {
  reason: string;
  survivorCoins: number;
  xpEarned: number;
}

/** The store mirrors this full public RoomState (STR/07 §2 catch-up snapshot). */
export interface RoomState {
  phase: GamePhase;
  roundNo: number;
  tableCard: TableCardRank | null;
  turnSeat: number | null;
  deadlineTs: number | null;
  window: { playSeat: number; closesAtTs: number } | null;
  pile: PlayedStack[];
  reveal: RevealState | null;
  shot: ShotState | null;
  roundEnd: RoundEndState | null;
}

// ── Client → Server (STR/07 §1) ────────────────────────────────────────────

export type ClientEvent =
  | { type: "room:create"; name: string; capacity: number; theme: ThemeId; visibility: Visibility }
  | { type: "room:join"; code: string }
  | { type: "room:leave" }
  | { type: "game:start" }
  | { type: "play:cards"; cardIds: string[] }
  | { type: "liar:call"; accusedSeat: number }
  | { type: "emote:send"; emoteId: string };

export interface EmitResult {
  ok: boolean;
  code?: string; // e.g. "DEMO1" after room:create
  errorCode?: string;
  errorMessage?: string;
}

// ── Server → Client (STR/07 §2) ────────────────────────────────────────────

export type ServerEvent =
  | { type: "lobby:state"; lobby: LobbySnapshot }
  | { type: "round:new"; roundNo: number; tableCard: TableCardRank; dealtCounts: number[] }
  | { type: "hand:deal"; cards: { id: string; rank: CardRank }[] } // ONLY to that player
  | { type: "turn:begin"; seat: number; deadlineTs: number }
  | { type: "play:accept"; seat: number; count: number; totalPile: number } // COUNT only
  | { type: "window:open"; playSeat: number; closesAtTs: number } // 5–10p tables
  | { type: "window:close"; reason: string }
  | { type: "reveal:show"; seat: number; cards: { id: string; rank: CardRank }[]; verdict: Verdict; loserSeat: number }
  | { type: "shot:assign"; loserSeat: number; kind: "SELF" | "EXECUTE"; executorSeat: number | null }
  | { type: "shot:result"; loserSeat: number; pulls: number; outcome: "BLANK" | "LIVE" }
  | { type: "round:end"; reason: string; survivorCoins: number; xpEarned: number }
  | { type: "game:over"; winnerSeat: number }
  | { type: "presence:update"; seats: { seat: number; connected: boolean; afk: boolean }[] }
  | { type: "emote:broadcast"; seat: number; emoteId: string }
  | { type: "error"; code: string; message: string; eventRef?: string };

/** Handshake payload (STR/07 §0). */
export interface Handshake {
  guestToken: string;
  nickname?: string;
  avatarSpec?: AvatarSpec;
}

/** POST /api/payments/create-order request body (STR/04 §1 — mock provider). */
export interface CreateOrderRequest {
  packId: string;
}

/** Expected mock response shape until the provider exists (may 404 — that IS the spec). */
export interface CreateOrderResponse {
  provider: "mock";
  status: "coming_soon";
}
