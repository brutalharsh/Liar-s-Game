/**
 * Display helpers shared by the profile + leaderboard views (W3 wiring wave).
 * Pure formatting — nothing here fetches or holds state.
 *
 * `titleLabel` accepts BOTH shapes in play today: E1's server stores title ids
 * (e.g. "cat-with-nine-lives") while W1's mock registry used "nine-lives" ids
 * or plain display names. Unknown values pass through verbatim so the real
 * backend never renders an empty chip. (Reconcile the registries at the
 * integration pass — flagged in the W3 report.)
 */
import { titleName } from "@/lib/mock/titles";

/** E1's real title ids that W1's registry spells differently. */
const TITLE_ID_ALIASES: Record<string, string> = {
  "cat-with-nine-lives": "Cat With Nine Lives",
  "house-wins": "The House Always Wins",
};

export function titleLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return titleName(raw) ?? TITLE_ID_ALIASES[raw] ?? raw;
}

/** "2 min ago" / "5h ago" / "3d ago" / "12 Nov" — client-relative, so it only
 * renders inside post-fetch client views (never during SSR prerender). */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 45_000) return "just now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "Sitting here since Nov 2026" — month + year only. */
export function memberSince(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
