import { ApiError } from '@/api/errors';
import { createMockDiscovery } from '@/api/mocks/discovery';
import type { DiscoveryCard, LikeResult } from '@/api/types';
import { applyPreferences, widenedDistance } from '@/features/discovery/applyPreferences';
import { actionButtons, createQueueController, useDiscoveryQueue, type QueueDeps } from '@/features/discovery/queue';

jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));

const card = (id: string): DiscoveryCard => ({
  userId: id,
  name: id,
  age: 28,
  city: 'Bengaluru',
  distanceBucket: 'lt10',
  badges: ['live_verified'],
  photos: [{ id: `${id}-p`, urls: { thumb: `https://x/${id}`, medium: `https://x/${id}`, large: `https://x/${id}` } }],
  topPrompt: null,
});
const err = (status: number, code: string, details?: Record<string, unknown>) => ApiError.fromResponse(status, { code, message: 'x', details }, null);

function setup(over: Partial<QueueDeps> = {}) {
  useDiscoveryQueue.setState(useDiscoveryQueue.getInitialState(), true);
  let batch = 0;
  const deps: QueueDeps = {
    fetch: jest.fn(async () => {
      batch += 1;
      return batch === 1 ? ['a', 'b', 'c', 'd'].map(card) : batch === 2 ? ['e', 'f'].map(card) : [];
    }),
    like: jest.fn(async (): Promise<LikeResult> => ({ matched: false })),
    pass: jest.fn(async () => ({})),
    prefetch: jest.fn(),
    ...over,
  };
  return { q: createQueueController(useDiscoveryQueue, deps), deps, state: () => useDiscoveryQueue.getState(), ids: () => useDiscoveryQueue.getState().cards.map((c) => c.userId) };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('discovery queue', () => {
  it('loads, prefetches the next 3, and refills below 3 sending the remaining ids as exclude', async () => {
    const { q, deps, ids } = setup();
    await q.load();
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
    expect(deps.prefetch).toHaveBeenCalledWith(['https://x/a', 'https://x/b', 'https://x/c']);
    await q.pass(card('a'));
    expect(deps.fetch).toHaveBeenCalledTimes(1); // 3 left: no refill yet
    await q.pass(card('b'));
    await settle();
    expect(deps.fetch).toHaveBeenLastCalledWith(['c', 'd']);
    expect(ids()).toEqual(['c', 'd', 'e', 'f']);
  });

  it('like and pass remove the card before the server answers', async () => {
    let release!: () => void;
    const { q, ids } = setup({ like: () => new Promise((r) => (release = () => r({ matched: false }))) });
    await q.load();
    const pending = q.like(card('a'));
    expect(ids()[0]).toBe('b');
    release();
    await pending;
  });

  it('404 drops the card silently', async () => {
    const { q, ids, state } = setup({ like: jest.fn().mockRejectedValue(err(404, 'USER_NOT_FOUND')) });
    await q.load();
    await q.like(card('a'));
    expect(ids()).not.toContain('a');
    expect(state().notice).toBeNull();
    expect(state().sheet).toBeNull();
  });

  it('429 LIKE_LIMIT_REACHED puts the card back on top and opens Out of likes', async () => {
    const { q, ids, state } = setup({ like: jest.fn().mockRejectedValue(err(429, 'LIKE_LIMIT_REACHED', { retryAfterSeconds: 24130 })) });
    await q.load();
    await q.like(card('a'));
    expect(ids()[0]).toBe('a');
    expect(state().sheet).toEqual({ kind: 'outOfLikes', retryAfterSeconds: 24130 });
  });

  it('a match opens the It’s a match placeholder', async () => {
    const { q, state } = setup({ like: jest.fn(async () => ({ matched: true, matchId: 'm1' })) });
    await q.load();
    await q.like(card('a'));
    expect(state().sheet).toMatchObject({ kind: 'match', matchId: 'm1', card: { userId: 'a' } });
    q.closeSheet();
    expect(state().sheet).toBeNull();
  });

  it('409 DISCOVERY_NOT_READY shows the fix-up list from details.missing', async () => {
    const { q, state } = setup({ fetch: jest.fn().mockRejectedValue(err(409, 'DISCOVERY_NOT_READY', { missing: ['photos', 'location', 'nonsense'] })) });
    await q.load();
    expect(state()).toMatchObject({ status: 'notReady', missing: ['photos', 'location'] });
  });

  it('network errors on like restore the card with a notice', async () => {
    const { q, ids, state } = setup({ pass: jest.fn().mockRejectedValue(ApiError.network()) });
    await q.load();
    await q.pass(card('b'));
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
    expect(state().notice).toMatch(/offline/i);
  });

  it('runs out → empty state', async () => {
    const { q, state } = setup({ fetch: jest.fn(async () => []) });
    await q.load();
    expect(state().status).toBe('empty');
  });
});

describe('filters flush the queue', () => {
  it('saves, reloads /auth/me, then flushes and refetches', async () => {
    const { q, deps, ids } = setup();
    await q.load();
    const order: string[] = [];
    await applyPreferences(
      { showMe: 'women', ageMin: 24, ageMax: 32, maxDistanceKm: 50 },
      {
        save: async () => void order.push('save'),
        reloadUser: async () => void order.push('me'),
        flush: async () => {
          order.push('flush');
          await q.flush();
        },
      },
    );
    expect(order).toEqual(['save', 'me', 'flush']);
    expect(deps.fetch).toHaveBeenLastCalledWith([]);
    expect(ids()).toEqual(['e', 'f']);
  });
});

describe('empty state actions', () => {
  it('widens to 50 km first, then in 50 km steps up to 200', () => {
    expect(widenedDistance(25)).toBe(50);
    expect(widenedDistance(50)).toBe(100);
    expect(widenedDistance(180)).toBe(200);
  });

  it('mock: an empty queue at 25 km gets people after widening', async () => {
    const acc = { nextStep: 'done' as const, profile: null, preferences: { showMe: 'everyone' as const, ageMin: 18, ageMax: 100, maxDistanceKm: 1 } };
    const mock = createMockDiscovery(() => acc, async () => 't', { empty: () => false, notReady: () => false, likeLimit: () => 25, now: Date.now, delay: 0 });
    expect(await mock.getDiscovery([])).toEqual([]);
    acc.preferences.maxDistanceKm = 50;
    expect((await mock.getDiscovery([])).length).toBeGreaterThan(0);
  });
});

describe('super-like flag', () => {
  it('the star is hidden unless FEATURE_SUPER_LIKE is on', () => {
    expect(actionButtons(false)).toEqual(['pass', 'like']);
    expect(actionButtons(true)).toEqual(['pass', 'superLike', 'like']);
  });
});

describe('mock M16–M18 errors', () => {
  const acc = () => ({ nextStep: 'done' as const, profile: null });
  it('hidden users 404, double likes 409, limits 429 with retryAfterSeconds', async () => {
    const account = acc();
    const mock = createMockDiscovery(() => account, async () => 't', { empty: () => false, notReady: () => false, likeLimit: () => 1, now: Date.now, delay: 0 });
    await expect(mock.like('user-hidden')).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
    await expect(mock.getProfile('user-hidden')).rejects.toMatchObject({ message: 'This profile is no longer available.' });
    await expect(mock.like('user-rohan')).resolves.toEqual({ matched: true, matchId: 'match-user-rohan' });
    await expect(mock.like('user-rohan')).rejects.toMatchObject({ code: 'INTERACTION_ALREADY_LIKED' });
    const limited = await mock.like('user-kabir').catch((e: ApiError) => e);
    expect(limited).toMatchObject({ status: 429, code: 'LIKE_LIMIT_REACHED' });
    expect((limited as ApiError).retryAfterSeconds).toBeGreaterThan(0);
  });
});
