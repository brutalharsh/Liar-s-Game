"use client";

/**
 * ============================================================================
 * MOCK ROOM (DEV-ONLY) — deterministic full-match script over the REAL wire
 * contract (STR/07 §2, via @liars-game/shared).
 * ============================================================================
 * The mock NEVER owns game rules: it is scripted tabletop theater emitting
 * the exact view-filtered payloads the real server (S1) will. It knows only:
 *   · the hero's own hand (hand:deal — the ONLY hand a payload may carry)
 *   · pile COUNTS — never another player's ranks before reveal:show
 *   · NO chamber/bullet position at all — only the public (pulled/6) counter
 *
 * Match script (deterministic per room code; ≤5-seat cast):
 *   R1 K  SUE accused, TOAR checks    → TRUTH → TOAR pays SELF · BLANK
 *   R2 Q  YOU accused, FOX checks     → TRUTH → FOX pays SELF · BLANK
 *   R3 A  TOAR caught by SUE          → LIE   → SUE EXECUTES · LIVE (TOAR dies)
 *   R4 K  FOX caught by SCUBB         → LIE   → FOX SELF · BLANK
 *   R5 Q  SUE caught by YOU (or bot)  → LIE   → EXECUTE · LIVE (SUE dies)
 *   R6 A  FOX falsely calls SCUBB     → TRUTH → FOX SELF · LIVE (FOX dies)
 *   R7 K  SCUBB falsely calls YOU     → TRUTH → SCUBB SELF · LIVE → YOU WIN
 * If YOU check first, the round adopts you as accuser and keeps the scripted
 * verdict; a TRUTH against you always ends BLANK — the demo keeps you alive
 * to reach game:over (ghost mode is demoable in /motion-lab).
 * ============================================================================
 */

import {
  ERROR_CODES,
  type Card,
  type ClientAction,
  type EmitResult,
  type EmoteId,
  type MatchRecord,
  type MatchReward,
  type PlayerState,
  type RoomPhase,
  type RoomState,
  type Seat,
  type ServerEvent,
  type ServerEventName,
  type ShotKind,
  type TableCard,
  type ViewPlayerState,
  WireAvatarSpec,
} from "@/lib/wire";
import { seededRng } from "@/lib/mock/rng";
import { EMOTE_COOLDOWN_MS } from "@/lib/mock/emotes";

export interface MockPlayerView {
  seat: number;
  nickname: string;
  avatarSpec: WireAvatarSpec;
  isBot: boolean;
}

const RANKS: Card["rank"][] = ["K", "Q", "A", "J"];
const BOT_EMOTES = ["tipping-hat", "laugh", "shush", "wink", "cheer"] as const;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Payload type of a shared server event (seq included). */
type PayloadOf<N extends ServerEventName> = Extract<ServerEvent, { event: N }>["payload"];

/** Scripted round resolution (see header). */
interface RoundScript {
  table: TableCard;
  accused: Seat;
  accuser: Seat;
  verdict: "TRUTH" | "LIE";
  kind: ShotKind;
  outcome: "BLANK" | "LIVE";
}

const SCRIPTS: readonly RoundScript[] = [
  { table: "K", accused: 2, accuser: 3, verdict: "TRUTH", kind: "SELF", outcome: "BLANK" },
  { table: "Q", accused: 0, accuser: 4, verdict: "TRUTH", kind: "SELF", outcome: "BLANK" },
  { table: "A", accused: 3, accuser: 2, verdict: "LIE", kind: "EXECUTE", outcome: "LIVE" },
  { table: "K", accused: 4, accuser: 1, verdict: "LIE", kind: "SELF", outcome: "BLANK" },
  { table: "Q", accused: 2, accuser: 0, verdict: "LIE", kind: "EXECUTE", outcome: "LIVE" },
  { table: "A", accused: 1, accuser: 4, verdict: "TRUTH", kind: "SELF", outcome: "LIVE" },
  { table: "K", accused: 0, accuser: 1, verdict: "TRUTH", kind: "SELF", outcome: "LIVE" },
] as const;

/** First player of each round (STR/01 §2.3 read off the script). */
const STARTERS: readonly Seat[] = [2, 3, 2, 1, 2, 4, 3] as const;

/** Cinematic holds — give the UI its STR/03 §5 beat budgets. */
const T = {
  afterRoundNew: 650,
  afterDeal: 700,
  botThink: 1700,
  playSettle: 500,
  revealToShot: 2600,
  shotToResult: 3600,
  resultToRoundEnd: 2000, // payoff stamp gets its beat before round:end clears
  roundEndToNext: 2400,
  heroTurnMs: 20_000, // 20s @ 4–5 players (STR/01 §3)
  botTurnMs: 8_000,
  windowArmMs: 2_000, // STR/01 §4 arm-delay after the play lands
  windowRingMs: 10_000,
  armToBotCheck: 1_500,
  maxTurnsPerRound: 18,
} as const;

type HeroAction =
  | { kind: "throw"; cardIds: string[] }
  | { kind: "check"; accusedSeat: number }
  | "timeout";

interface MatchStats {
  kills: number;
  catches: number;
  falseAccusations: number;
  deaths: number;
  deathCause?: "selfRoulette" | "executed";
  pullsSurvived: number;
  roundsPlayed: number;
  pulls: number;
  alive: boolean;
}

export class MockRoom {
  private seq = 0;
  private out: ((ev: ServerEvent) => void) | null = null;
  private cancelled = false;
  private matchRun = 0;

  /**
   * Time scale for every scripted beat (1 = production pacing). Tests drive
   * the full match at ~0.1 — cinematics keep identical ORDERING, only the
   * sleeps shrink.
   */
  constructor(private speed = 1) {}

  private t(key: keyof typeof T): number {
    return Math.max(1, Math.round(this.traw(key)));
  }

  private traw(key: keyof typeof T): number {
    return T[key] * this.speed;
  }

  private code = "";
  private name = "";
  private theme = "saloon";
  private visibility: "public" | "private" = "private";
  private capacity = 5;
  private heroNickname = "YOU";
  private heroAvatar: WireAvatarSpec = { base: "fox" };
  private startedAt = Date.now();

  private players: MockPlayerView[] = [];
  private stats = new Map<Seat, MatchStats>();
  private heroHand: Card[] = [];
  private botHandCounts = new Map<Seat, number>();
  private lastEmoteAt = 0;

  // in-flight round bookkeeping (theater only)
  private roundNo = 0;
  private phase: RoomPhase = "lobby";
  private tableCard: TableCard | null = null;
  private turnSeat: Seat | null = null;
  private turnDeadline: number | null = null;
  private window: { playSeat: Seat; closesAtTs: number; armedAt: number } | null = null;
  private pileTotal = 0;
  private awaitingHero = false;
  private heroAction: HeroAction | null = null;

  bind(out: (ev: ServerEvent) => void): void {
    this.out = out;
  }

  get roomCode(): string {
    return this.code;
  }

  /**
   * Emit one shared server event with the next monotonic seq (STR/07 §4).
   * `payload` omits seq; the helper injects it — the typed payload union is
   * the compiler's promise that nothing outside the contract ships.
   */
  private push<N extends ServerEventName>(name: N, payload: Omit<PayloadOf<N>, "seq">): void {
    this.seq += 1;
    const typed = { ...payload, seq: this.seq } as unknown as PayloadOf<N>;
    this.out?.({ event: name, payload: typed } as ServerEvent);
  }

  private nicknameOf(seat: Seat): string {
    return this.players.find((p) => p.seat === seat)?.nickname ?? "PLAYER";
  }

  // ── lobby plumbing ──────────────────────────────────────────────────

  join(
    code: string,
    opts: { name?: string; theme?: string; visibility?: "public" | "private"; capacity?: number } = {},
  ): void {
    // same-code rejoin = catch-up snapshot only (seq-gap resync path)
    if (this.code === code && this.players.length > 0) {
      this.snapshot();
      return;
    }
    this.cancel();
    this.code = code;
    this.capacity = Math.min(Math.max(opts.capacity ?? 5, 2), 5);
    this.name = opts.name ?? `${this.heroNickname}'S TABLE`;
    this.theme = opts.theme ?? "saloon";
    this.visibility = opts.visibility ?? "private";
    this.roundNo = 0;
    this.tableCard = null;
    this.phase = "lobby";
    this.heroHand = [];
    this.botHandCounts.clear();
    this.pileTotal = 0;
    this.window = null;
    this.turnSeat = null;
    this.turnDeadline = null;
    this.startedAt = Date.now();

    const cast: MockPlayerView[] = [
      { seat: 0, nickname: this.heroNickname, avatarSpec: this.heroAvatar, isBot: false },
      { seat: 1, nickname: "SCUBB", avatarSpec: { base: "raccoon", hat: "hat-stetson" }, isBot: true },
      { seat: 2, nickname: "SUE", avatarSpec: { base: "owl", glasses: "glasses-shades" }, isBot: true },
      { seat: 3, nickname: "TOAR", avatarSpec: { base: "wolf" }, isBot: true },
      { seat: 4, nickname: "FOX", avatarSpec: { base: "fox" }, isBot: true },
    ];
    this.players = cast.slice(0, this.capacity);
    this.freshStats();
    this.snapshot();
  }

  setIdentity(hs: { nickname?: string; avatarSpec?: WireAvatarSpec | null }): void {
    if (hs.avatarSpec) this.heroAvatar = hs.avatarSpec;
    const trimmed = hs.nickname?.trim();
    if (trimmed && trimmed.length > 0) this.heroNickname = trimmed.slice(0, 18);
    const hero = this.players.find((p) => p.seat === 0);
    if (hero) {
      hero.nickname = this.heroNickname;
      hero.avatarSpec = this.heroAvatar;
    }
  }

  private freshStats(): void {
    this.stats = new Map(
      this.players.map((p) => [
        p.seat,
        {
          kills: 0,
          catches: 0,
          falseAccusations: 0,
          deaths: 0,
          pullsSurvived: 0,
          roundsPlayed: 0,
          pulls: 0,
          alive: true,
        } satisfies MatchStats,
      ]),
    );
  }

  /** Shared `lobby:state` (a full RoomState) — the catch-up view on (re)join. */
  private snapshot(): void {
    const seats: ViewPlayerState[] = this.players.map((p) => {
      const s = this.stats.get(p.seat);
      return {
        seat: p.seat,
        nickname: p.nickname,
        avatarSpec: p.avatarSpec,
        connected: true,
        afk: false,
        isHost: p.seat === 0,
        handCount: p.seat === 0 ? this.heroHand.length : (this.botHandCounts.get(p.seat) ?? 0),
        pulls: s?.pulls ?? 0,
        alive: s?.alive ?? true,
        activeTitle: null,
      };
    });
    const heroStats = this.stats.get(0);
    const you: PlayerState = {
      seat: 0,
      nickname: this.heroNickname,
      avatarSpec: this.heroAvatar,
      connected: true,
      afk: false,
      isHost: true,
      hand: this.heroHand,
      handCount: this.heroHand.length,
      pulls: heroStats?.pulls ?? 0,
      alive: heroStats?.alive ?? true,
      activeTitle: null,
    };
    const inGame = this.roundNo > 0;
    const base: Omit<RoomState, "seq" | "roundNo" | "tableCard" | "currentTurnSeat" | "deadlineTs" | "pileTotal" | "challengeWindow"> = {
      roomCode: this.code,
      name: this.name,
      capacity: this.capacity,
      theme: this.theme,
      visibility: this.visibility,
      phase: this.phase,
      hostSeat: 0,
      seats,
      you,
      spectator: false,
      estMatchMinutes: 8,
    };
    const state: Omit<RoomState, "seq"> = inGame
      ? {
          ...base,
          roundNo: this.roundNo,
          ...(this.tableCard ? { tableCard: this.tableCard } : {}),
          currentTurnSeat: this.turnSeat,
          deadlineTs: this.turnDeadline,
          pileTotal: this.pileTotal,
          challengeWindow: this.window
            ? { playSeat: this.window.playSeat, closesAtTs: this.window.closesAtTs }
            : null,
        }
      : base;
    this.push("lobby:state", state);
  }

  presence(): void {
    this.push("presence:update", { seats: this.players.map((p) => ({ seat: p.seat, connected: true, afk: false })) });
  }

  leave(): void {
    this.cancel();
    this.code = "";
    this.players = [];
    this.phase = "lobby";
    this.roundNo = 0;
  }

  cancel(): void {
    this.cancelled = true;
    this.matchRun += 1;
    this.awaitingHero = false;
    this.heroAction = null;
  }

  // ── client action surface ────────────────────────────────────────────

  handle(action: ClientAction): EmitResult {
    switch (action.type) {
      case "room:create": {
        this.join("DUMMY", {
          name: action.name,
          theme: action.theme,
          visibility: action.visibility,
          capacity: action.capacity,
        });
        return { ok: true, code: "DUMMY" };
      }
      case "room:join": {
        this.join(action.code);
        return { ok: true, code: action.code };
      }
      case "room:leave": {
        this.leave();
        return { ok: true };
      }
      case "game:start": {
        if (this.code === "") {
          return { ok: false, errorCode: ERROR_CODES.NOT_IN_ROOM, errorMessage: "Join a table first." };
        }
        this.startMatch();
        return { ok: true };
      }
      case "play:cards": {
        if (!this.awaitingHero || this.turnSeat !== 0) {
          return { ok: false, errorCode: ERROR_CODES.NOT_YOUR_TURN, errorMessage: "Wait for your turn." };
        }
        const ids = action.cardIds;
        if (ids.length < 1 || ids.length > 3) {
          return { ok: false, errorCode: ERROR_CODES.VALIDATION, errorMessage: "You can throw 1–3 cards." };
        }
        if (new Set(ids).size !== ids.length) {
          return { ok: false, errorCode: ERROR_CODES.VALIDATION, errorMessage: "Duplicate cards — pick again." };
        }
        if (!ids.every((id) => this.heroHand.some((c) => c.id === id))) {
          return { ok: false, errorCode: ERROR_CODES.ILLEGAL_MOVE, errorMessage: "Those aren't your cards." };
        }
        this.awaitingHero = false;
        this.heroAction = { kind: "throw", cardIds: ids };
        return { ok: true };
      }
      case "liar:call": {
        const gate = this.canHeroCall(action.accusedSeat);
        if (!gate.ok) {
          return {
            ok: false,
            errorCode: gate.errorCode ?? ERROR_CODES.ILLEGAL_MOVE,
            errorMessage: gate.errorMessage ?? "",
          };
        }
        this.awaitingHero = false;
        this.heroAction = { kind: "check", accusedSeat: action.accusedSeat };
        return { ok: true };
      }
      case "emote:send": {
        if (Date.now() < this.lastEmoteAt + EMOTE_COOLDOWN_MS) {
          return { ok: false, errorCode: ERROR_CODES.RATE_LIMITED, errorMessage: "Emotes cool down for 3 seconds." };
        }
        this.lastEmoteAt = Date.now();
        // The adapter zod-validated the enum before handle(); the cast just
        // re-narrows the string the wire schema already accepted.
        this.push("emote:broadcast", { seat: 0, emoteId: action.emoteId as EmoteId });
        return { ok: true };
      }
      case "profile:tts-say": {
        return { ok: true }; // TTS is client-local — no audio ever crosses the wire
      }
      default: {
        const never: never = action;
        void never;
        return { ok: false, errorCode: ERROR_CODES.INTERNAL, errorMessage: "Unsupported event." };
      }
    }
  }

  private canHeroCall(accusedSeat: Seat): { ok: boolean; errorCode?: string; errorMessage?: string } {
    if (!(this.stats.get(0)?.alive ?? false)) {
      return { ok: false, errorCode: ERROR_CODES.ILLEGAL_MOVE, errorMessage: "Ghosts can't call liars." };
    }
    if (this.window) {
      if (accusedSeat !== this.window.playSeat) {
        return { ok: false, errorCode: ERROR_CODES.EVENT_STALE, errorMessage: "You can only challenge the last throw." };
      }
      if (Date.now() < this.window.armedAt) {
        return { ok: false, errorCode: ERROR_CODES.EVENT_STALE, errorMessage: "Window still arming — steady." };
      }
      return { ok: true };
    }
    if (this.awaitingHero && this.turnSeat === 0 && accusedSeat !== 0) {
      return { ok: true }; // 2–4p rule: you judge the previous throw on your own turn
    }
    return { ok: false, errorCode: ERROR_CODES.EVENT_STALE, errorMessage: "No open window to challenge." };
  }

  // ── the match ────────────────────────────────────────────────────────

  /** Fresh match — first start AND rematch (host re-lobby is S1's seam). */
  startMatch(): void {
    this.cancelled = false;
    this.matchRun += 1;
    const run = this.matchRun;
    this.freshStats();
    this.heroHand = [];
    this.botHandCounts.clear();
    this.pileTotal = 0;
    this.roundNo = 0;
    this.tableCard = null;
    this.phase = "lobby";
    this.startedAt = Date.now();
    void this.runMatch(run);
  }

  private alive(run: number): boolean {
    return !this.cancelled && this.matchRun === run;
  }

  private async step(run: number, ms: number): Promise<void> {
    const until = Date.now() + ms;
    while (this.alive(run) && Date.now() < until) await sleep(140);
  }

  private async waitHero(run: number, deadlineMs: number): Promise<HeroAction> {
    const startedAt = Date.now();
    for (;;) {
      const action = this.heroAction;
      if (action) {
        this.heroAction = null;
        return action;
      }
      if (!this.alive(run) || Date.now() - startedAt >= deadlineMs) return "timeout";
      await sleep(140);
    }
  }

  private async runMatch(run: number): Promise<void> {
    const rng = seededRng(`match-${this.code}-${this.startedAt % 97}`);
    let round = 0;

    while (this.alive(run) && round < SCRIPTS.length) {
      const script = SCRIPTS[round] as RoundScript;
      const living = this.players.filter((p) => this.stats.get(p.seat)?.alive);
      if (living.length <= 1) break;

      const roundNo = round + 1;
      this.roundNo = roundNo;
      this.tableCard = script.table;
      this.phase = "dealing";
      this.window = null;
      this.turnSeat = null;
      this.turnDeadline = null;
      this.pileTotal = 0;
      this.heroHand = [];
      this.botHandCounts = new Map(living.filter((p) => p.seat !== 0).map((p) => [p.seat, 5]));

      this.push("round:new", {
        roundNo,
        tableCard: script.table,
        dealtCounts: living.filter((p) => p.seat !== 0).map((p) => ({ seat: p.seat, count: 5 })),
      });
      await this.step(run, this.t("afterRoundNew"));
      if (!this.alive(run)) return;

      this.heroHand = Array.from({ length: 5 }, (_, i): Card => ({
        id: `c${roundNo}-${i}`,
        rank: RANKS[Math.floor(rng() * RANKS.length)] ?? "K",
      }));
      this.phase = "playing";
      this.push("hand:deal", { cards: this.heroHand });
      await this.step(run, this.t("afterDeal"));
      if (!this.alive(run)) return;

      const resolved = await this.playRing(run, script, STARTERS[round] ?? 2);
      if (!this.alive(run)) return;
      if (resolved) {
        await this.step(run, this.t("roundEndToNext"));
      }
      round += 1;
    }

    if (!this.alive(run)) return;
    this.emitGameOver();
  }

  private botCount(rng: () => number, seat: Seat): number {
    const left = this.botHandCounts.get(seat) ?? 0;
    return Math.min(1 + Math.floor(rng() * 3), left);
  }

  private takeHeroCheck(): { accusedSeat: number } | null {
    const action = this.heroAction;
    if (action && action !== "timeout" && action.kind === "check") {
      this.heroAction = null;
      return { accusedSeat: action.accusedSeat };
    }
    return null;
  }

  /** A queued hero check resolves the round instantly (validated at accept). */
  private async flushHeroCheck(run: number, script: RoundScript): Promise<boolean> {
    const check = this.takeHeroCheck();
    if (!check) return false;
    if (this.window) {
      this.push("window:close", { reason: "liar_called" });
      this.window = null;
    }
    await this.resolveCheck(run, check.accusedSeat, 0, script);
    return true;
  }

  /**
   * Turns around the ring (ccw, skipping dead + empty hands) until the round
   * resolves: a hero check in any open window, the scripted accusation after
   * the accused's play, or the defensive max-turn cap.
   */
  private async playRing(run: number, script: RoundScript, starter: Seat): Promise<boolean> {
    const rng = seededRng(`ring-${this.code}-r${this.roundNo}`);
    const ring = this.players.map((p) => p.seat).filter((s) => this.stats.get(s)?.alive);
    let idx = Math.max(0, ring.indexOf(starter));

    for (let turns = 0; turns < T.maxTurnsPerRound; turns += 1) {
      if (!this.alive(run)) return false;

      // a still-open window may have run out between beats (STR/01 §4)
      if (this.window && Date.now() >= this.window.closesAtTs) {
        if (await this.flushHeroCheck(run, script)) return true;
        this.push("window:close", { reason: "expired" });
        this.window = null;
      }
      if (await this.flushHeroCheck(run, script)) return true;

      const seat = ring[idx] ?? 0;
      const canPlay = seat === 0 ? this.heroHand.length > 0 : (this.botHandCounts.get(seat) ?? 0) > 0;
      if (!canPlay) {
        idx = (idx + 1) % ring.length;
        continue;
      }

      this.turnSeat = seat;
      this.turnDeadline = Date.now() + this.t(seat === 0 ? "heroTurnMs" : "botTurnMs");
      this.phase = "playing";
      this.push("turn:begin", { seat, deadlineTs: this.turnDeadline });

      let count: number;
      if (seat === 0) {
        this.awaitingHero = true;
        const action = await this.waitHero(run, this.t("heroTurnMs"));
        this.awaitingHero = false;
        if (!this.alive(run)) return false;
        if (action !== "timeout" && action.kind === "check") {
          // 2–4p judge-turn call on the previous throw
          if (this.window) {
            this.push("window:close", { reason: "liar_called" });
            this.window = null;
          }
          await this.resolveCheck(run, action.accusedSeat, 0, script);
          return true;
        }
        const thrownIds = action !== "timeout" && action.kind === "throw" ? action.cardIds : null;
        count = thrownIds?.length ?? 1; // timeout = auto-play 1, never auto-call (STR/01 §3)
        const ids = thrownIds ?? this.heroHand.slice(0, 1).map((c) => c.id);
        this.heroHand = this.heroHand.filter((c) => !ids.includes(c.id));
      } else {
        await this.step(run, this.t("botThink"));
        if (!this.alive(run)) return false;
        if (await this.flushHeroCheck(run, script)) return true;
        count = this.botCount(rng, seat);
        this.botHandCounts.set(seat, Math.max(0, (this.botHandCounts.get(seat) ?? 0) - count));
      }

      // committing a play closes any still-open window (belief)
      if (this.window) {
        if (await this.flushHeroCheck(run, script)) return true;
        this.push("window:close", { reason: "belief" });
        this.window = null;
      }

      this.pileTotal += count;
      this.turnSeat = null;
      this.turnDeadline = null;
      this.push("play:accept", { seat, count, totalPile: this.pileTotal });
      await this.step(run, this.t("playSettle"));
      if (!this.alive(run)) return false;
      if (await this.flushHeroCheck(run, script)) return true;

      // 5-seat table → a challenge window opens after every play (STR/01 §4)
      this.window = {
        playSeat: seat,
        closesAtTs: Date.now() + this.t("windowArmMs") + this.t("windowRingMs"),
        armedAt: Date.now() + this.t("windowArmMs"),
      };
      this.push("window:open", { playSeat: seat, closesAtTs: this.window.closesAtTs });

      if (seat !== 0 && rng() < 0.12) {
        const emoteId = BOT_EMOTES[Math.floor(rng() * BOT_EMOTES.length)] ?? "laugh";
        this.push("emote:broadcast", { seat, emoteId });
      }

      // scripted accusation beat: the accused just played → a rival checks
      // after the arm delay. A hero check wins the race (STR/07 §6 first-wins).
      if (seat === script.accused && script.accuser !== seat) {
        await this.step(run, this.t("windowArmMs") + this.t("armToBotCheck"));
        if (!this.alive(run)) return false;
        if (await this.flushHeroCheck(run, script)) return true;
        const windowOpen = this.window !== null;
        this.window = null;
        const accuser =
          script.accuser !== 0 && this.stats.get(script.accuser)?.alive
            ? script.accuser
            : this.pickBotAccuser(script.accused);
        if (accuser !== null) {
          if (windowOpen) this.push("window:close", { reason: "liar_called" });
          await this.resolveCheck(run, script.accused, accuser, script);
          return true;
        }
      }

      idx = (idx + 1) % ring.length;
    }
    return false;
  }

  private pickBotAccuser(accused: Seat): Seat | null {
    const alt = this.players.find((p) => p.seat !== accused && p.seat !== 0 && this.stats.get(p.seat)?.alive);
    return alt?.seat ?? null;
  }

  // ── resolution: reveal → shot → round:end ─────────────────────────────

  private async resolveCheck(run: number, accused: Seat, accuser: Seat, script: RoundScript): Promise<void> {
    // reveal faces are constructed to match the scripted verdict — same
    // payload shape the real server's reveal:show carries
    const count = 1 + Math.floor(seededRng(`reveal-${this.code}-${this.roundNo}-${accused}`)() * 2);
    const offRank: Record<TableCard, Card["rank"]> = { K: "Q", Q: "A", A: "K" };
    const cards: Card[] = Array.from({ length: count }, (_, i) => ({
      id: `r${this.roundNo}-${i}`,
      rank:
        script.verdict === "TRUTH"
          ? i === 0 && seededRng(`joker-${this.roundNo}-${accused}`)() < 0.2
            ? "J"
            : script.table
          : i > 0
            ? script.table
            : (offRank[script.table] as Card["rank"]),
    }));

    const loserSeat = script.verdict === "LIE" ? accused : accuser;
    const heroLoses = loserSeat === 0;
    const kind: ShotKind = script.verdict === "LIE" ? script.kind : "SELF";
    const outcome = heroLoses ? ("BLANK" as const) : script.outcome; // hero survives to reach game:over

    // stats attribution (STR/01 §10)
    const loserStats = this.stats.get(loserSeat);
    const accuserStats = this.stats.get(accuser);
    if (script.verdict === "LIE" && accuserStats) accuserStats.catches += 1;
    if (script.verdict === "TRUTH" && accuserStats) accuserStats.falseAccusations += 1;

    this.phase = "reveal";
    this.push("reveal:show", { cards, verdict: script.verdict, loserSeat });
    await this.step(run, this.t("revealToShot"));

    this.phase = "roulette";
    this.push("shot:assign", kind === "EXECUTE"
      ? { loserSeat, kind, executorSeat: accuser }
      : { loserSeat, kind });
    await this.step(run, this.t("shotToResult"));

    const pulls = (loserStats?.pulls ?? 0) + 1;
    if (loserStats) {
      loserStats.pulls = pulls;
      if (outcome === "LIVE") {
        loserStats.deaths = 1;
        loserStats.deathCause = kind === "EXECUTE" ? "executed" : "selfRoulette";
        loserStats.alive = false;
        if (kind === "EXECUTE" && accuserStats) accuserStats.kills += 1;
      } else {
        loserStats.pullsSurvived += 1;
      }
    }
    this.push("shot:result", { loserSeat, pulls, outcome });
    await this.step(run, this.t("resultToRoundEnd") + (outcome === "LIVE" ? Math.round(700 * this.speed) : 0));

    const living = this.players.filter((p) => this.stats.get(p.seat)?.alive);
    this.phase = "roundEnd";
    this.push("round:end", {
      reason: outcome === "LIVE" ? "death" : "survived",
      survivorCoins: living.length > 1 ? 1 : 0,
      xpEarned: living.map((p) => ({ seat: p.seat, xp: 1 })),
    });
    for (const s of this.stats.values()) s.roundsPlayed += 1;
  }

  private emitGameOver(): void {
    const aliveSeats = this.players.filter((p) => this.stats.get(p.seat)?.alive).map((p) => p.seat);
    const winnerSeat = aliveSeats[0] ?? 0;
    const start = this.startedAt || Date.now();

    const matchRecord: MatchRecord = {
      matchId: `demo-${this.code}-${start}`,
      roomCode: this.code || "DUMMY",
      startedAt: start,
      endedAt: Date.now(),
      capacity: this.players.length,
      theme: this.theme,
      players: this.players.map((p) => {
        const s = this.stats.get(p.seat)!;
        const won = p.seat === winnerSeat && s.alive;
        return {
          accountId: `demo-${p.seat}`,
          seat: p.seat,
          nickname: this.nicknameOf(p.seat),
          avatarSpec: p.avatarSpec,
          titleAtPlay: null,
          stats: {
            kills: s.kills,
            catches: s.catches,
            falseAccusations: s.falseAccusations,
            bluffSuccesses: p.seat === 1 ? 2 : p.seat === 2 ? 1 : 0,
            deaths: s.deaths,
            ...(s.deathCause ? { deathCause: s.deathCause } : {}),
            pullsSurvived: s.pullsSurvived,
            roundsPlayed: s.roundsPlayed,
            won,
            xpEarned: won ? 12 : s.alive ? 6 : 4,
            coinsEarned: won ? 4 + s.roundsPlayed : s.alive ? s.roundsPlayed : 0,
          },
        };
      }),
      summary: {
        rounds: this.roundNo,
        totalPulls: [...this.stats.values()].reduce((n, s) => n + s.pulls, 0),
        dareDevilMoments: [...this.stats.values()].filter((s) => s.pullsSurvived >= 2).length,
      },
    };

    const rewards: MatchReward[] = this.players.map((p) => {
      const s = this.stats.get(p.seat)!;
      const won = p.seat === winnerSeat && s.alive;
      return {
        seat: p.seat,
        coins: won ? 4 + s.roundsPlayed : s.alive ? s.roundsPlayed : 0,
        xp: won ? 12 : s.alive ? 6 : 4,
        unlockedTitles: won ? ["Last One Standing"] : [],
      };
    });

    this.phase = "gameOver";
    this.push("game:over", { winnerSeat, matchRecord, rewards });
  }
}
