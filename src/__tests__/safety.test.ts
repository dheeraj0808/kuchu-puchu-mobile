import { ApiError, ErrorCode } from '@/api/errors';
import { resolveErrorUi } from '@/api/errorUi';
import { createMockSafety, MOCK_PEOPLE } from '@/api/mocks/safety';
import type { AuthTokens, Me } from '@/api/types';
import { restrictionFrom } from '@/auth/restriction';
import { SessionManager } from '@/auth/session';
import { REPORT_CATEGORIES, REPORT_DETAILS_MAX, detailsProblem, submitReportFlow } from '@/features/safety/reportFlow';
import { describeRestriction } from '@/features/safety/restriction';
import { formatBlockedDate } from '@/features/safety/useBlocks';

jest.mock('expo-secure-store', () => ({}));

const restricted = (details: Record<string, unknown>) =>
  ApiError.fromResponse(403, { code: 'ACCOUNT_RESTRICTED', message: 'server words', details }, null);

describe('report flow', () => {
  const deps = () => ({ report: jest.fn(async () => ({ message: 'Report received' })), block: jest.fn(async () => ({ id: 'b', userId: 'u', name: 'Rohan', blockedAt: '' })) });

  it('reports, then blocks when "Also block" is on (the default)', async () => {
    const d = deps();
    await expect(submitReportFlow({ targetUserId: 'user-rohan', category: 'scam', details: '  asked for money  ', alsoBlock: true }, d)).resolves.toEqual({
      blocked: true,
      blockFailed: false,
    });
    expect(d.report).toHaveBeenCalledWith({ targetUserId: 'user-rohan', category: 'scam', details: 'asked for money' });
    expect(d.block).toHaveBeenCalledWith('user-rohan');
    expect(d.report.mock.invocationCallOrder[0]).toBeLessThan(d.block.mock.invocationCallOrder[0]!);
  });

  it('without block: no POST /blocks, and empty details are not sent', async () => {
    const d = deps();
    await expect(submitReportFlow({ targetUserId: 'user-rohan', category: 'harassment', details: '   ', alsoBlock: false }, d)).resolves.toEqual({
      blocked: false,
      blockFailed: false,
    });
    expect(d.report).toHaveBeenCalledWith({ targetUserId: 'user-rohan', category: 'harassment' });
    expect(d.block).not.toHaveBeenCalled();
  });

  it('a failed block keeps the report and offers "Block now"', async () => {
    const d = { ...deps(), block: jest.fn().mockRejectedValue(ApiError.network()) };
    await expect(submitReportFlow({ targetUserId: 'user-rohan', category: 'threats', details: '', alsoBlock: true }, d)).resolves.toEqual({
      blocked: false,
      blockFailed: true,
    });
  });

  it('a failed report throws and never blocks', async () => {
    const d = { ...deps(), report: jest.fn().mockRejectedValue(ApiError.network()) };
    await expect(submitReportFlow({ targetUserId: 'user-rohan', category: 'other', details: '', alsoBlock: true }, d)).rejects.toMatchObject({ kind: 'network' });
    expect(d.block).not.toHaveBeenCalled();
  });

  it('details are limited to 1000 characters', () => {
    expect(detailsProblem('x'.repeat(REPORT_DETAILS_MAX))).toBeNull();
    expect(detailsProblem('x'.repeat(REPORT_DETAILS_MAX + 1))).toBe('tooLong');
  });

  it('offers the 7 deck categories in order', () => {
    expect(REPORT_CATEGORIES).toEqual(['fake_profile', 'scam', 'harassment', 'explicit_content', 'underage', 'threats', 'other']);
  });
});

describe('mock M13/M14', () => {
  const setup = (appealAllowed = true) => {
    const acc: Record<string, unknown> & { nextStep: 'done'; profile: null } = { nextStep: 'done', profile: null };
    const mock = createMockSafety(() => acc as never, () => acc as never, async () => 't', { now: () => Date.parse('2026-10-01T10:00:00Z'), delay: 0, appealAllowed: () => appealAllowed });
    return { mock, acc };
  };

  it('the report answer never contains an outcome', async () => {
    const { mock } = setup();
    const answers = await Promise.all(['scam', 'harassment', 'underage'].map((c) => mock.submitReport({ targetUserId: 'user-rohan', category: c as never })));
    answers.forEach((a) => expect(a).toEqual({ message: 'Report received' }));
    await expect(mock.submitReport({ targetUserId: 'user-rohan', category: 'other', details: 'x'.repeat(1001) })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('reporting an unknown or hidden person looks like "no longer available"', async () => {
    const { mock } = setup();
    const err = (await mock.submitReport({ targetUserId: 'user-gone', category: 'scam' }).catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(404);
    expect(err.message).toBe('This profile is no longer available.');
  });

  it('blocks, lists newest first, and unblock removes the row', async () => {
    const { mock } = setup();
    expect((await mock.listBlocks()).map((b) => b.name)).toEqual(['Vikram', 'Aman', 'Sid']);
    const block = await mock.blockUser('user-rohan');
    expect((await mock.listBlocks())[0]).toEqual(block);
    await expect(mock.blockUser('user-rohan')).resolves.toEqual(block); // idempotent
    await mock.unblock(block.id);
    expect((await mock.listBlocks()).map((b) => b.name)).toEqual(['Vikram', 'Aman', 'Sid']);
    await expect(mock.unblock(block.id)).rejects.toMatchObject({ status: 404 });
    expect(Object.keys(MOCK_PEOPLE)).toContain('user-rohan');
  });

  it('blocked dates read like the deck', () => {
    expect(formatBlockedDate('2026-09-12T10:00:00.000Z')).toBe('12 Sept');
  });

  it('appeal: 10–1000 characters; refused when not allowed', async () => {
    await expect(setup().mock.submitAppeal('too short')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(setup().mock.submitAppeal('I was reported by mistake, please look again.')).resolves.toEqual({ message: 'Appeal received' });
    await expect(setup(false).mock.submitAppeal('I was reported by mistake, please look again.')).rejects.toMatchObject({ status: 403 });
  });
});

describe('restricted gate (suspended / banned / appeal not allowed)', () => {
  it('reads 403 ACCOUNT_RESTRICTED details defensively', () => {
    expect(restrictionFrom(restricted({ status: 'suspended', reasonCategory: 'harassment', endsAt: '2026-10-12T00:00:00Z', appealAllowed: true }))).toEqual({
      status: 'suspended',
      reasonCategory: 'harassment',
      endsAt: '2026-10-12T00:00:00Z',
      appealAllowed: true,
    });
    expect(restrictionFrom(restricted({ status: 'banned', reasonCategory: 'weird', endsAt: '2026-10-12T00:00:00Z' }))).toEqual({
      status: 'banned',
      reasonCategory: 'other',
      endsAt: null,
      appealAllowed: false,
    });
    expect(restrictionFrom(ApiError.network())).toBeNull();
    expect(resolveErrorUi(restricted({})).action).toBe('restricted');
  });

  it('describes suspended and banned accounts as in the deck', () => {
    expect(describeRestriction({ status: 'suspended', reasonCategory: 'harassment', endsAt: '2026-10-12T06:00:00Z', appealAllowed: true })).toEqual({
      title: 'Your account is suspended',
      body: 'Reason: harassment. Your suspension ends on 12 Oct 2026.',
    });
    expect(describeRestriction({ status: 'banned', reasonCategory: 'scam', endsAt: null, appealAllowed: false }).title).toBe('Your account has been banned');
  });

  const tokens: AuthTokens = {
    accessToken: 'a1',
    refreshToken: 'r1',
    tokenType: 'Bearer',
    accessTokenExpiresIn: 900,
    refreshTokenExpiresAt: '2026-10-08T00:00:00Z',
    user: { id: 'u', email: null, phone: '+919876543210', emailVerified: false, phoneVerified: true, status: 'suspended', role: 'user', createdAt: '' },
  };
  const storage = (initial: string | null = null) => {
    let v = initial;
    return {
      getRefreshToken: async () => v,
      setRefreshToken: async (x: string) => ((v = x), true),
      clearRefreshToken: async () => void (v = null),
      getDeviceId: async () => null,
      setDeviceId: async () => true,
      peek: () => v,
    };
  };
  const banned = restricted({ status: 'banned', reasonCategory: 'scam', appealAllowed: false });

  it('/auth/me at sign-in → restricted, session kept for the appeal', async () => {
    const st = storage();
    const s = new SessionManager({ refreshSession: jest.fn(), logout: jest.fn(), fetchMe: jest.fn().mockRejectedValue(banned) }, st);
    await s.signIn(tokens);
    expect(s.getSnapshot()).toMatchObject({ status: 'signedIn', restriction: { status: 'banned', appealAllowed: false } });
    expect(st.peek()).toBe('r1');
  });

  it('/auth/me at launch → restricted instead of signing out', async () => {
    const s = new SessionManager(
      { refreshSession: jest.fn(async () => tokens), logout: jest.fn(), fetchMe: jest.fn().mockRejectedValue(restricted({ status: 'suspended', reasonCategory: 'harassment', endsAt: '2026-10-12T00:00:00Z', appealAllowed: true })) },
      storage('r0'),
    );
    await s.restore();
    expect(s.getSnapshot()).toMatchObject({ status: 'signedIn', restriction: { status: 'suspended', appealAllowed: true } });
  });

  it('any later request can restrict; a good /auth/me lifts it; sign-out clears it', async () => {
    const me = { ...tokens.user, status: 'active', profile: null } as Me;
    const s = new SessionManager({ refreshSession: jest.fn(), logout: jest.fn(async () => ({ message: 'ok' })), fetchMe: jest.fn(async () => me) }, storage());
    await s.signIn(tokens);
    expect(s.reportRestriction(ApiError.network())).toBe(false);
    expect(s.reportRestriction(banned)).toBe(true);
    expect(s.getSnapshot().restriction?.status).toBe('banned');
    s.updateUser(me);
    expect(s.getSnapshot().restriction).toBeNull();
    s.reportRestriction(banned);
    await s.signOut();
    expect(s.getSnapshot()).toMatchObject({ status: 'signedOut', restriction: null });
  });
});

describe('never reveal a block: 404s look the same', () => {
  it.each(['USER_NOT_FOUND', 'PROFILE_NOT_FOUND', 'REPORT_TARGET_INVALID'])('%s → "This profile is no longer available."', (code) => {
    const err = ApiError.fromResponse(404, { code, message: 'blocked by user' }, null);
    expect(err.message).toBe('This profile is no longer available.');
    expect(resolveErrorUi(err).action).toBe('notFound');
  });

  it('MATCH_NOT_FOUND → "This conversation is no longer available."', () => {
    expect(ApiError.fromResponse(404, { code: ErrorCode.MatchNotFound, message: 'x' }, null).message).toBe('This conversation is no longer available.');
  });
});
