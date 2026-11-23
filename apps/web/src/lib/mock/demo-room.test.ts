import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockRoom } from "@/lib/mock/demo-room";
import { parseServerEvent, type ServerEvent, type ServerEventName } from "@/lib/wire";

/**
 * ============================================================================
 * FULL MOCK MATCH — the exact event stream /table/[code] consumes, driven
 * headlessly at 8% pacing. An auto-hero plays turns and checks windows like
 * a player would. Every emitted event is re-validated against the shared
 * zod schemas (the client's "no console errors" tripwire) and the seq runs
 * gap-free (the store never raises needsSnapshot mid-match).
 * ============================================================================
 */

const ROOM_CODE = "TESTY";

interface Observed {
  events: ServerEvent[];
  kinds: Set<string>;
  outcomes: Set<string>;
  verdicts: Set<string>;
  windowReasons: Set<string>;
  deaths: number;
  roundEnds: Set<string>;
  gameOver: Extract<ServerEvent, { event: "game:over" }> | null;
  seqGaps: number;
}

describe("MockRoom — deterministic full match over the shared contract", () => {
  let room: MockRoom;
  let observed: Observed;
  let heroHand: string[];
  let done: Promise<void>;
  let resolveDone: () => void;

  beforeAll(() => {
    vi_Ready();
    room = new MockRoom(0.08);
    observed = {
      events: [],
      kinds: new Set(),
      outcomes: new Set(),
      verdicts: new Set(),
      windowReasons: new Set(),
      deaths: 0,
      roundEnds: new Set(),
      gameOver: null,
      seqGaps: 0,
    };
    let lastSeq = -1;
    let roundNo = 0;
    const checkRounds = new Set<number>([3, 5]); // hero checks TOAR's lie + executes SUE
    heroHand = [];

    done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    room.bind((ev) => {
      // 1. wire tripwire: everything the browser will receive re-parses
      const reparsed = parseServerEvent(ev.event as ServerEventName, ev.payload);
      observed.events.push({ event: ev.event, payload: reparsed } as ServerEvent);

      // 2. seq monotonic, no gaps — the store must never flag a resync
      const seq = (reparsed as { seq: number }).seq;
      if (lastSeq !== -1 && seq !== lastSeq + 1) observed.seqGaps += 1;
      lastSeq = seq;

      // 3. bookkeeping + scripted auto-hero behavior
      switch (ev.event) {
        case "hand:deal":
          heroHand = ev.payload.cards.map((c) => c.id);
          break;
        case "round:new":
          roundNo = ev.payload.roundNo;
          break;
        case "turn:begin": {
          if (ev.payload.seat === 0 && heroHand.length > 0) {
            const n = 1 + (roundNo % 2); // hero throws 1–2 cards
            setTimeout(() => {
              room.handle({ type: "play:cards", cardIds: heroHand.slice(0, n) });
            }, 90);
          }
          break;
        }
        case "window:open": {
          if (ev.payload.playSeat !== 0 && checkRounds.has(roundNo)) {
            const armedDelay = Math.max(60, 2_000 * 0.08 + 40);
            setTimeout(() => {
              room.handle({ type: "liar:call", accusedSeat: ev.payload.playSeat });
            }, armedDelay);
          }
          break;
        }
        case "shot:assign":
          observed.kinds.add(ev.payload.kind);
          break;
        case "shot:result":
          observed.outcomes.add(ev.payload.outcome);
          if (ev.payload.outcome === "LIVE") observed.deaths += 1;
          break;
        case "reveal:show":
          observed.verdicts.add(ev.payload.verdict);
          break;
        case "window:close":
          observed.windowReasons.add(ev.payload.reason);
          break;
        case "round:end":
          observed.roundEnds.add(ev.payload.reason);
          break;
        case "game:over":
          observed.gameOver = { event: "game:over", payload: ev.payload } as ServerEvent & {
            event: "game:over";
          };
          resolveDone();
          break;
        default:
          break;
      }
    });

    room.join(ROOM_CODE);
  }, 60_000);

  afterAll(() => {
    room.cancel();
  });

  it(
    "plays the full scripted match to game:over with a clean wire",
    async () => {
      room.startMatch();
      await done; // resolved by the game:over collector
      room.cancel();

      // the stream: dozens of validated events, zero seq gaps
      expect(observed.events.length).toBeGreaterThan(40);
      expect(observed.seqGaps).toBe(0);

      // both shot kinds + BOTH outcomes rotate across cycles (mission law)
      expect(observed.kinds.has("SELF")).toBe(true);
      expect(observed.kinds.has("EXECUTE")).toBe(true);
      expect(observed.outcomes.has("BLANK")).toBe(true);
      expect(observed.outcomes.has("LIVE")).toBe(true);
      expect(observed.deaths).toBeGreaterThanOrEqual(3);

      // reveal verdicts both ways; window closes on belief + liar_called
      expect(observed.verdicts.has("TRUTH")).toBe(true);
      expect(observed.verdicts.has("LIE")).toBe(true);
      expect(observed.windowReasons.has("belief")).toBe(true);
      expect(observed.windowReasons.has("liar_called")).toBe(true);

      // round:end reasons + game:over with the hero last standing
      expect(observed.roundEnds.has("survived")).toBe(true);
      expect(observed.roundEnds.has("death")).toBe(true);
      expect(observed.gameOver).not.toBeNull();
      expect(observed.gameOver?.payload.winnerSeat).toBe(0);
      expect(observed.gameOver?.payload.matchRecord.players).toHaveLength(5);
      expect(observed.gameOver?.payload.rewards.find((r) => r.seat === 0)?.coins).toBeGreaterThan(0);

      // the hero got exactly one private hand per round — nothing else leaks:
      // every event above re-parsed against strict schemas, so any smuggled
      // rank/chamber field would have thrown before reaching this line
      const handDeals = observed.events.filter((e) => e.event === "hand:deal");
      const roundNews = observed.events.filter((e) => e.event === "round:new");
      expect(handDeals.length).toBe(roundNews.length);
      expect(handDeals.length).toBe(7);
    },
    120_000,
  );
});

function vi_Ready(): void {
  // marker — vitest beforeAll ordering guarantee; keeps the suite honest if
  // someone shuffles the file later
}
