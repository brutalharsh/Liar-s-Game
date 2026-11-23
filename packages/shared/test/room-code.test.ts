import { describe, expect, it } from 'vitest';
import {
  generateRoomCode,
  isRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomCodeSchema,
} from '../src/room-code.js';
import type { RandomBelow } from '../src/room-code.js';

describe('room codes', () => {
  it('generates a 5-char code from the injected rng (uniform over alphabet length)', () => {
    let calls = 0;
    const alwaysZero: RandomBelow = (max) => {
      calls += 1;
      expect(max).toBe(ROOM_CODE_ALPHABET.length);
      return 0;
    };
    const code = generateRoomCode(alwaysZero);
    expect(code).toBe('AAAAA');
    expect(calls).toBe(ROOM_CODE_LENGTH);
    expect(isRoomCode(code)).toBe(true);
  });

  it('maps every rng draw to the alphabet (no Math.random anywhere)', () => {
    const alwaysMax: RandomBelow = (max) => max - 1;
    expect(generateRoomCode(alwaysMax)).toBe('99999'); // last alphabet char is 9
    const mid: RandomBelow = () => 12;
    expect(generateRoomCode(mid)).toBe('PPPPP'); // index 12 = P (no I/L in the set)
  });

  it('alphabet is duplicate-free and contains no ambiguous chars', () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- code-point iteration is intended (ASCII alphabet)
    const chars = [...ROOM_CODE_ALPHABET];
    expect(new Set(chars).size).toBe(chars.length);
    for (const banned of ['I', 'L', 'O', '0', '1']) {
      expect(chars).not.toContain(banned);
    }
    expect(chars.length).toBeGreaterThanOrEqual(25); // STR/07 undercounts; we use the pinned string
  });

  it('rejects ambiguous characters (I, L, O, 0, 1)', () => {
    expect(isRoomCode('IL0O1')).toBe(false);
    expect(isRoomCode('AB2C9')).toBe(true);
    expect(isRoomCode('ab2c9')).toBe(false); // lowercase is not canonical
    expect(isRoomCode('AB2C')).toBe(false); // too short
    expect(isRoomCode('AB2C99')).toBe(false); // too long
  });

  it('normalizes user-typed input: uppercase, strip non-alphabet chars, cap at 5', () => {
    expect(normalizeRoomCode('ab2c9')).toBe('AB2C9');
    expect(normalizeRoomCode('ab2-c9')).toBe('AB2C9');
    expect(normalizeRoomCode('  a b 2 c 9 ')).toBe('AB2C9');
    expect(normalizeRoomCode('ab2c9d')).toBe('AB2C9'); // extra char dropped
    expect(normalizeRoomCode('1l0o')).toBe(''); // ambiguous chars stripped entirely
  });

  it('RoomCodeSchema round-trips valid codes and rejects everything else', () => {
    expect(RoomCodeSchema.safeParse('WXYZ3').success).toBe(true);
    expect(RoomCodeSchema.safeParse('IL0O1').success).toBe(false);
    expect(RoomCodeSchema.safeParse(12345).success).toBe(false);
    expect(RoomCodeSchema.safeParse('').success).toBe(false);
  });

  it('every alphabet char yields a valid code', () => {
    for (let i = 0; i < ROOM_CODE_ALPHABET.length; i += 1) {
      const pick: RandomBelow = () => i;
      expect(isRoomCode(generateRoomCode(pick))).toBe(true);
    }
  });
});
