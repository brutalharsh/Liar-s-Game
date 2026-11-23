"use client";

/**
 * ============================================================================
 * SOCKET ADAPTER — DEV-ONLY MOCK (TODO-sync-with-shared / W2)
 * ============================================================================
 * Singleton matching the Socket.IO client surface the real server (S1) will
 * accept, per STR/07. Wave 2 replaces `MockSocketAdapter` with a
 * socket.io-client backed adapter — `apps/web` UI only talks to this
 * interface + the game store, so no screen changes.
 *
 * What the mock does (names/rooms ONLY, never game rules):
 *   · room:create / room:join / room:leave with code "DEMO1" lobby snapshots
 *   · staggered bot joins into the lobby (SUE → TOAR → FOX → BRIS)
 *   · `game:start` runs a scripted tabletop demo round loop (see runDemoTable)
 *   · accepts play:cards / liar:call / emote:send and emits the matching
 *     STR/07 §2 server events.
 *
 * NO hidden data ever crosses this module (STR/07 §3 / STR/08 §1): hands go
 * only to seat 0, the pile is counts-only, and bulletPos is not modeled at all.
 * ============================================================================
 */

import type {
  ClientEvent,
  EmitResult,
  Handshake,
  LobbySnapshot,
  CardRank,
  ServerEvent,
  TableCardRank,
} from "@/lib/wire";
import { makeDemoLobby } from "@/lib/mock/rooms";
import { LOBBY_JOIN_PLAN } from "@/lib/mock/players";
import { EMOTE_COOLDOWN_MS } from "@/lib/mock/emotes";
import { sanitizeRoomCode, isValidRoomCode } from "@/lib/sanitize";
import { seededRng } from "@/lib/mock/rng";

export interface SocketAdapter {
  connect(handshake: Handshake): Promise<void>;
  on(handler: (ev: ServerEvent) => void): () => void;
  emit(ev: ClientEvent): Promise<EmitResult>;
  disconnect(): void;
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

type HeroAction =
  | { kind: "throw"; count: number }
  | { kind: "check"; accusedSeat: number };

interface DemoSession {
  cancelled: boolean;
  awaitingHero: boolean;
  pendingHeroAction: HeroAction | null;
  lastPlaySeat: number | null;
}

class MockSocketAdapter implements SocketAdapter {
  private handler: ((ev: ServerEvent) => void) | null = null;
  private lobby: LobbySnapshot | null = null;
  private demo: DemoSession | null = null;
  private lastEmoteAt = 0;
  private joinedCode = "";
  private connectPromise: Promise<void> | null = null;
  private handshake: Handshake | null = null;

  private send(ev: ServerEvent) {
    this.handler?.(ev);
  }

  async connect(handshake: Handshake): Promise<void> {
    if (!this.connectPromise) {
      this.handshake = handshake;
      this.connectPromise = sleep(280).then(() => {
        this.send({ type: "presence:update", seats: [] }); // establishes "connected" without state
      });
    }
    return this.connectPromise;
  }

  on(handler: (ev: ServerEvent) => void): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = null;
    };
  }

  disconnect(): void {
    this.cancelDemo();
    this.lobby = null;
    this.joinedCode = "";
    this.handler = null;
  }

  // ── lobby plumbing ──────────────────────────────────────────────────

  private seatLobby(code: string, opts: { name?: string; capacity?: number; theme?: LobbySnapshot["theme"]; visibility?: LobbySnapshot["visibility"] }): void {
    this.cancelDemo();
    this.lobby = makeDemoLobby({
      code,
      nickname: this.handshake?.nickname ?? "YOU",
      capacity: opts.capacity,
      theme: opts.theme,
      visibility: opts.visibility,
      name: opts.name,
    });
    this.joinedCode = code;
    this.emitLobby();

    // staggered bot joins so the lobby visibly fills (DEV preview of joins)
    for (const { player, atMs } of LOBBY_JOIN_PLAN) {
      void sleep(atMs).then(() => {
        if (this.lobby?.code !== code) return;
        const idx = this.lobby.seats.findIndex((s) => s.nickname === null && !s.locked);
        if (idx === -1) return;
        this.lobby = {
          ...this.lobby,
          seats: this.lobby.seats.map((s, i) =>
            i === idx
              ? { ...s, nickname: player.nickname, avatar: player.avatar, connected: true, isBot: true, locked: false }
              : s,
          ),
        };
        this.emitLobby();
      });
    }
  }

  private emitLobby() {
    if (!this.lobby) return;
    this.send({ type: "lobby:state", lobby: this.lobby });
  }

  // ── client event routing ────────────────────────────────────────────

  async emit(ev: ClientEvent): Promise<EmitResult> {
    switch (ev.type) {
      case "room:create": {
        this.seatLobby("DEMO1", {
          name: ev.name,
          capacity: ev.capacity,
          theme: ev.theme,
          visibility: ev.visibility,
        });
        return { ok: true, code: "DEMO1" };
      }
      case "room:join": {
        const code = sanitizeRoomCode(ev.code);
        if (!isValidRoomCode(code)) {
          return { ok: false, errorCode: "ROOM_CODE_INVALID", errorMessage: "That room code doesn't look right." };
        }
        if (this.joinedCode !== code || !this.lobby) {
          this.seatLobby(code, {});
        }
        return { ok: true, code };
      }
      case "room:leave": {
        this.cancelDemo();
        this.lobby = null;
        this.joinedCode = "";
        return { ok: true };
      }
      case "game:start": {
        if (!this.lobby) {
          return { ok: false, errorCode: "NO_ROOM", errorMessage: "Join a room first." };
        }
        this.cancelDemo();
        void this.runDemoTable(this.lobby);
        return { ok: true };
      }
      case "play:cards": {
        const demo = this.demo;
        if (!demo || !demo.awaitingHero) {
          return { ok: false, errorCode: "NOT_YOUR_TURN", errorMessage: "Wait for your turn." };
        }
        if (ev.cardIds.length < 1 || ev.cardIds.length > 3) {
          return { ok: false, errorCode: "PLAY_COUNT", errorMessage: "You can throw 1–3 cards." };
        }
        demo.pendingHeroAction = { kind: "throw", count: ev.cardIds.length };
        demo.awaitingHero = false;
        return { ok: true };
      }
      case "liar:call": {
        const demo = this.demo;
        if (!demo || !demo.awaitingHero) {
          return { ok: false, errorCode: "EVENT_STALE", errorMessage: "You can't challenge that right now." };
        }
        if (demo.lastPlaySeat === null || ev.accusedSeat !== demo.lastPlaySeat) {
          return { ok: false, errorCode: "CHALLENGE_TARGET", errorMessage: "You can only challenge the previous throw." };
        }
        demo.pendingHeroAction = { kind: "check", accusedSeat: ev.accusedSeat };
        demo.awaitingHero = false;
        return { ok: true };
      }
      case "emote:send": {
        if (Date.now() < this.lastEmoteAt + EMOTE_COOLDOWN_MS) {
          return { ok: false, errorCode: "EMOTE_COOLDOWN", errorMessage: "Emotes cool down for 3 seconds." };
        }
        this.lastEmoteAt = Date.now();
        this.send({ type: "emote:broadcast", seat: 0, emoteId: ev.emoteId });
        return { ok: true };
      }
      default: {
        // Exhaustiveness guard for ClientEvent
        const never: never = ev;
        void never;
        return { ok: false, errorCode: "UNSUPPORTED", errorMessage: "Unsupported event." };
      }
    }
  }

  // ── DEV demo table loop ─────────────────────────────────────────────

  private cancelDemo() {
    if (this.demo) this.demo.cancelled = true;
    this.demo = null;
  }

  /**
   * Scripted tabletop demo (round loop). Deterministic per room + round slot:
   *   round 1: prev tells TRUTH, hero's check fails → hero pulls (BLANK)
   *   round 2: prev LIES → hero's check catches them → EXECUTE, LIVE (death)
   *   round 3: prev LIES, coin flip → SELF, BLANK (survives the click)
   * then cycles K/Q/A. Bots never challenge the hero so the visitor can
   * experiment freely. Every beat maps 1:1 to an STR/07 §2 event.
   */
  private async runDemoTable(lobby: LobbySnapshot): Promise<void> {
    const demo: DemoSession = { cancelled: false, awaitingHero: false, pendingHeroAction: null, lastPlaySeat: null };
    this.demo = demo;
    const rng = seededRng(`demo-${lobby.code}`);

    const alive: number[] = lobby.seats.filter((s) => s.nickname !== null && s.alive).map((s) => s.seat);
    if (!alive.includes(0)) alive.unshift(0);
    alive.sort((a, b) => a - b);

    const pulled = new Map<number, number>(alive.map((s) => [s, 0]));
    const roomRng = rng;
    const nameOf = (seatNo: number): string => lobby.seats.find((s) => s.seat === seatNo)?.nickname ?? "PLAYER";

    const ok = () => !demo.cancelled && this.demo === demo;

    const step = async (ms: number) => {
      const until = Date.now() + ms;
      while (ok() && Date.now() < until) await sleep(120);
    };

    const rankPool: CardRank[] = [
      "K", "K", "K", "K", "K", "K",
      "Q", "Q", "Q", "Q", "Q", "Q",
      "A", "A", "A", "A", "A", "A",
      "JOKER", "JOKER",
    ];
    const dealHero = (roundNo: number) => {
      const cards = [0, 1, 2, 3, 4].map((i) => {
        const idx = Math.floor(roomRng() * rankPool.length);
        return { id: `c${roundNo}-${i}`, rank: rankPool[idx] ?? ("K" as CardRank) };
      });
      this.send({ type: "hand:deal", cards });
    };

    const botEmote = (seatNo: number) => {
      if (roomRng() < 0.12) {
        const ids = ["trust-me", "laugh", "snake", "oops", "clap"];
        this.send({ type: "emote:broadcast", seat: seatNo, emoteId: ids[Math.floor(roomRng() * ids.length)] ?? "trust-me" });
      }
    };

    type Script = {
      table: TableCardRank;
      verdict: "TRUTH" | "LIE";
      shotKind: "SELF" | "EXECUTE";
      outcome: "BLANK" | "LIVE";
    };
    const scripts: Script[] = [
      { table: "K", verdict: "TRUTH", shotKind: "SELF", outcome: "BLANK" },
      { table: "Q", verdict: "LIE", shotKind: "EXECUTE", outcome: "LIVE" },
      { table: "A", verdict: "LIE", shotKind: "SELF", outcome: "BLANK" },
    ];

    let roundNo = 0;
    while (ok()) {
      const script = scripts[roundNo % scripts.length] as Script;
      const prevSeat = alive.filter((s) => s !== 0)[(alive.filter((s) => s !== 0).length - 1)] ?? 0; // seat before hero in ring order (hero first)
      const others = alive.filter((s) => s !== 0);
      const startSeat = roundNo === 0 ? 0 : (prevSeat ?? 0);

      demo.lastPlaySeat = null;
      this.send({ type: "round:new", roundNo: roundNo + 1, tableCard: script.table, dealtCounts: alive.map(() => 5) });
      await step(650);
      if (!ok()) return;
      dealHero(roundNo + 1);
      await step(750);

      // play chain — resolves at first hero check, or a scripted forced-call
      const aliveSet = new Set(alive);
      const ring = alive.length > 1 ? alive : [0];
      let idx = ring.indexOf(startSeat) === -1 ? 0 : ring.indexOf(startSeat);
      let resolved = false;
      let guard = 0;

      while (ok() && !resolved && guard < 24) {
        guard++;
        const seatNo = ring[idx] ?? 0;
        const isWindowOpen = demo.lastPlaySeat !== null && seatNo !== demo.lastPlaySeat;

        if (seatNo === 0) {
          const deadline = isWindowOpen ? 10_000 : 30_000;
          demo.awaitingHero = true;
          demo.pendingHeroAction = null;
          this.send({ type: "turn:begin", seat: 0, deadlineTs: Date.now() + deadline });
          if (isWindowOpen) {
            this.send({ type: "window:open", playSeat: demo.lastPlaySeat ?? 0, closesAtTs: Date.now() + 10_000 });
          }
          const until = Date.now() + deadline;
          const action: HeroAction | "timeout" = await new Promise<HeroAction | "timeout">((resolve) => {
            const started = Date.now();
            const poll = () => {
              const pending = (this.demo === demo ? demo.pendingHeroAction : null) as HeroAction | null;
              if (pending) {
                demo.pendingHeroAction = null;
                resolve(pending);
                return;
              }
              if (!ok() || Date.now() - started >= deadline) {
                resolve("timeout");
                return;
              }
              setTimeout(poll, 120);
            };
            poll();
          });
          demo.awaitingHero = false;
          if (!ok()) return;

          if (action !== "timeout" && action.kind === "check") {
            const accused = demo.lastPlaySeat;
            if (accused !== null) {
              if (isWindowOpen) this.send({ type: "window:close", reason: "checked" });
              await this.resolveChallenge(demo, lobby, accused, 0, script, pulled, aliveSet, nameOf);
              resolved = true;
              break;
            }
          }
          const count = action === "timeout" ? 1 : action.kind === "throw" ? action.count : 1;
          if (isWindowOpen) this.send({ type: "window:close", reason: "believed" });
          this.send({ type: "play:accept", seat: 0, count, totalPile: count });
          demo.lastPlaySeat = 0;
          await step(500);
        } else {
          // bot turn: thinks ~2 s, throws 1–3 cards; sometimes emotes
          this.send({ type: "turn:begin", seat: seatNo, deadlineTs: Date.now() + 20_000 });
          if (isWindowOpen) {
            this.send({ type: "window:open", playSeat: demo.lastPlaySeat ?? seatNo, closesAtTs: Date.now() + 10_000 });
          }
          await step(2000);
          if (!ok()) return;
          const count = 1 + Math.floor(roomRng() * 3);
          if (isWindowOpen) this.send({ type: "window:close", reason: "believed" });
          this.send({ type: "play:accept", seat: seatNo, count, totalPile: count });
          demo.lastPlaySeat = seatNo;
          botEmote(seatNo);
          await step(400);
        }

        // forced call when only one holder remains — keep the demo bounded
        if (guard >= 12 && demo.lastPlaySeat !== null) {
          const accused = demo.lastPlaySeat;
          this.send({ type: "window:open", playSeat: accused, closesAtTs: Date.now() + 2000 });
          await step(1600);
          if (!ok()) return;
          const challenger = ring.find((s) => s !== accused) ?? 0;
          await this.resolveChallenge(demo, lobby, accused, challenger, script, pulled, aliveSet, nameOf);
          resolved = true;
        }
        idx = (idx + 1) % ring.length;
      }

      if (!ok()) return;
      // clean up any live window afterwards
      this.send({ type: "window:close", reason: "round over" });
      // keep alive list in sync (deaths shrink the ring next round)
      alive.length = 0;
      alive.push(...[...aliveSet]);
      roundNo++;
      await step(2600);
    }
  }

  private async resolveChallenge(
    demo: DemoSession,
    lobby: LobbySnapshot,
    accusedSeat: number,
    accuserSeat: number,
    script: { table: TableCardRank; verdict: "TRUTH" | "LIE"; shotKind: "SELF" | "EXECUTE"; outcome: "BLANK" | "LIVE" },
    pulled: Map<number, number>,
    aliveSet: Set<number>,
    nameOf: (seat: number) => string,
  ): Promise<void> {
    const ok = () => !demo.cancelled && this.demo === demo;
    const count = 1 + Math.floor(seededRng(`reveal-${lobby.code}-${accusedSeat}`)() * 2);

    // reveal cards: TRUTH → all table-rank/jokers; LIE → one off-rank card slipped in
    const cards = Array.from({ length: count }, (_, i) => {
      const rank: CardRank =
        script.verdict === "TRUTH" || i > 0 ? script.table : (({ K: "Q", Q: "A", A: "K" })[script.table] as CardRank);
      if (script.verdict === "TRUTH" && i === 0 && seededRng(`joker-${i}`)() < 0.2) return { id: `r${i}`, rank: "JOKER" as CardRank };
      return { id: `r${i}`, rank };
    });

    const loserSeat = script.verdict === "LIE" ? accusedSeat : accuserSeat;
    const kind = script.verdict === "LIE" ? script.shotKind : "SELF";
    const executorSeat = kind === "EXECUTE" ? accuserSeat : null;

    await step120(ok, 900);
    this.send({ type: "reveal:show", seat: accusedSeat, cards, verdict: script.verdict, loserSeat });
    await step120(ok, 1500);
    this.send({ type: "shot:assign", loserSeat, kind, executorSeat });
    await step120(ok, 1700);

    const newPulled = (pulled.get(loserSeat) ?? 0) + 1;
    pulled.set(loserSeat, newPulled);
    this.send({ type: "shot:result", loserSeat, pulls: newPulled, outcome: script.outcome });
    if (script.outcome === "LIVE") aliveSet.delete(loserSeat);

    const survivorCoins = 1;
    const xpEarned = script.verdict === "LIE" && accuserSeat === 0 ? 2 : 1;
    const reason =
      script.outcome === "LIVE"
        ? kind === "EXECUTE"
          ? `${nameOf(loserSeat)} caught lying — executed by ${nameOf(executorSeat ?? 0)}`
          : `${nameOf(loserSeat)} takes the live round`
        : script.verdict === "LIE"
          ? `${nameOf(loserSeat)} survives the click`
          : `${nameOf(loserSeat)} told the truth — ${nameOf(accuserSeat)} pays the toll`;
    this.send({ type: "round:end", reason, survivorCoins, xpEarned });
  }
}

async function step120(ok: () => boolean, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (ok() && Date.now() < until) await sleep(120);
}

/** DEV-ONLY mock singleton. W2: swap for the real socket.io-client adapter. */
export const socket: SocketAdapter = new MockSocketAdapter();
