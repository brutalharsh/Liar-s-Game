"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settings";

/**
 * System `prefers-reduced-motion`, OR the manual settings override
 * (STR/05 §7). Every juice fn / animation path checks this.
 */
export function usePrefersReducedMotion(): boolean {
  const manual = useSettingsStore((s) => s.reducedMotion);
  const [system, setSystem] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return manual || system;
}
