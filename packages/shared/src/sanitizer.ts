/**
 * Nickname / room-name sanitizer (STR/07 §7, STR/08 §7).
 *
 * Rules: max 18 code points; strip control + invisible format characters
 * (zero-width, bidi overrides — the classic "obfuscated slur" trick); fold
 * confusable unicode (Cyrillic/Greek lookalikes, fullwidth via NFKC) to ASCII;
 * collapse whitespace; reject blocklist hits. Returns `''` when the input
 * contains blocked content or cleans up to nothing — callers fall back to a
 * default name.
 *
 * Nicknames render as TEXT ONLY, never HTML (STR/08 §7); that enforcement
 * lives in the render layer, not here.
 */

export const MAX_DISPLAY_NAME_LENGTH = 18;

/** Max input length accepted before sanitizing — the sanitizer itself truncates to 18. */
export const MAX_INPUT_LENGTH = 64;

/**
 * Confusable → ASCII folds NOT covered by NFKC (NFKC already handles
 * fullwidth forms, Roman numerals, and math-alphanumeric symbols).
 */
const CONFUSABLES: Readonly<Record<string, string>> = Object.freeze({
  // Cyrillic lookalikes
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  і: 'i',
  ѕ: 's',
  ј: 'j',
  һ: 'h',
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  // Greek lookalikes
  α: 'a',
  ο: 'o',
  ρ: 'p',
  υ: 'u',
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
  // Latin-lookalike letters without NFKC decompositions
  'ɡ': 'g',
  'Ɩ': 'I',
  'ǀ': 'I',
});

/**
 * Initial blocklist. Substring matching is applied against a "squashed"
 * form (lowercased, alphanumerics only), so separator tricks like
 * "f u c k" or "j.o.h.n" don't bypass it. Terms are curated to avoid
 * false positives on ordinary words. Extend freely server-side.
 */
export const DEFAULT_BLOCKLIST: readonly string[] = Object.freeze([
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'whore',
  'slut',
  'faggot',
  'nigger',
  'nigga',
  'tranny',
  'retard',
  'hitler',
  'kkk',
  'pedo',
  'pedophile',
  'paedophile',
  'molest',
  'penis',
  'vagina',
  'porn',
  'jizz',
  'wanker',
  'titt',
  'twat',
  'clit',
  'pussy',
  'chink',
  // impersonation of staff/system
  'admin',
  'administrator',
  'moderator',
  'official',
  'support',
]);

export interface SanitizeOptions {
  maxLength?: number;
  blocklist?: readonly string[];
}

/** Control (Cc) and format (Cf) code points stripped before anything else. */
const STRIPPED_CODE_POINTS: ReadonlySet<number> = new Set<number>([
  0x00ad, // soft hyphen
  0x061c, // arabic letter mark
  0x180e, // mongolian vowel separator
  0x200b, // zero width space
  0x200c, // zero width non-joiner
  0x200d, // zero width joiner
  0x200e, // left-to-right mark
  0x200f, // right-to-left mark
  0x202a, // lre — bidi override family (the "rexdia" trick)
  0x202b,
  0x202c,
  0x202d,
  0x202e, // rlo
  0x2060, // word joiner
  0x2061,
  0x2062,
  0x2063,
  0x2064,
  0x2066,
  0x2067,
  0x2068,
  0x2069,
  0xfeff, // zero width no-break space (BOM)
  0xfff9, // interlinear annotation family
  0xfffa,
  0xfffb,
]);

function isControlCodePoint(code: number): boolean {
  return code < 0x20 || code === 0x7f;
}

function isSurrogateCodePoint(code: number): boolean {
  return code >= 0xd800 && code <= 0xdfff;
}

/** Lowercased alphanumerics-only squash — the surface blocklist terms match on. */
function squashForBlocklist(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFKC').toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) out += ch;
  }
  return out;
}

/**
 * Sanitizes a nickname or room name. Returns the cleaned string (≤18 code
 * points) or `''` when blocked/empty — callers substitute a default.
 */
export function sanitizeDisplayName(input: string, options: SanitizeOptions = {}): string {
  const maxLength = options.maxLength ?? MAX_DISPLAY_NAME_LENGTH;
  const blocklist = options.blocklist ?? DEFAULT_BLOCKLIST;
  if (typeof input !== 'string' || input.length === 0) return '';
  if (input.length > MAX_INPUT_LENGTH) return '';

  // 1. Compatibility fold: fullwidth → ASCII, Roman numerals, math letters, ligatures.
  const s = input.normalize('NFKC');

  // 2. Per-code-point cleanup: whitespace → space, strip control/format chars,
  //    map confusables.
  let cleaned = '';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (/\s/.test(ch)) {
      cleaned += ' '; // tab/newline/NBSP/etc. all collapse in step 3
      continue;
    }
    if (isControlCodePoint(code)) continue; // remaining Cc (bell, ESC, …)
    if (isSurrogateCodePoint(code)) continue; // lone surrogates from broken input
    if (STRIPPED_CODE_POINTS.has(code)) continue;
    cleaned += CONFUSABLES[ch] ?? ch;
  }

  // 3. Collapse all whitespace runs to single spaces, trim.
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 4. Truncate by code points (not UTF-16 units — emoji count once).
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- deliberate code-point iteration; ZWJ sequences are already split by step 2
  const chars = [...cleaned];
  const truncated = chars.length <= maxLength ? cleaned : chars.slice(0, maxLength).join('');

  // 5. Blocklist on the final form (post-truncation — what renders is what's checked).
  const squashed = squashForBlocklist(truncated);
  for (const term of blocklist) {
    if (term.length > 0 && squashed.includes(term)) return '';
  }
  return truncated;
}

/** Alias — same rules for nicknames and room names (STR/08 §7). */
export const sanitizeNickname = sanitizeDisplayName;

/** Alias — same rules for nicknames and room names (STR/08 §7). */
export const sanitizeRoomName = sanitizeDisplayName;
