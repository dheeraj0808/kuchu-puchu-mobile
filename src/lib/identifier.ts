/**
 * Sign-in identifiers. Client checks are for UX only; the backend stays
 * authoritative (guide §10.2).
 */

export const COUNTRY_CODE = '+91';
const MAX_EMAIL_LENGTH = 254;
// Pragmatic check; the backend's class-validator isEmail() has the final say.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
/** Indian mobile numbers: 10 digits starting 6–9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export type PhoneProblem = 'empty' | 'incomplete' | 'invalid';

/**
 * The 10 national digits from whatever was typed or pasted:
 * "98765 43210", "+91 98765-43210", "0 98765 43210" and "919876543210" all → "9876543210".
 */
export function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** E.164 for the API: "+919876543210", or null when not a valid Indian mobile. */
export function normalizePhone(raw: string): string | null {
  const digits = nationalDigits(raw);
  return INDIAN_MOBILE.test(digits) ? `${COUNTRY_CODE}${digits}` : null;
}

export function phoneProblem(raw: string): PhoneProblem | null {
  const digits = nationalDigits(raw);
  if (!digits) return 'empty';
  if (digits.length < 10) return 'incomplete';
  return INDIAN_MOBILE.test(digits) ? null : 'invalid';
}

/** "98765 43210" — how the field shows the national number. */
export function formatNationalPhone(raw: string): string {
  const digits = nationalDigits(raw);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** "+91 98765 43210" — for "Sent to …". */
export function formatPhone(e164: string): string {
  return `${COUNTRY_CODE} ${formatNationalPhone(e164)}`;
}

/** "+91 98••• ••210" — Settings shows the number without revealing it (deck 40). */
export function maskPhone(e164: string): string {
  const digits = nationalDigits(e164);
  if (digits.length !== 10) return `${COUNTRY_CODE} ••••• •••••`;
  return `${COUNTRY_CODE} ${digits.slice(0, 2)}••• ••${digits.slice(7)}`;
}

/** "j•••@example.com" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const value = normalizeEmail(raw);
  return value.length > 0 && value.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(value);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
