import { randomId, RecipeBookId } from "@recipe-book/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteBookDatabases } from "../storage/bookDatabases.ts";
import {
  addBookEntry,
  BOOK_REGISTRY_KEY,
  type BookRegistry,
  type BookRegistryEntry,
  closeActiveBook,
  findActiveBook,
  LEGACY_ACTIVE_BOOK_KEY,
  openBookEntry,
  readBookRegistry,
  removeBookEntry,
  renameBookEntry,
  sortBooksByRecent,
} from "../storage/bookRegistry.ts";
import { removeLocalStorage, writeLocalStorage } from "../storage/safeLocalStorage.ts";

export interface BookRegistryStore {
  /** Every book on this device, most recently opened first. */
  books: BookRegistryEntry[];
  /** The open book, or `null` while the picker is showing. */
  activeBook: BookRegistryEntry | null;
  /** Creates a book and opens it. A blank name creates nothing and returns `undefined`. */
  createBook: (name: string) => RecipeBookId | undefined;
  openBook: (id: RecipeBookId) => void;
  /** Leaves the open book for the picker. */
  closeBook: () => void;
  /**
   * Updates the cached name only — the book keeps its id. The name in the book's own document is
   * written separately (`writeBookName`, or `setBookName` for the open book).
   */
  renameBook: (id: RecipeBookId, name: string) => void;
  /** Removes a book from the list and deletes its data from this device. */
  deleteBook: (id: RecipeBookId) => Promise<void>;
}

/**
 * The books available on this device, kept in `localStorage` and validated on read. The list is
 * read once, lazily, on the first render — so a reload paints the right screen directly — and every
 * change is written straight through.
 *
 * An earlier build remembered a single book under `ecookdeck_book`; that book is adopted into the
 * list (and opened) the first time, and the old key is removed once the new one is stored.
 */
export function useBookRegistry(): BookRegistryStore {
  const [initial] = useState(() => readBookRegistry());
  const [registry, setRegistry] = useState<BookRegistry>(initial.registry);

  useEffect(() => {
    if (!initial.migratedFromLegacy) return;
    // Store the new key before dropping the old one, so a failure in between loses nothing.
    writeLocalStorage(BOOK_REGISTRY_KEY, JSON.stringify(initial.registry));
    removeLocalStorage(LEGACY_ACTIVE_BOOK_KEY);
  }, [initial]);

  /** Applies a change and writes it through. React may call the updater twice; the write is idempotent. */
  const update = useCallback((change: (prev: BookRegistry) => BookRegistry) => {
    setRegistry((prev) => {
      const next = change(prev);
      writeLocalStorage(BOOK_REGISTRY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const createBook = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed === "") return undefined;
      // Generated outside the updater, which React may run twice.
      const id = randomId(RecipeBookId);
      const now = Date.now();
      update((prev) =>
        openBookEntry(
          addBookEntry(prev, { id, name: trimmed, created_at: now, last_opened_at: now }),
          id,
          now,
        ),
      );
      return id;
    },
    [update],
  );

  const openBook = useCallback(
    (id: RecipeBookId) => {
      const now = Date.now();
      update((prev) => openBookEntry(prev, id, now));
    },
    [update],
  );

  const closeBook = useCallback(() => update(closeActiveBook), [update]);

  const renameBook = useCallback(
    (id: RecipeBookId, name: string) => update((prev) => renameBookEntry(prev, id, name)),
    [update],
  );

  const deleteBook = useCallback(
    async (id: RecipeBookId) => {
      update((prev) => removeBookEntry(prev, id));
      try {
        await deleteBookDatabases(id);
      } catch (e) {
        console.error(`failed to delete the stored data for book ${id}: `, e);
      }
    },
    [update],
  );

  const books = useMemo(() => sortBooksByRecent(registry.books), [registry.books]);
  const activeBook = useMemo(() => findActiveBook(registry) ?? null, [registry]);

  return { books, activeBook, createBook, openBook, closeBook, renameBook, deleteBook };
}
