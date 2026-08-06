import type { AnyCompanion } from "@recipe-book/shared";
import { type } from "arktype";
import { useCallback, useState } from "react";
import { readLocalStorage, writeLocalStorage } from "../storage/safeLocalStorage.ts";

/**
 * Device-local view state — the expanded/collapsed shape of a page, and anything else
 * that describes how *this device* is looking at the book rather than what is in it.
 *
 * This deliberately does NOT live in the Yjs document: it is per-device, it must not sync
 * to other devices, and it must not appear in the undo history. It is stored in
 * `localStorage` under a per-view key so it survives a page reload.
 *
 * Values are validated against an `arktype` schema on read, so a key written by an older
 * build (or hand-edited) falls back to the caller's default instead of throwing.
 */
export interface LocalViewStateStore<T> {
  /** The current view state — the persisted value, or the default when nothing valid is stored. */
  readonly viewState: T;
  /** Applies an update and writes the result through to `localStorage`. */
  readonly setViewState: (update: (prev: T) => T) => void;
}

/**
 * Reads and validates the view state stored under `key`.
 *
 * @returns the stored state, or `null` when nothing is stored, storage is unavailable
 *          (build-time prerender), or the stored value no longer matches the schema.
 */
export function loadLocalViewState<T>(key: string, companion: AnyCompanion<T>): T | null {
  const stored = readLocalStorage(key);
  if (stored === null) {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(stored);
  } catch (error) {
    // Reported separately from a schema failure: "not valid JSON" and "not the shape we expect"
    // call for different fixes, and the arktype message for a corrupt string would only say that
    // the value is not an object.
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

/**
 * Keeps a piece of device-local view state in `localStorage`, validated by `companion`.
 *
 * The stored value is read once, lazily, on the first render — so a reload paints the
 * restored view directly rather than flashing the default and then correcting itself.
 *
 * @param key the `localStorage` key; one per view
 * @param companion the `arktype` companion used to validate whatever is already stored
 * @param createDefault builds the state to use when nothing valid is stored
 */
export function useLocalViewState<T>(
  key: string,
  companion: AnyCompanion<T>,
  createDefault: () => T,
): LocalViewStateStore<T> {
  const [viewState, setState] = useState<T>(
    () => loadLocalViewState(key, companion) ?? createDefault(),
  );

  const setViewState = useCallback(
    (update: (prev: T) => T) => {
      // The updater runs inside setState so `prev` is always React's pending state — consecutive
      // updates in one tick compose, without a ref written during render to keep them in step.
      // React may invoke it more than once (StrictMode, an interrupted render), but the write is
      // idempotent for a given `prev` and any re-invocation is followed by the write that wins.
      setState((prev) => {
        const next = update(prev);
        writeLocalStorage(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );

  return { viewState, setViewState };
}
