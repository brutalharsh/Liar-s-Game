"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/AsyncSection";
import { useAuthStore } from "@/store/auth-store";

/**
 * Gate for routes that need a signed-in player (STR/02: login required to
 * play). unknown → skeleton, guest → sign-in CTA, authed → children.
 * Public pages (rooms browser, leaderboard, how-to-play, landing) never mount it.
 */
export function AuthGate({ next, children }: { next?: string; children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const pathname = usePathname();

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  if (status === "unknown") {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4" role="status" aria-label="Checking your seat">
        {error ? (
          <>
            <p className="font-body text-sm text-ink-dim">{error}</p>
            <Button variant="outline" onClick={() => void fetchMe(true)}>
              TRY AGAIN
            </Button>
          </>
        ) : (
          <>
            <span className="text-4xl" aria-hidden>
              🎩
            </span>
            <Skeleton className="h-4 w-48" />
            <p className="font-body text-xs text-ink-dim">Checking your seat at the table…</p>
          </>
        )}
      </div>
    );
  }

  if (status === "guest") {
    return <SignInWall next={next ?? pathname} />;
  }

  return <>{children}</>;
}

/** Replacement screen for signed-out visitors on gated routes. */
export function SignInWall({ next }: { next: string }) {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const loginHref = `/login${safeNext === "/" ? "" : `?next=${encodeURIComponent(safeNext)}`}`;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Panel className="w-full p-8 text-center">
        <span className="text-6xl" aria-hidden>
          🚪♠️
        </span>
        <h1 className="mt-4 font-display text-3xl text-ivory">Members only beyond this door</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          The house keeps a ledger — sign in with Discord or Google to create, join or play.
          Your coins, titles and XP travel with your account.
        </p>
        <ul className="mx-auto mt-4 max-w-xs space-y-1 text-left font-body text-xs text-ink-dim">
          <li>· One identity across every table — no guest hopping</li>
          <li>· Wallet, XP and titles persist between visits</li>
          <li>· Keeps the leaderboard and the shooting honest</li>
        </ul>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={loginHref}
            className="inline-flex min-h-12 items-center justify-center rounded-btn border-2 border-brass-deep bg-gradient-to-b from-brass to-brass-soft font-display tracking-wide text-wood-deep hover:brightness-110"
          >
            SIGN IN TO SIT DOWN
          </Link>
          <Link href="/rooms" className="inline-flex min-h-12 items-center justify-center rounded-btn border-2 border-ink-dim/70 font-display text-sm text-ink-dim hover:border-brass hover:text-red-text">
            BROWSE PUBLIC ROOMS
          </Link>
          <Link href="/how-to-play" className="inline-flex min-h-12 items-center justify-center font-body text-xs text-ink-dim underline hover:text-red-text">
            or read how the game is played
          </Link>
        </div>
      </Panel>
    </div>
  );
}
