import { useEffect, useState } from 'react';

/**
 * Current time in ms, refreshed every `intervalMs`.
 * Use instead of calling Date.now() during render, which React treats as impure.
 */
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
