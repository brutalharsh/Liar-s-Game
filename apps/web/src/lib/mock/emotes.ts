/**
 * Emote presets — thin re-export of the CANONICAL shared catalog (STR/02,
 * STR/05 §6). The UI's old W-era id set lived here and diverged from the
 * server's relay whitelist (only `laugh` overlapped) — since the
 * unification both ends derive from `@liars-game/shared` (AGENTS.md #4).
 */
export type { EmotePreset } from "@liars-game/shared";

export { EMOTE_PRESETS } from "@liars-game/shared";

export const EMOTE_COOLDOWN_MS = 3000;
