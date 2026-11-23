import { describe, expect, it } from 'vitest';
import { EMOTE_IDS, EMOTE_PRESETS, EmoteIdSchema } from '../src/emotes.js';

describe('emote catalog (STR/02 / STR/05 §6 — the canonical 10 presets)', () => {
  it('pins exactly 10 unique wire slugs', () => {
    expect(EMOTE_IDS.length).toBe(10);
    expect(new Set(EMOTE_IDS).size).toBe(10);
  });

  it('presets carry exactly the catalog ids, in order, with label + emoji', () => {
    expect(EMOTE_PRESETS.map((p) => p.id)).toEqual([...EMOTE_IDS]);
    for (const preset of EMOTE_PRESETS) {
      expect(preset.label.length, preset.id).toBeGreaterThan(0);
      expect(preset.emoji.length, preset.id).toBeGreaterThan(0);
    }
  });

  it('EmoteIdSchema accepts every catalog id and nothing else', () => {
    for (const id of EMOTE_IDS) {
      expect(EmoteIdSchema.safeParse(id).success, id).toBe(true);
    }
    expect(EmoteIdSchema.safeParse('party-parrot').success).toBe(false);
    expect(EmoteIdSchema.safeParse('LAUGH').success).toBe(false);
    expect(EmoteIdSchema.safeParse('laugh ').success).toBe(false);
    expect(EmoteIdSchema.safeParse('').success).toBe(false);
  });
});
