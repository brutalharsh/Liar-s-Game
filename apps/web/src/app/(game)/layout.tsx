import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";

/**
 * Game routes (lobby + table) run fullscreen and require a signed-in player
 * (STR/07 §0: no session → play denied with AUTH_REQUIRED). The gate renders
 * children untouched once the session is verified — no wrapper geometry.
 */
export default function GameLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
