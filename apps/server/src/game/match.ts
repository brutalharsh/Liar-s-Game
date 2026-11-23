/**
 * MatchRuntime — one live match inside a room: owns the engine `GameState`
 * (built from a crypto-minted seed), routes engine `Effect`s into STR/07 §2
 * wire events (seq-stamped via the Room), drives the timer wheel from the
 * ENGINE's clock fields (the only authority — STR/07 §4), schedules bots, and
 * fires the match-end seam exactly once.
 *
 * View-filtering discipline (STR/07 §3 / STR/08 §1):
 *  - every delta event is composed ONLY from engine `Effect` fields, which the
 *    engine guarantees carry no hidden data (counts, never other hands, never
 *    bulletPos);
 *  - the only seat-scoped event is `hand:deal` (HAND_DEALT) → the owner's
 *    sockets alone; `reveal:show` is the single face-leak event;
 *  - catch-up snapshots are built by the Room through
 *    `toPublicSnapshot(state, viewerSeat)`.
 *
 * Rank note: the engine speaks `'JOKER'`, the wire speaks `'J'` (shared
 * `RankSchema` pins J = Joker). `wireCard` is the single translation seam.
 */
import {
  apply,
  createMatch,
  SeededRng,
  chamberBadge,
  toPublicSnapshot,
} from '@liars-game/rules-engine';
import type {
  ApplyResult,
  Effect,
  GameEvent,
  GameState,
  MatchConfig,
  RosterEntry,
  MatchRecord as EngineMatchRecord,
  Card as EngineCard,
} from '@liars-game/rules-engine';
import type { Card as WireCard, MatchRecord as WireMatchRecord, XpGain } from '@liars-game/shared';
import { createBotBrain, type BotView } from './bots.js';
import type { TimerWheel } from './timers.js';
import type { GameTiming, MatchEndPayload } from './types.js';

const BOT_RNG_SALT = 0x5eedb07;

/** Engine `'JOKER'` → wire `'J'` (shared RankSchema: J = Joker). */
export function wireCard(card: EngineCard): WireCard {
  return { id: card.id, rank: card.rank === 'JOKER' ? 'J' : card.rank };
}

/** Engine WindowClosed reason → shared WindowCloseReason (STR/07 §2). */
export function wireWindowReason(reason: 'believed' | 'expired' | 'challenged'): 'belief' | 'expired' | 'liar_called' {
  if (reason === 'believed') return 'belief';
  if (reason === 'expired') return 'expired';
  return 'liar_called';
}

/** Engine ShotKind → shared ShotKind ('EXECUTE' = accuser fires). */
export function wireShotKind(kind: 'SELF' | 'EXECUTE_BY_ACCUSER'): 'SELF' | 'EXECUTE' {
  return kind === 'EXECUTE_BY_ACCUSER' ? 'EXECUTE' : 'SELF';
}

/**
 * Services the runtime needs from its Room. The Room stamps the per-room
 * monotonic `seq` and owns socket bindings; the runtime never touches io.
 */
export interface MatchRuntimeHost {
  /** Seq-stamped broadcast to the whole room scope (seated + spectators). */
  emitEvent(event: string, payload: Record<string, unknown>): void;
  /** Seq-stamped (once) emission to every socket bound to an engine seat. */
  emitToSeat(engineSeat: number, event: string, payload: Record<string, unknown>): void;
  /** Engine seat → live socket ids (empty for bots / disconnected). */
  seatSocketIds(engineSeat: number): ReadonlySet<string>;
  isBotSeat(engineSeat: number): boolean;
  /** A PRESENCE effect landed → the Room re-broadcasts the presence list. */
  onPresenceChanged(): void;
  /** Match-end seam (E1 contract, exactly once per match). */
  onMatchEnd(payload: MatchEndPayload): void;
  now(): number;
}

export interface MatchRuntimeOptions {
  matchId: string;
  seed: number;
  roster: RosterEntry[];
  isBotSeats: boolean[];
  config: MatchConfig;
  roomCode: string;
  theme: string;
  host: MatchRuntimeHost;
  wheel: TimerWheel;
  timing: GameTiming;
}

export class MatchRuntime {
  private state: GameState;
  private readonly ownKeys = new Set<string>();
  private readonly botBrain;
  private readonly botRng: SeededRng;
  private matchEnded = false;

  constructor(private readonly o: MatchRuntimeOptions) {
    this.state = createMatch({
      roster: o.roster,
      matchId: o.matchId,
      roomCode: o.roomCode,
      theme: o.theme,
      seed: o.seed,
      config: o.config,
    });
    // Separate derived stream: bot think/choice draws must never advance the
    // engine's replay stream (bit-exact (seed, log) replay — R1 requirement).
    this.botRng = new SeededRng(o.seed ^ BOT_RNG_SALT);
    this.botBrain = createBotBrain(this.botRng);
  }

  // ── introspection ───────────────────────────────────────────────────────

  get engineState(): GameState {
    return this.state;
  }

  get isOver(): boolean {
    return this.state.phase === 'GAME_END';
  }

  get seed(): number {
    return this.o.seed;
  }

  get matchId(): string {
    return this.o.matchId;
  }

  get capacity(): number {
    return this.state.capacity;
  }

  /** Phase as the wire sees it (shared RoomPhase). */
  get wirePhase(): 'lobby' | 'dealing' | 'playing' | 'reveal' | 'roulette' | 'roundEnd' | 'gameOver' {
    switch (this.state.phase) {
      case 'LOBBY':
        return 'lobby';
      case 'ROUND_NEW':
        return 'dealing';
      case 'TURN':
      case 'WINDOW':
        return 'playing';
      case 'REVEAL':
        return 'reveal';
      case 'SHOT':
        return 'roulette';
      case 'ROUND_END':
        return 'roundEnd';
      case 'GAME_END':
        return 'gameOver';
    }
  }

  /** Per-seat view-filtered snapshot (hand only for the viewer). */
  publicSnapshot(viewerSeat?: number): ReturnType<typeof toPublicSnapshot> {
    return toPublicSnapshot(this.state, viewerSeat);
  }

  /** Engine seat → public chamber badge (pulls counter only — never bulletPos). */
  chamberOf(engineSeat: number): { pulls: number; chambers: 6; fatalNext: boolean } | undefined {
    const p = this.state.players.find((q) => q.seat === engineSeat);
    return p ? chamberBadge(p) : undefined;
  }

  /** Grace deadline from the ENGINE's disconnect field (authority — STR/01 §7). */
  graceDeadline(engineSeat: number): number | undefined {
    const p = this.state.players.find((q) => q.seat === engineSeat);
    if (!p || p.disconnectedAt === undefined) return undefined;
    return p.disconnectedAt + this.o.config.disconnectGraceMs;
  }

  seatUser(engineSeat: number): string | undefined {
    return this.state.players.find((q) => q.seat === engineSeat)?.accountId;
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  /** Applies MATCH_START (rolls bullets, starter, deal 1) and routes effects. */
  start(): ApplyResult {
    return this.applyEvent({ type: 'MATCH_START', at: this.o.host.now() });
  }

  /**
   * Single entry point for EVERY engine input — human actions, timer fires,
   * presence changes, pacing drivers. Rejected events change nothing except
   * the log (they route no effects).
   */
  applyEvent(event: GameEvent): ApplyResult {
    const res = apply(this.state, event);
    this.state = res.state;
    if (!res.err) {
      this.route(res.effects);
    }
    return res;
  }

  /** Cancels every wheel slot this runtime armed (rematch / room reuse). */
  dispose(): void {
    for (const key of [...this.ownKeys]) {
      this.o.wheel.cancel(key);
    }
    this.ownKeys.clear();
  }

  // ── timer wheel (owner of armed-slot names) ─────────────────────────────

  private arm(key: string, at: number, fire: () => void): void {
    this.o.wheel.schedule(key, at, fire);
    this.ownKeys.add(key);
  }

  private drop(key: string): void {
    this.o.wheel.cancel(key);
    this.ownKeys.delete(key);
  }

  private dropAllMatching(prefix: string): void {
    for (const key of [...this.ownKeys]) {
      if (key.startsWith(prefix)) {
        this.o.wheel.cancel(key);
        this.ownKeys.delete(key);
      }
    }
  }

  private cancelMatchPacing(): void {
    this.drop('pacing:begin');
    this.drop('pacing:reveal');
    this.drop('pacing:shot');
    this.drop('pacing:next');
  }

  // ── effect routing (engine Effect → STR/07 §2 event) ────────────────────

  private route(effects: Effect[]): void {
    const gameOver = effects.find((e): e is Extract<Effect, { kind: 'GAME_OVER' }> => e.kind === 'GAME_OVER');
    const now = this.o.host.now();

    for (const effect of effects) {
      switch (effect.kind) {
        // Internal intro (starterSeat lands on the wire via first turn:begin).
        case 'MATCH_STARTED':
          break;

        case 'ROUND_STARTED':
          this.drop('turn');
          this.drop('window');
          this.drop('bot:turn');
          this.dropAllMatching('bot:win:');
          this.cancelMatchPacing();
          this.o.host.emitEvent('round:new', {
            roundNo: effect.roundNo,
            tableCard: effect.tableCard,
            dealtCounts: effect.dealtCounts,
          });
          this.arm('pacing:begin', now + this.o.timing.dealStaggerMs, () => {
            this.applyEvent({ type: 'BEGIN_TURNS', at: this.o.host.now() });
          });
          break;

        case 'HAND_DEALT':
          // SEAT-PRIVATE (STR/07 §2): the owning seat's sockets and nobody else.
          this.o.host.emitToSeat(effect.seat, 'hand:deal', {
            cards: effect.cards.map(wireCard),
          });
          break;

        case 'TURN_STARTED': {
          this.o.host.emitEvent('turn:begin', {
            seat: effect.seat,
            deadlineTs: effect.deadline,
          });
          this.armTurnTimer();
          this.scheduleBotTurn(effect.seat);
          break;
        }

        case 'PLAYED': {
          const totalPile = effect.pile.reduce((sum, p) => sum + p.count, 0);
          this.o.host.emitEvent('play:accept', {
            seat: effect.seat,
            count: effect.count,
            totalPile,
          });
          break;
        }

        case 'WINDOW_OPENED':
          this.armWindowTimer();
          this.o.host.emitEvent('window:open', {
            playSeat: effect.accusedSeat,
            closesAtTs: effect.closesAt,
          });
          this.scheduleBotWindowChecks(effect.accusedSeat, effect.armedAt, effect.closesAt);
          break;

        case 'WINDOW_CLOSED':
          this.drop('window');
          this.dropAllMatching('bot:win:');
          this.o.host.emitEvent('window:close', {
            reason: wireWindowReason(effect.reason),
          });
          break;

        case 'REVEALED':
          // A challenge is resolving: freeze the turn/window/pacing slots.
          this.drop('turn');
          this.drop('window');
          this.drop('bot:turn');
          this.dropAllMatching('bot:win:');
          this.cancelMatchPacing();
          this.o.host.emitEvent('reveal:show', {
            cards: effect.cards.map(wireCard),
            verdict: effect.verdict,
            loserSeat: effect.loserSeat,
          });
          this.arm('pacing:reveal', now + this.o.timing.revealAckMs, () => {
            this.applyEvent({ type: 'REVEAL_ACK', at: this.o.host.now() });
          });
          break;

        case 'SHOT_ASSIGNED': {
          const payload: Record<string, unknown> = {
            loserSeat: effect.loserSeat,
            kind: wireShotKind(effect.shotKind),
          };
          if (effect.executorSeat !== undefined) payload['executorSeat'] = effect.executorSeat;
          this.o.host.emitEvent('shot:assign', payload);
          break;
        }

        case 'SHOT_RESULT':
          this.o.host.emitEvent('shot:result', {
            loserSeat: effect.loserSeat,
            pulls: effect.pullNo,
            outcome: effect.outcome,
          });
          this.arm('pacing:shot', now + this.o.timing.shotAckMs, () => {
            this.applyEvent({ type: 'SHOT_ACK', at: this.o.host.now() });
          });
          break;

        case 'ROUND_ENDED': {
          this.cancelMatchPacing();
          const xpEarned: XpGain[] = gameOver
            ? this.buildFinalXpGains(gameOver.record)
            : [];
          this.o.host.emitEvent('round:end', {
            reason: effect.survived ? 'survived' : 'death',
            survivorCoins: 1, // +1 coin per survived round (STR/04 §2)
            xpEarned,
          });
          if (!gameOver && this.state.phase === 'ROUND_END') {
            this.arm('pacing:next', now + this.o.timing.roundEndMs, () => {
              this.applyEvent({ type: 'NEXT_ROUND', at: this.o.host.now() });
            });
          }
          break;
        }

        case 'GAME_OVER':
          this.cancelMatchPacing();
          this.drop('turn');
          this.drop('window');
          this.drop('bot:turn');
          this.dropAllMatching('bot:win:');
          this.finishMatch(effect);
          break;

        case 'PRESENCE':
          this.o.host.onPresenceChanged();
          break;
      }
    }
  }

  // ── timers (engine clock fields are the authority) ──────────────────────

  /**
   * Arms `TURN_TIMEOUT` for the current turn read from `state.turn`. A seat
   * inside its 60s disconnect grace gets the deadline EXTENDED to
   * `graceEnd + εms` (the round "pauses" — STR/03 §3), matching the engine's
   * ERR_GRACE guard; an abandoned seat fires ASAP (drunk-under-the-table
   * auto-play resumes past its deadline).
   */
  private armTurnTimer(): void {
    const turn = this.state.turn;
    if (!turn) {
      this.drop('turn');
      return;
    }
    const player = this.state.players.find((p) => p.seat === turn.seat);
    const now = this.o.host.now();
    let at = turn.deadline;
    const graceEnd = this.graceDeadline(turn.seat);
    if (player && player.disconnectedAt !== undefined && !player.abandoned && graceEnd !== undefined) {
      // Round-pause: no auto-play may fire before the grace clock (STR/03 §3).
      at = Math.max(at, graceEnd + 15);
    } else if (player && player.abandoned) {
      // Seat lost — drunk-under-the-table auto-play resumes right away.
      at = Math.max(at, now + 15);
    } else if (at < now + 1500) {
      // Connected player whose deadline already passed (returned from grace):
      // a 1.5s shot clock beats an instant auto-fire.
      at = now + 1500;
    }
    this.arm('turn', at, () => {
      const res = this.applyEvent({ type: 'TURN_TIMEOUT', seat: turn.seat, at: this.o.host.now() });
      if (res.err) {
        // Drift-safe re-check: too early / still in grace → retry past the block.
        const stillTurn = this.state.turn;
        if (res.err.code === 'ERR_TOO_EARLY' && stillTurn) {
          this.arm('turn', stillTurn.deadline + 25, () => {
            this.applyEvent({
              type: 'TURN_TIMEOUT',
              seat: this.state.turn ? this.state.turn.seat : turn.seat,
              at: this.o.host.now(),
            });
          });
        }
      }
    });
  }

  /** Arms `WINDOW_EXPIRE` at the engine's `window.closesAt`. */
  private armWindowTimer(): void {
    const w = this.state.round?.window;
    if (!w) {
      this.drop('window');
      return;
    }
    this.arm('window', w.closesAt, () => {
      this.applyEvent({ type: 'WINDOW_EXPIRE', at: this.o.host.now() });
    });
  }

  /** Late-cancel helper for presence flows re-entering the turn phase. */
  rearmAfterPresence(): void {
    if (this.state.phase === 'TURN' || this.state.phase === 'WINDOW') {
      this.armTurnTimer();
      if (this.state.round?.window) this.armWindowTimer();
    }
  }

  // ── bots ────────────────────────────────────────────────────────────────

  private scheduleBotTurn(seat: number): void {
    if (!this.o.host.isBotSeat(seat)) return;
    const player = this.state.players.find((p) => p.seat === seat);
    if (!player || !player.alive || player.left || player.abandoned) return;
    const turn = this.state.turn;
    if (!turn || turn.seat !== seat) return;

    const min = this.o.timing.botThinkMinMs;
    const jitter = this.o.timing.botThinkJitterMs;
    const think = this.botRng.int(Math.min(min, 15), Math.max(15, min + jitter));
    const at = Math.min(this.o.host.now() + think, turn.deadline - 25);
    this.arm('bot:turn', Math.max(this.o.host.now() + 1, at), () => this.botAct(seat));
  }

  private botAct(seat: number): void {
    const s = this.state;
    const player = s.players.find((p) => p.seat === seat);
    if (!player || !player.alive || player.left || player.abandoned) return;
    const turn = s.turn;
    if (!turn || turn.seat !== seat) return;
    if (s.phase !== 'TURN' && s.phase !== 'WINDOW') return;
    const round = s.round;
    if (!round) return;

    const last = round.pile[round.pile.length - 1];
    const w = round.window;
    const canCall =
      last !== undefined &&
      last.seat !== seat &&
      (s.phase === 'TURN' ||
        (w !== undefined && w.accusedSeat !== seat && this.o.host.now() >= w.armedAt));
    const view: BotView = {
      hand: player.hand,
      tableCard: round.tableCard,
      canCallNow: canCall,
      lastPlayCount: last ? last.cards.length : null,
    };

    const decision = this.botBrain.decide(view);
    if (decision.action === 'pass') return;

    if (decision.action === 'call' && last) {
      const res = this.applyEvent({
        type: 'LIAR',
        seat,
        accusedSeat: w ? w.accusedSeat : last.seat,
        at: this.o.host.now(),
      });
      if (res.err && res.err.code === 'ERR_WINDOW_NOT_ARMED' && w) {
        // Fired early against the arm delay — retry after arming.
        this.arm('bot:turn', w.armedAt + 5, () => this.botAct(seat));
      }
      return;
    }

    if (decision.action === 'play') {
      const res = this.applyEvent({
        type: 'PLAY',
        seat,
        cardIds: decision.cardIds,
        at: this.o.host.now(),
      });
      if (res.err && player.hand.length > 0) {
        // Fallback: minimal valid play (only if the engine somehow rejected).
        this.applyEvent({
          type: 'PLAY',
          seat,
          cardIds: [player.hand[0]!.id],
          at: this.o.host.now(),
        });
      }
    }
  }

  /** Each challenge-eligible bot rolls a CHECK inside the open window. */
  private scheduleBotWindowChecks(accusedSeat: number, armedAt: number, closesAt: number): void {
    const now = this.o.host.now();
    for (const p of this.state.players) {
      if (!this.o.host.isBotSeat(p.seat) || p.seat === accusedSeat) continue;
      if (!p.alive || p.left || p.abandoned) continue;
      const at = Math.min(armedAt + this.botRng.int(5, 60), closesAt - 20);
      if (at <= now) continue;
      this.arm(`bot:win:${p.seat}`, at, () => {
        const w = this.state.round?.window;
        if (
          this.state.phase === 'WINDOW' &&
          w &&
          w.accusedSeat === accusedSeat &&
          this.o.host.now() >= w.armedAt
        ) {
          this.botAct(p.seat);
        }
      });
    }
  }

  // ── match end (the E1 seam) ─────────────────────────────────────────────

  private finishMatch(effect: Extract<Effect, { kind: 'GAME_OVER' }>): void {
    if (this.matchEnded) return;
    this.matchEnded = true;

    const record = effect.record;
    const endedAt = new Date(this.o.host.now());
    const rewards = record.players.map((p) => ({
      seat: p.seat,
      ...(p.accountId ? { accountId: p.accountId } : {}),
      coins: p.stats.coinsEarned,
      xp: p.stats.xpEarned,
      unlockedTitles: [], // TODO-E1: title unlocks land with E1's grantMatchRewards
    }));

    this.o.host.emitEvent('game:over', {
      winnerSeat: effect.winnerSeat,
      matchRecord: this.buildWireMatchRecord(record),
      rewards,
    });

    const payload: MatchEndPayload = {
      record,
      roomCode: this.o.roomCode,
      seed: this.o.seed,
      log: [...this.state.log],
      endedAt,
    };
    this.o.host.onMatchEnd(payload);
  }

  /** STR/09-shaped wire record (endDate/ids coerced; accountIds always filled). */
  private buildWireMatchRecord(record: EngineMatchRecord): WireMatchRecord {
    const now = this.o.host.now();
    return {
      matchId: record.matchId ?? this.o.matchId,
      roomCode: record.roomCode ?? this.o.roomCode,
      startedAt: record.startedAt ?? now,
      endedAt: record.endedAt ?? now,
      capacity: record.capacity,
      theme: record.theme ?? this.o.theme,
      players: record.players.map((p) => ({
        accountId: p.accountId ?? `unknown:${p.seat}`,
        seat: p.seat,
        nickname: p.nickname ?? 'Player',
        avatarSpec: (p.avatarSpec as WireMatchRecord['players'][number]['avatarSpec']) ?? null,
        titleAtPlay: p.titleAtPlay ?? null,
        stats: {
          kills: p.stats.kills,
          catches: p.stats.catches,
          falseAccusations: p.stats.falseAccusations,
          bluffSuccesses: p.stats.bluffSuccesses,
          deaths: p.stats.deaths,
          ...(p.stats.deathCause ? { deathCause: p.stats.deathCause } : {}),
          pullsSurvived: p.stats.pullsSurvived,
          roundsPlayed: p.stats.roundsPlayed,
          won: p.stats.won,
          coinsEarned: p.stats.coinsEarned,
          xpEarned: p.stats.xpEarned,
        },
      })),
      summary: {
        rounds: record.summary.rounds,
        totalPulls: record.summary.totalPulls,
        dareDevilMoments: record.summary.dareDevilMoments,
      },
    };
  }

  /** Per-seat XP gains for the FINAL round:end (schema: filled on final round). */
  private buildFinalXpGains(record: EngineMatchRecord): XpGain[] {
    return record.players.map((p) => ({
      seat: p.seat,
      ...(p.accountId ? { accountId: p.accountId } : {}),
      outcome: p.stats.won ? ('win' as const) : p.stats.deaths > 0 ? ('died' as const) : ('survived' as const),
      xp: p.stats.xpEarned,
    }));
  }
}
