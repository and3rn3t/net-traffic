/**
 * Generic localStorage snapshot cache used to instantly paint the dashboard
 * on reload with last-known data while a fresh fetch runs in the background.
 */
const SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;

export function loadSnapshot<T>(key: string): (T & { timestamp: number }) | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T & { timestamp: number };
    if (!parsed.timestamp || Date.now() - parsed.timestamp > SNAPSHOT_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSnapshot<T extends object>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {
    // Best-effort only (private browsing / quota exceeded) - never block on this.
  }
}
