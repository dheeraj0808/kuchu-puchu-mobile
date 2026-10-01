import { ApiError } from '@/api/errors';
import { resolveErrorUi } from '@/api/errorUi';
import { createMockProfile } from '@/api/mocks/profile';
import type { Me, Profile, PromptAnswer } from '@/api/types';
import {
  ANSWER_MAX,
  INTERESTS_MAX,
  PROMPTS_MAX,
  ageOn,
  answerProblem,
  canAddPrompt,
  canContinueInterests,
  containsContactDetails,
  dobProblem,
  formatDobInput,
  matchesSearch,
  nameProblem,
  parseDob,
  removeAnswer,
  toIsoDate,
  toggleInterest,
  upsertAnswer,
} from '@/features/onboarding/rules';
import { filledSegments, resolveOnboardingScreen } from '@/features/onboarding/steps';
import { contactDetailsField } from '@/features/onboarding/useSaveStep';

jest.mock('expo-secure-store', () => ({}));

const TODAY = { year: 2026, month: 10, day: 1 };

describe('first name', () => {
  it.each([
    ['', 'tooShort'],
    ['A', 'tooShort'],
    ['  A  ', 'tooShort'],
    ['Al', null],
    ['Ananya', null],
    ['x'.repeat(50), null],
    ['x'.repeat(51), 'tooLong'],
  ])('%p → %p', (name, problem) => {
    expect(nameProblem(name)).toBe(problem);
  });
});

describe('date of birth', () => {
  it('formats as the user types', () => {
    expect(formatDobInput('1')).toBe('1');
    expect(formatDobInput('1403')).toBe('14 / 03');
    expect(formatDobInput('14032000')).toBe('14 / 03 / 2000');
    expect(formatDobInput('14 / 03 / 20001999')).toBe('14 / 03 / 2000');
  });

  it('rejects impossible dates', () => {
    expect(parseDob('31 / 02 / 2000')).toBeNull();
    expect(parseDob('00 / 01 / 2000')).toBeNull();
    expect(parseDob('01 / 13 / 2000')).toBeNull();
    expect(parseDob('29 / 02 / 2001')).toBeNull();
    expect(parseDob('29 / 02 / 2000')).toEqual({ year: 2000, month: 2, day: 29 });
  });

  it('18+ boundary: turning 18 today is allowed, tomorrow is not', () => {
    expect(dobProblem('01 / 10 / 2008', TODAY)).toBeNull(); // 18th birthday today
    expect(dobProblem('02 / 10 / 2008', TODAY)).toBe('underage'); // 18 tomorrow
    expect(dobProblem('30 / 09 / 2008', TODAY)).toBeNull();
    expect(ageOn({ year: 2008, month: 10, day: 2 }, TODAY)).toBe(17);
  });

  it('matches the deck: 14/03/2000 is 26 on 1 Oct 2026', () => {
    expect(ageOn(parseDob('14 / 03 / 2000')!, TODAY)).toBe(26);
  });

  it('reports incomplete, future and invalid dates', () => {
    expect(dobProblem('14 / 03', TODAY)).toBe('incomplete');
    expect(dobProblem('01 / 01 / 2030', TODAY)).toBe('future');
    expect(dobProblem('01 / 01 / 1850', TODAY)).toBe('invalid');
  });

  it('sends ISO dates', () => {
    expect(toIsoDate({ year: 2000, month: 3, day: 4 })).toBe('2000-03-04');
  });
});

describe('interests 3–10', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `i${i}`);

  it('Continue needs 3 to 10', () => {
    expect(canContinueInterests(2)).toBe(false);
    expect(canContinueInterests(3)).toBe(true);
    expect(canContinueInterests(10)).toBe(true);
    expect(canContinueInterests(11)).toBe(false);
  });

  it('blocks an 11th pick and says so', () => {
    const result = toggleInterest(ids(INTERESTS_MAX), 'extra');
    expect(result.limitReached).toBe(true);
    expect(result.selected).toHaveLength(10);
  });

  it('toggles off, and adding below the limit works', () => {
    expect(toggleInterest(['a', 'b'], 'a')).toEqual({ selected: ['b'], limitReached: false });
    expect(toggleInterest(ids(9), 'x').selected).toHaveLength(10);
    expect(toggleInterest(ids(10), 'i3')).toEqual({ selected: ids(10).filter((i) => i !== 'i3'), limitReached: false });
  });

  it('search ignores case and accents', () => {
    expect(matchesSearch('Filter coffee', 'COFF')).toBe(true);
    expect(matchesSearch('Café hopping', 'cafe')).toBe(true);
    expect(matchesSearch('Baking', 'trek')).toBe(false);
  });
});

describe('prompts: max 3, 200 chars', () => {
  const three: PromptAnswer[] = [
    { promptId: 'a', answer: '1' },
    { promptId: 'b', answer: '2' },
    { promptId: 'c', answer: '3' },
  ];

  it('never holds more than 3', () => {
    expect(canAddPrompt(three)).toBe(false);
    expect(upsertAnswer(three, 'd', 'four')).toHaveLength(PROMPTS_MAX);
    expect(canAddPrompt(three.slice(0, 2))).toBe(true);
  });

  it('edits in place and removes', () => {
    expect(upsertAnswer(three, 'b', '  new  ')[1]).toEqual({ promptId: 'b', answer: 'new' });
    expect(removeAnswer(three, 'b').map((a) => a.promptId)).toEqual(['a', 'c']);
  });

  it('caps answers at 200 characters', () => {
    expect(answerProblem('x'.repeat(ANSWER_MAX))).toBeNull();
    expect(answerProblem('x'.repeat(ANSWER_MAX + 1))).toBe('tooLong');
    expect(answerProblem('   ')).toBe('empty');
    expect(upsertAnswer([], 'a', 'y'.repeat(250))[0].answer).toHaveLength(ANSWER_MAX);
  });
});

describe('CONTACT_DETAILS_NOT_ALLOWED field highlight', () => {
  const contactError = (field?: string) =>
    ApiError.fromResponse(422, { code: 'CONTACT_DETAILS_NOT_ALLOWED', message: 'x', details: field ? { field } : undefined }, null);

  it('names the field to highlight from details.field', () => {
    expect(contactDetailsField(contactError('bio'))).toBe('bio');
    expect(contactDetailsField(contactError('prompts.1'))).toBe('prompts.1');
    expect(contactDetailsField(contactError())).toBe('unknown');
    expect(contactDetailsField(ApiError.network())).toBeNull();
    expect(resolveErrorUi(contactError('jobTitle'))).toMatchObject({ action: 'fieldErrors', field: 'jobTitle' });
  });

  it('mock detects 10 digits or "@"', () => {
    expect(containsContactDetails('call me 98765 43210')).toBe(true);
    expect(containsContactDetails('+91-98765-43210')).toBe(true);
    expect(containsContactDetails('insta @ananya')).toBe(true);
    expect(containsContactDetails('I bake 3 cakes a week since 2019')).toBe(false);
  });

  it('mock PATCH /profile returns 422 with the offending field', async () => {
    const account = { nextStep: 'profile' as const, profile: null as Profile | null };
    const mock = createMockProfile(() => account, async () => 'token', () => Date.parse('2026-10-01T00:00:00Z'), 0);
    await mock.createProfile({ firstName: 'Ananya', dateOfBirth: '2000-03-14', gender: 'woman', showGender: true });
    await expect(mock.updateProfile({ jobTitle: 'Designer', bio: 'text me on 9876543210' })).rejects.toMatchObject({
      status: 422,
      code: 'CONTACT_DETAILS_NOT_ALLOWED',
      details: { field: 'bio' },
    });
    expect(account.profile?.aboutCompletedAt).toBeNull();
  });
});

describe('resume at the correct step from nextStep', () => {
  const profile = (over: Partial<Profile> = {}): Profile => ({
    firstName: 'Ananya',
    dateOfBirth: '2000-03-14',
    gender: 'woman',
    showGender: true,
    interestIds: [],
    prompts: [],
    aboutCompletedAt: null,
    promptsCompletedAt: null,
    ...over,
  });
  const me = (nextStep: Me['nextStep'], p: Profile | null) => ({ nextStep, profile: p });

  it.each([
    ['no profile yet', me('profile', null), 'basics'],
    ['basics saved', me('profile', profile()), 'about'],
    ['about skipped', me('profile', profile({ aboutCompletedAt: '2026-10-01' })), 'interests'],
    ['2 interests only', me('profile', profile({ aboutCompletedAt: 'x', interestIds: ['a', 'b'] })), 'interests'],
    ['3 interests', me('profile', profile({ aboutCompletedAt: 'x', interestIds: ['a', 'b', 'c'] })), 'prompts'],
    ['prompts saved', me('profile', profile({ aboutCompletedAt: 'x', interestIds: ['a', 'b', 'c'], promptsCompletedAt: 'x' })), 'later'],
    ['server moved on', me('preferences', profile()), 'preferences'],
    ['selfie first', me('selfie', null), 'consent'],
  ] as const)('%s → %s', (_label, user, screen) => {
    expect(resolveOnboardingScreen(user)).toBe(screen);
  });

  it('full mock run advances nextStep to preferences only after prompts', async () => {
    const account = { nextStep: 'profile' as Me['nextStep'] & string, profile: null as Profile | null };
    const mock = createMockProfile(() => account as never, async () => 'token', () => Date.parse('2026-10-01T00:00:00Z'), 0);
    const state = () => resolveOnboardingScreen({ nextStep: account.nextStep, profile: account.profile });

    expect(state()).toBe('basics');
    await mock.createProfile({ firstName: 'Ananya', dateOfBirth: '2000-03-14', gender: 'woman', showGender: true });
    expect(state()).toBe('about');
    await mock.updateProfile({}); // Skip
    expect(state()).toBe('interests');
    await expect(mock.putInterests(['baking', 'indie'])).rejects.toMatchObject({ code: 'INVALID_INTERESTS' });
    await mock.putInterests(['baking', 'indie', 'beaches']);
    expect(state()).toBe('prompts');
    await mock.putPrompts([{ promptId: 'perfect-sunday', answer: 'Filter coffee and a long walk.' }]);
    expect(account.nextStep).toBe('preferences');
    expect(state()).toBe('preferences');
  });

  it('mock rejects under-18 and duplicate profiles', async () => {
    const account = { nextStep: 'profile' as const, profile: null as Profile | null };
    const mock = createMockProfile(() => account, async () => 'token', () => Date.parse('2026-10-01T00:00:00Z'), 0);
    await expect(
      mock.createProfile({ firstName: 'Teen', dateOfBirth: '2008-10-02', gender: 'man', showGender: true }),
    ).rejects.toMatchObject({ code: 'UNDERAGE' });
    await mock.createProfile({ firstName: 'Adult', dateOfBirth: '2008-10-01', gender: 'man', showGender: true });
    await expect(
      mock.createProfile({ firstName: 'Again', dateOfBirth: '2000-01-01', gender: 'man', showGender: true }),
    ).rejects.toMatchObject({ code: 'PROFILE_ALREADY_EXISTS' });
  });

  it('progress bar fills like the deck (10 → 4, 11 → 5, 12 → 6, 13 → 7 of 8)', () => {
    expect([filledSegments('basics'), filledSegments('about'), filledSegments('interests'), filledSegments('prompts')]).toEqual([4, 5, 6, 7]);
  });
});
