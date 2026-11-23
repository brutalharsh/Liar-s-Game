import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-wood-mid/50 px-4 py-8 pb-24 text-center lg:pb-8">
      <p className="font-display text-lg text-red-text">LIAR'S GAME</p>
      <p className="mx-auto mt-2 max-w-md font-body text-xs leading-relaxed text-ink-dim">
        An original bluffing card game. Coins are cosmetic-only and never redeemable. PG-13:
        dramatic slumps and scented candles, no gore. Not affiliated with Curve Animation's
        LIAR's BAR.
      </p>
      <nav className="mt-4 flex flex-wrap justify-center gap-4" aria-label="Footer">
        <Link
          href="/how-to-play"
          className="inline-flex min-h-12 items-center font-body text-xs text-ink-dim underline hover:text-ivory"
        >
          How to play
        </Link>
        <Link
          href="/shop"
          className="inline-flex min-h-12 items-center font-body text-xs text-ink-dim underline hover:text-ivory"
        >
          Shop
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex min-h-12 items-center font-body text-xs text-ink-dim underline hover:text-ivory"
        >
          Leaderboard
        </Link>
        <Link
          href="/settings"
          className="inline-flex min-h-12 items-center font-body text-xs text-ink-dim underline hover:text-ivory"
        >
          Settings
        </Link>
      </nav>
    </footer>
  );
}
