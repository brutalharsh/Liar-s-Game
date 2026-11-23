/** Small display formatters. */

export function formatCoins(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatInr(n: number): string {
  return `₹${n}`;
}

export function formatSeconds(totalMs: number): string {
  const s = Math.max(0, Math.round(totalMs / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Rank word for table cards: K → "KING", Q → "QUEEN", A → "ACE". */
export function rankWord(rank: string): string {
  switch (rank) {
    case "K":
      return "KING";
    case "Q":
      return "QUEEN";
    case "A":
      return "ACE";
    case "JOKER":
      return "JOKER";
    default:
      return rank;
  }
}

export function pluralClaim(rank: string, count: number): string {
  const w = rankWord(rank);
  return count === 1 ? w : `${w}S`;
}
