/** 10 preset emotes (STR/05 §6) — icon + text, colorblind-safe by design. */
export interface EmotePreset {
  id: string;
  label: string;
  emoji: string;
}

export const EMOTE_PRESETS: readonly EmotePreset[] = [
  { id: "call-my-bluff", label: "Call my bluff", emoji: "🤥" },
  { id: "my-condolences", label: "My condolences", emoji: "🕊️" },
  { id: "shots-on-me", label: "Shots on me", emoji: "🥃" },
  { id: "oops", label: "Oops", emoji: "😬" },
  { id: "trust-me", label: "Trust me", emoji: "😇" },
  { id: "snake", label: "Snake", emoji: "🐍" },
  { id: "skull", label: "Skull", emoji: "💀" },
  { id: "laugh", label: "Laugh", emoji: "😂" },
  { id: "clap", label: "Clap", emoji: "👏" },
  { id: "pray", label: "Pray", emoji: "🙏" },
] as const;

export const EMOTE_COOLDOWN_MS = 3000;
