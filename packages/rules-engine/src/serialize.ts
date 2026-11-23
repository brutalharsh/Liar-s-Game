/**
 * Public view serializer — STR/07 §3 (the anti-cheat view-filtering table).
 *
 * INVARIANT: the serialized snapshot NEVER contains `bulletPos` (chamber index
 * of the live round — hidden from EVERYONE incl. the owner), other players'
 * hand ranks, the undealt cards' faces, or staged selections. Own hand is
 * included only for the requested viewer. Pile shows counts only.
 */
import type { Card, GameState, Phase, PlayerState, TableRank } from './types';

/** The public `(pulled/6)` chamber badge (R23). */
export interface ChamberBadge {
  pulls: number;
  chambers: 6;
  fatalNext: boolean;
}

/** bulletPos is intentionally absent. */
export function chamberBadge(p: PlayerState): ChamberBadge {
  return {
    pulls: p.pulls,
    chambers: 6,
    fatalNext: p.pulls >= 5 && p.alive, // (5/6): next loss is fatal
  };
}

export interface PublicPlayerView {
  seat: number;
  nickname?: string;
  accountId?: string;
  alive: boolean;
  connected: boolean;
  abandoned: boolean;
  left: boolean;
  /** Hand SIZE is public (R12); hand faces are not. */
  handCount: number;
  chamber: ChamberBadge;
}

export interface PublicSnapshot {
  phase: Phase;
  roundNo: number | null;
  tableCard: TableRank | null;
  /** Face-down pile: per-play counts only. */
  pile: { seat: number; count: number }[];
  deckSize: number | null;
  leftoverCount: number | null;
  turn: { seat: number; deadline: number } | null;
  window: { accusedSeat: number; openedAt: number; armedAt: number; closesAt: number } | null;
  players: PublicPlayerView[];
  winnerSeat: number | null;
  aborted: boolean;
  /** Present iff `viewerSeat` is a seated living player. */
  viewer: { seat: number; hand: Card[] } | null;
}

export function toPublicSnapshot(s: GameState, viewerSeat?: number): PublicSnapshot {
  const round = s.round;
  const viewer =
    viewerSeat !== undefined && s.players.some((p) => p.seat === viewerSeat && p.alive)
      ? {
          seat: viewerSeat,
          hand: s.players.find((p) => p.seat === viewerSeat)?.hand ?? [],
        }
      : null;

  const pileCount = (round?.pile ?? []).reduce((n, pl) => n + pl.cards.length, 0);
  const heldCount = s.players
    .filter((p) => p.alive)
    .reduce((n, p) => n + p.hand.length, 0);
  const deckSize = round ? round.leftover.length + pileCount + heldCount : null;

  return {
    phase: s.phase,
    roundNo: round?.roundNo ?? null,
    tableCard: round?.tableCard ?? null,
    pile: (round?.pile ?? []).map((pl) => ({ seat: pl.seat, count: pl.cards.length })),
    deckSize,
    leftoverCount: round?.leftover.length ?? null,
    turn: s.turn ? { seat: s.turn.seat, deadline: s.turn.deadline } : null,
    window: round?.window
      ? {
          accusedSeat: round.window.accusedSeat,
          openedAt: round.window.openedAt,
          armedAt: round.window.armedAt,
          closesAt: round.window.closesAt,
        }
      : null,
    players: s.players.map((p) => ({
      seat: p.seat,
      nickname: p.nickname,
      accountId: p.accountId,
      alive: p.alive,
      connected: p.disconnectedAt === undefined && !p.left,
      abandoned: p.abandoned,
      left: p.left,
      handCount: p.hand.length,
      chamber: chamberBadge(p),
    })),
    winnerSeat: s.winnerSeat,
    aborted: s.aborted,
    viewer,
  };
}
