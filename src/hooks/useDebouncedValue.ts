import { useEffect, useState } from 'react';

import { debounce } from '@/lib/debounce';

/** `value`, updated only after it stops changing for `ms`. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const update = debounce((next: T) => setSettled(next), ms);
    update(value);
    return update.cancel;
  }, [value, ms]);
  return settled;
}
