"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { useGameStore } from "@/store/game";
import { useSettingsStore } from "@/store/settings";
import { socket } from "@/lib/socket";
import { parseServerEvent, type ServerEvent, type ServerEventName } from "@/lib/wire";
import { TableView } from "@/components/table/TableView";

/**
 * MOTION LAB — dev-only cinematic bench (app/motion-lab). Every button drives
 * the PRODUCTION store through canned events validated against the shared
 * zod schemas (parseServerEvent rejects drift loudly as the contract
 * evolves), rendered by the real <TableView>. The full mock round also runs
 * end-to-end through the real adapter.
 */
const LAB_CODE = "STAGE";

/** Build a schema-validated shared event with the next seq. */
function labEvent(name: ServerEventName, seq: number, payload: Record<string, unknown>): ServerEvent {
  const parsed = parseServerEvent(name, { ...payload, seq });
  return { event: name, payload: parsed } as ServerEvent;
}

function labLobby(overrides: { heroAlive?: boolean } = {}): ServerEvent {
  const alive = overrides.heroAlive ?? true;
  const seats = [0, 1, 2, 3, 4].map((seat) => ({
    seat,
    nickname: ["YOU", "SCUBB", "SUE", "TOAR", "FOX"][seat] ?? `P${seat}`,
    avatarSpec: { base: ["fox", "raccoon", "owl", "wolf", "deer"][seat] ?? "fox" },
    connected: true,
    afk: false,
    isHost: seat === 0,
    handCount: seat === 3 ? 0 : seat === 0 ? 4 : 2,
    pulls: seat === 3 ? 6 : seat === 0 ? (alive ? 2 : 4) : seat === 2 ? 3 : 0,
    alive: seat !== 3,
    activeTitle: null,
  }));
  return labEvent("lobby:state", 0, {
    roomCode: LAB_CODE,
    name: "MOTION LAB",
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
      hand: [
        { id: "c1", rank: "K" },
        { id: "c2", rank: "Q" },
        { id: "c3", rank: "J" },
        { id: "c4", rank: "A" },
      ],
      handCount: 4,
      pulls: alive ? 2 : 4,
      alive,
      activeTitle: null,
    },
    spectator: false,
    roundNo: 3,
    tableCard: "K",
    currentTurnSeat: 2,
    deadlineTs: Date.now() + 15_000,
    pileTotal: 6,
    estMatchMinutes: 8,
  });
}

function labMatchRecord(matchId: string) {
  const statsBase = { kills: 0, catches: 0, falseAccusations: 0, bluffSuccesses: 0, deaths: 1, pullsSurvived: 1, roundsPlayed: 7, won: false, xpEarned: 4, coinsEarned: 0 };
  return {
    matchId,
    roomCode: LAB_CODE,
    startedAt: Date.now() - 600_000,
    endedAt: Date.now(),
    capacity: 5,
    theme: "saloon",
    players: [
      { accountId: "lab-0", seat: 0, nickname: "YOU", avatarSpec: { base: "fox" }, titleAtPlay: null, stats: { ...statsBase, kills: 2, catches: 3, falseAccusations: 1, bluffSuccesses: 4, deaths: 0, pullsSurvived: 2, won: true, xpEarned: 12, coinsEarned: 11 } },
      { accountId: "lab-1", seat: 1, nickname: "SCUBB", avatarSpec: { base: "raccoon" }, titleAtPlay: null, stats: { ...statsBase, deathCause: "selfRoulette", catches: 1, falseAccusations: 2, bluffSuccesses: 1 } },
      { accountId: "lab-2", seat: 2, nickname: "SUE", avatarSpec: { base: "owl" }, titleAtPlay: null, stats: { ...statsBase, deathCause: "executed", catches: 2, bluffSuccesses: 2, pullsSurvived: 0 } },
      { accountId: "lab-3", seat: 3, nickname: "TOAR", avatarSpec: { base: "wolf" }, titleAtPlay: null, stats: { ...statsBase, deathCause: "selfRoulette", falseAccusations: 1, pullsSurvived: 0 } },
      { accountId: "lab-4", seat: 4, nickname: "FOX", avatarSpec: { base: "fox" }, titleAtPlay: null, stats: { ...statsBase, deathCause: "executed", kills: 1, falseAccusations: 1, bluffSuccesses: 3 } },
    ],
    summary: { rounds: 7, totalPulls: 9, dareDevilMoments: 1 },
  };
}

export function MotionLab() {
  const seqRef = useRef(0);
  const reset = useGameStore((s) => s.reset);
  const reduced = useSettingsStore((s) => s.reducedMotion);
  const setReduced = useSettingsStore((s) => s.setReducedMotion);

  const apply = (...events: ServerEvent[]) => {
    for (const ev of events) useGameStore.getState().applyEvent(ev);
    seqRef.current = useGameStore.getState().lastSeq;
  };

  const bump = (): number => (seqRef.current === -1 || seqRef.current === 0 ? 1 : seqRef.current + 1);

  const shotPair = (kind: "SELF" | "EXECUTE", outcome: "BLANK" | "LIVE", loserSeat: number, executorSeat?: number): ServerEvent[] => {
    const s1 = bump();
    return [
      labEvent("shot:assign", s1, { loserSeat, kind, ...(executorSeat !== undefined ? { executorSeat } : {}) }),
      labEvent("shot:result", s1 + 1, { loserSeat, pulls: outcome === "LIVE" ? 6 : 3, outcome }),
    ];
  };

  const runFullMockRound = async () => {
    const s = useGameStore.getState();
    if (!s.lobby || s.lobby.code !== LAB_CODE) {
      reset();
      await socket.emit({ type: "room:join", code: LAB_CODE });
    }
    await socket.emit({ type: "game:start" });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <motion.div
        className="z-[80] flex flex-wrap items-center gap-1 border-b-2 border-brass-deep bg-wood-deep px-2 py-1.5 pt-safe"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <span className="mr-2 font-display text-xs tracking-widest text-brass">MOTION LAB</span>

        <button type="button" onClick={() => { reset(); seqRef.current = 0; apply(labLobby()); }} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass">
          1 · base table
        </button>
        <button
          type="button"
          onClick={() => {
            const s1 = bump();
            apply(
              labEvent("round:new", s1, { roundNo: 4, tableCard: "A", dealtCounts: [1, 2, 4].map((seat) => ({ seat, count: 5 })) }),
              labEvent("hand:deal", s1 + 1, { cards: [{ id: "d1", rank: "A" }, { id: "d2", rank: "A" }, { id: "d3", rank: "K" }, { id: "d4", rank: "J" }, { id: "d5", rank: "Q" }] }),
              labEvent("turn:begin", s1 + 2, { seat: 0, deadlineTs: Date.now() + 20_000 }),
            );
          }}
          className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass"
        >
          2 · deal + your turn
        </button>
        <button
          type="button"
          onClick={() => {
            const s1 = bump();
            apply(
              labEvent("play:accept", s1, { seat: 2, count: 2, totalPile: 8 }),
              labEvent("window:open", s1 + 1, { playSeat: 2, closesAtTs: Date.now() + 2_000 + 10_000 }),
            );
          }}
          className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass"
        >
          3 · window arm → armed
        </button>
        <button type="button" onClick={() => apply(labEvent("reveal:show", bump(), { cards: [{ id: "r1", rank: "K" }, { id: "r2", rank: "J" }], verdict: "TRUTH", loserSeat: 0 }))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass">
          4 · reveal TRUTH
        </button>
        <button type="button" onClick={() => apply(labEvent("reveal:show", bump(), { cards: [{ id: "r1", rank: "Q" }, { id: "r2", rank: "K" }], verdict: "LIE", loserSeat: 2 }))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass">
          5 · reveal LIE
        </button>
        <button type="button" onClick={() => apply(...shotPair("SELF", "BLANK", 2))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass">
          6 · SELF · BLANK (head-fake)
        </button>
        <button type="button" onClick={() => apply(...shotPair("SELF", "LIVE", 2))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-blood-bright hover:border-brass">
          7 · SELF · LIVE (death)
        </button>
        <button type="button" onClick={() => apply(...shotPair("EXECUTE", "BLANK", 4, 0))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass">
          8 · EXECUTE · BLANK
        </button>
        <button type="button" onClick={() => apply(...shotPair("EXECUTE", "LIVE", 4, 0))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-blood-bright hover:border-brass">
          9 · EXECUTE · LIVE (you execute)
        </button>
        <button type="button" onClick={() => apply(labEvent("round:end", bump(), { reason: "survived", survivorCoins: 1, xpEarned: [{ seat: 0, xp: 1 }] }))} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ivory hover:border-brass">
          10 · round end
        </button>
        <button type="button" onClick={() => apply(labEvent("game:over", bump(), { winnerSeat: 0, matchRecord: labMatchRecord("lab-match"), rewards: [{ seat: 0, coins: 11, xp: 12, unlockedTitles: ["Last One Standing"] }, { seat: 1, coins: 0, xp: 4, unlockedTitles: [] }, { seat: 2, coins: 0, xp: 4, unlockedTitles: [] }, { seat: 3, coins: 0, xp: 4, unlockedTitles: [] }, { seat: 4, coins: 0, xp: 4, unlockedTitles: [] }] }))} className="rounded-btn border border-brass bg-brass/15 px-2 py-1 font-body text-[10px] text-brass hover:bg-brass/30">
          11 · game over (you win)
        </button>
        <button type="button" onClick={() => { reset(); seqRef.current = 0; apply(labLobby({ heroAlive: false })); }} className="rounded-btn border border-wood-mid bg-wood px-2 py-1 font-body text-[10px] text-ink-dim hover:border-brass">
          12 · ghost lounge
        </button>
        <button type="button" onClick={() => void runFullMockRound()} className="rounded-btn border border-brass bg-brass/15 px-2 py-1 font-body text-[10px] text-brass hover:bg-brass/30">
          ▶ FULL MOCK ROUND (adapter)
        </button>
        <button
          type="button"
          onClick={() => setReduced(!reduced)}
          className={`rounded-btn border px-2 py-1 font-body text-[10px] ${
            reduced ? "border-lamp bg-lamp/20 text-lamp" : "border-wood-mid bg-wood text-ink-dim"
          }`}
          aria-pressed={reduced}
        >
          reduced-motion {reduced ? "ON" : "OFF"}
        </button>
        <button type="button" onClick={() => { reset(); seqRef.current = 0; }} className="rounded-btn border border-blood-bright px-2 py-1 font-body text-[10px] text-blood-bright">
          reset
        </button>
      </motion.div>

      <div className="min-h-0 flex-1">
        <TableView
          code={LAB_CODE}
          roomId={LAB_CODE}
          onLeave={() => {
            reset();
            seqRef.current = 0;
          }}
        />
      </div>
    </div>
  );
}
