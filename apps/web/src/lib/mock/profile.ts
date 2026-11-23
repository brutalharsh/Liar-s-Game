/**
 * Mock viewer profile (mirrors GET /api/me). Real wallet/XP never originates
 * on the client (STR/06 §3 — clients are dumb terminals).
 */

export interface MockMatchHistory {
  id: string;
  result: "won" | "survived" | "died";
  round: number;
  opponents: string[];
  kills: number;
  xp: number;
  coins: number;
}

export interface MockProfile {
  nickname: string;
  level: number;
  xp: number;
  nextLevelXp: number; // mock threshold — TODO-sync-with-shared (real curve per STR/04 §5)
  kills: number;
  catches: number;
  wins: number;
  matches: number;
  deaths: number;
  pullsSurvived: number;
  falseAccusations: number;
  unlockedTitles: string[];
  matchHistory: MockMatchHistory[];
}

export const MOCK_PROFILE: MockProfile = {
  nickname: "YOU",
  level: 7,
  xp: 3000,
  nextLevelXp: 4200,
  kills: 23,
  catches: 12,
  wins: 4,
  matches: 37,
  deaths: 9,
  pullsSurvived: 11,
  falseAccusations: 2,
  unlockedTitles: ["regular", "sharp-eye", "dead-eye", "honest-fool", "chicken-dinner"],
  matchHistory: [
    { id: "m-32", result: "won", round: 6, opponents: ["SUE", "FOX", "MIGO"], kills: 2, xp: 12, coins: 9 },
    { id: "m-31", result: "survived", round: 5, opponents: ["TOAR", "BRIS"], kills: 1, xp: 6, coins: 5 },
    { id: "m-30", result: "died", round: 2, opponents: ["SCUBB", "SUE", "REX"], kills: 0, xp: 4, coins: 2 },
    { id: "m-29", result: "survived", round: 4, opponents: ["MIGO", "MIA"], kills: 1, xp: 6, coins: 4 },
    { id: "m-28", result: "died", round: 3, opponents: ["FOX", "LBLANC", "GUS"], kills: 3, xp: 4, coins: 3 },
  ],
};

export const MOCK_WALLET = {
  startingCoins: 1250,
};
