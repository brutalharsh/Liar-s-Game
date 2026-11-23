import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BLOCKLIST,
  MAX_DISPLAY_NAME_LENGTH,
  sanitizeDisplayName,
  sanitizeNickname,
  sanitizeRoomName,
} from '../src/sanitizer.js';

describe('sanitizeDisplayName', () => {
  it('passes clean names through untouched', () => {
    expect(sanitizeDisplayName('Foxy')).toBe('Foxy');
    expect(sanitizeDisplayName('Dörte')).toBe('Dörte'); // non-ASCII letters are kept
    expect(sanitizeDisplayName('Grapes')).toBe('Grapes'); // no false-positive on harmless words
  });

  it('strips control characters', () => {
    expect(sanitizeDisplayName('Bob\u0007')).toBe('Bob');
    expect(sanitizeDisplayName('Bo\u0000b')).toBe('Bob');
    expect(sanitizeDisplayName('\u0001\u0002\u0003')).toBe('');
  });

  it('strips zero-width and bidi format characters (obfuscation tricks)', () => {
    expect(sanitizeDisplayName('Bo\u200Bb')).toBe('Bob'); // zero width space
    expect(sanitizeDisplayName('sh\u200Dit')).toBe(''); // ZWJ smuggle → word reforms → blocked
    expect(sanitizeDisplayName('na\u202En')).toBe('nan'); // RTL override
    expect(sanitizeDisplayName('Alias\uFEFF')).toBe('Alias'); // BOM
  });

  it('folds fullwidth forms via NFKC', () => {
    expect(sanitizeDisplayName('Ａlice')).toBe('Alice'); // fullwidth Ａ
    expect(sanitizeDisplayName('ＦＯＸ９')).toBe('FOX9'); // exponent 9 → digits fold too
  });

  it('maps confusable Cyrillic/Greek lookalikes to ASCII', () => {
    expect(sanitizeDisplayName('СAPTAIN')).toBe('CAPTAIN'); // Cyrillic С
    expect(sanitizeDisplayName('Вad')).toBe('Bad'); // Cyrillic В
    expect(sanitizeDisplayName('Аdmin')).toBe(''); // folds to blocklisted "admin"
    expect(sanitizeDisplayName('Рeter')).toBe('Peter'); // Cyrillic Р
    expect(sanitizeDisplayName('ɡum')).toBe('gum'); // Latin ɡ
  });

  it('blocks confusable smuggling of blocklist terms', () => {
    expect(sanitizeDisplayName('shіt')).toBe(''); // Cyrillic і
    expect(sanitizeDisplayName(' fuckingaround')).toBe('');
  });

  it('collapses whitespace runs and trims', () => {
    expect(sanitizeDisplayName('a  b\t\tc \nd ')).toBe('a b c d');
    expect(sanitizeDisplayName('   Foxy   ')).toBe('Foxy');
  });

  it('truncates to 18 code points (emoji count once, not per surrogate half)', () => {
    expect(sanitizeDisplayName('a'.repeat(30))).toBe('a'.repeat(18));
    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- code-point count is the assertion
    expect([...sanitizeDisplayName('😀'.repeat(30))].length).toBe(18);
    expect(sanitizeDisplayName('😀')).toBe('😀'); // emoji are allowed, just counted
  });

  it('applies the blocklist after truncation (never blocks what cannot render)', () => {
    const name = 'a'.repeat(MAX_DISPLAY_NAME_LENGTH) + 'shit';
    expect(sanitizeDisplayName(name)).toBe('a'.repeat(MAX_DISPLAY_NAME_LENGTH));
  });

  it('rejects default-blocklist terms', () => {
    expect(sanitizeDisplayName('shitposter')).toBe('');
    expect(sanitizeDisplayName('Hitler_fan')).toBe('');
    expect(sanitizeDisplayName('AdminBot')).toBe('');
  });

  it('defeats separator evasion (spaces, punctuation, mixing)', () => {
    expect(sanitizeDisplayName('f u c k')).toBe('');
    expect(sanitizeDisplayName('f.u.c.k')).toBe('');
    expect(sanitizeDisplayName('a d m i n 2')).toBe('');
    expect(sanitizeDisplayName('administrator')).toBe('');
  });

  it('supports a custom blocklist', () => {
    const result = sanitizeDisplayName('grapes', { blocklist: ['grape'] });
    expect(result).toBe('');
    expect(sanitizeDisplayName('ok', { blocklist: ['grape'] })).toBe('ok');
  });

  it('returns empty string for empty / whitespace-only / oversized input', () => {
    expect(sanitizeDisplayName('')).toBe('');
    expect(sanitizeDisplayName('    ')).toBe('');
    expect(sanitizeDisplayName('x'.repeat(65))).toBe('');
  });

  it('nicknames and room names share the same rules', () => {
    expect(sanitizeNickname).toBe(sanitizeDisplayName);
    expect(sanitizeRoomName).toBe(sanitizeDisplayName);
  });

  it('ships a frozen, non-empty default blocklist', () => {
    expect(DEFAULT_BLOCKLIST.length).toBeGreaterThan(10);
    expect(Object.isFrozen(DEFAULT_BLOCKLIST)).toBe(true);
  });
});
