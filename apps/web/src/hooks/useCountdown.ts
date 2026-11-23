"use client";

import { useEffect, useState } from "react";

/**
 * Countdown from a server deadline timestamp (STR/07 §4 — clients render
 * countdowns from their own clock; the server is the only one that acts).
 * Ticks once per second — no tick spam; rings sweep smoothly via CSS
 * transitions between ticks.
 */
export function useCountdown(deadlineTs: number | null): { secondsLeft: number; urgent: boolean; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineTs === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineTs]);

  const secondsLeft = deadlineTs === null ? 0 : Math.max(0, (deadlineTs - now) / 1000);
  return {
    secondsLeft,
    urgent: deadlineTs !== null && secondsLeft < 10,
    expired: deadlineTs !== null && secondsLeft <= 0,
  };
}
