"use client";

import { useEffect, useState } from "react";

/**
 * Count-up animation for coins/XP reveals (STR/03 §4) — rAF-driven, zero
 * per-frame allocation, instant when reduced-motion is on.
 */
export function useCountUp(target: number, active: boolean, ms = 1200, reduced = false): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (reduced || ms <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - startedAt) / ms));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms, reduced]);

  return value;
}
