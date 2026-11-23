/**
 * ============================================================================
 * WIRE — the ONLY seam to `@liars-game/shared` (STR/06 §3 / AGENTS.md #4)
 * ============================================================================
 * Everything on the wire (event names, payload shapes, ranks, phases, acks)
 * is re-exported from the shared zod contract — no duplicate event definitions
 * live in this app anymore. STR/07 §3 view-filtering rules are encoded in
 * those schemas: other players' card ranks and any chamber position NEVER
 * appear here; `reveal:show` is the single face-leak event.
 *
 * Below the re-exports sit a few APP-SIDE VIEW-MODELS (SeatView,
 * LobbySnapshot, the app AvatarSpec, ClientAction, EmitResult): these are NOT
 * wire types — they are the zustand store's derived UI state. The store maps
 * every shared payload into them at the applyEvent boundary (see `store/game.ts`)
 * so screens never touch raw wire payloads.
 * ============================================================================
 */

export * from "@liars-game/shared";

export type { AvatarSpec as WireAvatarSpec } from "@liars-game/shared";

import type {
  AckResult,
  AvatarSpec as WireAvatarSpec,
  CreateRoomAckData,
  JoinRoomAckData,
  NullAckData,
  RoomVisibility,
  TableCard,
  Rank,
  RevealShowPayload,
  Seat,
} from "@liars-game/shared";

// ── shared-contract aliases (names W1 screens already speak) ───────────────

export type TableCardRank = TableCard;
export type CardRank = Rank; // 'K' | 'Q' | 'A' | 'J' (J = Joker, wild)
export type Verdict = RevealShowPayload["verdict"]; // 'TRUTH' | 'LIE' — from the shared schema
export type Visibility = RoomVisibility;

// ── app-side avatar view-model ↔ wire avatarSpec mapping ──────────────────

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

/** App-side avatar (starter animals + equipped cosmetic ids — UI rendering model). */
export interface AvatarSpec {
  animal: AvatarAnimal;
  hat?: string;
  glasses?: string;
  frame?: string;
}

/** App avatar → wire avatarSpec (`animal` rides as `base`; shared validates slugs server-side). */
export function avatarSpecToWire(spec: AvatarSpec | null | undefined): WireAvatarSpec | null {
  if (!spec) return null;
  const wire: WireAvatarSpec = { base: spec.animal };
  if (spec.hat) wire.hat = spec.hat;
  if (spec.glasses) wire.glasses = spec.glasses;
  if (spec.frame) wire.frame = spec.frame;
  return wire;
}

/** Wire avatarSpec → app avatar (unknown bases render as the placeholder chair). */
export function avatarSpecFromWire(spec: WireAvatarSpec | null | undefined): AvatarSpec | null {
  if (!spec) return null;
  const animal = spec.base as AvatarAnimal;
  const out: AvatarSpec = { animal };
  if (spec.hat) out.hat = spec.hat;
  if (spec.glasses) out.glasses = spec.glasses;
  if (spec.frame) out.frame = spec.frame;
  return out;
}

// ── app-side theme catalog ids (theme slugs the UI knows; wire treats as opaque string) ──

export type ThemeId =
  | "saloon"
  | "house"
  | "neon"
  | "royale"
  | "speakeasy"
  | "haunted"
  | "orbital"
  | "kabuki";

// ── app-side seat/lobby view-models (derived in the store from shared payloads) ──

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

/** The store's derived lobby snapshot (mirrors a shared `lobby:state` RoomState). */
export interface LobbySnapshot {
  code: string;
  name: string;
  theme: ThemeId;
  capacity: number;
  visibility: Visibility;
  hostSeat: number;
  seats: SeatView[]; // ascending seat number
  estMatchMinutes: number;
  roomLocked: boolean;
}

// ── app-side in-round mirror (store-only; NOT the wire `RoomState`) ────────

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
  seat: number | null; // accused seat — derived: the window's / last play's owner
  cards: { id: string; rank: CardRank }[];
  verdict: Verdict;
  loserSeat: number;
}

export interface ShotState {
  loserSeat: number;
  kind: "SELF" | "EXECUTE";
  executorSeat: number | null;
  outcome: "BLANK" | "LIVE" | null; // null = trigger still pending
  pulls: number; // loser's new pulled counter (1–6)
}

export interface RoundEndState {
  reason: "survived" | "death";
  survivorCoins: number;
  xpEarned: { seat: number; xp: number }[];
}

export interface GameOverState {
  winnerSeat: number;
  matchRecord: import("@liars-game/shared").MatchRecord;
  rewards: import("@liars-game/shared").MatchReward[];
}

// ── client actions (app-side union of the shared client events) ────────────
//
// Screens emit these; the socket adapter maps each one onto the shared
// `{ event, payload }` wire event and zod-validates the payload with the
// shared `clientEventSchemas` before it leaves the browser.

export type ClientAction =
  | { type: "room:create"; name: string; capacity: number; theme: ThemeId; visibility: Visibility }
  | { type: "room:join"; code: string }
  | { type: "room:leave" }
  | { type: "game:start" }
  | { type: "play:cards"; cardIds: string[] }
  | { type: "liar:call"; accusedSeat: number }
  | { type: "emote:send"; emoteId: string }
  | { type: "profile:tts-say"; phraseId: string };

export type EmitAckData = CreateRoomAckData | JoinRoomAckData | NullAckData;

/**
 * Flattened view of the shared `AckResult` envelope for the screens W1
 * shipped (`res.ok`, `res.errorMessage`, …). The live adapter normalizes the
 * real ack into this shape; new code should prefer the shared types directly.
 */
export interface EmitResult {
  ok: boolean;
  code?: string; // room code after room:create / room:join
  spectator?: boolean;
  yourSeat?: Seat | null;
  errorCode?: string;
  errorMessage?: string;
}

export function flattenAck(ack: AckResult<unknown> | undefined, timeoutMessage?: string): EmitResult {
  if (!ack) return { ok: false, errorCode: "ACK_TIMEOUT", errorMessage: timeoutMessage ?? "No answer from the table." };
  if (ack.ok) {
    const data = ack.data as Partial<EmitAckData> | null;
    const out: EmitResult = { ok: true };
    if (data && "roomCode" in data && data.roomCode) out.code = data.roomCode;
    if (data && "spectator" in data) out.spectator = data.spectator;
    if (data && "yourSeat" in data) out.yourSeat = data.yourSeat;
    return out;
  }
  return { ok: false, errorCode: ack.error.code, errorMessage: ack.error.message };
}
