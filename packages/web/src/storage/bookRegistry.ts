import { Companion, RecipeBookId } from "@recipe-book/shared";
import { type } from "arktype";
import type { ReadonlyDeep } from "type-fest";
import { readLocalStorage, readValidatedLocalStorage } from "./safeLocalStorage.ts";

/** Where the list of books on this device lives. One key, so the list and the active id stay in step. */
export const BOOK_REGISTRY_KEY = "chefe_books" as const;

/** The single `{ id, name }` an earlier build remembered as "the" book. Migrated, then removed. */
export const LEGACY_ACTIVE_BOOK_KEY = "ecookdeck_book" as const;

/** One book this device knows about. `name` is a cache of the name in the book's own `book_meta`. */
export const BookRegistryEntry = Companion(
  "BookRegistryEntry",
  type({
    id: RecipeBookId.type,
    name: "string > 0",
    created_at: "number.epoch",
    last_opened_at: "number.epoch",
  }),
);
export type BookRegistryEntry = typeof BookRegistryEntry.type.infer;

/**
 * The books available on this device, and which one is open.
 *
 * This is **device-local** state — each book's content is its own Yjs document in IndexedDB; this
 * only says which documents exist here. The name kept per entry is a cache so the picker and the
 * header can show it before a book's document has loaded; the document's `book_meta.name` leads.
 */
export const BookRegistry = Companion(
  "BookRegistry",
  type({
    books: BookRegistryEntry.type.array(),
    "active_book_id?": RecipeBookId.type,
  }),
);
export type BookRegistry = typeof BookRegistry.type.infer;

const LegacyActiveBook = Companion(
  "LegacyActiveBook",
  type({
    id: RecipeBookId.type,
    name: "string > 0",
  }),
);

export function emptyBookRegistry(): BookRegistry {
  return { books: [] };
}

/** Drops duplicate ids (the first wins) and an active id that names no book. */
export function normalizeBookRegistry(registry: ReadonlyDeep<BookRegistry>): BookRegistry {
  const seen = new Set<string>();
  const books: BookRegistryEntry[] = [];
  for (const entry of registry.books) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    books.push({ ...entry });
  }
  const active = registry.active_book_id;
  return { books, ...(active !== undefined && seen.has(active) && { active_book_id: active }) };
}

export function findBookEntry(
  registry: ReadonlyDeep<BookRegistry>,
  id: RecipeBookId,
): BookRegistryEntry | undefined {
  const entry = registry.books.find((book) => book.id === id);
  return entry === undefined ? undefined : { ...entry };
}

/** The open book, if there is one. */
export function findActiveBook(
  registry: ReadonlyDeep<BookRegistry>,
): BookRegistryEntry | undefined {
  const id = registry.active_book_id;
  return id === undefined ? undefined : findBookEntry(registry, id);
}

/** Most recently opened first; ties broken by name so the order is stable. */
export function sortBooksByRecent(books: ReadonlyDeep<BookRegistryEntry[]>): BookRegistryEntry[] {
  return books
    .map((book) => ({ ...book }))
    .sort((a, b) => b.last_opened_at - a.last_opened_at || a.name.localeCompare(b.name));
}

/** Adds a book without opening it. A book whose id is already listed is ignored. */
export function addBookEntry(
  registry: ReadonlyDeep<BookRegistry>,
  entry: ReadonlyDeep<BookRegistryEntry>,
): BookRegistry {
  return normalizeBookRegistry({ ...registry, books: [...registry.books, entry] });
}

/** Opens a listed book and stamps when. An id that names no book changes nothing. */
export function openBookEntry(
  registry: ReadonlyDeep<BookRegistry>,
  id: RecipeBookId,
  now: number,
): BookRegistry {
  if (findBookEntry(registry, id) === undefined) return normalizeBookRegistry(registry);
  return normalizeBookRegistry({
    books: registry.books.map((book) => (book.id === id ? { ...book, last_opened_at: now } : book)),
    active_book_id: id,
  });
}

/** Back to the book picker: nothing is open. */
export function closeActiveBook(registry: ReadonlyDeep<BookRegistry>): BookRegistry {
  return normalizeBookRegistry({ books: registry.books });
}

/** Renames the cached name of a book, keeping its id. A blank name changes nothing. */
export function renameBookEntry(
  registry: ReadonlyDeep<BookRegistry>,
  id: RecipeBookId,
  name: string,
): BookRegistry {
  const trimmed = name.trim();
  if (trimmed === "") return normalizeBookRegistry(registry);
  return normalizeBookRegistry({
    ...registry,
    books: registry.books.map((book) => (book.id === id ? { ...book, name: trimmed } : book)),
  });
}

/** Removes a book from the list (closing it if it was open). Its data is deleted separately. */
export function removeBookEntry(
  registry: ReadonlyDeep<BookRegistry>,
  id: RecipeBookId,
): BookRegistry {
  return normalizeBookRegistry({
    ...registry,
    books: registry.books.filter((book) => book.id !== id),
  });
}

export type ReadBookRegistryResult = {
  registry: BookRegistry;
  /** True when the registry was built from the legacy single-book key and is not stored yet. */
  migratedFromLegacy: boolean;
};

const StoredRegistryShape = type({ books: "unknown[]", "active_book_id?": "unknown" });

/**
 * The stored registry, keeping every entry that is valid and dropping (with a warning) only the ones
 * that are not — one malformed entry must not make the other books unreachable. `null` when nothing
 * usable is stored at all.
 */
function readStoredRegistry(): BookRegistry | null {
  const raw = readLocalStorage(BOOK_REGISTRY_KEY);
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    console.warn(`Invalid JSON in localStorage, key='${BOOK_REGISTRY_KEY}':`, error);
    return null;
  }
  const shape = StoredRegistryShape(json);
  if (shape instanceof type.errors) {
    console.warn(`Failed to load BookRegistry from localStorage: ${shape.summary}`);
    return null;
  }
  const books: BookRegistryEntry[] = [];
  for (const candidate of shape.books) {
    const entry = BookRegistryEntry.type(candidate);
    if (entry instanceof type.errors) {
      console.warn(`Dropping an invalid book from localStorage: ${entry.summary}`);
    } else {
      books.push(entry);
    }
  }
  const active = RecipeBookId.type(shape.active_book_id);
  return normalizeBookRegistry({
    books,
    ...(!(active instanceof type.errors) && { active_book_id: active }),
  });
}

/**
 * Reads the registry from `localStorage`, never throwing. Anything unusable (absent, unreadable,
 * corrupt, stale) falls back to the legacy single-book key if that holds a book, and otherwise to an
 * empty registry. Reading has no side effects; the caller persists a migrated result and removes the
 * legacy key.
 */
export function readBookRegistry(now: number = Date.now()): ReadBookRegistryResult {
  const stored = readStoredRegistry();
  if (stored !== null) return { registry: stored, migratedFromLegacy: false };
  const legacy = readValidatedLocalStorage(LEGACY_ACTIVE_BOOK_KEY, LegacyActiveBook);
  if (legacy === null) {
    return { registry: emptyBookRegistry(), migratedFromLegacy: false };
  }
  const entry: BookRegistryEntry = {
    id: legacy.id,
    name: legacy.name,
    created_at: now,
    last_opened_at: now,
  };
  return {
    registry: { books: [entry], active_book_id: entry.id },
    migratedFromLegacy: true,
  };
}
