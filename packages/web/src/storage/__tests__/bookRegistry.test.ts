import { fixedId, RecipeBookId } from "@recipe-book/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBookEntry,
  BOOK_REGISTRY_KEY,
  type BookRegistry,
  type BookRegistryEntry,
  closeActiveBook,
  emptyBookRegistry,
  findActiveBook,
  LEGACY_ACTIVE_BOOK_KEY,
  normalizeBookRegistry,
  openBookEntry,
  readBookRegistry,
  removeBookEntry,
  renameBookEntry,
  sortBooksByRecent,
} from "../bookRegistry.ts";

const A = fixedId(RecipeBookId, "book-a");
const B = fixedId(RecipeBookId, "book-b");
const C = fixedId(RecipeBookId, "book-c");

function entry(id: RecipeBookId, name: string, lastOpened = 100): BookRegistryEntry {
  return { id, name, created_at: 1, last_opened_at: lastOpened };
}

const registryOf = (books: BookRegistryEntry[], active?: RecipeBookId): BookRegistry => ({
  books,
  ...(active !== undefined && { active_book_id: active }),
});

describe("normalizeBookRegistry", () => {
  it("drops duplicate ids, keeping the first", () => {
    const result = normalizeBookRegistry(registryOf([entry(A, "First"), entry(A, "Second")]));
    expect(result.books.map((b) => b.name)).toEqual(["First"]);
  });

  it("drops an active id that names no book", () => {
    expect(normalizeBookRegistry(registryOf([entry(A, "A")], B)).active_book_id).toBeUndefined();
  });

  it("keeps an active id that names a book", () => {
    expect(normalizeBookRegistry(registryOf([entry(A, "A")], A)).active_book_id).toBe(A);
  });
});

describe("registry operations", () => {
  it("adds a book without opening it", () => {
    const result = addBookEntry(emptyBookRegistry(), entry(A, "A"));
    expect(result.books).toHaveLength(1);
    expect(result.active_book_id).toBeUndefined();
  });

  it("ignores adding a book whose id is already listed", () => {
    const result = addBookEntry(registryOf([entry(A, "A")]), entry(A, "Other"));
    expect(result.books.map((b) => b.name)).toEqual(["A"]);
  });

  it("opens a book, stamping when it was opened", () => {
    const result = openBookEntry(registryOf([entry(A, "A"), entry(B, "B")]), B, 500);
    expect(result.active_book_id).toBe(B);
    expect(result.books.find((b) => b.id === B)?.last_opened_at).toBe(500);
    expect(result.books.find((b) => b.id === A)?.last_opened_at).toBe(100);
  });

  it("changes nothing when opening an id that names no book", () => {
    const before = registryOf([entry(A, "A")], A);
    expect(openBookEntry(before, C, 500)).toEqual(before);
  });

  it("closes the open book but keeps the list", () => {
    const result = closeActiveBook(registryOf([entry(A, "A")], A));
    expect(result.active_book_id).toBeUndefined();
    expect(result.books).toHaveLength(1);
  });

  it("renames a book, trimmed, keeping its id", () => {
    const result = renameBookEntry(registryOf([entry(A, "A")], A), A, "  Renamed  ");
    expect(result.books[0]).toMatchObject({ id: A, name: "Renamed" });
    expect(result.active_book_id).toBe(A);
  });

  it("ignores a blank rename", () => {
    const result = renameBookEntry(registryOf([entry(A, "A")]), A, "   ");
    expect(result.books[0]?.name).toBe("A");
  });

  it("removes a book, and closes it if it was open", () => {
    const result = removeBookEntry(registryOf([entry(A, "A"), entry(B, "B")], A), A);
    expect(result.books.map((b) => b.id)).toEqual([B]);
    expect(result.active_book_id).toBeUndefined();
  });

  it("keeps the open book when a different one is removed", () => {
    const result = removeBookEntry(registryOf([entry(A, "A"), entry(B, "B")], A), B);
    expect(result.active_book_id).toBe(A);
  });

  it("finds the open book", () => {
    expect(findActiveBook(registryOf([entry(A, "A"), entry(B, "B")], B))?.name).toBe("B");
    expect(findActiveBook(registryOf([entry(A, "A")]))).toBeUndefined();
  });

  it("sorts most recently opened first, then by name", () => {
    const sorted = sortBooksByRecent([
      entry(A, "Zed", 100),
      entry(B, "Amy", 100),
      entry(C, "Mid", 900),
    ]);
    expect(sorted.map((b) => b.name)).toEqual(["Mid", "Amy", "Zed"]);
  });
});

describe("readBookRegistry", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is empty when nothing is stored", () => {
    expect(readBookRegistry()).toEqual({ registry: { books: [] }, migratedFromLegacy: false });
  });

  it("returns what is stored", () => {
    const stored = registryOf([entry(A, "A"), entry(B, "B")], B);
    localStorage.setItem(BOOK_REGISTRY_KEY, JSON.stringify(stored));
    expect(readBookRegistry()).toEqual({ registry: stored, migratedFromLegacy: false });
  });

  it("normalizes what is stored", () => {
    localStorage.setItem(
      BOOK_REGISTRY_KEY,
      JSON.stringify(registryOf([entry(A, "A"), entry(A, "Dup")], B)),
    );
    const { registry } = readBookRegistry();
    expect(registry.books).toHaveLength(1);
    expect(registry.active_book_id).toBeUndefined();
  });

  it("falls back to empty, with a warning, when the stored JSON is malformed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem(BOOK_REGISTRY_KEY, "{truncated");
    expect(readBookRegistry().registry).toEqual({ books: [] });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("falls back to empty, with a warning, when the stored value has the wrong shape", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem(BOOK_REGISTRY_KEY, JSON.stringify({ books: [{ id: "x" }] }));
    expect(readBookRegistry().registry).toEqual({ books: [] });
    expect(warn).toHaveBeenCalledOnce();
  });

  describe("legacy single-book key", () => {
    it("adopts the legacy book as the open book", () => {
      localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, JSON.stringify({ id: A, name: "Alice" }));
      const { registry, migratedFromLegacy } = readBookRegistry(777);
      expect(migratedFromLegacy).toBe(true);
      expect(registry).toEqual({
        books: [{ id: A, name: "Alice", created_at: 777, last_opened_at: 777 }],
        active_book_id: A,
      });
    });

    it("does not touch storage itself", () => {
      localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, JSON.stringify({ id: A, name: "Alice" }));
      readBookRegistry();
      expect(localStorage.getItem(BOOK_REGISTRY_KEY)).toBeNull();
      expect(localStorage.getItem(LEGACY_ACTIVE_BOOK_KEY)).not.toBeNull();
    });

    it("prefers the new key when both exist", () => {
      localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, JSON.stringify({ id: A, name: "Alice" }));
      localStorage.setItem(BOOK_REGISTRY_KEY, JSON.stringify(registryOf([entry(B, "Bob")], B)));
      const { registry, migratedFromLegacy } = readBookRegistry();
      expect(migratedFromLegacy).toBe(false);
      expect(registry.books.map((b) => b.id)).toEqual([B]);
    });

    it("adopts the legacy book when the new key is corrupt", () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      localStorage.setItem(BOOK_REGISTRY_KEY, "{truncated");
      localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, JSON.stringify({ id: A, name: "Alice" }));
      expect(readBookRegistry().migratedFromLegacy).toBe(true);
    });

    it("ignores a legacy value that is not a book", () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, '{"name":"Alice"}');
      expect(readBookRegistry()).toEqual({ registry: { books: [] }, migratedFromLegacy: false });
    });
  });
});
