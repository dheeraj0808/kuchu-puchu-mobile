import { useEffect, useState } from 'react';

/**
 * Seconds remaining until `targetMs` (epoch ms), ticking once per second.
 * Derived from the wall clock, so it stays correct after the app is
 * backgrounded. Returns null when there is no target.
 */
export function useCountdown(targetMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs === null) return;
    const tick = (): number => {
      const current = Date.now();
      setNow(current);
      return current;
    };
    // Resync immediately when the target changes, then every second until it passes.
    const initial = setTimeout(tick, 0);
    const id = setInterval(() => {
      if (tick() >= targetMs) clearInterval(id);
    }, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [targetMs]);

  if (targetMs === null) return null;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}
