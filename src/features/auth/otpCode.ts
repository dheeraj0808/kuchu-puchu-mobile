/** Pure OTP entry logic shared by the keypad, paste and SMS autofill. */

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'backspace';

/** Applies one keypad press. Digits past `length` are ignored. */
export function applyKey(code: string, key: KeypadKey, length: number): string {
  if (key === 'backspace') return code.slice(0, -1);
  return code.length >= length ? code : code + key;
}

/**
 * Finds a code in pasted text or an SMS body: "482913", "482 913", "482-913"
 * or "Your Kuchu Puchu code is 482913. FA+9qCX9VSu" → "482913".
 * Returns null when there is no run of exactly `length` digits.
 */
export function extractCode(text: string, length: number): string | null {
  const grouped = new RegExp(`(?<!\\d)(\\d[\\d\\s-]{${length - 2},${length * 2}}\\d)(?!\\d)`, 'g');
  for (const match of text.matchAll(grouped)) {
    const digits = match[1].replace(/\D/g, '');
    if (digits.length === length) return digits;
  }
  return null;
}

/** Which box shows the highlight: the next empty one, or the last when full. */
export function activeIndex(code: string, length: number): number {
  return Math.min(code.length, length - 1);
}

/** Seconds until `targetMs`, never negative. */
export function secondsUntil(targetMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
}
