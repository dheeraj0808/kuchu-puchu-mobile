import { ApiError, ErrorCode } from '@/api/errors';
import { createMockVerification, PHOTO_APPROVE_MS, REVIEW_AUTO_APPROVE_MS, type MockVerificationAccount } from '@/api/mocks/verification';
import type { FaceResult, Me, Photo } from '@/api/types';
import { resolveOnboardingScreen } from '@/features/onboarding/steps';
import { MockLivenessProvider, randomSteps } from '@/features/verification/liveness/MockLivenessProvider';
import type { LivenessProvider } from '@/features/verification/liveness/types';
import { canContinuePhotos, localFileProblem, movePhoto, resizeFor, summarizePhotos, MIN_APPROVED_PHOTOS } from '@/features/verification/photoRules';
import { startPolling } from '@/features/verification/poller';
import { preparePhoto } from '@/features/verification/preparePhoto';
import { routeForFaceResult, SelfieController, type SelfieState } from '@/features/verification/selfieController';

jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('consent and selfie gate', () => {
  const me = (over: Partial<Me>) => ({ nextStep: 'selfie', profile: null, ...over }) as Me;

  it.each([
    [{ nextStep: 'selfie' }, 'consent'],
    [{ nextStep: 'selfie', faceStatus: 'none' }, 'consent'],
    [{ nextStep: 'selfie', faceStatus: 'rejected' }, 'consent'],
    [{ nextStep: 'selfie', faceStatus: 'review' }, 'selfieReview'],
    [{ nextStep: 'photos', faceStatus: 'approved' }, 'photos'],
  ] as const)('%p → %s', (over, screen) => {
    expect(resolveOnboardingScreen(me(over as Partial<Me>))).toBe(screen);
  });

  it('a face session needs the consent version', async () => {
    const acc: MockVerificationAccount = { nextStep: 'selfie', profile: null };
    const mock = createMockVerification(() => acc, async () => 't', Date.now, 0);
    await expect(mock.createFaceSession('')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(mock.createFaceSession('2026-10-01')).resolves.toMatchObject({ provider: 'mock' });
  });
});

describe('liveness result routing', () => {
  it.each([
    [{ status: 'approved' }, 'photos'],
    [{ status: 'review' }, 'review'],
    [{ status: 'rejected', reason: 'x', attemptsLeft: 2 }, 'retry'],
  ] as const)('%p → %s', (result, route) => {
    expect(routeForFaceResult(result as FaceResult)).toBe(route);
  });

  const instantProvider = (): LivenessProvider => ({
    name: 'test',
    start: async (_id, cb) => {
      cb.onInstruction('turnLeft');
      cb.onProgress(0.5);
      return { kind: 'captured' };
    },
    cancel: () => undefined,
  });

  const run = async (complete: () => Promise<FaceResult>, createSession = async () => ({ sessionId: 's1', provider: 'mock' as const })) => {
    const states: SelfieState[] = [];
    const c = new SelfieController((s) => states.push(s), () => 'error', { createSession, complete, providerFor: instantProvider });
    await c.start();
    return states;
  };

  it('approved / review / rejected come only from /face/complete', async () => {
    expect((await run(async () => ({ status: 'approved' }))).at(-1)).toEqual({ kind: 'approved' });
    expect((await run(async () => ({ status: 'review' }))).at(-1)).toEqual({ kind: 'review' });
    expect((await run(async () => ({ status: 'rejected', reason: 'Too dark', attemptsLeft: 1 }))).at(-1)).toEqual({
      kind: 'rejected',
      reason: 'Too dark',
      attemptsLeft: 1,
    });
  });

  it('shows checking (not verified) between capture and the server decision', async () => {
    const states = await run(async () => ({ status: 'approved' }));
    expect(states.map((s) => s.kind)).toEqual(['starting', 'capturing', 'capturing', 'checking', 'approved']);
  });

  it('429 VERIFICATION_ATTEMPTS_EXCEEDED → "Try again tomorrow"', async () => {
    const exceeded = () => Promise.reject(ApiError.fromResponse(429, { code: 'VERIFICATION_ATTEMPTS_EXCEEDED', message: 'x' }, null));
    expect((await run(async () => ({ status: 'approved' }), exceeded)).at(-1)).toEqual({ kind: 'exceeded' });
  });

  it('mock counts attempts down and then refuses new sessions', async () => {
    const acc: MockVerificationAccount = { nextStep: 'selfie', profile: null };
    const mock = createMockVerification(() => acc, async () => 't', Date.now, 0, { selfieResult: () => 'rejected', photoException: () => 'none' });
    for (const left of [2, 1, 0]) {
      const s = await mock.createFaceSession('v');
      await expect(mock.completeFaceSession(s.sessionId)).resolves.toMatchObject({ status: 'rejected', attemptsLeft: left });
    }
    await expect(mock.createFaceSession('v')).rejects.toMatchObject({ status: 429, code: ErrorCode.VerificationAttemptsExceeded });
  });

  it('random head-turn steps never repeat back to back', () => {
    const seq = [0, 0, 0.5, 0.9, 0.9, 0.1];
    let i = 0;
    const steps = randomSteps(4, () => seq[i++ % seq.length]!);
    expect(steps).toHaveLength(4);
    steps.slice(1).forEach((s, k) => expect(s).not.toBe(steps[k]));
  });
});

describe('background restart', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('leaving mid-capture cancels; returning starts a brand-new session', async () => {
    let sessions = 0;
    const createSession = jest.fn(async () => ({ sessionId: `s${sessions++}`, provider: 'mock' as const }));
    const complete = jest.fn(async () => ({ status: 'approved' as const }));
    const providers: MockLivenessProvider[] = [];
    const states: SelfieState[] = [];
    const c = new SelfieController((s) => states.push(s), () => 'error', {
      createSession,
      complete,
      providerFor: () => {
        const p = new MockLivenessProvider(1000, () => 0.3);
        providers.push(p);
        return p;
      },
    });

    void c.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(c.state.kind).toBe('capturing');

    c.onAppState('background');
    await Promise.resolve();
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled(); // the cancelled capture never reaches the server

    c.onAppState('active');
    await Promise.resolve();
    await Promise.resolve();
    expect(createSession).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(10_000);
    await jest.runOnlyPendingTimersAsync();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith('s1');
    expect(c.state.kind).toBe('approved');
  });

  it('coming back to the foreground does nothing when nothing was interrupted', async () => {
    const createSession = jest.fn(async () => ({ sessionId: 's', provider: 'mock' as const }));
    const c = new SelfieController(() => undefined, () => 'e', {
      createSession,
      complete: async () => ({ status: 'review' }),
      providerFor: () => ({ name: 't', start: async () => ({ kind: 'captured' }), cancel: () => undefined }),
    });
    jest.useRealTimers();
    await c.start();
    c.onAppState('background');
    c.onAppState('active');
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});

describe('review polling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('polls every 60 s, refreshes on foreground, and stops when the screen is left', () => {
    const tick = jest.fn();
    const poll = startPolling(tick, 60_000);
    jest.advanceTimersByTime(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
    poll.refreshNow();
    expect(tick).toHaveBeenCalledTimes(2);
    poll.stop();
    jest.advanceTimersByTime(10 * 60_000);
    poll.refreshNow();
    expect(tick).toHaveBeenCalledTimes(2);
    expect(poll.running).toBe(false);
  });

  it('mock review approves after 30 s and nextStep moves to photos', async () => {
    let now = 0;
    const acc: MockVerificationAccount = { nextStep: 'selfie', profile: null };
    const mock = createMockVerification(() => acc, async () => 't', () => now, 0, { selfieResult: () => 'review', photoException: () => 'none' });
    const s = await mock.createFaceSession('v');
    await mock.completeFaceSession(s.sessionId);
    expect(mock.sync(acc)).toEqual({ faceStatus: 'review' });
    expect(acc.nextStep).toBe('selfie');
    now = REVIEW_AUTO_APPROVE_MS;
    expect((await mock.getVerification()).face.status).toBe('approved');
    mock.sync(acc);
    expect(acc.nextStep).toBe('photos');
  });
});

describe('image preparation', () => {
  it('resizes the longest edge to 2048 and never upscales', () => {
    expect(resizeFor(4032, 3024)).toEqual({ width: 2048 });
    expect(resizeFor(3024, 4032)).toEqual({ height: 2048 });
    expect(resizeFor(2048, 1536)).toBeNull();
    expect(resizeFor(1200, 1600)).toBeNull();
  });

  it('always re-encodes to JPEG with a safe file name', async () => {
    const manipulate = jest.fn(async () => ({ uri: 'file:///out.jpg', width: 1536, height: 2048 }));
    const file = await preparePhoto({ uri: 'file:///IMG 0042.HEIC', width: 3024, height: 4032, fileName: 'IMG 0042.HEIC' }, manipulate);
    expect(manipulate).toHaveBeenCalledWith('file:///IMG 0042.HEIC', { height: 2048 });
    expect(file).toEqual({ uri: 'file:///out.jpg', name: 'IMG0042.jpg', type: 'image/jpeg', width: 1536, height: 2048, size: null });
  });

  it('rejects photos that are too small before uploading', () => {
    expect(localFileProblem({ width: 399, height: 800 })).toBe('tooSmall');
    expect(localFileProblem({ width: 800, height: 800, mimeType: 'image/gif' })).toBe('type');
    expect(localFileProblem({ width: 3024, height: 4032, mimeType: 'image/heic' })).toBeNull();
  });
});

describe('approved-count rule and reorder', () => {
  const photo = (id: string, status: Photo['status']): Photo => ({ id, status, rejectionReason: null, urls: { thumb: id, medium: id, large: id } });

  it(`Continue needs ${MIN_APPROVED_PHOTOS} approved photos`, () => {
    const three = [photo('a', 'approved'), photo('b', 'approved'), photo('c', 'approved'), photo('d', 'review')];
    expect(canContinuePhotos(three)).toBe(false);
    expect(summarizePhotos(three)).toEqual({ approved: 3, inReview: 1, rejected: 0, needed: 4 });
    expect(canContinuePhotos([...three.slice(0, 3), photo('d', 'approved')])).toBe(true);
    expect(canContinuePhotos([photo('a', 'approved'), photo('b', 'approved'), photo('c', 'approved'), photo('d', 'rejected'), photo('e', 'review')])).toBe(false);
  });

  it('moves photos; the first one is the main photo', () => {
    expect(movePhoto(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    expect(movePhoto(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(movePhoto(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b']);
    expect(movePhoto(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('photo error codes (mock M12)', () => {
  const file = (over = {}) => ({ uri: 'file:///p.jpg', name: 'p.jpg', type: 'image/jpeg' as const, width: 1536, height: 2048, size: 900_000, ...over });
  const setup = (exception: 'none' | 'review' | 'rejected' = 'none') => {
    let now = 0;
    const acc: MockVerificationAccount = { nextStep: 'photos', profile: null, face: { status: 'approved', submittedAt: 0, reviewedAt: 0, attemptsLeft: 3 } };
    const mock = createMockVerification(() => acc, async () => 't', () => now, 0, { selfieResult: () => 'approved', photoException: () => exception });
    return { mock, acc, advance: (ms: number) => (now += ms) };
  };

  it('400 PHOTO_INVALID_FILE for small or non-JPEG files', async () => {
    const { mock } = setup();
    await expect(mock.uploadPhoto(file({ width: 300 }))).rejects.toMatchObject({ status: 400, code: 'PHOTO_INVALID_FILE' });
    await expect(mock.uploadPhoto(file({ size: 11 * 1024 * 1024 }))).rejects.toMatchObject({ code: 'PHOTO_INVALID_FILE' });
  });

  it('409 PHOTO_LIMIT_REACHED after 6 photos', async () => {
    const { mock } = setup();
    for (let i = 0; i < 6; i += 1) await mock.uploadPhoto(file());
    await expect(mock.uploadPhoto(file())).rejects.toMatchObject({ status: 409, code: 'PHOTO_LIMIT_REACHED' });
  });

  it('422 PHOTO_FACE_MISMATCH when a rejected photo is made main', async () => {
    const { mock } = setup('rejected');
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) ids.push((await mock.uploadPhoto(file())).id);
    await expect(mock.reorderPhotos([ids[3]!, ids[0]!, ids[1]!, ids[2]!])).rejects.toMatchObject({ status: 422, code: 'PHOTO_FACE_MISMATCH' });
    await expect(mock.reorderPhotos([ids[1]!, ids[0]!, ids[2]!, ids[3]!])).resolves.toHaveLength(4);
  });

  it('messages are mapped by code (guide §11)', () => {
    const msg = (code: string, status: number) => ApiError.fromResponse(status, { code, message: 'server words' }, null).message;
    expect(msg('PHOTO_FACE_MISMATCH', 422)).toBe('Your main photo must clearly show you');
    expect(msg('PHOTO_INVALID_FILE', 400)).toBe('Use a JPG or PNG photo, at least 400×400, under 10 MB');
    expect(msg('PHOTO_LIMIT_REACHED', 409)).toMatch(/Remove one/);
  });

  it('photos auto-approve after 3 s; 4 approved moves nextStep to profile', async () => {
    const { mock, acc, advance } = setup('review');
    for (let i = 0; i < 4; i += 1) await mock.uploadPhoto(file());
    expect((await mock.listPhotos()).map((p) => p.status)).toEqual(['review', 'review', 'review', 'review']);
    advance(PHOTO_APPROVE_MS);
    expect((await mock.listPhotos()).map((p) => p.status)).toEqual(['approved', 'approved', 'approved', 'review']);
    mock.sync(acc);
    expect(acc.nextStep).toBe('photos');
    await mock.uploadPhoto(file());
    advance(PHOTO_APPROVE_MS);
    mock.sync(acc);
    expect(acc.nextStep).toBe('profile');
  });

  it('delete removes the photo; unknown id is 404', async () => {
    const { mock } = setup();
    const p = await mock.uploadPhoto(file());
    await mock.deletePhoto(p.id);
    expect(await mock.listPhotos()).toEqual([]);
    await expect(mock.deletePhoto(p.id)).rejects.toMatchObject({ status: 404 });
  });

  it('cancelling an upload aborts it', async () => {
    const { mock } = setup();
    const abort = new AbortController();
    abort.abort();
    await expect(mock.uploadPhoto(file(), undefined, abort.signal)).rejects.toMatchObject({ code: 'ABORTED' });
    await flush();
  });
});
