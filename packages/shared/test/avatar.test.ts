/**
 * Avatar base/slot contract (STR/08 §7): the 7 canonical bases, the
 * attachable-slot union, the default base, and the byte-compat shape of
 * `AvatarSpecSchema` (flat combined `base` slug + open slot strings).
 */
import { describe, expect, it } from 'vitest';
import {
  AttachableSlotsSchema,
  AvatarSpecSchema,
  AVATAR_BASE_IDS,
  AVATAR_BASE_IDS_SCHEMA,
  DEFAULT_AVATAR_BASE,
  type AvatarBaseId,
  type AttachableSlot,
} from '../src/types.js';

describe('AVATAR_BASE_IDS (canonical body slugs)', () => {
  it('pins the 7 owner-dictated bases, order-independently', () => {
    expect(AVATAR_BASE_IDS).toHaveLength(7);
    expect(new Set<string>(AVATAR_BASE_IDS)).toEqual(
      new Set<string>([
        'human-male-thin',
        'human-female-thin',
        'human-male-gym',
        'human-female-gym',
        'dog',
        'cat',
        'horse',
      ]),
    );
  });

  it('keeps the 4 human bases sex × build distinct', () => {
    for (const sex of ['male', 'female'] as const) {
      for (const build of ['thin', 'gym'] as const) {
        const slug = `human-${sex}-${build}`;
        expect((AVATAR_BASE_IDS as readonly string[]).includes(slug)).toBe(true);
      }
    }
  });

  it('defaults to human-male-thin and it is a member', () => {
    expect(DEFAULT_AVATAR_BASE).toBe('human-male-thin');
    expect((AVATAR_BASE_IDS as readonly string[]).includes(DEFAULT_AVATAR_BASE)).toBe(true);
  });

  it('is a readonly tuple of unique strings', () => {
    expect(new Set<string>(AVATAR_BASE_IDS).size).toBe(AVATAR_BASE_IDS.length);
  });
});

describe('AVATAR_BASE_IDS_SCHEMA (server validation enum)', () => {
  it.each(AVATAR_BASE_IDS)('accepts %s', (id: AvatarBaseId) => {
    expect(AVATAR_BASE_IDS_SCHEMA.safeParse(id).success).toBe(true);
  });

  it.each(['human', 'human-male', 'default', 'fox', '', 'horse ', 'CAT'])(
    'rejects non-canonical base %j',
    (bad: string) => {
      expect(AVATAR_BASE_IDS_SCHEMA.safeParse(bad).success).toBe(false);
    },
  );
});

describe('AttachableSlotsSchema', () => {
  it('pins exactly the 5 attachable slots', () => {
    expect(AttachableSlotsSchema.options).toHaveLength(5);
    expect(new Set<string>(AttachableSlotsSchema.options)).toEqual(
      new Set<string>(['hair', 'beard', 'hat', 'shirt', 'glasses']),
    );
  });

  it.each(['hair', 'beard', 'hat', 'shirt', 'glasses'])('accepts %s', (slot: AttachableSlot) => {
    expect(AttachableSlotsSchema.safeParse(slot).success).toBe(true);
  });

  it.each(['base', 'frame', 'anim', 'voicePack', 'theme', 'shoes'])(
    'rejects non-attachable slot %s',
    (bad: string) => {
      expect(AttachableSlotsSchema.safeParse(bad).success).toBe(false);
    },
  );
});

describe('AvatarSpecSchema (wire shape stays byte-compat)', () => {
  it('accepts the canonical default spec and every slot as open strings', () => {
    const spec = {
      base: 'human-male-thin',
      hair: 'hair:mohawk',
      beard: 'beard:goatee',
      hat: 'hat:sombrero',
      shirt: 'shirt:poncho',
      glasses: 'glasses:aviators',
      frame: 'frame:neon',
      anim: 'anim:idle-drunk',
      voicePack: 'voicePack:villain',
    };
    expect(AvatarSpecSchema.parse(spec)).toEqual(spec);
  });

  it('rejects nested/extra keys (strict flat object)', () => {
    expect(AvatarSpecSchema.safeParse({ base: 'dog', extra: 1 }).success).toBe(false);
    expect(AvatarSpecSchema.safeParse({}).success).toBe(false);
  });
});
