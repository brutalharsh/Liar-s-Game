"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "HOME", emoji: "🏠" },
  { href: "/rooms", label: "ROOMS", emoji: "🎪" },
  { href: "/shop", label: "SHOP", emoji: "🛍️" },
  { href: "/leaderboard", label: "RANKS", emoji: "🏆" },
  { href: "/profile", label: "YOU", emoji: "👤" },
] as const;

/** Mobile bottom tab bar (48px targets, safe-area aware). */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-wood-mid/60 bg-wood-deep/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 pt-1 ${
              active ? "text-brass" : "text-ink-dim"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {tab.emoji}
            </span>
            <span className="font-body text-xs tracking-widest">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
