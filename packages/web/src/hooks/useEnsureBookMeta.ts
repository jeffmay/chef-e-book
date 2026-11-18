import { ensureBookMeta, type RecipeBookId } from "@recipe-book/shared";
import { useEffect } from "react";
import type { ReadonlyDeep } from "type-fest";
import type { DocContextValue } from "../contexts/docContext.ts";

/**
 * Makes sure the open book's document carries its `book_meta` (id, name, creation time, schema
 * version), once IndexedDB and the legacy-data merge have finished — so an existing book is never
 * mistaken for a blank one. Idempotent; see `ensureBookMeta`.
 */
export function useEnsureBookMeta(
  { doc, whenSynced }: DocContextValue,
  book: ReadonlyDeep<{ id: RecipeBookId; name: string }>,
): void {
  const { id, name } = book;
  useEffect(() => {
    let cancelled = false;
    whenSynced.then(() => {
      if (!cancelled) ensureBookMeta(doc, { id, name });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, whenSynced, id, name]);
}
