import { ensureBookMeta, type RecipeBookId } from "@recipe-book/shared";
import { useEffect, useRef } from "react";
import type { ReadonlyDeep } from "type-fest";
import type { DocContextValue } from "../contexts/docContext.ts";

/**
 * Makes sure the open book's document carries its `book_meta` (id, name, creation time, schema
 * version), once IndexedDB and the legacy-data merge have finished — so an existing book is never
 * mistaken for a blank one. Idempotent; see `ensureBookMeta`.
 *
 * Returns a promise that resolves once `book_meta` is in place. Setup that writes into it (the
 * seeded flag, the name-key version) waits on that promise, so the ordering is a stated dependency
 * rather than a matter of which hook happens to be called first.
 */
export function useEnsureBookMeta(
  { doc, whenSynced }: DocContextValue,
  book: ReadonlyDeep<{ id: RecipeBookId; name: string }>,
): Promise<void> {
  const { id, name } = book;
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }
  const ready = readyRef.current;

  useEffect(() => {
    let cancelled = false;
    whenSynced.then(() => {
      if (cancelled) return;
      ensureBookMeta(doc, { id, name });
      ready.resolve();
    });
    return () => {
      cancelled = true;
    };
  }, [doc, whenSynced, id, name, ready]);

  return ready.promise;
}
