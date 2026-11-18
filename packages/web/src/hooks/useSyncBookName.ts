import { getBookMetaYmap, type RecipeBookId } from "@recipe-book/shared";
import { useEffect } from "react";
import type { ReadonlyDeep } from "type-fest";
import type { DocContextValue } from "../contexts/docContext.ts";

/**
 * Keeps the device registry's cached name in step with the name in the open book's own document,
 * which leads: a rename made on another device, or undone, reaches the header and the picker too.
 *
 * Reads `book_meta.name` once the document has synced and again whenever it changes. It reads the
 * one key rather than validating the whole `book_meta`, which may legitimately be mid-setup.
 */
export function useSyncBookName(
  { doc, whenSynced }: DocContextValue,
  book: ReadonlyDeep<{ id: RecipeBookId; name: string }>,
  onNameChange: (id: RecipeBookId, name: string) => void,
): void {
  const { id, name } = book;
  useEffect(() => {
    let cancelled = false;
    const map = getBookMetaYmap(doc);
    function sync() {
      const stored = map.get("name");
      if (typeof stored === "string" && stored !== "" && stored !== name) onNameChange(id, stored);
    }
    whenSynced.then(() => {
      if (cancelled) return;
      sync();
      map.observe(sync);
    });
    return () => {
      cancelled = true;
      map.unobserve(sync);
    };
  }, [doc, whenSynced, id, name, onNameChange]);
}
