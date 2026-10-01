import { Image } from 'expo-image';

import * as discoveryApi from '@/api/endpoints/discovery';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import type { DiscoveryCard, DiscoveryMissing, LikeResult } from '@/api/types';
import { createResettableStore } from '@/lib/stores';

/**
 * Discovery queue (guide §10.6). Lives in Zustand, not the React Query
 * cache: cards are consumed one at a time and removed optimistically.
 */

export const REFILL_BELOW = 3;
export const PREFETCH_AHEAD = 3;

export type QueueStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'notReady' | 'error';

export type QueueSheet =
  | { kind: 'match'; card: DiscoveryCard; matchId: string | null }
  | { kind: 'outOfLikes'; retryAfterSeconds: number | null }
  | null;

export interface QueueState {
  cards: DiscoveryCard[];
  status: QueueStatus;
  /** 409 DISCOVERY_NOT_READY details.missing */
  missing: DiscoveryMissing[];
  error: string | null;
  /** Placeholder sheets until screens 21/22 (part 2). */
  sheet: QueueSheet;
  /** A failed like/pass that was put back (network etc.). */
  notice: string | null;
}

const initial: QueueState = { cards: [], status: 'idle', missing: [], error: null, sheet: null, notice: null };

export const useDiscoveryQueue = createResettableStore<QueueState>(() => ({ ...initial }));

type Store = Pick<typeof useDiscoveryQueue, 'getState' | 'setState'>;

export interface QueueDeps {
  fetch: (exclude: readonly string[]) => Promise<DiscoveryCard[]>;
  like: (userId: string) => Promise<LikeResult>;
  pass: (userId: string) => Promise<unknown>;
  prefetch: (urls: string[]) => void;
}

const defaultDeps: QueueDeps = {
  fetch: discoveryApi.getDiscovery,
  like: discoveryApi.likeUser,
  pass: discoveryApi.passUser,
  // Only real URLs; mock:// photos are drawn locally.
  prefetch: (urls) => {
    const real = urls.filter((u) => /^https?:/.test(u));
    if (real.length) void Image.prefetch(real).catch(() => undefined);
  },
};

const MISSING: readonly DiscoveryMissing[] = ['selfie', 'photos', 'profile', 'preferences', 'location'];

export function createQueueController(store: Store, deps: QueueDeps = defaultDeps) {
  let fetching: Promise<void> | null = null;
  /** Bumped by flush() so a stale refill can't add old cards to a new queue. */
  let generation = 0;

  const set = (partial: Partial<QueueState>) => store.setState(partial);
  const get = () => store.getState();

  const prefetchNext = () => {
    const next = get().cards.slice(0, PREFETCH_AHEAD);
    deps.prefetch(next.flatMap((c) => c.photos.slice(0, 2).map((p) => p.urls.medium)));
  };

  /** Refill when fewer than 3 cards remain, excluding everything still queued. */
  const refill = (force = false): Promise<void> => {
    if (fetching) return fetching;
    if (!force && get().cards.length >= REFILL_BELOW) return Promise.resolve();
    const gen = generation;
    if (get().cards.length === 0) set({ status: 'loading', error: null });
    fetching = (async () => {
      try {
        const queued = get().cards;
        const fresh = await deps.fetch(queued.map((c) => c.userId));
        if (gen !== generation) return;
        const known = new Set(get().cards.map((c) => c.userId));
        const cards = [...get().cards, ...fresh.filter((c) => !known.has(c.userId))];
        set({ cards, status: cards.length ? 'ready' : 'empty', missing: [], error: null });
        prefetchNext();
      } catch (err) {
        if (gen !== generation) return;
        if (isApiError(err) && err.code === ErrorCode.DiscoveryNotReady) {
          const raw = err.details?.missing;
          const missing = Array.isArray(raw) ? MISSING.filter((m) => raw.includes(m)) : [];
          set({ status: 'notReady', missing });
        } else if (get().cards.length === 0) {
          set({ status: 'error', error: errorMessage(err) });
        }
      } finally {
        fetching = null;
      }
    })();
    return fetching;
  };

  /** Removes a card (optimistic). Returns where it was, to put it back. */
  const take = (userId: string): number => {
    const index = get().cards.findIndex((c) => c.userId === userId);
    if (index >= 0) set({ cards: get().cards.filter((c) => c.userId !== userId) });
    return index;
  };

  const restore = (card: DiscoveryCard, index: number) => {
    const cards = [...get().cards];
    if (cards.some((c) => c.userId === card.userId)) return;
    cards.splice(Math.max(0, Math.min(index, cards.length)), 0, card);
    set({ cards, status: 'ready' });
  };

  const settle = () => {
    if (get().cards.length === 0 && get().status === 'ready') set({ status: fetching ? 'loading' : 'empty' });
    void refill();
    prefetchNext();
  };

  return {
    load: () => refill(true),
    refill,

    async like(card: DiscoveryCard): Promise<void> {
      const index = take(card.userId);
      set({ notice: null });
      settle();
      try {
        const result = await deps.like(card.userId);
        if (result.matched) set({ sheet: { kind: 'match', card, matchId: result.matchId ?? null } });
      } catch (err) {
        if (!isApiError(err)) return restore(card, index);
        if ([ErrorCode.UserNotFound, ErrorCode.ProfileNotFound, ErrorCode.InteractionAlreadyLiked].includes(err.code as never)) return; // drop silently
        restore(card, index);
        if (err.code === ErrorCode.LikeLimitReached) set({ sheet: { kind: 'outOfLikes', retryAfterSeconds: err.retryAfterSeconds } });
        else set({ notice: errorMessage(err) });
      }
    },

    async pass(card: DiscoveryCard): Promise<void> {
      const index = take(card.userId);
      set({ notice: null });
      settle();
      try {
        await deps.pass(card.userId);
      } catch (err) {
        if (isApiError(err) && (err.code === ErrorCode.UserNotFound || err.code === ErrorCode.ProfileNotFound)) return;
        restore(card, index);
        set({ notice: errorMessage(err) });
      }
    },

    /** Blocked, 404 from the profile screen, etc. */
    drop(userId: string): void {
      take(userId);
      settle();
    },

    /** Preferences changed (Filters, widen distance): start over (guide §7: flush the queue). */
    async flush(): Promise<void> {
      generation += 1;
      fetching = null;
      set({ cards: [], status: 'loading', missing: [], error: null, notice: null });
      await refill(true);
    },

    closeSheet(): void {
      set({ sheet: null });
    },
  };
}

export const discoveryQueue = createQueueController(useDiscoveryQueue);

/** Deck 18: pass and like; the star only with FEATURE_SUPER_LIKE (no API yet). */
export function actionButtons(superLike: boolean): ('pass' | 'superLike' | 'like')[] {
  return superLike ? ['pass', 'superLike', 'like'] : ['pass', 'like'];
}
