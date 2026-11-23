import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-8xl text-brass">404</p>
      <h1 className="font-display text-3xl text-ivory">This table doesn't exist</h1>
      <p className="max-w-sm font-body text-sm text-ink-dim">
        Either the room emptied out and expired, or the code took a bullet. Grab a fresh seat.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-btn border-2 border-brass bg-brass px-5 font-display text-wood-deep"
        >
          BACK TO THE BAR
        </Link>
        <Link
          href="/join"
          className="flex min-h-12 items-center rounded-btn border-2 border-ink-dim/70 px-5 font-display text-ivory hover:border-brass hover:text-brass"
        >
          JOIN WITH CODE
        </Link>
      </div>
    </main>
  );
}
