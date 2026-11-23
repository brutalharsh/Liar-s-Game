/**
 * RoomManager + Room — server-authoritative rooms in process memory
 * (STR/06 §4: rooms live in memory; Mongo = identity/economy only).
 * Zero client trust: seats, locks, kicks and bots are decided HERE; the
 * rules-engine (via MatchRuntime) decides all game outcomes.
 *
 * Scope per STR/02 + STR/07:
 *  - capacity 2–7 free · Big Table 8–10 gated by the HOST holding the
 *    `capacity:big-table` entitlement (Entitlement model consumed read-only,
 *    lookup shaped exactly like routes/shop.ts; kind/key pinned here —
 *    reconciliation with the shop catalog lands at the integration pass).
 *  - host controls: lock / kick / bot-fill / start. No wire events exist for
 *    lock/kick/bot in @liars-game/shared yet, so the surface is programmatic
 *    (inventing event names is banned by AGENTS.md rule 4); the router only
 *    enforces host-ness on `game:start`.
 *  - public rooms mirror write-behind to the `public_rooms` collection
 *    (TTL 600s covers staleness); `listPublicRooms()` serves the future
 *    GET /api/rooms route from the live registry.
 *  - rooms dissolve when idle (GC slot on the room's wheel), and never while
 *    a match is live.
 *
 * Reconnection: seats bind to USER IDs, not sockets. A dropped member's seat
 * is held for the engine's `disconnectGraceMs` (60s round-pause, STR/03 §3),
 * then ABANDON fires ("seat lost" — auto-play continues, drunk under the
 * table). Rejoin rides the room code (STR/07 §5: the code IS the seat
 * authority) — the client keeps it and re-sends `room:join`, which always
 * answers with a fresh full snapshot (seq catch-up per STR/07 §4).
 */
import { DEFAULT_MATCH_CONFIG, turnTimerMs } from '@liars-game/rules-engine';
import type { MatchConfig, RosterEntry } from '@liars-game/rules-engine';
import {
  generateRoomCode,
  sanitizeRoomName,
  type PlayerState,
  type PresenceUpdatePayload,
  type RoomState,
  type RoomVisibility,
  type Seat,
  type ViewPlayerState,
} from '@liars-game/shared';
import { BOT_NAMES, botAccountId, botAvatarSpec } from './bots.js';
import { MatchRuntime, wireCard } from './match.js';
import { TimerWheel } from './timers.js';
import type {
  GameDeps,
  GameTiming,
  MatchEndPayload,
  PublicRoomDoc,
  PublicRoomStore,
  RoomTransport,
} from './types.js';

export type { PublicRoomDoc, PublicRoomStore } from './types.js';

/** Free themes (STR/02: The Saloon + House Table ship free). */
export const FREE_THEMES: readonly string[] = Object.freeze(['saloon', 'house-table']);

/** Big Table entitlement pin (entitlement key shape as in routes/shop.ts). */
export const BIG_TABLE_ENTITLEMENT = Object.freeze({ kind: 'capacity', key: 'big-table' });

/** The 10 preset emotes (STR/02) — opaque, blocklist-safe slugs. */
export const EMOTE_CATALOG: readonly string[] = Object.freeze([
  'tipping-hat',
  'laugh',
  'gasp',
  'angry',
  'sweat',
  'cry',
  'cheer',
  'shush',
  'thinking',
  'wink',
]);

const MIN_CAPACITY = 2;
const MAX_CAPACITY = 10;
const FREE_MAX_CAPACITY = 7;
const CODE_MINT_ATTEMPTS = 64;
export const GRACE_KEY_PREFIX = 'grace:';
const GC_KEY = 'gc';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function okAction<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
export function errAction<T = null>(code: string, message: string): ActionResult<T> {
  return { ok: false, code, message };
}

export interface JoinOutcome {
  roomCode: string;
  spectator: boolean;
  /** Room seat in lobby, ENGINE seat during a match, null for spectators. */
  yourSeat: Seat | null;
  reconnected: boolean;
}

export interface CreateOutcome {
  roomCode: string;
  seat: Seat;
}

export interface MemberProfileLoaded {
  avatarSpec: unknown;
  activeTitle: string | null;
}

interface SeatMember {
  userId: string;
  nickname: string;
  avatarSpec: unknown;
  activeTitle: string | null;
  isBot: boolean;
  socketIds: Set<string>;
  lastEmoteAt: number;
}

export interface PublicRoomListing extends PublicRoomDoc {
  /** Live lock state for the browser lock badge (not mirrored to Mongo). */
  locked: boolean;
  hostConnected: boolean;
}

/** Resolved deps (defaults filled by ./index.ts; tests inject fakes). */
export interface ManagerDeps extends GameDeps {
  transport: RoomTransport;
  timing: Required<GameTiming>;
  sanitizeEmote(raw: string): string;
  randomInt(minInclusive: number, maxInclusive: number): number;
  randomUuid(): string;
  now(): number;
  userProfile(accountId: string): Promise<MemberProfileLoaded | null>;
}

/** Rough "est. match time" chip; heuristic, never a promise. */
export function estMatchMinutes(capacity: number, config: MatchConfig): number {
  const turnSec = Math.round(turnTimerMs(config, capacity) / 1000);
  const perRoundSec = capacity * (turnSec + 4) + 6;
  return Math.max(2, Math.ceil((3.5 * Math.max(1, capacity - 1) * perRoundSec) / 60));
}

// ─────────────────────────────────────────────────────────────────────────────
// Room
// ─────────────────────────────────────────────────────────────────────────────

class Room {
  private _seq = 0;
  private _displayName: string;
  private _lastActivity: number;
  private _hostUserId: string;
  private matchRuntime: MatchRuntime | null = null;
  /** True while a start is parked on profile loads (double-tap guard). */
  private startingMatch = false;
  /** engine seat → room seat (built at game:start; null while in lobby). */
  private engineToRoomSeat: number[] | null = null;
  /** room seat → engine seat (-1 when not seated for the match). */
  private roomToEngineSeat: number[] | null = null;

  readonly seats: (SeatMember | null)[];
  readonly wheel: TimerWheel;
  readonly createdAt: number;
  /** socket id → room seat index (spectators: -1). */
  readonly socketSeat = new Map<string, number>();
  locked = false;
  readonly capacity: number;
  readonly code: string;
  readonly theme: string;
  readonly visibility: RoomVisibility;

  constructor(
    private readonly manager: RoomManager,
    code: string,
    displayName: string,
    capacity: number,
    theme: string,
    visibility: RoomVisibility,
    hostUserId: string,
    private readonly timing: Required<GameTiming>,
  ) {
    this.code = code;
    this._displayName = displayName;
    this.capacity = capacity;
    this.theme = theme;
    this.visibility = visibility;
    this._hostUserId = hostUserId;
    this.seats = new Array<SeatMember | null>(capacity).fill(null);
    this.wheel = new TimerWheel(timing, () => manager.now());
    this.createdAt = manager.now();
    this._lastActivity = this.createdAt;
  }

  get displayName(): string {
    return this._displayName;
  }

  get hostUserId(): string {
    return this._hostUserId;
  }

  get seq(): number {
    return this._seq;
  }

  get match(): MatchRuntime | null {
    return this.matchRuntime;
  }

  get isMatchLive(): boolean {
    return this.matchRuntime !== null && !this.matchRuntime.isOver;
  }

  get lastActivity(): number {
    return this._lastActivity;
  }

  markActivity(): void {
    this._lastActivity = this.manager.now();
    this.wheel.cancel(GC_KEY);
  }

  private nextSeq(): number {
    this._seq += 1;
    return this._seq;
  }

  // ── seats ────────────────────────────────────────────────────────────────

  seatOfUser(userId: string): number {
    return this.seats.findIndex((m) => m?.userId === userId);
  }

  findSocket(socketId: string): { roomSeat: number; spectator: boolean } | null {
    const seat = this.socketSeat.get(socketId);
    if (seat === undefined) return null;
    return { roomSeat: seat, spectator: seat === -1 };
  }

  /** Removes the socket from this room's scope + reverse maps (manager-aware). */
  unbindSocket(socketId: string): void {
    const seat = this.socketSeat.get(socketId);
    if (seat === undefined) return;
    this.socketSeat.delete(socketId);
    if (seat !== -1) {
      this.seats[seat]?.socketIds.delete(socketId);
    }
    this.manager.transport.leave(socketId, this.code);
    this.manager.dropSocketRoomEntry(socketId, this.code);
  }

  seatsTaken(): number {
    return this.seats.filter((m) => m !== null).length;
  }

  lowestFreeSeat(): number {
    return this.seats.findIndex((m) => m === null);
  }

  private hasLiveSockets(): boolean {
    for (const member of this.seats) {
      if (member && !member.isBot && member.socketIds.size > 0) return true;
    }
    return [...this.socketSeat.values()].some((s) => s === -1);
  }

  // ── seat mapping (lobby room seats ↔ match engine seats) ─────────────────

  /** Engine seats = the compacted ascending order of occupied room seats at start. */
  engineSeatOf(roomSeat: number): number | null {
    return this.roomToEngineSeat ? (this.roomToEngineSeat[roomSeat] ?? -1) : null;
  }

  roomSeatOfEngine(engineSeat: number): number | null {
    return this.engineToRoomSeat ? (this.engineToRoomSeat[engineSeat] ?? null) : null;
  }

  isMember(roomSeat: number): boolean {
    return this.seats[roomSeat] != null;
  }

  seatSocketIdsByEngine(engineSeat: number): ReadonlySet<string> {
    const roomSeat = this.roomSeatOfEngine(engineSeat);
    const member = roomSeat !== null ? this.seats[roomSeat] : null;
    return member ? member.socketIds : new Set<string>();
  }

  isBotEngineSeat(engineSeat: number): boolean {
    const roomSeat = this.roomSeatOfEngine(engineSeat);
    const member = roomSeat !== null ? this.seats[roomSeat] : null;
    return member != null && member.isBot;
  }

  // ── emitters ─────────────────────────────────────────────────────────────

  emitEvent(event: string, payload: Record<string, unknown>): number {
    const seq = this.nextSeq();
    this.manager.transport.emitToRoom(this.code, event, { ...payload, seq });
    return seq;
  }

  /** SEAT-PRIVATE emission (hand:deal): stamped once, owner's sockets only. */
  emitToEngineSeat(engineSeat: number, event: string, payload: Record<string, unknown>): void {
    const roomSeat = this.roomSeatOfEngine(engineSeat);
    const member = roomSeat !== null ? this.seats[roomSeat] : null;
    if (!member || member.socketIds.size === 0) return;
    const seq = this.nextSeq();
    for (const socketId of member.socketIds) {
      this.manager.transport.emitToSocket(socketId, event, { ...payload, seq });
    }
  }

  /** Per-seat view-filtered full snapshot to every bound socket (catch-up). */
  emitSnapshotToAll(): void {
    for (const socketId of [...this.socketSeat.keys()]) {
      this.emitSnapshotToSocket(socketId);
    }
  }

  emitSnapshotToSocket(socketId: string): void {
    this.manager.transport.emitToSocket(socketId, 'lobby:state', this.buildSnapshot(socketId));
  }

  /** Full presence list (engine seats mid-match, room seats in lobby). */
  presenceSeats(): PresenceUpdatePayload['seats'] {
    const entries: { seat: Seat; connected: boolean; afk: boolean }[] = [];
    if (this.matchRuntime && this.engineToRoomSeat) {
      for (const view of this.matchRuntime.publicSnapshot().players) {
        const roomSeat = this.roomSeatOfEngine(view.seat);
        const member = roomSeat !== null ? this.seats[roomSeat] : null;
        entries.push({
          seat: view.seat,
          connected: !!member && member.socketIds.size > 0 && view.connected,
          afk: view.abandoned || !view.connected,
        });
      }
      return entries;
    }
    for (let seat = 0; seat < this.capacity; seat += 1) {
      const member = this.seats[seat];
      entries.push({
        seat,
        connected: !!member && member.socketIds.size > 0,
        afk: false,
      });
    }
    return entries;
  }

  emitPresence(): void {
    this.emitEvent('presence:update', { seats: this.presenceSeats() });
  }

  // ── snapshot (per-seat view; hands only for the viewer; never bulletPos) ──

  buildSnapshot(socketId: string | null): RoomState {
    const binding = socketId !== null ? this.socketSeat.get(socketId) : undefined;
    const hasSeat = binding !== undefined && binding !== -1;
    const roomSeat = hasSeat && binding !== undefined ? binding : null;
    const memberThisSocket = roomSeat !== null ? this.seats[roomSeat] ?? null : null;

    const match = this.matchRuntime;
    const inMatch = match !== null && this.engineToRoomSeat !== null;

    const seats: ViewPlayerState[] = [];
    let you: PlayerState | null = null;

    if (inMatch && match) {
      const viewerEngineSeat =
        memberThisSocket !== null && roomSeat !== null ? this.engineSeatOf(roomSeat) : null;
      // View-filtered through the engine's own serializer (viewer hand only).
      const pub = match.publicSnapshot(
        viewerEngineSeat !== null && viewerEngineSeat >= 0 ? viewerEngineSeat : undefined,
      );
      for (const p of pub.players) {
        const rs = this.roomSeatOfEngine(p.seat);
        const member = rs !== null ? this.seats[rs] : null;
        const isBot = member != null && member.isBot;
        const view: ViewPlayerState = {
          seat: p.seat,
          nickname: p.nickname ?? member?.nickname ?? null,
          avatarSpec: (member?.avatarSpec ?? null) as ViewPlayerState['avatarSpec'],
          connected: !!member && member.socketIds.size > 0 && p.connected,
          afk: p.abandoned || !p.connected,
          isHost: member != null && member.userId === this.hostUserId,
          handCount: p.handCount,
          pulls: p.chamber.pulls,
          alive: p.alive,
          activeTitle: member?.activeTitle ?? null,
          ...(isBot ? { isBot: true } : {}), // TODO-sync-with-shared: needs isBot in ViewPlayerStateSchema
        };
        seats.push(view);
      }
      if (memberThisSocket !== null && roomSeat !== null && viewerEngineSeat !== null) {
        const enginePlayer =
          match.engineState.players.find((p) => p.seat === viewerEngineSeat) ?? null;
        you = {
          seat: viewerEngineSeat,
          nickname: memberThisSocket.nickname,
          avatarSpec: (memberThisSocket.avatarSpec ?? null) as PlayerState['avatarSpec'],
          connected: memberThisSocket.socketIds.size > 0,
          afk: false,
          isHost: memberThisSocket.userId === this.hostUserId,
          hand: (pub.viewer?.hand ?? enginePlayer?.hand ?? []).map(
            (c: { id: string; rank: string }) => wireCard({ id: c.id, rank: c.rank as 'K' | 'Q' | 'A' | 'JOKER' }),
          ),
          handCount: pub.viewer ? pub.viewer.hand.length : enginePlayer?.hand.length ?? 0,
          pulls: enginePlayer?.pulls ?? 0,
          alive: enginePlayer?.alive ?? false,
          activeTitle: memberThisSocket.activeTitle,
          ...(memberThisSocket.isBot ? { isBot: true } : {}),
        };
      }
    } else {
      for (let seat = 0; seat < this.capacity; seat += 1) {
        const member = this.seats[seat];
        const isBot = member != null && member.isBot;
        const view: ViewPlayerState = {
          seat,
          nickname: member?.nickname ?? null,
          avatarSpec: (member?.avatarSpec ?? null) as ViewPlayerState['avatarSpec'],
          connected: !!member && member.socketIds.size > 0,
          afk: false,
          isHost: member != null && member.userId === this.hostUserId,
          handCount: 0,
          pulls: 0,
          alive: member !== null,
          activeTitle: member?.activeTitle ?? null,
          ...(isBot ? { isBot: true } : {}),
        };
        seats.push(view);
      }
      if (memberThisSocket !== null && roomSeat !== null) {
        you = {
          seat: roomSeat,
          nickname: memberThisSocket.nickname,
          avatarSpec: (memberThisSocket.avatarSpec ?? null) as PlayerState['avatarSpec'],
          connected: true,
          afk: false,
          isHost: memberThisSocket.userId === this.hostUserId,
          hand: [],
          handCount: 0,
          pulls: 0,
          alive: true,
          activeTitle: memberThisSocket.activeTitle,
          ...(memberThisSocket.isBot ? { isBot: true } : {}),
        };
      }
    }

    const state = inMatch && match ? match.engineState : null;
    const round = state?.round ?? null;
    const turn = state?.turn ?? null;
    const window = round?.window ?? null;
    const hostRoomSeat = this.seatOfUser(this.hostUserId);
    const hostWireSeat =
      hostRoomSeat === -1
        ? 0
        : inMatch
          ? this.engineSeatOf(hostRoomSeat) ?? 0
          : hostRoomSeat;

    const snapshot: Record<string, unknown> = {
      roomCode: this.code,
      name: this._displayName,
      capacity: this.capacity,
      theme: this.theme,
      visibility: this.visibility,
      phase: inMatch && match ? match.wirePhase : 'lobby',
      hostSeat: hostWireSeat,
      seats,
      you,
      spectator: !hasSeat,
      seq: this._seq,
      ...(round
        ? {
            roundNo: round.roundNo,
            tableCard: round.tableCard,
            currentTurnSeat: turn ? turn.seat : null,
            deadlineTs: turn ? turn.deadline : window ? window.closesAt : null,
            pileTotal: round.pile.reduce((sum, p) => sum + p.cards.length, 0),
            ...(window
              ? { challengeWindow: { playSeat: window.accusedSeat, closesAtTs: window.closesAt } }
              : {}),
          }
        : {}),
      estMatchMinutes: estMatchMinutes(this.capacity, this.manager.configuredMatchConfig),
    };
    return snapshot as unknown as RoomState;
  }

  // ── emote relay (ghost-lounge: dead-but-seated may emote; spectators may not) ─

  sendEmote(socketId: string, rawEmoteId: string): ActionResult<null> {
    const seat = this.socketSeat.get(socketId);
    if (seat === undefined || seat === -1) {
      return errAction('ILLEGAL_MOVE', 'spectators cannot emote');
    }
    const member = this.seats[seat];
    if (!member) return errAction('NOT_IN_ROOM', 'no seat');
    const emoteId = this.manager.deps.sanitizeEmote(rawEmoteId);
    if (!emoteId || !EMOTE_CATALOG.includes(emoteId)) {
      return errAction('VALIDATION', 'unknown emote');
    }
    const now = this.manager.now();
    if (now - member.lastEmoteAt < this.timing.emoteCooldownMs) {
      return errAction('RATE_LIMITED', 'emote cooldown');
    }
    member.lastEmoteAt = now;
    const wireSeat = this.engineSeatOf(seat) ?? seat;
    this.emitEvent('emote:broadcast', { seat: wireSeat, emoteId });
    return okAction(null);
  }

  // ── match lifecycle ──────────────────────────────────────────────────────

  async startMatch(): Promise<ActionResult<null>> {
    // `startingMatch` is set synchronously BEFORE the first await below:
    // a second game:start landing in the profile-load window bounces here
    // (isMatchLive stays false until the runtime is installed, so the old
    // guard alone let two starts through → two deals, two seeds on the wire).
    if (this.startingMatch || this.isMatchLive) {
      return errAction('ILLEGAL_MOVE', 'match already in progress');
    }
    const occupied: number[] = [];
    for (let seat = 0; seat < this.capacity; seat += 1) {
      if (this.seats[seat]) occupied.push(seat);
    }
    if (occupied.length < 2) {
      return errAction('INSUFFICIENT_PLAYERS', 'need at least 2 seated players');
    }
    // Seat membership is frozen at entry. A leave/kick/grace-expiry/bot-fill
    // or a late join that lands in an await window below makes the post-await
    // equality check abort the start instead of seating a half-roster (or
    // dereferencing a freed seat).
    const seatUserIds: (string | null)[] = this.seats.map((m) => m?.userId ?? null);

    this.startingMatch = true;
    try {
      const abortStart = (): ActionResult<null> => {
        this.engineToRoomSeat = null;
        this.roomToEngineSeat = null;
        return errAction('ILLEGAL_MOVE', 'seating changed while starting the match');
      };

      if (this.matchRuntime) this.matchRuntime.dispose();
      // Recycle match slots; seat-grace + GC timers outlive matches.
      this.wheel.cancelExcept([GRACE_KEY_PREFIX, GC_KEY]);
      this.engineToRoomSeat = occupied;
      this.roomToEngineSeat = new Array<number>(this.capacity).fill(-1);
      occupied.forEach((rs, engineSeat) => {
        this.roomToEngineSeat![rs] = engineSeat;
      });

      const roster: RosterEntry[] = [];
      const isBots: boolean[] = [];
      for (let engineSeat = 0; engineSeat < occupied.length; engineSeat += 1) {
        const rs = occupied[engineSeat]!;
        const member = this.seats[rs];
        if (!member) return abortStart(); // freed mid-await in an earlier iteration
        let avatarSpec: unknown = member.avatarSpec;
        let titleAtPlay: string | null = member.activeTitle;
        if (!member.isBot) {
          const profile = await this.manager.deps.userProfile(member.userId);
          avatarSpec = profile?.avatarSpec ?? member.avatarSpec;
          titleAtPlay = profile?.activeTitle ?? member.activeTitle;
        }
        isBots.push(member.isBot);
        roster.push({
          seat: engineSeat,
          accountId: member.userId,
          nickname: member.nickname,
          avatarSpec,
          titleAtPlay: titleAtPlay ?? undefined,
        });
      }

      // Revalidation after the last await: exact seat→user equality or no match.
      for (let seat = 0; seat < this.capacity; seat += 1) {
        if ((this.seats[seat]?.userId ?? null) !== seatUserIds[seat]) {
          return abortStart();
        }
      }

      const runtime = new MatchRuntime({
        matchId: this.manager.deps.randomUuid(),
        // Crypto-minted once per match (R1 pattern); (seed, log) replays exact.
        // node:crypto caps the range at 2^48 (exclusive max), and the port's
        // default adapter bridges inclusive->exclusive with +1 — so the safe
        // inclusive ceiling for the port is 2^48 - 2. Still 2.8e14 states.
        seed: this.manager.deps.randomInt(0, 2 ** 48 - 2),
        roster,
        isBotSeats: isBots,
        config: this.manager.configuredMatchConfig,
        roomCode: this.code,
        theme: this.theme,
        wheel: this.wheel,
        timing: this.timing,
        host: {
          emitEvent: (event, payload) => {
            this.emitEvent(event, payload);
          },
          emitToSeat: (engineSeat, event, payload) => {
            this.emitToEngineSeat(engineSeat, event, payload);
          },
          seatSocketIds: (engineSeat) => this.seatSocketIdsByEngine(engineSeat),
          isBotSeat: (engineSeat) => this.isBotEngineSeat(engineSeat),
          onPresenceChanged: () => {
            this.emitPresence();
            if (this.matchRuntime?.isOver) this.scheduleGcIfEmpty();
          },
          onMatchEnd: (payload) => {
            this.manager.handleMatchEnd(payload);
          },
          now: () => this.manager.now(),
        },
      });
      this.matchRuntime = runtime;
      runtime.start();

      // Seat-holders with zero live sockets at kickoff begin disconnected and
      // get their own grace clocks (they are still part of the fixed roster).
      // The slot is (re)armed from the ENGINE's grace deadline: it replaces
      // any lobby-era slot (armed at lobby-drop time), which would otherwise
      // fire early, get rejected by ERR_TOO_EARLY, and lose the ABANDON.
      for (let engineSeat = 0; engineSeat < occupied.length; engineSeat += 1) {
        const rs = occupied[engineSeat]!;
        const member = this.seats[rs]!;
        if (!member.isBot && member.socketIds.size === 0) {
          runtime.applyEvent({ type: 'DISCONNECT', seat: engineSeat, at: this.manager.now() });
          this.armGraceTimer(member.userId, engineSeat);
        }
      }
      return okAction(null);
    } catch {
      // A rejected profile load (or any other mid-start throw) must never
      // strand a half-started room: roll the mappings back, keep the room in
      // the lobby, and let the host simply start again.
      if (this.matchRuntime) {
        this.matchRuntime.dispose();
        this.matchRuntime = null;
      }
      this.engineToRoomSeat = null;
      this.roomToEngineSeat = null;
      return errAction('INTERNAL', 'match start failed');
    } finally {
      this.startingMatch = false;
    }
  }

  // ── disconnect grace (engine clock fields are the authority) ─────────────

  /** `seat` is an ENGINE seat mid-match, a ROOM seat otherwise. */
  armGraceTimer(userId: string, seat: number): void {
    const runtime = this.matchRuntime;
    const graceMs =
      runtime && !runtime.isOver
        ? runtime.engineState.config.disconnectGraceMs
        : this.manager.configuredMatchConfig.disconnectGraceMs;
    let at = this.manager.now() + graceMs;
    if (runtime && !runtime.isOver) {
      const engineDeadline = runtime.graceDeadline(seat);
      if (engineDeadline !== undefined) at = engineDeadline;
    }
    this.wheel.schedule(`${GRACE_KEY_PREFIX}${userId}`, at, () => {
      this.onGraceExpired(userId);
    });
  }

  cancelGraceTimer(userId: string): void {
    this.wheel.cancel(`${GRACE_KEY_PREFIX}${userId}`);
  }

  private onGraceExpired(userId: string): void {
    const roomSeat = this.seatOfUser(userId);
    if (roomSeat === -1) return;
    const member = this.seats[roomSeat];
    if (!member || member.socketIds.size > 0) return; // reconnected in time
    const runtime = this.matchRuntime;
    if (runtime && !runtime.isOver) {
      const engineSeat = this.engineSeatOf(roomSeat);
      if (engineSeat === null || engineSeat < 0) return;
      runtime.applyEvent({ type: 'ABANDON', seat: engineSeat, at: this.manager.now() });
      runtime.rearmAfterPresence(); // seat lost → resume auto-play pacing
    } else {
      this.freeSeat(roomSeat, true);
      return; // freeSeat broadcast + mirror + gc
    }
    this.manager.mirrorRoom(this);
  }

  /** Frees a lobby seat (grace expiry or lobby removal), promoting a new host if needed. */
  freeSeat(roomSeat: number, broadcast: boolean): void {
    const member = this.seats[roomSeat];
    if (!member) return;
    this.cancelGraceTimer(member.userId);
    for (const socketId of [...member.socketIds]) {
      this.unbindSocket(socketId);
    }
    this.seats[roomSeat] = null;
    if (member.userId === this.hostUserId) {
      const nextHost = this.seats.find((cand) => cand !== null);
      if (nextHost) this._hostUserId = nextHost.userId;
    }
    if (broadcast) {
      this.emitSnapshotToAll();
      this.manager.mirrorRoom(this);
      this.scheduleGcIfEmpty();
    }
  }

  /**
   * Fresh-seat sitter claims host when the room has NO seated host at all.
   * A lobby grace cascade can free every seat — promotion passing through
   * doomed members (their own slots expire moments later) used to leave the
   * room pointing at a departed host → NOT_HOST forever, an unstartable room.
   */
  claimHostIfVacant(userId: string): void {
    if (this.seatOfUser(this.hostUserId) === -1) this._hostUserId = userId;
  }

  // ── host controls ────────────────────────────────────────────────────────

  /** Mid-match kick = engine LEAVE (seat lost, identical wire path to a quit). */
  kickSeat(actorUserId: string, roomSeat: number): ActionResult<null> {
    if (actorUserId !== this.hostUserId) return errAction('NOT_HOST', 'only the host can kick');
    const member = this.seats[roomSeat];
    if (!member) return errAction('NOT_IN_ROOM', 'no such seat');
    if (member.userId === this.hostUserId) return errAction('NOT_HOST', 'host cannot be kicked');
    const runtime = this.matchRuntime;
    if (runtime && !runtime.isOver) {
      const engineSeat = this.engineSeatOf(roomSeat);
      if (engineSeat === null) return errAction('NOT_IN_ROOM', 'seat is not in the match');
      runtime.applyEvent({ type: 'LEAVE', seat: engineSeat, at: this.manager.now() });
      runtime.rearmAfterPresence();
      this.cancelGraceTimer(member.userId);
      for (const socketId of [...member.socketIds]) {
        this.unbindSocket(socketId);
      }
    } else {
      this.freeSeat(roomSeat, false);
    }
    this.emitSnapshotToAll();
    this.manager.mirrorRoom(this);
    this.scheduleGcIfEmpty();
    return okAction(null);
  }

  addBot(actorUserId: string): ActionResult<{ seat: number }> {
    if (actorUserId !== this.hostUserId) return errAction('NOT_HOST', 'only the host can add bots');
    if (this.isMatchLive) return errAction('ILLEGAL_MOVE', 'bots can only be added in the lobby');
    const seat = this.lowestFreeSeat();
    if (seat === -1) return errAction('ROOM_FULL', 'no free seat');
    this.seats[seat] = {
      userId: botAccountId(this.code, seat),
      nickname: BOT_NAMES[seat % BOT_NAMES.length] ?? 'Rusty',
      avatarSpec: botAvatarSpec(),
      activeTitle: null,
      isBot: true,
      socketIds: new Set<string>(),
      lastEmoteAt: 0,
    };
    this.emitSnapshotToAll();
    this.manager.mirrorRoom(this);
    return okAction({ seat });
  }

  removeBot(actorUserId: string, roomSeat: number): ActionResult<null> {
    if (actorUserId !== this.hostUserId) return errAction('NOT_HOST', 'only the host can remove bots');
    const member = this.seats[roomSeat];
    if (!member || !member.isBot) return errAction('NOT_IN_ROOM', 'no bot on that seat');
    this.freeSeat(roomSeat, false);
    this.emitSnapshotToAll();
    this.manager.mirrorRoom(this);
    this.scheduleGcIfEmpty();
    return okAction(null);
  }

  setLocked(actorUserId: string, locked: boolean): ActionResult<null> {
    if (actorUserId !== this.hostUserId) return errAction('NOT_HOST', 'only the host can lock');
    this.locked = locked;
    this.emitSnapshotToAll();
    return okAction(null);
  }

  // ── GC ───────────────────────────────────────────────────────────────────

  scheduleGcIfEmpty(): void {
    if (this.hasLiveSockets()) return;
    // Never reap a live match (bot-only zombie matches run to their record).
    const sweep = (): void => {
      if (this.isMatchLive) {
        this.wheel.schedule(GC_KEY, this.manager.now() + 30_000, sweep);
        return;
      }
      this.manager.closeRoom(this.code);
    };
    this.wheel.schedule(GC_KEY, this.manager.now() + this.timing.idleGcMs, sweep);
  }

  close(): void {
    this.wheel.cancelAll();
    for (const socketId of [...this.socketSeat.keys()]) {
      this.unbindSocket(socketId);
    }
    this.matchRuntime?.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomManager
// ─────────────────────────────────────────────────────────────────────────────

export class RoomManager {
  readonly transport: RoomTransport;
  readonly deps: ManagerDeps;
  readonly configuredMatchConfig: MatchConfig;
  private readonly rooms = new Map<string, Room>();
  private readonly socketRoom = new Map<string, string>();
  private readonly joinAttempts = new Map<string, number[]>();
  private readonly matchListeners = new Set<(payload: MatchEndPayload) => void>();

  constructor(deps: ManagerDeps) {
    this.deps = deps;
    this.transport = deps.transport;
    this.configuredMatchConfig = { ...DEFAULT_MATCH_CONFIG, ...deps.matchConfig };
  }

  now(): number {
    return this.deps.now();
  }

  handleMatchEnd(payload: MatchEndPayload): void {
    // Seam isolation: a hook that THROWS synchronously (instead of returning
    // a rejected promise) must not blow up the game:over wire path from inside
    // the wheel callback — both failure flavors are swallowed here.
    try {
      const viaDeps = this.deps.onMatchEnd?.(payload);
      if (viaDeps instanceof Promise) viaDeps.catch(() => undefined);
    } catch {
      /* the economy's own retry path owns persistence; play must continue */
    }
    for (const fn of this.matchListeners) fn(payload);
  }

  addMatchEndListener(fn: (payload: MatchEndPayload) => void): void {
    this.matchListeners.add(fn);
  }

  // ── creation ─────────────────────────────────────────────────────────────

  async createRoom(input: {
    userId: string;
    nickname: string;
    name: string;
    capacity: number;
    theme: string;
    visibility: RoomVisibility;
    socketId: string;
  }): Promise<ActionResult<CreateOutcome>> {
    const capacity = Math.floor(input.capacity);
    if (capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
      return errAction('VALIDATION', 'capacity must be 2..10');
    }
    if (capacity > FREE_MAX_CAPACITY) {
      // Big Table 8–10: HOST entitlement gate (read-only Entitlement lookup).
      const gate = this.deps.hasEntitlement;
      const entitled =
        gate !== undefined &&
        (await gate(input.userId, BIG_TABLE_ENTITLEMENT.kind, BIG_TABLE_ENTITLEMENT.key));
      if (!entitled) {
        return errAction('ILLEGAL_MOVE', 'Big Table capacity requires the big-table entitlement');
      }
    }

    const themeAllowed =
      FREE_THEMES.includes(input.theme) ||
      (this.deps.hasEntitlement !== undefined &&
        (await this.deps.hasEntitlement(input.userId, 'theme', input.theme)));
    if (!themeAllowed) {
      return errAction('ILLEGAL_MOVE', 'theme not available to you');
    }

    const name = sanitizeRoomName(input.name) || 'Saloon Table';
    const code = this.mintCode();

    const room = new Room(
      this,
      code,
      name,
      capacity,
      input.theme,
      input.visibility,
      input.userId,
      this.deps.timing,
    );
    this.rooms.set(code, room);
    room.seats[0] = {
      userId: input.userId,
      nickname: sanitizeRoomName(input.nickname) || 'Player',
      avatarSpec: null,
      activeTitle: null,
      isBot: false,
      socketIds: new Set<string>(),
      lastEmoteAt: 0,
    };
    if (!this.bindSocketToSeat(room, input.socketId, 0)) {
      this.rooms.delete(code);
      return errAction('INTERNAL', 'failed to bind host socket');
    }
    room.markActivity();
    this.mirrorRoom(room);
    return okAction({ roomCode: code, seat: 0 });
  }

  /** 5-char code from the shared 31-char alphabet with collision retry. */
  private mintCode(): string {
    for (let i = 0; i < CODE_MINT_ATTEMPTS; i += 1) {
      // shared's RandomBelow is exclusive-bound; deps.randomInt is inclusive.
      const code = generateRoomCode((maxExclusive) => this.deps.randomInt(0, maxExclusive - 1));
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('room code space exhausted');
  }

  // ── membership ───────────────────────────────────────────────────────────

  private bindSocketToSeat(room: Room, socketId: string, roomSeat: number): boolean {
    const member = room.seats[roomSeat];
    if (!member) return false;
    this.detachSocketFromCurrentRoom(socketId);
    member.socketIds.add(socketId);
    room.socketSeat.set(socketId, roomSeat);
    this.socketRoom.set(socketId, room.code);
    this.transport.join(socketId, room.code);
    room.markActivity();
    return true;
  }

  private bindSpectator(room: Room, socketId: string): void {
    this.detachSocketFromCurrentRoom(socketId);
    room.socketSeat.set(socketId, -1);
    this.socketRoom.set(socketId, room.code);
    this.transport.join(socketId, room.code);
    room.markActivity();
  }

  private detachSocketFromCurrentRoom(socketId: string): void {
    const priorCode = this.socketRoom.get(socketId);
    if (priorCode === undefined) return;
    const priorRoom = this.rooms.get(priorCode);
    priorRoom?.unbindSocket(socketId);
    // The vacated room may have just lost its last live socket in this rebind
    // (e.g. a second room:create from the same socket) — nothing else in the
    // rebind path arms its idle GC, so it must happen here or the room leaks.
    priorRoom?.scheduleGcIfEmpty();
  }

  /** Called by rooms when they drop a socket (reverse-map hygiene). */
  dropSocketRoomEntry(socketId: string, code: string): void {
    if (this.socketRoom.get(socketId) === code) this.socketRoom.delete(socketId);
  }

  /** STR/07 §5: 10 join attempts / IP / window (null disables — tests). */
  joinAttemptAllowed(address: string | null): boolean {
    const limit = this.deps.joinRateLimit;
    if (!limit) return true;
    const key = address ?? 'unknown';
    const now = this.now();
    const bucket = (this.joinAttempts.get(key) ?? []).filter((t) => now - t < limit.windowMs);
    bucket.push(now);
    this.joinAttempts.set(key, bucket);
    return bucket.length <= limit.limit;
  }

  async joinRoom(input: {
    userId: string;
    nickname: string;
    socketId: string;
    code: string;
    address: string | null;
  }): Promise<ActionResult<JoinOutcome>> {
    if (!this.joinAttemptAllowed(input.address)) {
      return errAction('RATE_LIMITED', 'too many join attempts');
    }
    const room = this.rooms.get(input.code);
    if (!room) return errAction('ROOM_NOT_FOUND', 'no such room');

    // Reconnect first: seats bind to USER IDs — a known member always lands.
    const existingSeat = room.seatOfUser(input.userId);
    if (existingSeat !== -1) {
      if (this.bindSocketToSeat(room, input.socketId, existingSeat)) {
        const runtime = room.match;
        const engineSeat = room.engineSeatOf(existingSeat);
        if (runtime && !runtime.isOver && runtime.engineState.phase !== 'LOBBY' && engineSeat !== null) {
          const player = runtime.engineState.players.find((p) => p.seat === engineSeat);
          if (player && player.disconnectedAt !== undefined) {
            runtime.applyEvent({ type: 'RECONNECT', seat: engineSeat, at: this.now() });
            runtime.rearmAfterPresence();
          }
        }
        room.cancelGraceTimer(input.userId);
        room.emitSnapshotToAll();
        return okAction({
          roomCode: room.code,
          spectator: false,
          yourSeat: engineSeat !== null && engineSeat >= 0 ? engineSeat : existingSeat,
          reconnected: true,
        });
      }
      return errAction('INTERNAL', 'failed to bind socket');
    }

    const canSeat = !room.locked && !room.isMatchLive && room.lowestFreeSeat() !== -1;
    if (canSeat) {
      const seat = room.lowestFreeSeat();
      room.seats[seat] = {
        userId: input.userId,
        nickname: sanitizeRoomName(input.nickname) || 'Player',
        avatarSpec: null,
        activeTitle: null,
        isBot: false,
        socketIds: new Set<string>(),
        lastEmoteAt: 0,
      };
      // Host vacancy self-heals at the next fresh seat (see claimHostIfVacant).
      room.claimHostIfVacant(input.userId);
      if (this.bindSocketToSeat(room, input.socketId, seat)) {
        room.emitSnapshotToAll();
        this.mirrorRoom(room);
        return okAction({
          roomCode: room.code,
          spectator: false,
          yourSeat: seat,
          reconnected: false,
        });
      }
      return errAction('INTERNAL', 'failed to bind socket');
    }
    this.bindSpectator(room, input.socketId);
    room.emitSnapshotToSocket(input.socketId);
    return okAction({ roomCode: room.code, spectator: true, yourSeat: null, reconnected: false });
  }

  /** Voluntary `room:leave` — lobby frees the seat; mid-match = engine LEAVE. */
  leaveSocket(socketId: string, userId: string | null): ActionResult<null> {
    const room = this.roomOfSocket(socketId);
    if (!room) return errAction('NOT_IN_ROOM', 'you are not in a room');
    const bound = room.findSocket(socketId);
    if (!bound) return errAction('NOT_IN_ROOM', 'you are not in a room');
    if (bound.spectator) {
      room.unbindSocket(socketId);
      room.scheduleGcIfEmpty();
      return okAction(null);
    }
    const member = room.seats[bound.roomSeat];
    room.unbindSocket(socketId);
    if (member) {
      room.cancelGraceTimer(member.userId);
      if (room.isMatchLive) {
        const engineSeat = room.engineSeatOf(bound.roomSeat);
        const runtime = room.match;
        if (runtime && engineSeat !== null) {
          runtime.applyEvent({ type: 'LEAVE', seat: engineSeat, at: this.now() });
          runtime.rearmAfterPresence();
        }
      } else {
        room.freeSeat(bound.roomSeat, false);
      }
    }
    room.emitSnapshotToAll();
    this.mirrorRoom(room);
    room.scheduleGcIfEmpty();
    return okAction(null);
  }

  /** Transport drop (network) — grace clock, NOT an immediate seat loss. */
  socketDisconnected(socketId: string): void {
    const room = this.roomOfSocket(socketId);
    if (!room) return;
    const bound = room.findSocket(socketId);
    room.unbindSocket(socketId);
    if (!bound || bound.spectator) {
      room.scheduleGcIfEmpty();
      return;
    }
    const member = room.seats[bound.roomSeat];
    if (!member) {
      room.scheduleGcIfEmpty();
      return;
    }
    if (member.socketIds.size > 0) {
      return; // another device still holds the seat — no presence change
    }
    if (room.isMatchLive) {
      const engineSeat = room.engineSeatOf(bound.roomSeat);
      const runtime = room.match;
      if (runtime && engineSeat !== null) {
        runtime.applyEvent({ type: 'DISCONNECT', seat: engineSeat, at: this.now() });
        room.armGraceTimer(member.userId, engineSeat);
      }
    } else {
      room.armGraceTimer(member.userId, bound.roomSeat);
    }
    room.scheduleGcIfEmpty();
  }

  roomOfSocket(socketId: string): Room | null {
    const code = this.socketRoom.get(socketId);
    return code !== undefined ? this.rooms.get(code) ?? null : null;
  }

  /** Direct error emission to one socket (user-safe; seq = room counter). */
  emitError(socketId: string, code: string, message: string, eventRef: string): void {
    const room = this.roomOfSocket(socketId);
    const seq = room ? room.seq : 0;
    this.transport.emitToSocket(socketId, 'error', { seq, code, message, eventRef });
  }

  roomOfUser(userId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.seatOfUser(userId) !== -1) return room;
    }
    return null;
  }

  roomByCode(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  // ── game flow ────────────────────────────────────────────────────────────

  async startMatch(userId: string): Promise<ActionResult<{ started: boolean }>> {
    const room = this.roomOfUser(userId);
    if (!room || userId !== room.hostUserId) {
      return errAction('NOT_HOST', 'only the host can start the match');
    }
    if (room.seatOfUser(userId) === -1) return errAction('NOT_IN_ROOM', 'spectators cannot start');
    const res = await room.startMatch();
    if (!res.ok) return errAction(res.code, res.message);
    return okAction({ started: true });
  }

  private seatForAction(socketId: string): { room: Room; engineSeat: number } | null {
    const room = this.roomOfSocket(socketId);
    if (!room) return null;
    const bound = room.findSocket(socketId);
    if (!bound || bound.spectator) return null;
    if (!room.isMatchLive) return null;
    const engineSeat = room.engineSeatOf(bound.roomSeat);
    if (engineSeat === null || engineSeat < 0) return null;
    return { room, engineSeat };
  }

  playCards(socketId: string, cardIds: string[]): ActionResult<{ seq: number }> {
    const target = this.seatForAction(socketId);
    if (!target) return errAction('NOT_IN_ROOM', 'you have no seat in a live match');
    const res = target.room.match!.applyEvent({
      type: 'PLAY',
      seat: target.engineSeat,
      cardIds,
      at: this.now(),
    });
    if (res.err) return errAction(res.err.code, res.err.message);
    return okAction({ seq: target.room.seq });
  }

  callLiar(socketId: string, accusedSeat: number): ActionResult<{ seq: number }> {
    const target = this.seatForAction(socketId);
    if (!target) return errAction('NOT_IN_ROOM', 'you have no seat in a live match');
    const res = target.room.match!.applyEvent({
      type: 'LIAR',
      seat: target.engineSeat,
      accusedSeat,
      at: this.now(),
    });
    if (res.err) return errAction(res.err.code, res.err.message);
    return okAction({ seq: target.room.seq });
  }

  sendEmote(socketId: string, emoteId: string): ActionResult<null> {
    const room = this.roomOfSocket(socketId);
    if (!room) return errAction('NOT_IN_ROOM', 'you are not in a room');
    return room.sendEmote(socketId, emoteId);
  }

  ttsSay(socketId: string, phraseId: string): ActionResult<null> {
    // TTS is client-local (STR/07 §1) — no audio EVER travels the wire.
    // Validate presence of a seat so the surface stays symmetric, then no-op.
    const room = this.roomOfSocket(socketId);
    if (!room) return errAction('NOT_IN_ROOM', 'you are not in a room');
    const bound = room.findSocket(socketId);
    if (!bound || bound.spectator) return errAction('ILLEGAL_MOVE', 'spectators cannot speak');
    if (phraseId.length === 0) return errAction('VALIDATION', 'empty phrase');
    return okAction(null);
  }

  // ── host controls (programmatic; wire events land with shared schema work) ─

  lockRoom(userId: string, locked: boolean): ActionResult<null> {
    const room = this.roomOfUser(userId);
    if (!room || userId !== room.hostUserId) return errAction('NOT_HOST', 'only the host can lock');
    return room.setLocked(userId, locked);
  }

  /** `seat` speaks the wire: engine seat mid-match, room seat in lobby. */
  kickSeat(userId: string, seat: number): ActionResult<null> {
    const room = this.roomOfUser(userId);
    if (!room || userId !== room.hostUserId) return errAction('NOT_HOST', 'only the host can kick');
    const roomSeat = room.isMatchLive ? room.roomSeatOfEngine(seat) : seat;
    if (roomSeat === null || !room.isMember(roomSeat)) {
      return errAction('NOT_IN_ROOM', 'no such seat');
    }
    return room.kickSeat(userId, roomSeat);
  }

  addBotToRoom(userId: string): ActionResult<{ seat: number }> {
    const room = this.roomOfUser(userId);
    if (!room || userId !== room.hostUserId) return errAction('NOT_HOST', 'only the host can add bots');
    return room.addBot(userId);
  }

  removeBotFromRoom(userId: string, seat: number): ActionResult<null> {
    const room = this.roomOfUser(userId);
    if (!room || userId !== room.hostUserId) return errAction('NOT_HOST', 'only the host can remove bots');
    if (room.isMatchLive) return errAction('ILLEGAL_MOVE', 'bots cannot be removed mid-match');
    if (!room.isMember(seat)) return errAction('NOT_IN_ROOM', 'no such seat');
    return room.removeBot(userId, seat);
  }

  // ── mirror + GC ──────────────────────────────────────────────────────────

  /** Write-behind public_rooms mirror (TTL 600s; failures never block play). */
  mirrorRoom(room: Room): void {
    const store: PublicRoomStore | undefined = this.deps.publicRoomStore;
    if (!store) return;
    if (room.visibility !== 'public') {
      if (room.code) store.remove(room.code).catch(() => undefined);
      return;
    }
    const hostSeat = room.seatOfUser(room.hostUserId);
    const hostNickname = hostSeat !== -1 ? room.seats[hostSeat]?.nickname ?? 'Host' : 'Host';
    const doc: PublicRoomDoc = {
      roomCode: room.code,
      name: room.displayName,
      hostNickname,
      theme: room.theme,
      capacity: room.capacity,
      seatsTaken: room.seatsTaken(),
      visibility: room.visibility,
    };
    store.upsert(doc).catch(() => undefined);
  }

  listPublicRooms(): PublicRoomListing[] {
    const out: PublicRoomListing[] = [];
    for (const room of this.rooms.values()) {
      if (room.visibility !== 'public') continue;
      const hostSeat = room.seatOfUser(room.hostUserId);
      const hostMember = hostSeat !== -1 ? room.seats[hostSeat] : null;
      out.push({
        roomCode: room.code,
        name: room.displayName,
        hostNickname: hostMember?.nickname ?? 'Host',
        theme: room.theme,
        capacity: room.capacity,
        seatsTaken: room.seatsTaken(),
        visibility: room.visibility,
        locked: room.locked,
        hostConnected: hostMember != null && hostMember.socketIds.size > 0,
      });
    }
    return out;
  }

  closeRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.close();
    this.rooms.delete(code);
    const store = this.deps.publicRoomStore;
    if (store) store.remove(code).catch(() => undefined);
  }

  /** Dissolves every room (server shutdown / test teardown). */
  closeAll(): void {
    for (const code of [...this.rooms.keys()]) {
      this.closeRoom(code);
    }
  }

  get roomCount(): number {
    return this.rooms.size;
  }
}
