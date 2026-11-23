/**
 * Event wire schemas — the single source of the Socket.IO contract (STR/07 §1–§2).
 * No app may define its own event/payload shapes; temporary local mocks must
 * be marked `TODO-sync-with-shared` (AGENTS.md non-negotiable #4).
 *
 * Every payload schema is STRICT: unknown extra fields fail validation. That
 * makes a hidden-card leak fail loudly (defence-in-depth behind the server's
 * explicit payload composition + the CI packet-recorder).
 *
 * Event names and payload fields are exactly STR/07 §1–§2. Where STR did not
 * pin a representation (seq envelope, ack data, window-close reasons, dealt
 * counts as pairs) the chosen one is documented inline and in the mission
 * report.
 */
import { z } from 'zod';
import type { Seat } from './types.js';
import {
  CardSchema,
  DeadlineTsSchema,
  MatchRecordSchema,
  MatchRewardSchema,
  RoomStateSchema,
  RoomVisibilitySchema,
  SeatSchema,
  ShotKindSchema,
  TableCardSchema,
  XpGainSchema,
} from './types.js';
import { EmoteIdSchema } from './emotes.js';
import { RoomCodeSchema } from './room-code.js';

/** Monotonic per-room event counter carried by EVERY server→client payload (STR/07 §4). */
export const SeqSchema = z.number().int().min(0);

// ---------------------------------------------------------------------------
// Client → Server (STR/07 §1) — ALL of these are zod-parsed before anything else
// ---------------------------------------------------------------------------

export const RoomCreatePayloadSchema = z.strictObject({
  /** Pre-sanitized suggestion (≤18 after sanitization); server sanitizes again. */
  name: z.string().min(1).max(64),
  /** 2–7 free; 8–10 require an entitlement the server checks. */
  capacity: z.number().int().min(2).max(10),
  /** Theme slug — server validates ownership/validity (STR/08 §7). */
  theme: z.string().min(1).max(64),
  visibility: RoomVisibilitySchema,
});
export type RoomCreatePayload = z.infer<typeof RoomCreatePayloadSchema>;

export const RoomJoinPayloadSchema = z.strictObject({
  /** Invite links embed the code; the client extracts it before sending. */
  code: RoomCodeSchema,
});
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;

export const RoomLeavePayloadSchema = z.strictObject({});
export type RoomLeavePayload = z.infer<typeof RoomLeavePayloadSchema>;

export const GameStartPayloadSchema = z.strictObject({});
export type GameStartPayload = z.infer<typeof GameStartPayloadSchema>;

export const PlayCardsPayloadSchema = z.strictObject({
  /** Ids of own cards to play face-down. Server verifies turn/ownership/count. */
  cardIds: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(3)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'cardIds must be unique' }),
});
export type PlayCardsPayload = z.infer<typeof PlayCardsPayloadSchema>;

export const LiarCallPayloadSchema = z.strictObject({
  /** The seat whose last play is being challenged (window rules per STR/01 §4). */
  accusedSeat: SeatSchema,
});
export type LiarCallPayload = z.infer<typeof LiarCallPayloadSchema>;

export const EmoteSendPayloadSchema = z.strictObject({
  /** Canonical catalog slug (shared EMOTE_IDS — STR/05 §6); 3s cooldown enforced server-side. */
  emoteId: EmoteIdSchema,
});
export type EmoteSendPayload = z.infer<typeof EmoteSendPayloadSchema>;

/**
 * OPTIONAL alternate emote channel (STR/07 §1): the phrase is spoken by the
 * CLIENT's local TTS. NO AUDIO EVER TRAVELS OVER THE WIRE — only the preset
 * phrase id. `phraseId` references a free preset or an owned voice pack.
 */
export const TtsSayPayloadSchema = z.strictObject({
  phraseId: z.string().min(1).max(32),
});
export type TtsSayPayload = z.infer<typeof TtsSayPayloadSchema>;

/** Client event name → payload schema. `profile:tts-say` may be dropped if the owner nixes TTS. */
export const clientEventSchemas = {
  'room:create': RoomCreatePayloadSchema,
  'room:join': RoomJoinPayloadSchema,
  'room:leave': RoomLeavePayloadSchema,
  'game:start': GameStartPayloadSchema,
  'play:cards': PlayCardsPayloadSchema,
  'liar:call': LiarCallPayloadSchema,
  'emote:send': EmoteSendPayloadSchema,
  'profile:tts-say': TtsSayPayloadSchema,
} as const;

export type ClientEventName = keyof typeof clientEventSchemas;

/** Discriminated union of every client event (for exhaustive switch handling). */
export type ClientEvent = {
  [K in ClientEventName]: { event: K; payload: z.infer<(typeof clientEventSchemas)[K]> };
}[ClientEventName];

// ---------------------------------------------------------------------------
// Server → Client (STR/07 §2) — view-filtered; `reveal:show` is the ONLY face-leak
// ---------------------------------------------------------------------------

/** `lobby:state` carries the full (filtered) room snapshot — also the catch-up on (re)join. */
export const LobbyStatePayloadSchema = RoomStateSchema;
export type LobbyStatePayload = z.infer<typeof LobbyStatePayloadSchema>;

export const RoundNewPayloadSchema = z.strictObject({
  seq: SeqSchema,
  roundNo: z.number().int().min(1),
  tableCard: TableCardSchema,
  /** Cards dealt per seat this round, as seat/count pairs (public by nature). */
  dealtCounts: z.array(
    z.strictObject({ seat: SeatSchema, count: z.number().int().min(0).max(5) }),
  ).max(10),
});
export type RoundNewPayload = z.infer<typeof RoundNewPayloadSchema>;

/** ONLY delivered to the seat's own socket (STR/07 §2). */
export const HandDealPayloadSchema = z.strictObject({
  seq: SeqSchema,
  cards: z.array(CardSchema).min(1).max(5),
});
export type HandDealPayload = z.infer<typeof HandDealPayloadSchema>;

export const TurnBeginPayloadSchema = z.strictObject({
  seq: SeqSchema,
  seat: SeatSchema,
  deadlineTs: DeadlineTsSchema,
});
export type TurnBeginPayload = z.infer<typeof TurnBeginPayloadSchema>;

/** COUNT only — never the rank. The strict schema rejects any smuggled rank fields. */
export const PlayAcceptPayloadSchema = z.strictObject({
  seq: SeqSchema,
  seat: SeatSchema,
  count: z.number().int().min(1).max(3),
  totalPile: z.number().int().min(0),
});
export type PlayAcceptPayload = z.infer<typeof PlayAcceptPayloadSchema>;

/** 5–10 player tables: after a play lands, a challenge window opens (STR/01 §4). */
export const WindowOpenPayloadSchema = z.strictObject({
  seq: SeqSchema,
  playSeat: SeatSchema,
  closesAtTs: DeadlineTsSchema,
});
export type WindowOpenPayload = z.infer<typeof WindowOpenPayloadSchema>;

export const WindowCloseReasonSchema = z.enum(['belief', 'expired', 'liar_called']);
export const WindowClosePayloadSchema = z.strictObject({
  seq: SeqSchema,
  reason: WindowCloseReasonSchema,
});
export type WindowClosePayload = z.infer<typeof WindowClosePayloadSchema>;

/** The ONLY event that may carry face values — after every LIAR resolution. */
export const RevealVerdictSchema = z.enum(['TRUTH', 'LIE']);
export const RevealShowPayloadSchema = z.strictObject({
  seq: SeqSchema,
  /** The accused's LAST play (1–3 cards). */
  cards: z.array(CardSchema).min(1).max(3),
  verdict: RevealVerdictSchema,
  loserSeat: SeatSchema,
});
export type RevealShowPayload = z.infer<typeof RevealShowPayloadSchema>;

export const ShotAssignPayloadSchema = z
  .strictObject({
    seq: SeqSchema,
    loserSeat: SeatSchema,
    kind: ShotKindSchema,
    /** Present iff kind === 'EXECUTE' (the accuser fires the shot). */
    executorSeat: SeatSchema.optional(),
  })
  .refine((p) => p.kind === 'SELF' || p.executorSeat !== undefined, {
    message: 'executorSeat is required when kind is EXECUTE',
  })
  .refine((p) => p.kind === 'EXECUTE' || p.executorSeat === undefined, {
    message: 'executorSeat must be absent when kind is SELF',
  });
export type ShotAssignPayload = z.infer<typeof ShotAssignPayloadSchema>;

export const ShotOutcomeSchema = z.enum(['BLANK', 'LIVE']);
export const ShotResultPayloadSchema = z.strictObject({
  seq: SeqSchema,
  loserSeat: SeatSchema,
  /** The pull number that just happened (1–6); the public counter renders (pulls/6). */
  pulls: z.number().int().min(1).max(6),
  outcome: ShotOutcomeSchema,
});
export type ShotResultPayload = z.infer<typeof ShotResultPayloadSchema>;

export const RoundEndReasonSchema = z.enum(['survived', 'death']);
export const RoundEndPayloadSchema = z.strictObject({
  seq: SeqSchema,
  /** Every roulette ends the round (STR/01 §7): blank → survived, live → death. */
  reason: RoundEndReasonSchema,
  /** Coins granted to each surviving player (typically +1, STR/04 §2). */
  survivorCoins: z.number().int().min(0),
  /** Usually empty mid-match; filled on the final round (XP is per match — STR/04 §5). */
  xpEarned: z.array(XpGainSchema),
});
export type RoundEndPayload = z.infer<typeof RoundEndPayloadSchema>;

export const GameOverPayloadSchema = z.strictObject({
  seq: SeqSchema,
  /** null = zero-survivor abort (STR/01 §7: <2 connected-alive with no winner). */
  winnerSeat: SeatSchema.nullable(),
  /** Public stats written to match_records (STR/09). Ledger writes happen server-side. */
  matchRecord: MatchRecordSchema,
  rewards: z.array(MatchRewardSchema).max(10),
});
export type GameOverPayload = z.infer<typeof GameOverPayloadSchema>;

export const PresenceUpdatePayloadSchema = z.strictObject({
  seq: SeqSchema,
  seats: z.array(
    z.strictObject({ seat: SeatSchema, connected: z.boolean(), afk: z.boolean() }),
  ).max(10),
});
export type PresenceUpdatePayload = z.infer<typeof PresenceUpdatePayloadSchema>;

export const EmoteBroadcastPayloadSchema = z.strictObject({
  seq: SeqSchema,
  seat: SeatSchema,
  /** Canonical catalog slug — the enum keeps foreign emotes off the broadcast too. */
  emoteId: EmoteIdSchema,
});
export type EmoteBroadcastPayload = z.infer<typeof EmoteBroadcastPayloadSchema>;

export const ErrorPayloadSchema = z.strictObject({
  seq: SeqSchema,
  code: z.string().min(1).max(64),
  /** User-safe — never echoes state, values, or other players' info. */
  message: z.string().min(1).max(280),
  /** Name of the client event that triggered this; '' when server-initiated. */
  eventRef: z.string().max(64),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

/** Stable error-code vocabulary (STR/07 §6 pins EVENT_STALE; the rest is open). */
export const ERROR_CODES = Object.freeze({
  VALIDATION: 'VALIDATION',
  EVENT_STALE: 'EVENT_STALE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ILLEGAL_MOVE: 'ILLEGAL_MOVE',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_HOST: 'NOT_HOST',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_PLAYERS: 'INSUFFICIENT_PLAYERS',
  INTERNAL: 'INTERNAL',
});

/** Server event name → payload schema. */
export const serverEventSchemas = {
  'lobby:state': LobbyStatePayloadSchema,
  'round:new': RoundNewPayloadSchema,
  'hand:deal': HandDealPayloadSchema,
  'turn:begin': TurnBeginPayloadSchema,
  'play:accept': PlayAcceptPayloadSchema,
  'window:open': WindowOpenPayloadSchema,
  'window:close': WindowClosePayloadSchema,
  'reveal:show': RevealShowPayloadSchema,
  'shot:assign': ShotAssignPayloadSchema,
  'shot:result': ShotResultPayloadSchema,
  'round:end': RoundEndPayloadSchema,
  'game:over': GameOverPayloadSchema,
  'presence:update': PresenceUpdatePayloadSchema,
  'emote:broadcast': EmoteBroadcastPayloadSchema,
  error: ErrorPayloadSchema,
} as const;

export type ServerEventName = keyof typeof serverEventSchemas;

/** Discriminated union of every server event. */
export type ServerEvent = {
  [K in ServerEventName]: { event: K; payload: z.infer<(typeof serverEventSchemas)[K]> };
}[ServerEventName];

// ---------------------------------------------------------------------------
// Ack envelope (Socket.IO acknowledgements)
// ---------------------------------------------------------------------------

/**
 * Uniform ack envelope for every client action that wants a response.
 * Co-designed baseline — S1/W2 adjust via shared if the server evolves it.
 */
export type AckError = { ok: false; error: { code: string; message: string } };
export type AckResult<T> = { ok: true; data: T } | AckError;
export type Ack<T> = (result: AckResult<T>) => void;

export type CreateRoomAckData = { roomCode: string };
export type JoinRoomAckData = {
  roomCode: string;
  spectator: boolean;
  yourSeat: Seat | null;
};
export type SeqAckData = { seq: number };
export type NullAckData = null;

// ---------------------------------------------------------------------------
// Socket.IO typed interfaces (hand to `Server<...>` / `io<...>`)
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  'room:create': (payload: RoomCreatePayload, ack?: Ack<CreateRoomAckData>) => void;
  'room:join': (payload: RoomJoinPayload, ack?: Ack<JoinRoomAckData>) => void;
  'room:leave': (payload: RoomLeavePayload, ack?: Ack<NullAckData>) => void;
  'game:start': (payload: GameStartPayload, ack?: Ack<NullAckData>) => void;
  'play:cards': (payload: PlayCardsPayload, ack?: Ack<SeqAckData>) => void;
  'liar:call': (payload: LiarCallPayload, ack?: Ack<SeqAckData>) => void;
  'emote:send': (payload: EmoteSendPayload, ack?: Ack<NullAckData>) => void;
  'profile:tts-say': (payload: TtsSayPayload, ack?: Ack<NullAckData>) => void;
}

export interface ServerToClientEvents {
  'lobby:state': (payload: LobbyStatePayload) => void;
  'round:new': (payload: RoundNewPayload) => void;
  'hand:deal': (payload: HandDealPayload) => void;
  'turn:begin': (payload: TurnBeginPayload) => void;
  'play:accept': (payload: PlayAcceptPayload) => void;
  'window:open': (payload: WindowOpenPayload) => void;
  'window:close': (payload: WindowClosePayload) => void;
  'reveal:show': (payload: RevealShowPayload) => void;
  'shot:assign': (payload: ShotAssignPayload) => void;
  'shot:result': (payload: ShotResultPayload) => void;
  'round:end': (payload: RoundEndPayload) => void;
  'game:over': (payload: GameOverPayload) => void;
  'presence:update': (payload: PresenceUpdatePayload) => void;
  'emote:broadcast': (payload: EmoteBroadcastPayload) => void;
  error: (payload: ErrorPayload) => void;
}

// ---------------------------------------------------------------------------
// Parse helpers (zod-validate EVERY socket/REST input — STR/08 §2)
// ---------------------------------------------------------------------------

/** Parses a client→server payload against its schema; THROWS zod error on bad input. */
export function parseClientEvent<N extends ClientEventName>(
  name: N,
  payload: unknown,
): z.infer<(typeof clientEventSchemas)[N]> {
  return clientEventSchemas[name].parse(payload) as z.infer<
    (typeof clientEventSchemas)[N]
  >;
}

/** Parses a server→client payload (used by tests + the CI packet-recorder). */
export function parseServerEvent<N extends ServerEventName>(
  name: N,
  payload: unknown,
): z.infer<(typeof serverEventSchemas)[N]> {
  return serverEventSchemas[name].parse(payload) as z.infer<
    (typeof serverEventSchemas)[N]
  >;
}
