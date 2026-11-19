import {
  importBundle,
  type ImportOptions,
  type ImportPlan,
  type RecipeBookExport,
} from "@recipe-book/shared";
import { useCallback } from "react";
import type { ReadonlyDeep } from "type-fest";
import { useBookDoc } from "../contexts/docContext.ts";
import type { BookUndo } from "../contexts/undoContext.ts";

export interface BookImport {
  /**
   * Imports into the open book. The plan is made against the book as it is *now* (not as it was
   * when a preview was shown) and written in one transaction, run through the book's undo history
   * as its own step (`runAsStep`), so one Undo takes back exactly the import.
   */
  importNow: (
    bundle: ReadonlyDeep<RecipeBookExport>,
    options: ImportOptions,
    undo: BookUndo | null,
  ) => ImportPlan;
}

export function useBookImport(): BookImport {
  const { doc } = useBookDoc();
  const importNow = useCallback<BookImport["importNow"]>(
    (bundle, options, undo) =>
      undo === null
        ? importBundle(doc, bundle, options)
        : undo.runAsStep(() => importBundle(doc, bundle, options)),
    [doc],
  );
  return { importNow };
}
