"use client";

import { useSyncExternalStore } from "react";
import { useSettingsStore } from "@/store/settings";

/**
 * System `prefers-reduced-motion`, OR the manual settings override
 * (STR/05 §7). Every juice fn / animation path checks this.
 *
 * useSyncExternalStore reads the live media query DURING the first client
 * render — there is no false "motion-ok" first frame (the old useEffect
 * variant rendered false once, flashing "+0" count-ups at reduced-motion
 * users). The manual `data-reduced-motion` override stays in the settings
 * store (Providers syncs it to <html>) and is OR-ed in unchanged.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

let cachedQuery: MediaQueryList | null = null;
function query(): MediaQueryList {
  if (cachedQuery === null) cachedQuery = window.matchMedia(QUERY);
  return cachedQuery;
}

function subscribe(onChange: () => void): () => void {
  const mq = query();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return query().matches;
}

function getServerSnapshot(): boolean {
  return false; // SSR can't read the query; CSS + MotionConfig cover the paint
}

export function usePrefersReducedMotion(): boolean {
  const manual = useSettingsStore((s) => s.reducedMotion);
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return manual || system;
}
