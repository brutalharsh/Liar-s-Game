"use client";

/**
 * SFX SEAM (STR/05 §5, research/09 §6) — placeholder for the C1 audio wave.
 * The game calls playSfx(name) at every beat; C1 registers a howler-backed
 * engine here (per-category volume + master mute live in `store/settings.ts`,
 * WebAudio unlock-on-first-pointerdown also lands with C1). Until then every
 * call is a silent no-op — timing is already final so slotting audio in
 * cannot change any animation budget.
 */

export type SfxName =
  | "card-select"
  | "card-flick"
  | "deal"
  | "flip"
  | "throw"
  | "challenge-slam"
  | "window-arm"
  | "cylinder-spin"
  | "hammer-cock"
  | "dry-click"
  | "bang"
  | "death"
  | "survive"
  | "win"
  | "round-end"
  | "button-click"
  | "emote-bang" // emote-fired table bang (STR/03 §2 CHECK spec)
  | "toast";

type SfxEngine = (name: SfxName) => void;

let engine: SfxEngine | null = null;

/** C1 registers the real audio engine here (howler). */
export function registerSfxEngine(fn: SfxEngine | null): void {
  engine = fn;
}

export function playSfx(name: SfxName): void {
  engine?.(name);
}

/**
 * TTS SEAM (STR/05 §5, STR/07 §1 `profile:tts-say`): spoken claims, "LIAR!",
 * kill/death/win lines. Also silent until the C1 wave wires SpeechSynthesis
 * with the voice-theme presets — captions text already renders everywhere.
 */
export function speak(_phrase: string, _opts?: { interrupt?: boolean }): void {
  // C1: speechSynthesis with {voice, pitch, rate} presets (Villain/Chipper/Robot/Drunk)
}
