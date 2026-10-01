import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockProfile } from '../mocks/profile';
import type { InterestCategory, Profile, ProfileAbout, ProfileBasics, PromptAnswer, PromptQuestion } from '../types';

/** Profile endpoints (guide M09), relative to /api/v1. */
export const PROFILE_ENDPOINTS = {
  profile: '/profile',
  interests: '/profile/interests',
  prompts: '/profile/prompts',
  interestCatalog: '/catalog/interests',
  promptCatalog: '/catalog/prompts',
} as const;

const mock = env.useAuthMock ? mockProfile : null;

/** Screen 10. 422 CONTACT_DETAILS_NOT_ALLOWED · 422 UNDERAGE · 409 PROFILE_ALREADY_EXISTS. */
export function createProfile(body: ProfileBasics): Promise<Profile> {
  if (mock) return mock.createProfile(body);
  return authedRequest<Profile>(PROFILE_ENDPOINTS.profile, { method: 'POST', body });
}

/** Screen 11 (and Skip, with `{}`). 422 CONTACT_DETAILS_NOT_ALLOWED with details.field. */
export function updateProfile(body: ProfileAbout): Promise<Profile> {
  if (mock) return mock.updateProfile(body);
  return authedRequest<Profile>(PROFILE_ENDPOINTS.profile, { method: 'PATCH', body, retry: true });
}

export function getInterestCatalog(): Promise<InterestCategory[]> {
  if (mock) return mock.getInterestCatalog();
  return authedRequest<InterestCategory[]>(PROFILE_ENDPOINTS.interestCatalog);
}

/** Screen 12: 3–10 ids. */
export function putInterests(interestIds: string[]): Promise<Profile> {
  if (mock) return mock.putInterests(interestIds);
  return authedRequest<Profile>(PROFILE_ENDPOINTS.interests, { method: 'PUT', body: { interestIds }, retry: true });
}

export function getPromptCatalog(): Promise<PromptQuestion[]> {
  if (mock) return mock.getPromptCatalog();
  return authedRequest<PromptQuestion[]>(PROFILE_ENDPOINTS.promptCatalog);
}

/** Screen 13 (and Skip, with `[]`): up to 3 answers of ≤ 200 chars. */
export function putPrompts(prompts: PromptAnswer[]): Promise<Profile> {
  if (mock) return mock.putPrompts(prompts);
  return authedRequest<Profile>(PROFILE_ENDPOINTS.prompts, { method: 'PUT', body: { prompts }, retry: true });
}
