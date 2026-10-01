import type { PromptAnswer } from '@/api/types';

/**
 * Onboarding validation (guide §9.2). Mirrors the backend; the server stays
 * authoritative and the UI only uses these to guide the user.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 50;
export const MIN_AGE = 18;
export const BIO_MAX = 500;
export const SHORT_FIELD_MAX = 80;
export const INTERESTS_MIN = 3;
export const INTERESTS_MAX = 10;
export const PROMPTS_MAX = 3;
export const ANSWER_MAX = 200;

export type NameProblem = 'tooShort' | 'tooLong' | null;

export function nameProblem(raw: string): NameProblem {
  const name = raw.trim();
  if (name.length < NAME_MIN) return 'tooShort';
  if (name.length > NAME_MAX) return 'tooLong';
  return null;
}

// ---- Date of birth: typed as "DD / MM / YYYY", sent as "YYYY-MM-DD".

/** Formats digits as the user types: "1403" → "14 / 03", "14032000" → "14 / 03 / 2000". */
export function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} / ${d.slice(2)}`;
  return `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
}

export interface CalendarDate {
  year: number;
  month: number; // 1–12
  day: number;
}

/** A real calendar date from "DD / MM / YYYY", or null (31/02, 00/13, partial input…). */
export function parseDob(input: string): CalendarDate | null {
  const d = input.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4));
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth ? { year, month, day } : null;
}

/** Whole years on `today` (birthday counted on the day itself; 29 Feb → 1 Mar in common years). */
export function ageOn(dob: CalendarDate, today: CalendarDate): number {
  let age = today.year - dob.year;
  if (today.month < dob.month || (today.month === dob.month && today.day < dob.day)) age -= 1;
  return age;
}

export function todayLocal(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export type DobProblem = 'incomplete' | 'invalid' | 'future' | 'underage' | null;

export function dobProblem(input: string, today: CalendarDate = todayLocal()): DobProblem {
  if (input.replace(/\D/g, '').length < 8) return 'incomplete';
  const dob = parseDob(input);
  if (!dob) return 'invalid';
  const age = ageOn(dob, today);
  if (age < 0) return 'future';
  if (age < MIN_AGE) return 'underage';
  return age > 120 ? 'invalid' : null;
}

export function toIsoDate(dob: CalendarDate): string {
  return `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`;
}

// ---- Interests (screen 12): pick 3 to 10.

export interface ToggleResult {
  selected: string[];
  /** True when the tap was refused because 10 are already picked. */
  limitReached: boolean;
}

export function toggleInterest(selected: readonly string[], id: string, max: number = INTERESTS_MAX): ToggleResult {
  if (selected.includes(id)) return { selected: selected.filter((s) => s !== id), limitReached: false };
  if (selected.length >= max) return { selected: [...selected], limitReached: true };
  return { selected: [...selected, id], limitReached: false };
}

export function canContinueInterests(count: number): boolean {
  return count >= INTERESTS_MIN && count <= INTERESTS_MAX;
}

/** Case- and accent-insensitive match for the search field. */
export function matchesSearch(name: string, query: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  return norm(name).includes(norm(query));
}

// ---- Prompts (screen 13): up to 3 answers of ≤ 200 chars.

export function canAddPrompt(answers: readonly PromptAnswer[]): boolean {
  return answers.length < PROMPTS_MAX;
}

/** Adds or replaces the answer for `promptId`; never more than 3, answers trimmed and capped. */
export function upsertAnswer(answers: readonly PromptAnswer[], promptId: string, answer: string): PromptAnswer[] {
  const text = answer.trim().slice(0, ANSWER_MAX);
  const exists = answers.some((a) => a.promptId === promptId);
  if (exists) return answers.map((a) => (a.promptId === promptId ? { promptId, answer: text } : a));
  if (!canAddPrompt(answers)) return [...answers];
  return [...answers, { promptId, answer: text }];
}

export function removeAnswer(answers: readonly PromptAnswer[], promptId: string): PromptAnswer[] {
  return answers.filter((a) => a.promptId !== promptId);
}

export function answerProblem(answer: string): 'empty' | 'tooLong' | null {
  const text = answer.trim();
  if (!text) return 'empty';
  return text.length > ANSWER_MAX ? 'tooLong' : null;
}

/** Mock-only stand-in for the server's check: a 10-digit number or an "@". */
export function containsContactDetails(text: string): boolean {
  return text.includes('@') || /\d{10}/.test(text.replace(/[\s\-().+]/g, ''));
}
