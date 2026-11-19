import { rekeyBookNames } from "@recipe-book/shared";
import { useEffect } from "react";
import type { DocContextValue } from "../contexts/docContext.ts";

/**
 * Brings the open book's stored name keys up to the current rules once it has loaded — books from
 * before name keys existed have none, and a change to the rules leaves every book with stale ones.
 * Idempotent and never undoable; see `rekeyBookNames`. It runs after the legacy-data merge, so the
 * data from an older build is keyed too.
 */
export function useRekeyBookNames(
  { doc, whenSynced }: DocContextValue,
  /** Resolves once `book_meta` exists (see `useEnsureBookMeta`), which the name-key version is written into. */
  metaReady: Promise<unknown> = Promise.resolve(),
): void {
  useEffect(() => {
    let cancelled = false;
    whenSynced
      .then(() => metaReady)
      .then(() => {
        if (!cancelled) rekeyBookNames(doc);
      });
    return () => {
      cancelled = true;
    };
  }, [doc, whenSynced, metaReady]);
}
