import { Companion, randomId, RecipeBookId } from "@recipe-book/shared";
import { type } from "arktype";
import { useCallback, useEffect, useState } from "react";

export const ACTIVE_BOOK_KEY = "ecookdeck_book" as const;

export interface UseActiveBookMetaResult {
  readonly activeBookMeta: ActiveBookMeta | null;
  readonly setActiveBookName: (name: string) => void;
  readonly clearActiveBookMeta: () => void;
}

export const ActiveBookMeta = Companion(
  "ActiveBookMeta",
  type({
    id: RecipeBookId.type,
    name: "string.normalize",
  }),
);

export type ActiveBookMeta = typeof ActiveBookMeta.type.infer;

function loadActiveBookMeta(): ActiveBookMeta | null {
  const bookStr = localStorage.getItem(ACTIVE_BOOK_KEY);
  if (!bookStr) {
    return null;
  }
  const book = ActiveBookMeta.type(JSON.parse(bookStr));
  if (book instanceof type.errors) {
    console.error(
      `Failed to load active book from localStorage, key='${ACTIVE_BOOK_KEY}': ${book.summary}`,
    );
    return null;
  }
  return book;
}

export function useActiveBookMeta(): UseActiveBookMetaResult {
  // Start with null so server pre-render and hydration pass both match.
  // The real localStorage value is read in useEffect (client-only).
  const [activeBookMeta, setState] = useState<ActiveBookMeta | null>(null);

  useEffect(() => {
    setState(loadActiveBookMeta());
  }, []);

  const setActiveBookName = useCallback((name: string) => {
    const id = randomId(RecipeBookId);
    const book = ActiveBookMeta.type({ name, id });
    if (book instanceof type.errors) {
      throw book.toTraversalError();
    }
    localStorage.setItem(ACTIVE_BOOK_KEY, JSON.stringify(book));
    setState(book);
  }, []);

  const clearActiveBookMeta = useCallback(() => {
    localStorage.removeItem(ACTIVE_BOOK_KEY);
    setState(null);
  }, []);

  return { activeBookMeta, setActiveBookName, clearActiveBookMeta };
}
