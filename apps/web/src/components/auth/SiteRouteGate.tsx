"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";

/**
 * Site pages that REQUIRE a signed-in player (STR/02: login required to play).
 * Everything else under (site) — landing, rooms browser, leaderboard,
 * how-to-play — stays public (browse-only when signed out).
 */
const GATED_SITE_ROUTES: readonly string[] = ["/create", "/join", "/shop", "/profile", "/settings"];

export function SiteRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const gated = GATED_SITE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!gated) return <>{children}</>;
  return <AuthGate>{children}</AuthGate>;
}
