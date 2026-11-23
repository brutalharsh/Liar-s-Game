"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console so dev/QA can correlate with the store log
    console.error("[liars-web] render error:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🃏💦
      </span>
      <h1 className="font-display text-3xl text-ivory">The deck hit the fan</h1>
      <p className="max-w-sm font-body text-sm text-ink-dim">
        Something broke on our side of the table. The dealer is picking the cards back up.
      </p>
      <button
        onClick={reset}
        className="flex min-h-12 items-center rounded-btn border-2 border-brass bg-brass px-5 font-display text-wood-deep"
      >
        DEAL ME IN AGAIN
      </button>
    </main>
  );
}
