import { useEffect, useState } from 'react';

/**
 * Seconds remaining until `targetMs` (epoch ms), ticking once per second.
 * Derived from the wall clock, so it stays correct after the app is
 * backgrounded. Returns null when there is no target.
 */
export function useCountdown(targetMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (targetMs === null || targetMs <= Date.now()) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= targetMs) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs === null) return null;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}
