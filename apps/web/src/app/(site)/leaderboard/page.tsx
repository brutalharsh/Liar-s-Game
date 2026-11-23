import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Global all-time Liar's Game leaderboards — XP, wins, kills and unlocked titles. No MMR, just scars.",
};

/**
 * Public route. LeaderboardView reads ?metric=/?page= via useSearchParams,
 * which client-side-renders up to the nearest Suspense boundary (Next 16
 * prerendering contract) — the fallback keeps the shell in the initial HTML.
 */
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardFallback />}>
      <LeaderboardView />
    </Suspense>
  );
}

/** Static shell served while the URL-state leaf streams in. */
function LeaderboardFallback() {
  return (
    <div className="flex flex-col gap-6 py-8" role="status" aria-label="Loading the leaderboard">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Leaderboard</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Global · all-time · no MMR, just scars.
        </p>
      </section>
      <div className="flex justify-center gap-2" aria-hidden>
        {["w-16", "w-20", "w-16", "w-20"].map((w, i) => (
          <div key={i} className={`h-12 animate-pulse rounded-btn bg-wood-mid/60 ${w}`} />
        ))}
      </div>
      <div className="flex flex-col gap-2" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-card bg-wood-mid/60" />
        ))}
      </div>
    </div>
  );
}
