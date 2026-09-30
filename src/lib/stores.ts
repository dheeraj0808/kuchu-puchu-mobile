import { create, type StateCreator, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * Every Zustand store is created through `createResettableStore`, so logout
 * and account deletion can put all of them back to their initial state
 * (guide §10.1) without knowing which stores exist.
 */
const resetters = new Set<() => void>();

export function createResettableStore<T extends object>(initializer: StateCreator<T>): UseBoundStore<StoreApi<T>> {
  const store = create<T>()(initializer);
  const initialState = store.getInitialState();
  resetters.add(() => store.setState(initialState, true));
  return store;
}

export function resetAllStores(): void {
  resetters.forEach((reset) => reset());
}
