/**
 * Client-side nickname sanitizer — mirrors @liars-game/shared (TODO-sync-with-shared).
 * The server re-sanitizes; this is first-line UX only (STR/08 §1).
 *
 * Rules: trim, collapse whitespace, strip control characters & zero-width
 * tricks, hard cap 12 chars (research/09 §1).
 */

export interface NicknameResult {
  value: string;
  error: string | null;
}

const MAX_NICKNAME = 12;

export function sanitizeNickname(raw: string): NicknameResult {
  const stripped = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "") // control chars
    .replace(/[\u200b-\u200f\u2028\u2029\u00ad\ufeff]/g, "") // zero-width & separators
    .replace(/\s+/g, " ")
    .trimStart()
    .slice(0, MAX_NICKNAME)
    .trimEnd();
  if (stripped.length === 0) return { value: stripped, error: "Pick a nickname first." };
  if (stripped.length < 2) return { value: stripped, error: "At least 2 characters." };
  return { value: stripped, error: null };
}

/**
 * Room-code sanitizer (STR/07 §5): 5 chars, charset ABCDEFGHJKMNPQRSTUVWXYZ23456789
 * (no I/L/O/0/1 — confusable-safe for reading codes aloud).
 */
export const ROOM_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function sanitizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((ch) => ROOM_CODE_CHARSET.includes(ch))
    .join("")
    .slice(0, 5);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === 5 && [...code].every((ch) => ROOM_CODE_CHARSET.includes(ch));
}

/** Extract a valid code from pasted text or an invite link (e.g. /r/ABCDE). */
export function parseCodeFromPasted(text: string): string | null {
  const upper = text.toUpperCase();

  // invite links embed the code in the /r/ route segment — prefer it, or the
  // protocol's own letters ("HTTPS…") can masquerade as a code
  const route = /\/R\/([^/?#]*)/.exec(upper);
  if (route?.[1]) {
    const code = sanitizeRoomCode(route[1]);
    if (isValidRoomCode(code)) return code;
  }

  // else: the LAST ≥5-char run of charset-valid characters — messy pastes
  // append the code ("join me: ABC7E"), so the later run wins; anything
  // shorter than 5 can never be a code
  const runs = upper.split(new RegExp(`[^${ROOM_CODE_CHARSET}]`)).filter((run) => run.length >= 5);
  const last = runs.at(-1);
  if (last === undefined) return null;
  const code = sanitizeRoomCode(last);
  return isValidRoomCode(code) ? code : null;
}
