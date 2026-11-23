"use client";

import { create } from "zustand";
import type {
  CardRank,
  GamePhase,
  LobbySnapshot,
  PlayedStack,
  RevealState,
  RoomState,
  RoundEndState,
  SeatView,
  ServerEvent,
  ShotState,
  ThemeId,
} from "@/lib/wire";
import { estimateMatchMinutes } from "@/lib/mock/rooms";

/**
 * THE client state (STR/06 §3): a zustand store mirroring the last known
 * server view of the room. The mock adapter fills it today; the real
 * socket drops in tomorrow with ZERO screen changes. Optimistic UI is
 * limited to safe things (card selection, emotes) — everything else
 * arrives as events.
 */

export interface HandCard {
  id: string;
  rank: CardRank;
}

export interface FeedEntry {
  id: string;
  text: string;
  at: number;
}

interface GameStore extends RoomState {
  connected: boolean;
  lobby: LobbySnapshot | null;
  hand: HandCard[];
  selectedCardIds: string[];
  pendingThrow: boolean;
  lastEmoteSentAt: number;
  emotes: Record<number, { emoteId: string; at: number } | undefined>;
  feed: FeedEntry[];

  setConnected: (b: boolean) => void;
  applyLobby: (lobby: LobbySnapshot) => void;
  applyEvent: (ev: ServerEvent) => void;
  toggleCardSelection: (id: string) => boolean; // false = rejected (4th card)
  clearSelection: () => void;
  setPendingThrow: (b: boolean) => void;
  noteEmoteSent: () => void;
  seatByNumber: (n: number) => SeatView | undefined;
  nicknameOf: (n: number) => string;

  // lobby-local host actions (mock; real kick/lock event names TBD by S1)
  kickSeat: (seatNo: number) => void;
  toggleSeatLock: (seatNo: number) => void;
  fillSeatWithBot: () => void;
  toggleRoomLock: () => void;
  setTheme: (theme: ThemeId) => void;

  reset: () => void;
}

const MAX_FEED = 12;

function pushFeed(feed: FeedEntry[], text: string): FeedEntry[] {
  const entry: FeedEntry = { id: `f-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, text, at: Date.now() };
  return [...feed, entry].slice(-MAX_FEED);
}

const initialGame: RoomState = {
  phase: "idle" as GamePhase,
  roundNo: 0,
  tableCard: null,
  turnSeat: null,
  deadlineTs: null,
  window: null,
  pile: [] as PlayedStack[],
  reveal: null as RevealState | null,
  shot: null as ShotState | null,
  roundEnd: null as RoundEndState | null,
};

function mixPile(pile: PlayedStack[], seat: number, count: number): PlayedStack[] {
  const others = pile.filter((s) => s.seat !== seat);
  return [...others, { seat, count }];
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialGame,
  connected: false,
  lobby: null,
  hand: [],
  selectedCardIds: [],
  pendingThrow: false,
  lastEmoteSentAt: 0,
  emotes: {},
  feed: [],

  setConnected: (b) => set({ connected: b }),

  seatByNumber: (n) => get().lobby?.seats.find((s) => s.seat === n),
  nicknameOf: (n) => get().lobby?.seats.find((s) => s.seat === n)?.nickname ?? "PLAYER",

  applyLobby: (lobby) => {
    const prev = get().lobby;
    const phase: GamePhase = prev && get().phase !== "idle" && get().phase !== "lobby" ? get().phase : "lobby";
    set({ lobby, phase });
  },

  applyEvent: (ev) => {
    const s = get();
    switch (ev.type) {
      case "lobby:state": {
        s.applyLobby(ev.lobby);
        return;
      }
      case "round:new": {
        set({
          phase: "round-new",
          roundNo: ev.roundNo,
          tableCard: ev.tableCard,
          pile: [],
          reveal: null,
          shot: null,
          roundEnd: null,
          window: null,
          turnSeat: null,
          deadlineTs: null,
          hand: [],
          selectedCardIds: [],
          feed: pushFeed(s.feed, `Round ${ev.roundNo} — table card ${ev.tableCard}`),
        });
        return;
      }
      case "hand:deal": {
        set({ hand: ev.cards.map((c) => ({ id: c.id, rank: c.rank })), selectedCardIds: [], pendingThrow: false });
        return;
      }
      case "turn:begin": {
        const seatName = s.nicknameOf(ev.seat);
        set({
          phase: ev.seat === 0 ? "turn" : s.phase === "window" ? "window" : "turn",
          turnSeat: ev.seat,
          deadlineTs: ev.deadlineTs,
          selectedCardIds: ev.seat === 0 ? s.selectedCardIds : [],
          feed: pushFeed(s.feed, ev.seat === 0 ? "YOUR turn" : `${seatName}'s turn`),
        });
        return;
      }
      case "play:accept": {
        const isMine = ev.seat === 0;
        set({
          pile: mixPile(s.pile, ev.seat, ev.count),
          hand: s.hand,
          selectedCardIds: [],
          pendingThrow: false,
          turnSeat: null,
          deadlineTs: null,
          feed: pushFeed(
            s.feed,
            `${isMine ? "YOU" : s.nicknameOf(ev.seat)} threw ${ev.count} card${ev.count === 1 ? "" : "s"}`,
          ),
        });
        return;
      }
      case "window:open": {
        set({
          phase: "window",
          window: { playSeat: ev.playSeat, closesAtTs: ev.closesAtTs },
          feed: pushFeed(s.feed, "CHECK window open — 10s"),
        });
        return;
      }
      case "window:close": {
        set({ window: null, phase: get().turnSeat !== null ? "turn" : get().phase === "window" ? "turn" : get().phase });
        return;
      }
      case "reveal:show": {
        set({
          phase: "reveal",
          window: null,
          reveal: { seat: ev.seat, cards: ev.cards, verdict: ev.verdict, loserSeat: ev.loserSeat },
          feed: pushFeed(s.feed, `${s.nicknameOf(ev.seat)}'s play: ${ev.verdict}!`),
        });
        return;
      }
      case "shot:assign": {
        set({
          phase: "shot",
          shot: { loserSeat: ev.loserSeat, kind: ev.kind, executorSeat: ev.executorSeat, outcome: null, pulls: 0 },
          feed: pushFeed(
            s.feed,
            ev.kind === "EXECUTE"
              ? `${s.nicknameOf(ev.executorSeat ?? 0)} executes ${s.nicknameOf(ev.loserSeat)}`
              : `${s.nicknameOf(ev.loserSeat)} takes the revolver`,
          ),
        });
        return;
      }
      case "shot:result": {
        const lobby = s.lobby;
        const seats = lobby
          ? {
              ...lobby,
              seats: lobby.seats.map((seat) =>
                seat.seat === ev.loserSeat
                  ? { ...seat, pulled: ev.pulls, alive: ev.outcome === "LIVE" ? false : seat.alive }
                  : seat,
              ),
            }
          : lobby;
        const survived = ev.outcome === "BLANK";
        set({
          lobby: seats,
          shot: s.shot ? { ...s.shot, outcome: ev.outcome, pulls: ev.pulls } : null,
          feed: pushFeed(
            s.feed,
            survived
              ? `${s.nicknameOf(ev.loserSeat)} survives (${ev.pulls}/6)`
              : `${s.nicknameOf(ev.loserSeat)} is out`,
          ),
        });
        return;
      }
      case "round:end": {
        set({
          phase: "round-end",
          roundEnd: { reason: ev.reason, survivorCoins: ev.survivorCoins, xpEarned: ev.xpEarned },
          feed: pushFeed(s.feed, `${ev.reason} · +${ev.survivorCoins}🪙 +${ev.xpEarned}XP`),
        });
        return;
      }
      case "game:over": {
        set({ phase: "game-over", feed: pushFeed(s.feed, `${s.nicknameOf(ev.winnerSeat)} wins the table`) });
        return;
      }
      case "presence:update": {
        const lobby = s.lobby;
        if (!lobby) return;
        const bySeat = new Map(ev.seats.map((p) => [p.seat, p]));
        set({
          lobby: {
            ...lobby,
            seats: lobby.seats.map((seat) => ({ ...seat, connected: bySeat.get(seat.seat)?.connected ?? true })),
          },
        });
        return;
      }
      case "emote:broadcast": {
        set({
          emotes: { ...s.emotes, [ev.seat]: { emoteId: ev.emoteId, at: Date.now() } },
        });
        return;
      }
      case "error": {
        set({ feed: pushFeed(s.feed, ev.message) });
        return;
      }
      default: {
        const never: never = ev;
        void never;
      }
    }
  },

  toggleCardSelection: (id) => {
    const { selectedCardIds } = get();
    if (selectedCardIds.includes(id)) {
      set({ selectedCardIds: selectedCardIds.filter((c) => c !== id) });
      return true;
    }
    if (selectedCardIds.length >= 3) return false; // hard reject: shake + buzz (research/09 §3)
    set({ selectedCardIds: [...selectedCardIds, id] });
    return true;
  },

  clearSelection: () => set({ selectedCardIds: [] }),
  setPendingThrow: (b) => set({ pendingThrow: b }),
  noteEmoteSent: () => set({ lastEmoteSentAt: Date.now() }),

  // ── lobby-local host actions (DEV mock seams; S1 defines the real events) ──
  kickSeat: (seatNo) => {
    const lobby = get().lobby;
    if (!lobby) return;
    set({
      lobby: {
        ...lobby,
        seats: lobby.seats.map((s) => (s.seat === seatNo ? { ...s, nickname: null, avatar: null, isBot: false, connected: false } : s)),
      },
    });
  },

  toggleSeatLock: (seatNo) => {
    const lobby = get().lobby;
    if (!lobby) return;
    set({
      lobby: {
        ...lobby,
        seats: lobby.seats.map((s) => (s.seat === seatNo ? { ...s, locked: !s.locked } : s)),
      },
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
    const existing = new Set(lobby.seats.map((s) => s.nickname));
    const botName = bots.find((b) => !existing.has(b)) ?? `BOT-${Date.now() % 1000}`;
    const animals = ["owl", "wolf", "fox", "bear", "deer", "boar"] as const;
    set({
      lobby: {
        ...lobby,
        seats: lobby.seats.map((s, i) =>
          i === idx
            ? { ...s, nickname: botName, avatar: { animal: animals[Math.floor(Math.random() * animals.length)] }, connected: true, isBot: true }
            : s,
        ),
        estMatchMinutes: estimateMatchMinutes(lobby.seats.filter((s) => s.nickname).length + 1),
      },
    });
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

  reset: () =>
    set({
      ...initialGame,
      connected: false,
      lobby: null,
      hand: [],
      selectedCardIds: [],
      pendingThrow: false,
      emotes: {},
      feed: [],
    }),
}));
