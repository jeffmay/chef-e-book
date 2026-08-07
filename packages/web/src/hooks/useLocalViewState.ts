import type { AnyCompanion } from "@recipe-book/shared";
import { useCallback, useState } from "react";
import { readValidatedLocalStorage, writeLocalStorage } from "../storage/safeLocalStorage.ts";

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
 * Keeps a piece of device-local view state in `localStorage`, validated by `companion`.
 *
 * The stored value is read once, lazily, on the first render — so a reload paints the
 * restored view directly rather than flashing the default and then correcting itself.
 * Anything unusable in storage (absent, unreadable, corrupt, schema-stale) resolves to
 * `createDefault()` via {@link readValidatedLocalStorage}.
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
    () => readValidatedLocalStorage(key, companion) ?? createDefault(),
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
