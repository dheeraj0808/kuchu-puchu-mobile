import { session } from '@/auth/session';
import { env } from '@/config/env';

import { ApiError, ErrorCode } from '../errors';
import type { DiscoveryCard, DistanceBucket, LikeResult, MessageResponse, Preferences, ProfileDetail } from '../types';
import { mockAuth, type MockAccount } from './auth';

/**
 * In-app stand-in for M16–M18 (guide contracts):
 *   GET /discovery?exclude= · POST /likes · POST /passes · GET /profiles/:userId
 * ~20 people; every third like is mutual. `user-hidden` is in the first
 * batch but answers 404 everywhere (blocked, hidden and deleted look alike).
 * Settings: EXPO_PUBLIC_MOCK_DISCOVERY_EMPTY / _NOT_READY / _LIKE_LIMIT.
 */

const LATENCY_MS = 400;
const BATCH = 5;

interface Person {
  userId: string;
  name: string;
  age: number;
  city: string;
  km: number;
  gender: 'man' | 'woman';
  idVerified: boolean;
  mutual: boolean;
  bio: string;
  job: string;
  prompts: [string, string][];
  interests: [string, string][];
}

const P = (
  userId: string,
  name: string,
  age: number,
  km: number,
  gender: Person['gender'],
  extra: Partial<Person> = {},
): Person => ({
  userId,
  name,
  age,
  city: 'Bengaluru',
  km,
  gender,
  idVerified: age % 2 === 0,
  mutual: false,
  bio: 'Weekend baker, weekday product designer. I’ll ask what you’re reading and steal the recommendation.',
  job: 'Product designer',
  prompts: [
    ['A green flag I look for', 'Remembers the small things you mention once.'],
    ['My perfect Sunday is', 'Filter coffee, a long walk in Cubbon Park, and a rom-com.'],
  ],
  interests: [
    ['filter-coffee', 'Filter coffee'],
    ['trekking', 'Trekking'],
    ['indie', 'Indie'],
    ['street-food', 'Street food'],
  ],
  ...extra,
});

export const MOCK_PEOPLE_DISCOVERY: Person[] = [
  P('user-rohan', 'Rohan', 28, 8, 'man', { mutual: true }),
  P('user-hidden', 'Hidden', 27, 4, 'man'),
  P('user-kabir', 'Kabir', 31, 9, 'man', { prompts: [['Two truths and a lie', 'I’ve run a marathon, I can’t whistle, I love durian.']] }),
  P('user-meera', 'Meera', 27, 6, 'woman', { mutual: true }),
  P('user-ishaan', 'Ishaan', 29, 12, 'man'),
  P('user-arjun', 'Arjun', 30, 3, 'man'),
  P('user-priya', 'Priya', 26, 18, 'woman', { mutual: true }),
  P('user-zoya', 'Zoya', 25, 22, 'woman'),
  P('user-ira', 'Ira', 28, 7, 'woman'),
  P('user-dev', 'Dev', 33, 35, 'man', { city: 'Mysuru' }),
  P('user-nikhil', 'Nikhil', 27, 14, 'man', { mutual: true }),
  P('user-ananya', 'Ananya', 26, 4, 'woman'),
  P('user-rhea', 'Rhea', 29, 45, 'woman', { city: 'Mysuru' }),
  P('user-vivaan', 'Vivaan', 32, 9, 'man'),
  P('user-sana', 'Sana', 30, 11, 'woman', { mutual: true }),
  P('user-aditya', 'Aditya', 34, 28, 'man'),
  P('user-tara', 'Tara', 24, 6, 'woman'),
  P('user-kunal', 'Kunal', 29, 60, 'man', { city: 'Tumakuru' }),
  P('user-myra', 'Myra', 27, 2, 'woman'),
  P('user-yash', 'Yash', 28, 16, 'man'),
];

export function bucketFor(km: number): DistanceBucket {
  return km < 5 ? 'lt5' : km < 10 ? 'lt10' : km < 25 ? 'lt25' : km < 50 ? 'lt50' : 'gt50';
}

/** Mock photos: `mock://avatar/<seed>/<n>` — drawn by ProfilePhotoView until real photos exist. */
const photosFor = (p: Person) =>
  Array.from({ length: 4 }, (_, i) => {
    const uri = `mock://avatar/${p.userId}/${i}`;
    return { id: `${p.userId}-p${i}`, urls: { thumb: uri, medium: uri, large: uri } };
  });

const cardOf = (p: Person): DiscoveryCard => ({
  userId: p.userId,
  name: p.name,
  age: p.age,
  city: p.city,
  distanceBucket: bucketFor(p.km),
  badges: p.idVerified ? ['live_verified', 'id_verified'] : ['live_verified'],
  photos: photosFor(p),
  topPrompt: p.prompts[0] ? { question: p.prompts[0][0], answer: p.prompts[0][1] } : null,
});

interface MockDiscoveryAccount extends MockAccount {
  seen?: string[];
  liked?: string[];
  likesToday?: number;
}

export interface DiscoveryMockOptions {
  empty: () => boolean;
  notReady: () => boolean;
  likeLimit: () => number;
  now: () => number;
  delay: number;
}

export function createMockDiscovery(
  resolve: (accessToken: string) => MockDiscoveryAccount,
  token: () => Promise<string | null>,
  options: DiscoveryMockOptions = {
    empty: () => env.mockDiscoveryEmpty,
    notReady: () => env.mockDiscoveryNotReady,
    likeLimit: () => env.mockLikeLimit,
    now: Date.now,
    delay: LATENCY_MS,
  },
) {
  const wait = () => (options.delay > 0 ? new Promise<void>((r) => setTimeout(r, options.delay)) : Promise.resolve());
  const fail = (status: number, code: string, details?: Record<string, unknown>): never => {
    throw ApiError.fromResponse(status, { success: false, code, message: code, details, requestId: 'mock' }, null);
  };
  const account = async (): Promise<MockDiscoveryAccount> => {
    await wait();
    const t = await token();
    if (!t) throw ApiError.sessionExpired();
    return resolve(t);
  };
  const visible = (p: Person) => p.userId !== 'user-hidden';
  const find = (userId: string) => MOCK_PEOPLE_DISCOVERY.find((p) => p.userId === userId && visible(p));
  const matchesPrefs = (p: Person, prefs: Preferences | null | undefined) => {
    if (!prefs) return true;
    const gender = prefs.showMe === 'everyone' || (prefs.showMe === 'men' ? p.gender === 'man' : p.gender === 'woman');
    return gender && p.age >= prefs.ageMin && p.age <= prefs.ageMax && p.km <= prefs.maxDistanceKm;
  };
  const markSeen = (acc: MockDiscoveryAccount, userId: string) => {
    acc.seen ??= [];
    if (!acc.seen.includes(userId)) acc.seen.push(userId);
  };

  return {
    async getDiscovery(exclude: readonly string[]): Promise<DiscoveryCard[]> {
      const acc = await account();
      if (options.notReady()) fail(409, ErrorCode.DiscoveryNotReady, { missing: ['photos', 'location'] });
      if (options.empty()) return [];
      const skip = new Set([...(acc.seen ?? []), ...exclude]);
      return MOCK_PEOPLE_DISCOVERY.filter((p) => !skip.has(p.userId) && matchesPrefs(p, acc.preferences))
        .slice(0, BATCH)
        .map(cardOf);
    },

    async like(targetUserId: string): Promise<LikeResult> {
      const acc = await account();
      const person = find(targetUserId) ?? fail(404, ErrorCode.UserNotFound);
      if (acc.liked?.includes(targetUserId)) fail(409, ErrorCode.InteractionAlreadyLiked);
      if ((acc.likesToday ?? 0) >= options.likeLimit()) {
        const midnight = new Date(options.now());
        midnight.setHours(24, 0, 0, 0);
        fail(429, ErrorCode.LikeLimitReached, { retryAfterSeconds: Math.ceil((midnight.getTime() - options.now()) / 1000) });
      }
      acc.likesToday = (acc.likesToday ?? 0) + 1;
      (acc.liked ??= []).push(targetUserId);
      markSeen(acc, targetUserId);
      return person.mutual ? { matched: true, matchId: `match-${targetUserId}` } : { matched: false };
    },

    async pass(targetUserId: string): Promise<MessageResponse> {
      const acc = await account();
      if (!find(targetUserId)) fail(404, ErrorCode.UserNotFound);
      markSeen(acc, targetUserId);
      return { message: 'Passed' };
    },

    async getProfile(userId: string): Promise<ProfileDetail> {
      await account();
      const p = find(userId) ?? fail(404, ErrorCode.UserNotFound);
      const mine = new Set(['filter-coffee', 'indie', 'baking', 'beaches']);
      return {
        ...cardOf(p),
        bio: p.bio,
        jobTitle: p.job,
        prompts: p.prompts.map(([question, answer]) => ({ question, answer })),
        interests: p.interests.map(([id, name]) => ({ id, name, shared: mine.has(id) })),
      };
    },
  };
}

export const mockDiscovery = createMockDiscovery(
  (t) => mockAuth.accountFor(t) as MockDiscoveryAccount,
  () => session.getAccessToken(),
);
