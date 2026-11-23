"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VoiceThemeId = "villain" | "chipper" | "robot" | "drunk";

export interface VoiceThemePreset {
  id: VoiceThemeId;
  label: string;
  desc: string;
  pitch: number;
  rate: number;
}

/** TTS {voice,pitch,rate} presets (STR/05 §5). */
export const VOICE_THEMES: readonly VoiceThemePreset[] = [
  { id: "villain", label: "Villain", desc: "Low, slow, unbothered.", pitch: 0.4, rate: 0.85 },
  { id: "chipper", label: "Chipper", desc: "Bright and way too friendly.", pitch: 1.6, rate: 1.15 },
  { id: "robot", label: "Robot", desc: "Flatlined affect.", pitch: 0.1, rate: 0.95 },
  { id: "drunk", label: "Drunk", desc: "Loose. Extremely loose.", pitch: 0.55, rate: 0.65 },
] as const;

export function voicePreset(id: VoiceThemeId): VoiceThemePreset {
  return VOICE_THEMES.find((t) => t.id === id) ?? VOICE_THEMES[0];
}

interface SettingsStore {
  voiceTheme: VoiceThemeId;
  sfxVolume: number; // 0–100 (seam for howler in the motion pass)
  captions: boolean;
  reducedMotion: boolean; // manual override; system pref respected when false
  emoteMuted: boolean;
  setVoiceTheme: (id: VoiceThemeId) => void;
  setSfxVolume: (n: number) => void;
  setCaptions: (b: boolean) => void;
  setReducedMotion: (b: boolean) => void;
  setEmoteMuted: (b: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      voiceTheme: "villain",
      sfxVolume: 80,
      captions: true,
      reducedMotion: false,
      emoteMuted: false,
      setVoiceTheme: (id) => set({ voiceTheme: id }),
      setSfxVolume: (n) => set({ sfxVolume: Math.min(100, Math.max(0, n)) }),
      setCaptions: (b) => set({ captions: b }),
      setReducedMotion: (b) => set({ reducedMotion: b }),
      setEmoteMuted: (b) => set({ emoteMuted: b }),
    }),
    {
      name: "liars-settings",
      skipHydration: true, // hydrate on mount via StoreHydrator (avoids SSR mismatch)
    },
  ),
);
