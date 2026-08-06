/**
 * `localStorage` access that can never crash the page.
 *
 * Two separate hazards are covered here:
 *
 * 1. The global may not exist at all — a build-time prerender runs in Node with no `window`.
 * 2. The global may exist but *accessing* it still throws: `SecurityError` in a sandboxed iframe
 *    or a privacy-blocked storage context, `QuotaExceededError` when a write exceeds the quota.
 *
 * The second case is the one worth being careful about, because callers commonly read stored state
 * during the first render — an unguarded throw there takes the whole page down on load, in exactly
 * the browsers where storage is least likely to work.
 */

function warnStorageFailure(action: string, key: string, error: unknown): void {
  console.warn(`Failed to ${action} localStorage, key='${key}':`, error);
}

/** @returns the stored string, or `null` when it is absent or storage is unavailable. */
export function readLocalStorage(key: string): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    warnStorageFailure("read from", key, error);
    return null;
  }
}

/** Writes `value`, silently doing nothing when storage is unavailable or full. */
export function writeLocalStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    warnStorageFailure("write to", key, error);
  }
}

/** Removes `key`, silently doing nothing when storage is unavailable. */
export function removeLocalStorage(key: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch (error) {
    warnStorageFailure("remove from", key, error);
  }
}
