import type { AvatarSpec } from "@/lib/wire";
import { seededRng } from "@/lib/mock/rng";

/** Standing cast of mock players (names borrowed from research/09 wireframes). */
export interface MockPlayer {
  id: string;
  nickname: string;
  avatar: AvatarSpec;
}

export const MOCK_PLAYERS: readonly MockPlayer[] = [
  { id: "p-scubb", nickname: "SCUBB", avatar: { base: "raccoon", hat: "hat:cowboy" } },
  { id: "p-sue", nickname: "SUE", avatar: { base: "owl", glasses: "glasses:round" } },
  { id: "p-toar", nickname: "TOAR", avatar: { base: "wolf" } },
  { id: "p-fox", nickname: "FOX", avatar: { base: "fox" } },
  { id: "p-bris", nickname: "BRIS", avatar: { base: "bear", hat: "hat:bowler" } },
  { id: "p-migo", nickname: "MIGO", avatar: { base: "deer" } },
  { id: "p-lblanc", nickname: "LBLANC", avatar: { base: "gator" } },
  { id: "p-rex", nickname: "REX", avatar: { base: "boar" } },
  { id: "p-mia", nickname: "MIA", avatar: { base: "cat", glasses: "glasses:monocle" } },
] as const;

export function extraPlayer(seed: string): MockPlayer {
  const rng = seededRng("extra:" + seed);
  const pool = MOCK_PLAYERS;
  const pickIdx = Math.floor(rng() * pool.length);
  const base = pool[Math.min(pickIdx, pool.length - 1)] as MockPlayer;
  const n = Math.floor(rng() * 900 + 100);
  return { ...base, id: `${base.id}-b${n}`, nickname: `${base.nickname}-${n}` };
}

/** Staggered lobby join schedule for the mock adapter. */
export const LOBBY_JOIN_PLAN: readonly { player: MockPlayer; atMs: number }[] = [
  { player: MOCK_PLAYERS[1] as MockPlayer, atMs: 2600 }, // SUE
  { player: MOCK_PLAYERS[2] as MockPlayer, atMs: 5400 }, // TOAR
  { player: MOCK_PLAYERS[3] as MockPlayer, atMs: 8600 }, // FOX
  { player: MOCK_PLAYERS[4] as MockPlayer, atMs: 12200 }, // BRIS
] as const;
