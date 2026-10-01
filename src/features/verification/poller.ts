/**
 * Calls `tick` every `intervalMs` until stopped (screen 08 polls
 * GET /verification every 60 s). Also ticks immediately when `refreshNow` is called
 * (app back in the foreground). Never runs after stop().
 */
export function startPolling(tick: () => void, intervalMs: number) {
  let timer: ReturnType<typeof setInterval> | null = setInterval(tick, intervalMs);
  return {
    refreshNow(): void {
      if (timer) tick();
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = null;
    },
    get running(): boolean {
      return timer !== null;
    },
  };
}

export const REVIEW_POLL_MS = 60_000;
