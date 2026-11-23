"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoinBadge } from "@/components/ui/CoinBadge";
import { useEconomyStore } from "@/store/economy";
import { useIdentityStore } from "@/store/identity";
import { useAuthStore } from "@/store/auth-store";
import { useToasts } from "@/store/ui";
import { Avatar } from "@/components/ui/Avatar";
import { toDisplaySpec } from "@/components/auth/viewer";
import { useEffect } from "react";

const NAV = [
  { href: "/rooms", label: "ROOMS" },
  { href: "/leaderboard", label: "RANKS" },
  { href: "/shop", label: "SHOP" },
  { href: "/how-to-play", label: "HOW TO PLAY" },
] as const;

/** Site header (site pages only — game routes run fullscreen). */
export function SiteHeader() {
  const pathname = usePathname();
  const coins = useEconomyStore((s) => s.coins);
  const guestAvatar = useIdentityStore((s) => s.avatar);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);
  const push = useToasts();

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const loginHref = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
  const signedOut = status === "guest" || (status === "unknown" && !user);

  const handleSignOut = async () => {
    await logout();
    push({ title: "Signed out", sub: "The bar remembers your tab.", tone: "info" });
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-wood-mid/60 bg-wood-deep/90 backdrop-blur pt-safe">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" className="font-display text-xl tracking-wider text-brass md:text-2xl">
          LIAR'S GAME
        </Link>
        <nav className="ml-4 hidden gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-12 items-center px-3 font-display text-sm tracking-wide ${
                  active ? "text-brass" : "text-ink-dim hover:text-ivory"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* auth cluster — fixed-height slot: the cluster is 52px in EVERY
            session state (48px locals center inside it), so the header never
            shifts when the session resolves */}
        <div className="ml-auto flex h-13 items-center gap-2">
          <CoinBadge amount={coins} />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl hover:bg-wood"
          >
            ⚙️
          </Link>
          {signedOut ? (
            <Link
              href={loginHref}
              aria-label="Sign in"
              className="flex min-h-12 shrink-0 items-center rounded-btn border-2 border-ink-dim/70 px-3 font-display text-xs tracking-wider text-ink-dim hover:border-brass hover:text-brass md:text-sm"
            >
              SIGN IN
            </Link>
          ) : status === "authed" && user ? (
            <>
              <Link
                href="/profile"
                aria-label={`Profile — ${user.nickname}`}
                className="flex min-h-12 shrink-0 items-center gap-2 rounded-full border-2 border-transparent px-1 hover:border-wood-mid"
              >
                <Avatar spec={toDisplaySpec(user.avatarSpec)} size="md" />
                <span className="hidden max-w-24 truncate font-display text-sm text-ivory md:block">
                  {user.nickname}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                aria-label="Sign out"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl text-ink-dim hover:bg-wood hover:text-blood-bright"
              >
                🚪
              </button>
            </>
          ) : (
            <Link href="/profile" aria-label="Profile" className="shrink-0 p-1 opacity-60">
              <Avatar spec={guestAvatar} size="md" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
