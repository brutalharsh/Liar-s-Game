/**
 * @liars-game/rules-engine — public API surface (consumed by S1 `apps/server`).
 *
 * Zero IO. Everything else is internal; nothing here touches sockets, fs,
 * zod, or `Math.random` in game paths (RNG flows through the injected port).
 */
export * from './types';
export { NodeCryptoRng, SeededRng, fisherYatesShuffle, type RngPort, type IntFn } from './rng';
export {
  buildDeck,
  containsLie,
  dealHands,
  deckModulesFor,
  HAND_SIZE,
  isTruth,
  tableDeckRanks,
} from './deck';
export { apply, cloneState, createMatch, type CreateMatchOptions } from './engine';
export {
  alivePlayers,
  computeNextStarter,
  finishMatch,
  holders,
  isMatchLive,
  logEnvelope,
  nextHolderCcw,
  nextLivingCcw,
  presentAlivePlayers,
  seatOf,
  startRound,
} from './round';
export { replay, stripRuntime, type ReplayOptions, type ReplayResult } from './replay';
export { chamberBadge, toPublicSnapshot, type ChamberBadge, type PublicPlayerView, type PublicSnapshot } from './serialize';
