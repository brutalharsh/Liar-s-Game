/**
 * Timing-safe string compare — both sides go through SHA-256 first so the
 * digest lengths always match (raw `timingSafeEqual` throws on unequal
 * lengths, which itself leaks a length signal). Used for the env admin
 * credentials (STR/08 §13).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}
