import type { AnyCompanion } from "@recipe-book/shared";
import { type } from "arktype";

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

/**
 * Reads, JSON-parses, and validates the value stored under `key` against `companion`'s schema.
 *
 * This is how anything typed should be read out of `localStorage`. Stored data is untrusted input:
 * it may have been written by an older build whose schema has since changed, hand-edited in
 * devtools, or truncated. Every failure mode — storage unavailable, key absent, unparsable JSON,
 * value no longer matching the schema — resolves to `null` so the caller can fall back to a
 * default, and none of them can throw at the call site.
 *
 * The corruption cases warn separately on purpose: "not valid JSON" and "not the shape we expect"
 * call for different fixes, and arktype would describe a corrupt string only as "must be an
 * object" — hiding the fact that it never parsed at all.
 *
 * @returns the validated value, or `null` when nothing usable is stored
 */
export function readValidatedLocalStorage<T>(key: string, companion: AnyCompanion<T>): T | null {
  const stored = readLocalStorage(key);
  if (stored === null) {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(stored);
  } catch (error) {
    console.warn(
      `Invalid JSON in localStorage, key='${key}'; falling back to the default ${companion.name}:`,
      error,
    );
    return null;
  }

  const parsed = companion.type(json);
  if (parsed instanceof type.errors) {
    console.warn(
      `Failed to load ${companion.name} from localStorage, key='${key}': ${parsed.summary}`,
    );
    return null;
  }
  // The schema validated every field, so the parsed value is the companion's type.
  return parsed as T;
}
