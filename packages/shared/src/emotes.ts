/**
 * Emote catalog — the canonical 10 preset table-talk emotes (STR/02,
 * STR/05 §6). ONE list, three consumers:
 *   · the wire schemas pin `emote:send` / `emote:broadcast` ids to EMOTE_IDS
 *   · the server derives its relay whitelist from EMOTE_IDS
 *   · the web derives the UI preset pairs (id + label + emoji) here
 * Ids are opaque, blocklist-safe slugs — never user free text.
 */
import { z } from 'zod';

/** The 10 wire slugs, in catalog order (as pinned in STR/05 §6). */
export const EMOTE_IDS = [
  'tipping-hat',
  'laugh',
  'gasp',
  'angry',
  'sweat',
  'cry',
  'cheer',
  'shush',
  'thinking',
  'wink',
] as const;
export type EmoteId = (typeof EMOTE_IDS)[number];

/** The wire contract for an emote id: exactly one of `EMOTE_IDS`. */
export const EmoteIdSchema = z.enum(EMOTE_IDS);

/**
 * UI metadata for one preset. The bubble always renders text + icon together
 * (colorblind-safe by design — STR/05 §6).
 */
export interface EmotePreset {
  id: EmoteId;
  label: string;
  emoji: string;
}

/** The 10 presets with display metadata, in catalog order. */
export const EMOTE_PRESETS: readonly EmotePreset[] = Object.freeze([
  { id: 'tipping-hat', label: 'Tips Hat', emoji: '🎩' },
  { id: 'laugh', label: 'Laugh', emoji: '😂' },
  { id: 'gasp', label: 'Gasp', emoji: '😲' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'sweat', label: 'Sweat', emoji: '😅' },
  { id: 'cry', label: 'Cry', emoji: '😭' },
  { id: 'cheer', label: 'Cheer', emoji: '🎉' },
  { id: 'shush', label: 'Shush', emoji: '🤫' },
  { id: 'thinking', label: 'Thinking', emoji: '🤔' },
  { id: 'wink', label: 'Wink', emoji: '😉' },
] satisfies EmotePreset[]);
