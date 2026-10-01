import { containsContactDetails, INTERESTS_MAX, INTERESTS_MIN, PROMPTS_MAX, ANSWER_MAX, ageOn, parseDob, todayLocal, MIN_AGE } from '@/features/onboarding/rules';
import { session } from '@/auth/session';

import { ApiError, ErrorCode } from '../errors';
import type { InterestCategory, Profile, ProfileAbout, ProfileBasics, PromptAnswer, PromptQuestion } from '../types';
import { mockAuth, type MockAccount } from './auth';

/**
 * In-app stand-in for backend M09 (guide contracts):
 *   POST /profile · PATCH /profile · GET /catalog/interests · PUT /profile/interests
 *   GET /catalog/prompts · PUT /profile/prompts
 * Text containing 10 digits or "@" → 422 CONTACT_DETAILS_NOT_ALLOWED with details.field.
 * Finishing prompts (or skipping them) moves nextStep from `profile` to `preferences`.
 */

const LATENCY_MS = 400;

export const INTEREST_CATALOG: InterestCategory[] = [
  {
    id: 'food',
    name: 'Food and drink',
    interests: [
      { id: 'baking', name: 'Baking' },
      { id: 'street-food', name: 'Street food' },
      { id: 'filter-coffee', name: 'Filter coffee' },
      { id: 'vegan', name: 'Vegan' },
      { id: 'biryani', name: 'Biryani' },
    ],
  },
  {
    id: 'music',
    name: 'Music',
    interests: [
      { id: 'indie', name: 'Indie' },
      { id: 'bollywood', name: 'Bollywood' },
      { id: 'classical', name: 'Classical' },
      { id: 'live-gigs', name: 'Live gigs' },
    ],
  },
  {
    id: 'outdoors',
    name: 'Outdoors',
    interests: [
      { id: 'trekking', name: 'Trekking' },
      { id: 'cycling', name: 'Cycling' },
      { id: 'beaches', name: 'Beaches' },
      { id: 'road-trips', name: 'Road trips' },
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    interests: [
      { id: 'cricket', name: 'Cricket' },
      { id: 'football', name: 'Football' },
      { id: 'badminton', name: 'Badminton' },
      { id: 'yoga', name: 'Yoga' },
    ],
  },
  {
    id: 'staying-in',
    name: 'Staying in',
    interests: [
      { id: 'reading', name: 'Reading' },
      { id: 'board-games', name: 'Board games' },
      { id: 'cooking', name: 'Cooking' },
      { id: 'movies', name: 'Movies' },
    ],
  },
];

export const PROMPT_CATALOG: PromptQuestion[] = [
  { id: 'perfect-sunday', text: 'My perfect Sunday is' },
  { id: 'get-along', text: "We'll get along if" },
  { id: 'green-flag', text: 'A green flag I look for' },
  { id: 'win-me-over', text: 'The way to win me over is' },
  { id: 'weirdly-good', text: "I'm weirdly good at" },
  { id: 'karaoke', text: 'My go-to karaoke song' },
  { id: 'fall-for-you', text: "I'll fall for you if" },
];

type Resolve = (accessToken: string) => MockAccount;

export function createMockProfile(
  resolve: Resolve,
  token: () => Promise<string | null>,
  now: () => number = Date.now,
  delay = LATENCY_MS,
) {
  const wait = () => (delay > 0 ? new Promise<void>((r) => setTimeout(r, delay)) : Promise.resolve());
  const fail = (status: number, code: string, details?: Record<string, unknown>): never => {
    throw ApiError.fromResponse(status, { success: false, code, message: code, details, requestId: 'mock' }, null);
  };
  const account = async (): Promise<MockAccount> => {
    await wait();
    const t = await token();
    if (!t) throw ApiError.sessionExpired();
    return resolve(t);
  };
  const guardContact = (fields: Record<string, string | undefined>) => {
    for (const [field, value] of Object.entries(fields)) {
      if (value && containsContactDetails(value)) fail(422, ErrorCode.ContactDetailsNotAllowed, { field });
    }
  };
  const requireProfile = (acc: MockAccount): Profile => acc.profile ?? fail(404, ErrorCode.ProfileNotFound);
  const stamp = () => new Date(now()).toISOString();

  return {
    async createProfile(body: ProfileBasics): Promise<Profile> {
      const acc = await account();
      if (acc.profile) fail(409, ErrorCode.ProfileAlreadyExists);
      const dob = parseDob(body.dateOfBirth.split('-').reverse().join(''));
      if (!dob || ageOn(dob, todayLocal(new Date(now()))) < MIN_AGE) fail(422, ErrorCode.Underage);
      guardContact({ firstName: body.firstName });
      acc.profile = {
        ...body,
        firstName: body.firstName.trim(),
        interestIds: [],
        prompts: [],
        aboutCompletedAt: null,
        promptsCompletedAt: null,
      };
      return acc.profile;
    },

    async updateProfile(body: ProfileAbout): Promise<Profile> {
      const acc = await account();
      const profile = requireProfile(acc);
      guardContact({ bio: body.bio, jobTitle: body.jobTitle, education: body.education });
      Object.assign(profile, body, { aboutCompletedAt: profile.aboutCompletedAt ?? stamp() });
      return profile;
    },

    async getInterestCatalog(): Promise<InterestCategory[]> {
      await wait();
      return INTEREST_CATALOG;
    },

    async putInterests(interestIds: string[]): Promise<Profile> {
      const acc = await account();
      const profile = requireProfile(acc);
      const known = new Set(INTEREST_CATALOG.flatMap((c) => c.interests.map((i) => i.id)));
      const unique = [...new Set(interestIds)];
      if (unique.length < INTERESTS_MIN || unique.length > INTERESTS_MAX || unique.some((id) => !known.has(id))) {
        fail(400, ErrorCode.InvalidInterests);
      }
      profile.interestIds = unique;
      return profile;
    },

    async getPromptCatalog(): Promise<PromptQuestion[]> {
      await wait();
      return PROMPT_CATALOG;
    },

    async putPrompts(prompts: PromptAnswer[]): Promise<Profile> {
      const acc = await account();
      const profile = requireProfile(acc);
      const known = new Set(PROMPT_CATALOG.map((p) => p.id));
      if (prompts.length > PROMPTS_MAX || prompts.some((p) => !known.has(p.promptId) || !p.answer.trim() || p.answer.length > ANSWER_MAX)) {
        fail(400, ErrorCode.ValidationError);
      }
      prompts.forEach((p, i) => guardContact({ [`prompts.${i}`]: p.answer }));
      profile.prompts = prompts;
      profile.promptsCompletedAt = profile.promptsCompletedAt ?? stamp();
      if (acc.nextStep === 'profile') acc.nextStep = 'preferences';
      return profile;
    },
  };
}

export const mockProfile = createMockProfile(
  (t) => mockAuth.accountFor(t),
  () => session.getAccessToken(),
);
