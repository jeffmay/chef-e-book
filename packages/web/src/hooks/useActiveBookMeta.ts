import { randomId, RecipeBookId } from "@recipe-book/shared";
import { Companion } from "@recipe-book/shared/src/types/companion";
import { type } from "arktype";
import { useState, useCallback } from "react";

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

export function useActiveBookMeta(): UseActiveBookMetaResult {
  const [activeBookMeta, setState] = useState<ActiveBookMeta | null>(() => {
    if (typeof localStorage === "undefined") {
      // if server-side rendering the page
      return null;
    }
    const bookStr = localStorage.getItem(ACTIVE_BOOK_KEY);
    if (!bookStr) {
      // if no book has been created
      return null;
    }
    const book = ActiveBookMeta.type(JSON.parse(bookStr));
    if (book instanceof type.errors) {
      // the stored book metadata is incompatible
      console.error(
        `Failed to load active book from localStorage, key='${ACTIVE_BOOK_KEY}': ${book.summary}`,
      );
      return null;
    }
    return book;
  });

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
