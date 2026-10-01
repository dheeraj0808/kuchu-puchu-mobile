import type { Me } from '@/api/types';

import { INTERESTS_MIN } from './rules';

/**
 * Where onboarding resumes (guide §8). The server's `nextStep` is the source
 * of truth; within `profile` the saved profile decides the screen, so the
 * user can close the app at any step and continue on any device.
 */
export type OnboardingScreen =
  | 'consent'
  | 'selfieReview'
  | 'photos'
  | 'basics'
  | 'about'
  | 'interests'
  | 'prompts'
  | 'preferences'
  | 'location'
  | 'notifications'
  | 'later';

type GateUser = Pick<Me, 'nextStep' | 'profile' | 'preferences' | 'location' | 'notificationsChoiceAt' | 'faceStatus'>;

/**
 * nextStep `selfie`: consent → live selfie; while a review is pending, the
 * in-review screen (photos can be added meanwhile).
 * nextStep `photos`: photos.
 * nextStep `profile`: basics → about → interests → prompts.
 * nextStep `preferences`: preferences → location (city picker if denied) → notifications.
 */
export function resolveOnboardingScreen(me: GateUser | null): OnboardingScreen {
  if (!me) return 'later';
  if (me.nextStep === 'selfie') return me.faceStatus === 'review' ? 'selfieReview' : 'consent';
  if (me.nextStep === 'photos') return 'photos';
  if (me.nextStep === 'preferences') {
    if (!me.preferences) return 'preferences';
    if (!me.location) return 'location';
    if (!me.notificationsChoiceAt) return 'notifications';
    return 'later';
  }
  if (me.nextStep !== 'profile') return 'later';
  const profile = me.profile;
  if (!profile) return 'basics';
  if (!profile.aboutCompletedAt) return 'about';
  if (profile.interestIds.length < INTERESTS_MIN) return 'interests';
  if (!profile.promptsCompletedAt) return 'prompts';
  // Server still says `profile` but everything is saved: wait for it on the placeholder.
  return 'later';
}

/** The deck's 8-segment progress bar, in flow order. */
export const ONBOARDING_SEGMENTS = ['consent', 'selfie', 'photos', 'basics', 'about', 'interests', 'prompts', 'preferences'] as const;
export type OnboardingSegment = (typeof ONBOARDING_SEGMENTS)[number];

/** Segments filled on a screen: every earlier step plus the current one (deck 10 → 4 of 8). */
export function filledSegments(segment: OnboardingSegment): number {
  return ONBOARDING_SEGMENTS.indexOf(segment) + 1;
}
