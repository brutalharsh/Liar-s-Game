"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoinBadge } from "@/components/ui/CoinBadge";
import { useEconomyStore } from "@/store/economy";
import { useIdentityStore } from "@/store/identity";
import { Avatar } from "@/components/ui/Avatar";

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
  const avatar = useIdentityStore((s) => s.avatar);

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
        <div className="ml-auto flex items-center gap-2">
          <CoinBadge amount={coins} />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-12 w-12 items-center justify-center rounded-full text-xl hover:bg-wood"
          >
            ⚙️
          </Link>
          <Link href="/profile" aria-label="Profile" className="p-1">
            <Avatar spec={avatar} size="md" />
          </Link>
        </div>
      </div>
    </header>
  );
}
