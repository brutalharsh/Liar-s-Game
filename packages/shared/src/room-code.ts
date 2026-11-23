/**
 * Room codes — 5 chars from a confusable-free alphabet (STR/07 §5):
 * no I/L/O/0/1; knowing the code = seat rights, so join attempts are
 * rate-limited server-side (10/IP/10min).
 *
 * NOTE: there is no default RNG here. `generateRoomCode` takes an injected
 * integer source (AGENTS.md non-negotiable #2 — all game RNG via injected
 * crypto port, never `Math.random`). The server wires it to `crypto.randomInt`.
 */
import { z } from 'zod';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1 (31 chars)
export const ROOM_CODE_LENGTH = 5;

export const ROOM_CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export const RoomCodeSchema = z.string().regex(ROOM_CODE_REGEX);
export type RoomCode = z.infer<typeof RoomCodeSchema>;

/** Uniform random integer in [0, maxExclusive) — the injectable crypto port shape. */
export type RandomBelow = (maxExclusive: number) => number;

/** Generates a new 5-char code. `randomBelow` MUST be uniform over [0, alphabet.length). */
export function generateRoomCode(randomBelow: RandomBelow): RoomCode {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET.charAt(randomBelow(ROOM_CODE_ALPHABET.length));
  }
  return code;
}

/** Strict validity check (exact length + alphabet). */
export function isRoomCode(value: string): boolean {
  return ROOM_CODE_REGEX.test(value);
}

/**
 * Best-effort cleanup of user-typed input: uppercase, drop every char that is
 * not in the alphabet, cap at 5. Result may be shorter than 5 — use
 * `isRoomCode` to confirm before sending `room:join`.
 */
export function normalizeRoomCode(input: string): string {
  let out = '';
  for (const ch of input.toUpperCase()) {
    if (ROOM_CODE_ALPHABET.includes(ch)) {
      out += ch;
      if (out.length === ROOM_CODE_LENGTH) break;
    }
  }
  return out;
}
