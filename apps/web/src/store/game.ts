"use client";

import { create } from "zustand";
import {
  type ClientAction,
  type EmitResult,
  type GameOverState,
  type LobbySnapshot,
  type PlayedStack,
  type RevealState,
  type RoomState,
  type RoundEndState,
  type SeatView,
  type ServerEvent,
  type ShotState,
  avatarSpecFromWire,
  type GamePhase,
  themeFromWire,
} from "@/lib/wire";
import { socket } from "@/lib/socket";
import { playSfx } from "@/lib/sfx";
import { vibrate } from "@/lib/haptics";
import { estimateMatchMinutes } from "@/lib/mock/rooms";

/**
 * ============================================================================
 * THE GAME STORE — mirror of the server's last known view (STR/06 §3)
 * ============================================================================
 * Consumes EVERY STR/07 §2 server event (via the shared zod contract) and
 * folds each payload into the app-side view-models screens read. Optimistic
 * UI is limited to safe things (card selection, emote cooldown, guard sheet);
 * everything else arrives as events. Timers derive from deadlineTs — the
 * client renders countdowns from its own clock, the server is the only one
 * that acts (STR/07 §4).
 *
 * `createGameStore(emitter)` powers the hermetic vitest suite;
 * `useGameStore` is the singleton the screens read.
 * ============================================================================
 */

export interface HandCard {
  id: string;
  rank: "K" | "Q" | "A" | "J";
}

export interface FeedEntry {
  id: string;
  text: string;
  at: number;
}

interface GameStoreState {
  connected: boolean;
  /** A skipped seq means lost events — the bridge re-joins for a snapshot. */
  needsSnapshot: boolean;
  lastSeq: number;
  lobby: LobbySnapshot | null;
  heroSeat: number;
  spectator: boolean;

  phase: GamePhase;
  roundNo: number;
  tableCard: "K" | "Q" | "A" | null;
  turnSeat: number | null;
  deadlineTs: number | null;
  starterSeat: number | null;
  window: { playSeat: number; closesAtTs: number; openedAt: number } | null;
  lastPlay: { seat: number; count: number } | null;
  pile: PlayedStack[];
  /** Table-wide face-down count — the wire's authoritative pile total (STR/07 §2). */
  totalPile: number;
  reveal: RevealState | null;
  shot: ShotState | null;
  roundEnd: RoundEndState | null;
  gameOver: GameOverState | null;
  forcedCall: boolean;

  hand: HandCard[];
  selectedCardIds: string[];
  pendingThrowIds: string[] | null;
  pendingThrow: boolean;
  lastEmoteSentAt: number;
  emotes: Record<number, { emoteId: string; at: number } | undefined>;
  feed: FeedEntry[];
}

export interface GameStore extends GameStoreState {
  setConnected: (b: boolean) => void;
  applyEvent: (ev: ServerEvent) => void;
  toggleCardSelection: (id: string) => boolean; // false = 4th-card hard reject
  clearSelection: () => void;
  sendThrow: () => Promise<EmitResult>;
  sendCheck: (accusedSeat: number) => Promise<EmitResult>;
  sendEmote: (emoteId: string) => Promise<EmitResult>;
  startGame: () => Promise<EmitResult>;
  rematch: () => Promise<EmitResult>;
  /** Create a table (ack carries the minted roomCode; the create flow's submit seam). */
  createRoom: (input: {
    name: string;
    capacity: number;
    theme: LobbySnapshot["theme"];
    visibility: LobbySnapshot["visibility"];
  }) => Promise<EmitResult>;
  noteEmoteSent: () => void;

  // lobby-local host controls (DEV mock seams; S1 defines the real events)
  kickSeat: (seatNo: number) => void;
  toggleSeatLock: (seatNo: number) => void;
  fillSeatWithBot: () => void;
  toggleRoomLock: () => void;
  setTheme: (theme: LobbySnapshot["theme"]) => void;

  seatByNumber: (n: number) => SeatView | undefined;
  nicknameOf: (n: number) => string;
  reset: () => void;
}

const MAX_FEED = 14;
let feedCounter = 0;

function pushFeed(feed: FeedEntry[], text: string): FeedEntry[] {
  feedCounter += 1;
  const entry: FeedEntry = { id: `f-${feedCounter}`, text, at: Date.now() };
  return [...feed, entry].slice(-MAX_FEED);
}

const initialState: GameStoreState = {
  connected: false,
  needsSnapshot: false,
  lastSeq: -1,
  lobby: null,
  heroSeat: 0,
  spectator: false,

  phase: "idle",
  roundNo: 0,
  tableCard: null,
  turnSeat: null,
  deadlineTs: null,
  starterSeat: null,
  window: null,
  lastPlay: null,
  pile: [],
  totalPile: 0,
  reveal: null,
  shot: null,
  roundEnd: null,
  gameOver: null,
  forcedCall: false,

  hand: [],
  selectedCardIds: [],
  pendingThrowIds: null,
  pendingThrow: false,
  lastEmoteSentAt: 0,
  emotes: {},
  feed: [],
};

function mixPile(pile: PlayedStack[], seat: number, count: number): PlayedStack[] {
  const others = pile.filter((s) => s.seat !== seat);
  return [...others, { seat, count }];
}

/** App GamePhase ← shared RoomPhase (catch-up snapshot mapping). */
export function phaseFromRoomPhase(p: RoomState["phase"]): GamePhase {
  switch (p) {
    case "lobby":
      return "lobby";
    case "dealing":
      return "round-new";
    case "playing":
      return "turn";
    case "reveal":
      return "reveal";
    case "roulette":
      return "shot";
    case "roundEnd":
      return "round-end";
    case "gameOver":
      return "game-over";
  }
}

/** Lobby view-model from a shared RoomState snapshot. */
function lobbyFromRoomState(room: RoomState): LobbySnapshot {
  return {
    code: room.roomCode,
    name: room.name,
    // wire slug ('house-table') → UI catalog id ('house') — the store only
    // ever holds catalog ids, so every consumer (data-theme CSS attr,
    // themeMeta lookups) speaks one slug
    theme: themeFromWire(room.theme),
    capacity: room.capacity,
    visibility: room.visibility,
    hostSeat: room.hostSeat,
    roomLocked: false,
    estMatchMinutes: room.estMatchMinutes ?? estimateMatchMinutes(Math.max(2, room.seats.length)),
    seats: room.seats.map(
      (seat): SeatView => ({
        seat: seat.seat,
        nickname: seat.nickname,
        avatar: avatarSpecFromWire(seat.avatarSpec),
        isHost: seat.isHost,
        connected: seat.connected,
        alive: seat.alive,
        pulled: seat.pulls,
        cardCount: seat.handCount,
        locked: false,
        isBot: seat.isBot ?? false, // shared ViewPlayerState.isBot (optional; bots only)
      }),
    ),
  };
}

function mapSeats(lobby: LobbySnapshot | null, fn: (seat: SeatView) => SeatView): LobbySnapshot | null {
  if (!lobby) return lobby;
  return { ...lobby, seats: lobby.seats.map(fn) };
}

/** Exactly one player still holds cards + a play stands → auto-call is live. */
export function computeForcedCall(seats: SeatView[], pile: PlayedStack[]): boolean {
  if (pile.length === 0) return false;
  const holders = seats.filter((s) => s.nickname !== null && s.alive && (s.cardCount ?? 0) > 0);
  return holders.length === 1;
}

export function createGameStore(
  emitter: (action: ClientAction) => Promise<EmitResult> = (action) => socket.emit(action),
) {
  let emoteInFlight: Promise<EmitResult> | null = null; // collapses rapid taps into one emote:send
  return create<GameStore>()((set, get) => ({
    ...initialState,

    setConnected: (b) => set({ connected: b }),

    seatByNumber: (n) => get().lobby?.seats.find((s) => s.seat === n),
    nicknameOf: (n) => get().lobby?.seats.find((s) => s.seat === n)?.nickname ?? "PLAYER",

    applyEvent: (ev) => {
      const seq = (ev.payload as { seq: number }).seq;
      const seqBefore = get().lastSeq;

      if (ev.event === "lobby:state") {
        const room = ev.payload;
        // Stale same-room snapshot (double-join race / socket.io recovery
        // replay): NEVER let an older echo rewind a newer view or clear a
        // fresher gap flag. A snapshot for a DIFFERENT room is always
        // authoritative (join/leave flows reset the store, so seq numbers
        // from two rooms never legitimately compare).
        if (seqBefore !== -1 && room.roomCode === get().lobby?.code && room.seq < seqBefore) {
          return;
        }
        const prev = get();
        const lobby = lobbyFromRoomState(room);
        set({
          lobby,
          lastSeq: room.seq, // the snapshot is authoritative — never "behind"
          needsSnapshot: false,
          heroSeat: room.you?.seat ?? room.hostSeat,
          spectator: room.spectator,
          phase: room.phase === "lobby" ? (prev.phase === "idle" ? "lobby" : prev.phase) : phaseFromRoomPhase(room.phase),
          roundNo: room.roundNo ?? prev.roundNo,
          tableCard: room.tableCard ?? prev.tableCard,
          turnSeat: room.currentTurnSeat ?? prev.turnSeat,
          deadlineTs: room.deadlineTs ?? null,
          window: room.challengeWindow
            ? { playSeat: room.challengeWindow.playSeat, closesAtTs: room.challengeWindow.closesAtTs, openedAt: Date.now() }
            : null,
          hand: room.you ? room.you.hand.map((c) => ({ id: c.id, rank: c.rank })) : prev.hand,
          totalPile: room.pileTotal ?? prev.totalPile,
          forcedCall: computeForcedCall(lobby.seats, prev.pile),
        });
        return;
      }

      // Duplicate/stale delta (seq already applied — a replayed packet after a
      // resync): drop it. Without this, a replay REWINDS lastSeq and every
      // later in-order event looks like a gap → rejoin storm.
      if (seqBefore !== -1 && seq <= seqBefore) return;

      // Monotonic seq guard (STR/07 §4): a skipped seq means lost events.
      // S1 seam: the bridge re-emits `room:join` and the server answers with
      // a fresh `lobby:state` snapshot (recovery is 1 event, not N replays).
      // This event still applies best-effort; the snapshot overwrites.
      if (seq > seqBefore + 1) {
        set({ needsSnapshot: true });
      }

      set({ lastSeq: seq });

      switch (ev.event) {
        // ── round lifecycle ──────────────────────────────────────────
        case "round:new": {
          const prev = get();
          const lobby = mapSeats(prev.lobby, (seat) => ({
            ...seat,
            cardCount: ev.payload.dealtCounts.find((d) => d.seat === seat.seat)?.count ?? 0,
          }));
          set({
            phase: "round-new",
            roundNo: ev.payload.roundNo,
            tableCard: ev.payload.tableCard,
            pile: [],
            totalPile: 0,
            reveal: null,
            shot: null,
            roundEnd: null,
            gameOver: null,
            window: null,
            lastPlay: null,
            turnSeat: null,
            deadlineTs: null,
            starterSeat: null,
            forcedCall: false,
            hand: [],
            selectedCardIds: [],
            pendingThrow: false,
            pendingThrowIds: null,
            lobby,
            feed: pushFeed(prev.feed, `Round ${ev.payload.roundNo} — table card ${ev.payload.tableCard}`),
          });
          return;
        }

        case "hand:deal": {
          const prev = get();
          set({
            hand: ev.payload.cards.map((c) => ({ id: c.id, rank: c.rank })),
            selectedCardIds: [],
            pendingThrow: false,
            pendingThrowIds: null,
            lobby: mapSeats(prev.lobby, (seat) =>
              seat.seat === prev.heroSeat ? { ...seat, cardCount: ev.payload.cards.length } : seat,
            ),
          });
          playSfx("deal");
          return;
        }

        case "turn:begin": {
          const prev = get();
          set({
            phase: "turn",
            turnSeat: ev.payload.seat,
            deadlineTs: ev.payload.deadlineTs,
            starterSeat: prev.starterSeat ?? ev.payload.seat, // first turn of the round marks the starter
            selectedCardIds: ev.payload.seat === prev.heroSeat ? prev.selectedCardIds : [],
            pendingThrow: false,
            pendingThrowIds: null,
            feed: pushFeed(
              prev.feed,
              ev.payload.seat === prev.heroSeat ? "YOUR turn" : `${prev.nicknameOf(ev.payload.seat)}'s turn`,
            ),
          });
          return;
        }

        // ── plays + challenge window ─────────────────────────────────
        case "play:accept": {
          const prev = get();
          const isMine = ev.payload.seat === prev.heroSeat;
          const staged = prev.pendingThrowIds;
          // which of my cards left the hand: the staged selection, or (server
          // auto-play on timeout) the first card — STR/01 §3's auto-play means
          // the server plays 1; the snapshot event will correct any drift.
          const removedIds = isMine ? (staged ?? [prev.hand[0]?.id ?? ""]) : [];
          const hand = isMine ? prev.hand.filter((c) => !removedIds.includes(c.id)) : prev.hand;
          const lobby = mapSeats(prev.lobby, (seat) =>
            seat.seat === ev.payload.seat
              ? {
                  ...seat,
                  cardCount: Math.max(0, (seat.cardCount ?? 0) - ev.payload.count),
                  ...(isMine ? { cardCount: hand.length } : {}),
                }
              : seat,
          );
          const pile = mixPile(prev.pile, ev.payload.seat, ev.payload.count);
          set({
            pile,
            totalPile: ev.payload.totalPile,
            lastPlay: { seat: ev.payload.seat, count: ev.payload.count },
            turnSeat: null,
            deadlineTs: null,
            hand,
            pendingThrow: false,
            pendingThrowIds: null,
            selectedCardIds: [],
            lobby,
            forcedCall: lobby ? computeForcedCall(lobby.seats, pile) : false,
            feed: pushFeed(
              prev.feed,
              `${isMine ? "YOU" : prev.nicknameOf(ev.payload.seat)} threw ${ev.payload.count} card${ev.payload.count === 1 ? "" : "s"}`,
            ),
          });
          playSfx("throw");
          return;
        }

        case "window:open": {
          const prev = get();
          set({
            phase: "window",
            window: { playSeat: ev.payload.playSeat, closesAtTs: ev.payload.closesAtTs, openedAt: Date.now() },
            feed: pushFeed(prev.feed, "CHECK window open — challenge the last throw"),
          });
          playSfx("window-arm");
          vibrate("window-arm"); // haptics map: 20ms arm tap (feature-detected internally)
          return;
        }

        case "window:close": {
          const prev = get();
          set({
            window: null,
            phase: prev.turnSeat !== null ? "turn" : prev.phase === "window" ? "turn" : prev.phase,
          });
          return;
        }

        // ── resolution ───────────────────────────────────────────────
        case "reveal:show": {
          const prev = get();
          const accused = prev.window?.playSeat ?? prev.lastPlay?.seat ?? null;
          set({
            phase: "reveal",
            window: null,
            forcedCall: false,
            // the resolution settles any pending turn — stop the countdown
            // ring from lingering through the cinematic
            turnSeat: null,
            deadlineTs: null,
            reveal: {
              seat: accused,
              cards: ev.payload.cards.map((c) => ({ id: c.id, rank: c.rank })),
              verdict: ev.payload.verdict,
              loserSeat: ev.payload.loserSeat,
            },
            feed: pushFeed(
              prev.feed,
              `${accused !== null ? prev.nicknameOf(accused) : "The accused"}'s play: ${ev.payload.verdict}!`,
            ),
          });
          playSfx("flip");
          return;
        }

        case "shot:assign": {
          const prev = get();
          const pulls = prev.seatByNumber(ev.payload.loserSeat)?.pulled ?? 0;
          set({
            phase: "shot",
            shot: {
              loserSeat: ev.payload.loserSeat,
              kind: ev.payload.kind,
              executorSeat: ev.payload.kind === "EXECUTE" ? (ev.payload.executorSeat ?? null) : null,
              outcome: null,
              pulls,
            },
            feed: pushFeed(
              prev.feed,
              ev.payload.kind === "EXECUTE"
                ? `${prev.nicknameOf(ev.payload.executorSeat ?? 0)} executes ${prev.nicknameOf(ev.payload.loserSeat)}`
                : `${prev.nicknameOf(ev.payload.loserSeat)} takes the revolver`,
            ),
          });
          playSfx("challenge-slam");
          return;
        }

        case "shot:result": {
          const prev = get();
          set({
            lobby: mapSeats(prev.lobby, (seat) =>
              seat.seat === ev.payload.loserSeat
                ? {
                    ...seat,
                    pulled: ev.payload.pulls,
                    alive: ev.payload.outcome === "LIVE" ? false : seat.alive,
                  }
                : seat,
            ),
            shot: prev.shot ? { ...prev.shot, outcome: ev.payload.outcome, pulls: ev.payload.pulls } : null,
            feed: pushFeed(
              prev.feed,
              ev.payload.outcome === "BLANK"
                ? `${prev.nicknameOf(ev.payload.loserSeat)} survives (${ev.payload.pulls}/6)`
                : `${prev.nicknameOf(ev.payload.loserSeat)} is out`,
            ),
          });
          return;
        }

        case "round:end": {
          const prev = get();
          set({
            phase: "round-end",
            roundEnd: {
              reason: ev.payload.reason,
              survivorCoins: ev.payload.survivorCoins,
              xpEarned: ev.payload.xpEarned.map((x) => ({ seat: x.seat, xp: x.xp })),
            },
            forcedCall: false,
            feed: pushFeed(
              prev.feed,
              `${ev.payload.reason === "death" ? "A round ends in death" : "The round ends — shots survived"} · +${ev.payload.survivorCoins}🪙`,
            ),
          });
          playSfx("round-end");
          return;
        }

        case "game:over": {
          const prev = get();
          set({
            phase: "game-over",
            gameOver: {
              winnerSeat: ev.payload.winnerSeat,
              matchRecord: ev.payload.matchRecord,
              rewards: ev.payload.rewards,
            },
            window: null,
            forcedCall: false,
            // the ceremony owns the screen — no turn/timer state survives it
            turnSeat: null,
            deadlineTs: null,
            feed: pushFeed(
              prev.feed,
              ev.payload.winnerSeat === null
                ? "The table falls silent — nobody survived"
                : `${prev.nicknameOf(ev.payload.winnerSeat)} wins the table`,
            ),
          });
          playSfx("win");
          return;
        }

        // ── ambience ─────────────────────────────────────────────────
        case "presence:update": {
          const lobby = get().lobby;
          if (!lobby) return;
          const bySeat = new Map(ev.payload.seats.map((p) => [p.seat, p]));
          set({
            lobby: {
              ...lobby,
              // a seat the payload omits keeps its previous flag — never
              // default it to connected (presence is server-authoritative)
              seats: lobby.seats.map((seat) => ({ ...seat, connected: bySeat.get(seat.seat)?.connected ?? seat.connected })),
            },
          });
          return;
        }

        case "emote:broadcast": {
          set({
            emotes: { ...get().emotes, [ev.payload.seat]: { emoteId: ev.payload.emoteId, at: Date.now() } },
          });
          playSfx("emote-bang"); // emote-fired table bang seam — sfx engine lands with C1
          return;
        }

        case "error": {
          set({ feed: pushFeed(get().feed, ev.payload.message) });
          return;
        }

        default: {
          const never: never = ev;
          void never;
        }
      }
    },

    // ── optimistic-only helpers (safe local state) ────────────────────

    toggleCardSelection: (id) => {
      const { selectedCardIds } = get();
      if (selectedCardIds.includes(id)) {
        set({ selectedCardIds: selectedCardIds.filter((c) => c !== id) });
        playSfx("card-select");
        return true;
      }
      if (selectedCardIds.length >= 3) return false; // hard reject: shake + buzz (research/09 §3)
      set({ selectedCardIds: [...selectedCardIds, id] });
      playSfx("card-select");
      return true;
    },

    clearSelection: () => set({ selectedCardIds: [] }),

    sendThrow: async () => {
      const { selectedCardIds, pendingThrow, phase } = get();
      // advisory guard: the server is the authority, but a dance after the
      // ceremony is locally dead too (round:new is the only re-arm)
      if (phase === "game-over") return { ok: false, errorCode: "EVENT_STALE", errorMessage: "The match is already over." };
      if (pendingThrow || selectedCardIds.length === 0) return { ok: false, errorMessage: "Nothing selected." };
      const cardIds = [...selectedCardIds];
      set({ pendingThrow: true, pendingThrowIds: cardIds });
      const res = await emitter({ type: "play:cards", cardIds });
      if (!res.ok) {
        // the play never landed (rejection / ack timeout) — free the SAME-TURN
        // retry instead of freezing the hand until the next turn:begin
        set({ pendingThrow: false, pendingThrowIds: null });
      }
      return res;
    },

    sendCheck: (accusedSeat) => {
      if (get().phase === "game-over") {
        return Promise.resolve({ ok: false, errorCode: "EVENT_STALE", errorMessage: "The match is already over." });
      }
      return emitter({ type: "liar:call", accusedSeat });
    },

    sendEmote: (emoteId) => {
      // Cooldown is advisory client-side (the server re-arms it anyway); it's
      // stamped only on the server's ACCEPT so a rejected emote doesn't burn
      // it. In-flight taps collapse into one emit.
      if (emoteInFlight) return emoteInFlight;
      emoteInFlight = emitter({ type: "emote:send", emoteId }).then(
        (res) => {
          emoteInFlight = null;
          if (res.ok) get().noteEmoteSent();
          return res;
        },
        (err: unknown) => {
          emoteInFlight = null;
          throw err;
        },
      );
      return emoteInFlight;
    },

    startGame: () => emitter({ type: "game:start" }),

    rematch: () => emitter({ type: "game:start" }),

    createRoom: (input) =>
      emitter({
        type: "room:create",
        name: input.name,
        capacity: input.capacity,
        theme: input.theme,
        visibility: input.visibility,
      }),

    noteEmoteSent: () => set({ lastEmoteSentAt: Date.now() }),

    // ── lobby-local host controls (DEV mock seams; S1 defines the real events) ──

    kickSeat: (seatNo) => {
      const lobby = get().lobby;
      if (!lobby) return;
      set({
        lobby: {
          ...lobby,
          seats: lobby.seats.map((s) =>
            s.seat === seatNo ? { ...s, nickname: null, avatar: null, isBot: false, connected: false } : s,
          ),
        },
      });
    },

    toggleSeatLock: (seatNo) => {
      const lobby = get().lobby;
      if (!lobby) return;
      set({
        lobby: { ...lobby, seats: lobby.seats.map((s) => (s.seat === seatNo ? { ...s, locked: !s.locked } : s)) },
      });
    },

    fillSeatWithBot: () => {
      const lobby = get().lobby;
      if (!lobby) return;
      const idx = lobby.seats.findIndex((s) => s.nickname === null && !s.locked);
      if (idx === -1) {
        set({ lobby: { ...lobby, roomLocked: !lobby.roomLocked } }); // full → toggle room lock instead
        return;
      }
      const bots = ["SUE", "TOAR", "FOX", "BRIS", "MIGO", "REX"];
      const animals = ["owl", "wolf", "fox", "bear", "deer", "boar"] as const;
      const existing = new Set(lobby.seats.map((s) => s.nickname));
      const botName = bots.find((b) => !existing.has(b)) ?? `BOT-${Date.now() % 1000}`;
      const seat = lobby.seats[idx];
      set({
        lobby: {
          ...lobby,
          seats: lobby.seats.map((s, i) =>
            i === idx
              ? {
                  ...s,
                  nickname: botName,
                  avatar: { animal: animals[Math.floor(s.seat % animals.length)] },
                  connected: true,
                  isBot: true,
                }
              : s,
          ),
          estMatchMinutes: estimateMatchMinutes(lobby.seats.filter((s) => s.nickname).length + 1),
        },
      });
      void seat;
    },

    toggleRoomLock: () => {
      const lobby = get().lobby;
      if (!lobby) return;
      set({ lobby: { ...lobby, roomLocked: !lobby.roomLocked } });
    },

    setTheme: (theme) => {
      const lobby = get().lobby;
      if (!lobby) return;
      set({ lobby: { ...lobby, theme } });
    },

    reset: () => set({ ...initialState }),
  }));
}

export const useGameStore = createGameStore();
