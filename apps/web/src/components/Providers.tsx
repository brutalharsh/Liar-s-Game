"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useSettingsStore } from "@/store/settings";
import { useIdentityStore } from "@/store/identity";
import { useEconomyStore } from "@/store/economy";
import { GameBridge } from "@/components/GameBridge";

/**
 * Root client providers: persisted-store hydration → socket bridge → motion
 * preferences. GameBridge mounts only after the persisted stores rehydrate,
 * so the handshake carries the saved nickname/avatar.
 */
export function Providers({ children }: { children: ReactNode }) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      useSettingsStore.persist.rehydrate(),
      useIdentityStore.persist.rehydrate(),
      useEconomyStore.persist.rehydrate(),
    ]).then(() => {
      if (alive) setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Manual reduced-motion override mirrors onto <html> for CSS animations.
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "on" : "off";
  }, [reducedMotion]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      {hydrated && <GameBridge />}
      {children}
    </MotionConfig>
  );
}
