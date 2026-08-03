import { useCallback, useEffect, useState } from 'react';

const PARAM_NAME = 'tab';

function readTabFromUrl(validValues: readonly string[], fallback: string): string {
  const value = new URLSearchParams(window.location.search).get(PARAM_NAME);
  return value && validValues.includes(value) ? value : fallback;
}

/**
 * Syncs a single tab/view selection with the `?tab=` URL search param, so
 * views are deep-linkable and back/forward-button friendly without pulling
 * in a full router for what is just one flat tab set.
 */
export function useUrlTab(
  validValues: readonly string[],
  defaultValue: string
): [string, (value: string) => void] {
  const [tab, setTabState] = useState(() => readTabFromUrl(validValues, defaultValue));

  // Keep state in sync with browser back/forward navigation.
  useEffect(() => {
    const handlePopState = () => setTabState(readTabFromUrl(validValues, defaultValue));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = useCallback((value: string) => {
    setTabState(value);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_NAME, value);
    window.history.pushState({}, '', url);
  }, []);

  return [tab, setTab];
}
