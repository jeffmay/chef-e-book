import { Companion, randomId, RecipeBookId } from "@recipe-book/shared";
import { type } from "arktype";
import { useCallback, useEffect, useState } from "react";
import {
  readValidatedLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "../storage/safeLocalStorage.ts";

export const ACTIVE_BOOK_KEY = "ecookdeck_book" as const;

export interface ActiveBookMetaStore {
  activeBookMeta: ActiveBookMeta | null;
  setActiveBookName: (name: string) => void;
  clearActiveBookMeta: () => void;
}

export const ActiveBookMeta = Companion(
  "ActiveBookMeta",
  type({
    id: RecipeBookId.type,
    name: "string.normalize",
  }),
);

export type ActiveBookMeta = typeof ActiveBookMeta.type.infer;

export function useActiveBookMeta(): ActiveBookMetaStore {
  // Start with null so server pre-render and hydration pass both match.
  // The real localStorage value is read in useEffect (client-only).
  const [activeBookMeta, setState] = useState<ActiveBookMeta | null>(null);

  useEffect(() => {
    setState(readValidatedLocalStorage(ACTIVE_BOOK_KEY, ActiveBookMeta));
  }, []);

  const setActiveBookName = useCallback((name: string) => {
    const id = randomId(RecipeBookId);
    const book = ActiveBookMeta.type({ name, id });
    if (book instanceof type.errors) {
      throw book.toTraversalError();
    }
    writeLocalStorage(ACTIVE_BOOK_KEY, JSON.stringify(book));
    setState(book);
  }, []);

  const clearActiveBookMeta = useCallback(() => {
    removeLocalStorage(ACTIVE_BOOK_KEY);
    setState(null);
  }, []);

  return { activeBookMeta, setActiveBookName, clearActiveBookMeta };
}
