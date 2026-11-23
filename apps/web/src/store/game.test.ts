import { describe, expect, it } from "vitest";
import { computeForcedCall, createGameStore, phaseFromRoomPhase, type GameStore } from "@/store/game";
import {
  parseServerEvent,
  type ClientAction,
  type EmitResult,
  type MatchRecord,
  type SeatView,
  type ServerEvent,
  type ServerEventName,
} from "@/lib/wire";

/**
 * ============================================================================
 * applyEvent suite — table-driven, hermetic (fresh store + stub emitter per
 * case). Every event is built through the shared `parseServerEvent`, so the
 * tests double as contract-canaries: any drift in @liars-game/shared fails
 * here before it reaches a screen.
 * ============================================================================
 */

function ev(name: ServerEventName, seq: number, payload: Record<string, unknown>): ServerEvent {
  const parsed = parseServerEvent(name, { ...payload, seq });
  return { event: name, payload: parsed } as ServerEvent;
}

const NICKS = ["YOU", "SCUBB", "SUE", "TOAR", "FOX"] as const;
const ANIMALS = ["fox", "raccoon", "owl", "wolf", "deer"] as const;

/** Standard 5-seat room snapshot (what S1 and the mock both send). */
function lobbyState(overrides: { heroAlive?: boolean; handCounts?: number[] } = {}): ServerEvent {
  const alive = overrides.heroAlive ?? true;
  const handCounts = overrides.handCounts ?? [4, 3, 2, 5, 1];
  const heroCount = handCounts[0] ?? 4;
  const seats = [0, 1, 2, 3, 4].map((seat) => ({
    seat,
    nickname: NICKS[seat] ?? `P${seat}`,
    avatarSpec: { base: ANIMALS[seat] ?? "fox" },
    connected: true,
    afk: false,
    isHost: seat === 0,
    handCount: handCounts[seat] ?? 0,
    pulls: seat === 3 ? 2 : seat === 0 ? (alive ? 1 : 3) : 0,
    alive: seat === 0 ? alive : true,
    activeTitle: null,
  }));
  return ev("lobby:state", 0, {
    roomCode: "TESTY",
    name: "TEST TABLE",
    capacity: 5,
    theme: "saloon",
    visibility: "private",
    phase: "playing",
    hostSeat: 0,
    seats,
    you: {
      seat: 0,
      nickname: "YOU",
      avatarSpec: { base: "fox" },
      connected: true,
      afk: false,
      isHost: true,
      hand: Array.from({ length: heroCount }, (_, i) => ({ id: `c${i}`, rank: "K" })),
      handCount: heroCount,
      pulls: alive ? 1 : 3,
      alive,
      activeTitle: null,
    },
    spectator: false,
    roundNo: 2,
    tableCard: "K",
    currentTurnSeat: null,
    deadlineTs: null,
    pileTotal: 0,
    estMatchMinutes: 8,
  });
}

function matchRecord(): MatchRecord {
  return {
    matchId: "test-match",
    roomCode: "TESTY",
    startedAt: 1,
    endedAt: 2,
    capacity: 5,
    theme: "saloon",
    players: [0, 1, 2, 3, 4].map((seat) => ({
      accountId: `a${seat}`,
      seat,
      nickname: `P${seat}`,
      avatarSpec: { base: "fox" },
      titleAtPlay: null,
      stats: {
        kills: 0,
        catches: 0,
        falseAccusations: 0,
        bluffSuccesses: 0,
        deaths: 0,
        pullsSurvived: 1,
        roundsPlayed: 5,
        won: seat === 0,
        xpEarned: seat === 0 ? 12 : 4,
        coinsEarned: seat === 0 ? 6 : 0,
      },
    })),
    summary: { rounds: 5, totalPulls: 3, dareDevilMoments: 1 },
  };
}

function fakeSeat(over: Partial<SeatView>): SeatView {
  return {
    seat: 0,
    nickname: "A",
    avatar: null,
    isHost: false,
    connected: true,
    alive: true,
    pulled: 0,
    cardCount: 0,
    locked: false,
    isBot: false,
    ...over,
  };
}

class Fixture {
  store: ReturnType<typeof createGameStore>;
  seq = 0;
  sent: ClientAction[] = [];
  emitterResults: EmitResult[] = [];

  constructor() {
    this.store = createGameStore(async (action) => {
      this.sent.push(action);
      return this.emitterResults.shift() ?? { ok: true };
    });
  }

  send(name: ServerEventName, payload: Record<string, unknown>): void {
    const event = ev(name, 0, payload);
    (event.payload as { seq: number }).seq = ++this.seq;
    this.store.getState().applyEvent(event);
  }
}

function fresh(): Fixture {
  return new Fixture();
}

const at = (f: Fixture, seat: number) => f.store.getState().seatByNumber(seat);

describe("applyEvent — lobby:state (snapshot + catch-up)", () => {
  it("rebuilds the lobby view-model from a shared RoomState", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    const s = f.store.getState();
    expect(s.lobby?.code).toBe("TESTY");
    expect(s.lobby?.seats).toHaveLength(5);
    expect(s.heroSeat).toBe(0);
    expect(s.spectator).toBe(false);
    expect(s.phase).toBe("turn"); // playing → turn
    expect(s.tableCard).toBe("K");
    expect(s.roundNo).toBe(2);
    expect(s.lastSeq).toBe(0);
    expect(s.needsSnapshot).toBe(false);
    expect(s.lobby?.seats[1]?.avatar?.base).toBe("raccoon"); // wire → app avatar mapping
  });

  it("maps every shared RoomPhase to an app phase", () => {
    expect(phaseFromRoomPhase("lobby")).toBe("lobby");
    expect(phaseFromRoomPhase("dealing")).toBe("round-new");
    expect(phaseFromRoomPhase("playing")).toBe("turn");
    expect(phaseFromRoomPhase("reveal")).toBe("reveal");
    expect(phaseFromRoomPhase("roulette")).toBe("shot");
    expect(phaseFromRoomPhase("roundEnd")).toBe("round-end");
    expect(phaseFromRoomPhase("gameOver")).toBe("game-over");
  });

  it("restores an open challenge window from a reconnect snapshot", () => {
    const f = fresh();
    const lobby = lobbyState();
    (lobby.payload as unknown as { challengeWindow: unknown }).challengeWindow = {
      playSeat: 2,
      closesAtTs: Date.now() + 9_000,
    };
    f.store.getState().applyEvent(lobby);
    const s = f.store.getState();
    expect(s.window?.playSeat).toBe(2);
  });
});

describe("applyEvent — round:new / hand:deal", () => {
  it("resets the round surfaces and applies dealt counts", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("round:new", { roundNo: 3, tableCard: "Q", dealtCounts: [{ seat: 1, count: 5 }, { seat: 2, count: 5 }] });
    const s = f.store.getState();
    expect(s.phase).toBe("round-new");
    expect(s.roundNo).toBe(3);
    expect(s.tableCard).toBe("Q");
    expect(s.pile).toEqual([]);
    expect(s.reveal).toBeNull();
    expect(s.shot).toBeNull();
    expect(s.roundEnd).toBeNull();
    expect(s.gameOver).toBeNull();
    expect(s.hand).toEqual([]);
    expect(s.turnSeat).toBeNull();
    expect(s.starterSeat).toBeNull();
    expect(at(f, 1)?.cardCount).toBe(5);
    expect(at(f, 0)?.cardCount).toBe(0); // hero's count arrives via hand:deal
  });

  it("deals the hero hand and clears any stale selection", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.store.getState().toggleCardSelection("c0");
    f.send("hand:deal", { cards: [{ id: "h1", rank: "K" }, { id: "h2", rank: "J" }, { id: "h3", rank: "A" }] });
    const s = f.store.getState();
    expect(s.hand.map((c) => c.rank)).toEqual(["K", "J", "A"]);
    expect(s.selectedCardIds).toEqual([]);
    expect(at(f, 0)?.cardCount).toBe(3);
  });
});

describe("applyEvent — turn:begin", () => {
  it("spotlights the seat, tracks the deadline, and marks the round's starter", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("round:new", { roundNo: 1, tableCard: "K", dealtCounts: [{ seat: 1, count: 5 }] });
    const deadline = Date.now() + 20_000;
    f.send("turn:begin", { seat: 4, deadlineTs: deadline });
    expect(f.store.getState().starterSeat).toBe(4);
    expect(f.store.getState().deadlineTs).toBe(deadline);
    expect(f.store.getState().turnSeat).toBe(4);

    f.send("turn:begin", { seat: 0, deadlineTs: deadline + 1 });
    const s = f.store.getState();
    expect(s.starterSeat).toBe(4); // starter never changes mid-round
    expect(s.phase).toBe("turn");
  });
});

describe("applyEvent — play:accept + challenge window", () => {
  it("walks deal → turn → play → window, shrinking the staged hero hand", async () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("round:new", { roundNo: 1, tableCard: "A", dealtCounts: [{ seat: 1, count: 5 }] });
    f.send("hand:deal", {
      cards: [
        { id: "h1", rank: "A" },
        { id: "h2", rank: "K" },
        { id: "h3", rank: "Q" },
        { id: "h4", rank: "J" },
        { id: "h5", rank: "A" },
      ],
    });
    f.send("turn:begin", { seat: 0, deadlineTs: Date.now() + 20_000 });

    f.store.getState().toggleCardSelection("h1");
    f.store.getState().toggleCardSelection("h3");
    await f.store.getState().sendThrow();
    expect(f.sent).toEqual([{ type: "play:cards", cardIds: ["h1", "h3"] }]);
    expect(f.store.getState().pendingThrow).toBe(true);

    f.send("play:accept", { seat: 0, count: 2, totalPile: 2 });
    const s = f.store.getState();
    expect(s.hand.map((c) => c.id)).toEqual(["h2", "h4", "h5"]);
    expect(s.pile).toEqual([{ seat: 0, count: 2 }]);
    expect(s.totalPile).toBe(2); // the wire's pile total lands with the play
    expect(s.lastPlay).toEqual({ seat: 0, count: 2 });
    expect(s.pendingThrow).toBe(false);
    expect(s.selectedCardIds).toEqual([]);
    expect(at(f, 0)?.cardCount).toBe(3);

    f.send("window:open", { playSeat: 0, closesAtTs: Date.now() + 12_000 });
    expect(f.store.getState().phase).toBe("window");
    expect(f.store.getState().window?.playSeat).toBe(0);

    f.send("turn:begin", { seat: 1, deadlineTs: Date.now() + 20_000 });
    f.send("window:close", { reason: "belief" });
    const after = f.store.getState();
    expect(after.window).toBeNull();
    expect(after.phase).toBe("turn");

    // strict schemas: a smuggled rank on play:accept never parses
    expect(() => parseServerEvent("play:accept", { seq: 1, seat: 1, count: 1, totalPile: 3, rank: "A" })).toThrow();
  });

  it("derives forcedCall the instant a single holder remains", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState({ handCounts: [3, 1, 2, 5, 5] }));
    f.send("round:new", { roundNo: 1, tableCard: "K", dealtCounts: [{ seat: 1, count: 1 }, { seat: 2, count: 2 }] });
    f.send("hand:deal", { cards: [{ id: "h1", rank: "K" }, { id: "h2", rank: "Q" }, { id: "h3", rank: "A" }] });
    f.send("play:accept", { seat: 2, count: 2, totalPile: 2 });
    expect(f.store.getState().forcedCall).toBe(false);
    f.send("play:accept", { seat: 1, count: 1, totalPile: 3 });
    expect(f.store.getState().forcedCall).toBe(true);
    expect(at(f, 1)?.cardCount).toBe(0);
  });

  it("plumbs wire totalPile through snapshot and play, resetting each round", () => {
    const f = fresh();
    const midMatch = lobbyState();
    Object.assign(midMatch.payload, { pileTotal: 7 });
    f.store.getState().applyEvent(midMatch);
    expect(f.store.getState().totalPile).toBe(7); // lobby:state carries the authoritative total

    f.send("play:accept", { seat: 1, count: 3, totalPile: 10 });
    expect(f.store.getState().totalPile).toBe(10); // play:accept updates it

    f.send("round:new", { roundNo: 4, tableCard: "Q", dealtCounts: [] });
    expect(f.store.getState().pile).toEqual([]);
    expect(f.store.getState().totalPile).toBe(0); // a fresh round starts the count over
  });

  it("computeForcedCall needs a standing play AND exactly one holder", () => {
    const holder = fakeSeat({ seat: 0, nickname: "A", alive: true, cardCount: 3 });
    const emptied = fakeSeat({ seat: 1, nickname: "B", alive: true, cardCount: 0 });
    const dead = fakeSeat({ seat: 2, nickname: "C", alive: false, cardCount: 5 });
    const rival = fakeSeat({ seat: 3, nickname: "D", alive: true, cardCount: 1 });
    expect(computeForcedCall([holder, emptied, dead], [{ seat: 1, count: 2 }])).toBe(true);
    expect(computeForcedCall([holder, emptied, dead], [])).toBe(false);
    expect(computeForcedCall([holder, rival], [{ seat: 3, count: 1 }])).toBe(false);
  });
});

describe("applyEvent — reveal:show", () => {
  it("clears the open window, enters reveal, and derives the accused seat", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("play:accept", { seat: 2, count: 2, totalPile: 2 });
    f.send("window:open", { playSeat: 2, closesAtTs: Date.now() + 12_000 });
    f.send("reveal:show", {
      cards: [{ id: "r1", rank: "Q" }, { id: "r2", rank: "K" }],
      verdict: "LIE",
      loserSeat: 2,
    });
    const s = f.store.getState();
    expect(s.phase).toBe("reveal");
    expect(s.window).toBeNull(); // reveal clears the challenge window
    expect(s.reveal?.seat).toBe(2); // derived: the window's playSeat
    expect(s.reveal?.verdict).toBe("LIE");
    expect(s.reveal?.loserSeat).toBe(2);
    expect(s.forcedCall).toBe(false);
  });
});

describe("applyEvent — shot lifecycle ordering", () => {
  it("assigns unarmed first, then the result arms pulls + elimination", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("reveal:show", { cards: [{ id: "r1", rank: "Q" }], verdict: "LIE", loserSeat: 3 });
    f.send("shot:assign", { loserSeat: 3, kind: "SELF" });
    let s = f.store.getState();
    expect(s.phase).toBe("shot");
    expect(s.shot).toMatchObject({ loserSeat: 3, kind: "SELF", executorSeat: null, outcome: null });
    expect(s.shot?.pulls).toBe(2); // pre-shot public counter from the seat view

    f.send("shot:result", { loserSeat: 3, pulls: 3, outcome: "LIVE" });
    s = f.store.getState();
    expect(s.shot?.outcome).toBe("LIVE");
    expect(s.shot?.pulls).toBe(3);
    expect(at(f, 3)?.pulled).toBe(3);
    expect(at(f, 3)?.alive).toBe(false);
  });

  it("EXECUTE carries the executor; the wire forbids mismatched shapes", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("shot:assign", { loserSeat: 4, kind: "EXECUTE", executorSeat: 0 });
    expect(f.store.getState().shot).toMatchObject({ kind: "EXECUTE", executorSeat: 0 });
    expect(() => parseServerEvent("shot:assign", { seq: 1, loserSeat: 4, kind: "SELF", executorSeat: 0 })).toThrow();
    expect(() => parseServerEvent("shot:assign", { seq: 1, loserSeat: 4, kind: "EXECUTE" })).toThrow();
  });
});

describe("applyEvent — round:end / game:over resets", () => {
  it("round:end lands the banner state", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("round:end", { reason: "death", survivorCoins: 1, xpEarned: [{ seat: 0, xp: 1 }] });
    const s = f.store.getState();
    expect(s.phase).toBe("round-end");
    expect(s.roundEnd).toEqual({ reason: "death", survivorCoins: 1, xpEarned: [{ seat: 0, xp: 1 }] });
  });

  it("game:over captures the ceremony, resets on rematch round:new", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("window:open", { playSeat: 2, closesAtTs: Date.now() + 12_000 });
    f.send("turn:begin", { seat: 1, deadlineTs: Date.now() + 10_000 });
    f.send("game:over", {
      winnerSeat: 0,
      matchRecord: matchRecord(),
      rewards: [{ seat: 0, coins: 6, xp: 12, unlockedTitles: ["Last One Standing"] }],
    });
    let s = f.store.getState();
    expect(s.phase).toBe("game-over");
    expect(s.gameOver?.winnerSeat).toBe(0);
    expect(s.gameOver?.matchRecord.players).toHaveLength(5);
    expect(s.gameOver?.rewards[0]?.coins).toBe(6);
    expect(s.window).toBeNull();
    expect(s.turnSeat).toBeNull(); // stale-action guard: no turn survives the ceremony
    expect(s.deadlineTs).toBeNull();

    // rematch: the first round:new clears the game-over surfaces
    f.send("round:new", { roundNo: 1, tableCard: "K", dealtCounts: [] });
    s = f.store.getState();
    expect(s.gameOver).toBeNull();
    expect(s.phase).toBe("round-new");
  });

  it("in-round actions after game:over are locally rejected", async () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("game:over", {
      winnerSeat: 0,
      matchRecord: matchRecord(),
      rewards: [],
    });
    f.store.getState().toggleCardSelection("c0");
    const throwRes = await f.store.getState().sendThrow();
    expect(throwRes.ok).toBe(false);
    const checkRes = await f.store.getState().sendCheck(2);
    expect(checkRes.ok).toBe(false);
    expect(f.sent).toEqual([]); // nothing even reaches the wire (server stays authority anyway)
  });

  it("a rejected play frees the same-turn retry (pendingThrow never sticks)", async () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.store.getState().toggleCardSelection("c0");
    f.emitterResults.push({ ok: false, errorCode: "EVENT_STALE", errorMessage: "Too slow." });
    const first = await f.store.getState().sendThrow();
    expect(first.ok).toBe(false);
    expect(f.store.getState().pendingThrow).toBe(false); // unstuck
    expect(f.store.getState().selectedCardIds).toEqual(["c0"]); // selection survives for the retry

    const second = await f.store.getState().sendThrow();
    expect(second.ok).toBe(true);
    expect(f.sent).toHaveLength(2);
    expect(f.store.getState().pendingThrow).toBe(true); // staged until play:accept
  });
});

describe("applyEvent — presence / emotes / errors", () => {
  it("presence:update flips connection badges", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("presence:update", { seats: [{ seat: 2, connected: false, afk: true }, { seat: 3, connected: false, afk: false }] });
    expect(at(f, 2)?.connected).toBe(false);

    // a seat the payload omits keeps its PREVIOUS flag — never forced "connected"
    f.send("presence:update", { seats: [{ seat: 2, connected: true, afk: false }] });
    expect(at(f, 3)?.connected).toBe(false);
    expect(at(f, 2)?.connected).toBe(true);
  });

  it("emote:broadcast lands the bubble for the seat", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("emote:broadcast", { seat: 3, emoteId: "laugh" });
    const e = f.store.getState().emotes[3];
    expect(e?.emoteId).toBe("laugh");
    expect(typeof e?.at).toBe("number");
  });

  it("error events surface the user-safe message in the feed", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    const phaseBefore = f.store.getState().phase;
    expect(() =>
      f.send("error", { code: "EVENT_STALE", message: "Too slow — first call wins.", eventRef: "liar:call" }),
    ).not.toThrow();
    const feed = f.store.getState().feed;
    expect(feed[feed.length - 1]?.text).toContain("Too slow");
    expect(f.store.getState().phase).toBe(phaseBefore); // surfaced, never thrown
    expect(f.store.getState().needsSnapshot).toBe(false);
  });

  it("sendEmote routes through the emitter seam", async () => {
    const f = fresh();
    await f.store.getState().sendEmote("wink");
    expect(f.sent).toEqual([{ type: "emote:send", emoteId: "wink" }]);
  });

  it("emote cooldown stamps only on the server's accept (a reject never burns it)", async () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.emitterResults.push({ ok: false, errorCode: "RATE_LIMITED", errorMessage: "Emotes cool down for 3 seconds." });
    const rejected = await f.store.getState().sendEmote("wink");
    expect(rejected.ok).toBe(false);
    expect(f.store.getState().lastEmoteSentAt).toBe(0); // unchanged — retry is free

    const accepted = await f.store.getState().sendEmote("laugh");
    expect(accepted.ok).toBe(true);
    expect(f.store.getState().lastEmoteSentAt).toBeGreaterThan(0);
  });

  it("rapid emote taps collapse into one emote:send while the first is in flight", async () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    const [a, b] = await Promise.all([f.store.getState().sendEmote("laugh"), f.store.getState().sendEmote("cheer")]);
    expect(a.ok && b.ok).toBe(true);
    expect(f.sent).toHaveLength(1); // deduped — the second tap reuses the same emit
  });

  it("reveal:show retires the pending turn (no countdown lingers through the cinematic)", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("turn:begin", { seat: 0, deadlineTs: Date.now() + 20_000 }); // own-turn direct call path
    f.send("reveal:show", { cards: [{ id: "r1", rank: "Q" }], verdict: "TRUTH", loserSeat: 0 });
    const s = f.store.getState();
    expect(s.phase).toBe("reveal");
    expect(s.turnSeat).toBeNull();
    expect(s.deadlineTs).toBeNull();
  });
});

describe("seq — monotonic room counter (STR/07 §4)", () => {
  it("flags a gap for snapshot recovery, and the snapshot clears it", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState()); // snapshot: lastSeq 0
    f.send("play:accept", { seat: 1, count: 1, totalPile: 1 }); // seq 1
    f.send("play:accept", { seat: 2, count: 2, totalPile: 3 }); // seq 2
    const skipped = ev("play:accept", 5, { seat: 4, count: 1, totalPile: 4 }); // gap 3–4
    f.store.getState().applyEvent(skipped);
    expect(f.store.getState().needsSnapshot).toBe(true);

    const snapshot = lobbyState();
    (snapshot.payload as { seq: number }).seq = 6;
    f.store.getState().applyEvent(snapshot);
    const s = f.store.getState();
    expect(s.needsSnapshot).toBe(false); // authoritative snapshot resolves the gap
    expect(s.lastSeq).toBe(6);
  });

  it("in-order events never flag", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("play:accept", { seat: 1, count: 1, totalPile: 1 });
    f.send("play:accept", { seat: 2, count: 1, totalPile: 2 });
    expect(f.store.getState().needsSnapshot).toBe(false);
  });

  it("drops a replayed/duplicate delta without rewinding lastSeq (no rejoin storm)", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState()); // lastSeq 0
    f.send("play:accept", { seat: 1, count: 1, totalPile: 1 }); // seq 1
    f.send("play:accept", { seat: 2, count: 2, totalPile: 3 }); // seq 2

    // socket.io recovery replays seq 2 AFTER we already applied it
    const replay = ev("play:accept", 2, { seat: 2, count: 2, totalPile: 3 });
    f.store.getState().applyEvent(replay);
    const s = f.store.getState();
    expect(s.lastSeq).toBe(2); // never rewound
    expect(s.needsSnapshot).toBe(false);

    // the next in-order event must NOT look like a gap (the old rewind made
    // every later event a "gap" → thundering rejoin)
    f.send("play:accept", { seat: 3, count: 1, totalPile: 4 }); // seq 3
    expect(f.store.getState().needsSnapshot).toBe(false);
    expect(f.store.getState().pile.at(-1)?.seat).toBe(3);
  });

  it("drops a stale same-room snapshot (double-join race / recovery echo)", () => {
    const f = fresh();
    const snapNew = lobbyState();
    (snapNew.payload as unknown as { seq: number }).seq = 6;
    f.store.getState().applyEvent(snapNew);
    expect(f.store.getState().roundNo).toBe(2);

    // an older echo for the SAME room arrives last — it must not rewind the world
    const snapStale = lobbyState();
    (snapStale.payload as unknown as { seq: number }).seq = 3;
    (snapStale.payload as unknown as { roundNo: number }).roundNo = 1;
    f.store.getState().applyEvent(snapStale);
    const s = f.store.getState();
    expect(s.lastSeq).toBe(6);
    expect(s.roundNo).toBe(2);
  });

  it("applies a DIFFERENT room's snapshot even with a lower seq (room switch)", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.send("play:accept", { seat: 1, count: 1, totalPile: 1 });
    f.send("play:accept", { seat: 2, count: 2, totalPile: 3 }); // lastSeq 2

    const roomB = lobbyState();
    Object.assign(roomB.payload, { seq: 1, roomCode: "TESTB", theme: "house-table" });
    f.store.getState().applyEvent(roomB);
    const s = f.store.getState();
    expect(s.lobby?.code).toBe("TESTB");
    expect(s.lobby?.theme).toBe("house"); // wire slug → UI catalog id
    expect(s.lastSeq).toBe(1);
    expect(s.needsSnapshot).toBe(false);
  });

  it("reconnect: same-code rejoin → catch-up snapshot restores the mid-match scene", () => {
    const f = fresh();
    const lobby = lobbyState();
    Object.assign(lobby.payload, { seq: 0, theme: "house-table" });
    f.store.getState().applyEvent(lobby);
    f.send("play:accept", { seat: 1, count: 1, totalPile: 1 }); // seq 1
    f.send("round:new", { roundNo: 3, tableCard: "A", dealtCounts: [{ seat: 1, count: 4 }] }); // seq 2

    // scissors-cut: events 3–4 lost; event 5 lands → gap flagged, best-effort applied
    const late = ev("hand:deal", 5, { cards: [{ id: "x1", rank: "A" }, { id: "x2", rank: "K" }] });
    f.store.getState().applyEvent(late);
    expect(f.store.getState().needsSnapshot).toBe(true);
    expect(f.store.getState().hand.map((c) => c.id)).toEqual(["x1", "x2"]);

    // the bridge's rejoin answers with an authoritative mid-match snapshot:
    // seat restored, hand restored, seq resynced, flag cleared
    const catchUp = lobbyState();
    Object.assign(catchUp.payload, { seq: 5, theme: "house-table" });
    f.store.getState().applyEvent(catchUp);
    const s = f.store.getState();
    expect(s.needsSnapshot).toBe(false);
    expect(s.lastSeq).toBe(5);
    expect(s.phase).toBe("turn");
    expect(s.hand.map((c) => c.id)).toEqual(["c0", "c1", "c2", "c3"]);
    expect(s.lobby?.theme).toBe("house");
  });

  it("an unknown (future) server event is safely ignored, seq still advances", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    const before = f.store.getState();
    const future = { event: "future:event", payload: { seq: 1 } } as unknown as ServerEvent;
    expect(() => f.store.getState().applyEvent(future)).not.toThrow();
    const after = f.store.getState();
    expect(after.lastSeq).toBe(1);
    expect(after.phase).toBe(before.phase); // nothing else touched
    expect(after.needsSnapshot).toBe(false);
  });
});

describe("hidden-data tripwires (STR/07 §3 / STR/08 §1)", () => {
  it("keeps hand ranks within the shared enum and the store behind the contract", () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    expect(f.store.getState().hand.every((c) => ["K", "Q", "A", "J"].includes(c.rank))).toBe(true);
  });

  it("flattens shared ack envelopes for legacy callers", async () => {
    const f = fresh();
    f.store.getState().applyEvent(lobbyState());
    f.store.getState().toggleCardSelection("c0");
    f.emitterResults.push({ ok: false, errorCode: "NOT_YOUR_TURN", errorMessage: "Wait for your turn." });
    const res = await f.store.getState().sendThrow();
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("NOT_YOUR_TURN");
  });
});
