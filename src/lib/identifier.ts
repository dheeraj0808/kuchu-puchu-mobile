import type { IdentifierType } from '@/api/types';

/**
 * Mirrors backend/src/auth/utils/identifier.util.ts and the RequestOtpDto
 * rules. Client validation is for UX only; the backend remains authoritative.
 */

export const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const MAX_EMAIL_LENGTH = 254;
// Pragmatic check; the backend's class-validator isEmail() has the final say.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s\-().]/g, '');
}

export function normalizeIdentifier(type: IdentifierType, value: string): string {
  return type === 'email' ? normalizeEmail(value) : normalizePhone(value);
}

/** Returns an error message, or null when valid. Expects a raw (un-normalized) value. */
export function validateIdentifier(type: IdentifierType, raw: string): string | null {
  const value = normalizeIdentifier(type, raw);
  if (type === 'email') {
    if (!value) return 'Enter your email address.';
    if (value.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(value)) return 'Enter a valid email address.';
    return null;
  }
  if (!value) return 'Enter your phone number.';
  if (!value.startsWith('+')) return 'Include your country code, e.g. +91 98765 43210.';
  if (!E164_REGEX.test(value)) return 'Enter a valid phone number with country code.';
  return null;
}

export function validateOtp(code: string, length: number): string | null {
  if (!code) return 'Enter the verification code.';
  if (!/^\d+$/.test(code)) return 'The code contains digits only.';
  if (code.length !== length) return `Enter all ${length} digits.`;
  return null;
}

/** j***@example.com — mirrors the backend's masking. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***@${email.slice(at + 1)}`;
}

/** +91******3210 */
export function maskPhone(phone: string): string {
  if (phone.length <= 7) return '*'.repeat(phone.length);
  return `${phone.slice(0, 3)}${'*'.repeat(phone.length - 7)}${phone.slice(-4)}`;
}

export function maskIdentifier(type: IdentifierType, identifier: string): string {
  return type === 'email' ? maskEmail(identifier) : maskPhone(identifier);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
