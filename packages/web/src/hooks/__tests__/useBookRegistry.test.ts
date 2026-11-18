import { fixedId, RecipeBookId } from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOK_REGISTRY_KEY,
  type BookRegistry,
  type BookRegistryEntry,
  LEGACY_ACTIVE_BOOK_KEY,
} from "../../storage/bookRegistry.ts";

const mockDeleteBookDatabases = vi.fn();
vi.mock("../../storage/bookDatabases.ts", () => ({
  deleteBookDatabases: mockDeleteBookDatabases,
}));

const { useBookRegistry } = await import("../useBookRegistry.ts");

const A = fixedId(RecipeBookId, "book-a");
const B = fixedId(RecipeBookId, "book-b");

function entry(id: RecipeBookId, name: string, lastOpened = 100): BookRegistryEntry {
  return { id, name, created_at: 1, last_opened_at: lastOpened };
}

function store(registry: BookRegistry) {
  localStorage.setItem(BOOK_REGISTRY_KEY, JSON.stringify(registry));
}

function stored(): BookRegistry {
  const raw = localStorage.getItem(BOOK_REGISTRY_KEY);
  if (raw === null) throw new Error("registry was not stored");
  return JSON.parse(raw) as BookRegistry;
}

beforeEach(() => {
  localStorage.clear();
  mockDeleteBookDatabases.mockReset();
  mockDeleteBookDatabases.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBookRegistry — reading", () => {
  it("starts empty, with nothing open", () => {
    const { result } = renderHook(() => useBookRegistry());
    expect(result.current.books).toEqual([]);
    expect(result.current.activeBook).toBeNull();
  });

  it("restores the books and the open book on the first render", () => {
    store({ books: [entry(A, "Alice", 100), entry(B, "Bob", 900)], active_book_id: A });
    const { result } = renderHook(() => useBookRegistry());
    expect(result.current.books.map((b) => b.name)).toEqual(["Bob", "Alice"]);
    expect(result.current.activeBook?.id).toBe(A);
  });

  it("adopts the legacy single book as the open book, then stores it and drops the old key", () => {
    localStorage.setItem(LEGACY_ACTIVE_BOOK_KEY, JSON.stringify({ id: A, name: "Alice" }));
    const { result } = renderHook(() => useBookRegistry());

    expect(result.current.activeBook).toMatchObject({ id: A, name: "Alice" });
    expect(stored().active_book_id).toBe(A);
    expect(localStorage.getItem(LEGACY_ACTIVE_BOOK_KEY)).toBeNull();
  });
});

describe("useBookRegistry — createBook", () => {
  it("creates a book, opens it, and stores the change", () => {
    const { result } = renderHook(() => useBookRegistry());
    let id: RecipeBookId | undefined;
    act(() => {
      id = result.current.createBook("  Family  ");
    });
    expect(id).toBeDefined();
    expect(result.current.activeBook).toMatchObject({ id, name: "Family" });
    expect(stored().active_book_id).toBe(id);
  });

  it("creates nothing for a blank name", () => {
    const { result } = renderHook(() => useBookRegistry());
    let id: RecipeBookId | undefined;
    act(() => {
      id = result.current.createBook("   ");
    });
    expect(id).toBeUndefined();
    expect(result.current.books).toEqual([]);
  });

  it("gives every book its own id", () => {
    const { result } = renderHook(() => useBookRegistry());
    act(() => {
      result.current.createBook("One");
      result.current.createBook("Two");
    });
    expect(result.current.books).toHaveLength(2);
    expect(new Set(result.current.books.map((b) => b.id)).size).toBe(2);
  });
});

describe("useBookRegistry — switching", () => {
  it("opens a different book, which moves it to the top", () => {
    store({ books: [entry(A, "Alice", 100), entry(B, "Bob", 900)], active_book_id: B });
    const { result } = renderHook(() => useBookRegistry());
    act(() => result.current.openBook(A));
    expect(result.current.activeBook?.id).toBe(A);
    expect(result.current.books.map((b) => b.name)).toEqual(["Alice", "Bob"]);
    expect(stored().active_book_id).toBe(A);
  });

  it("closes the open book without removing it", () => {
    store({ books: [entry(A, "Alice")], active_book_id: A });
    const { result } = renderHook(() => useBookRegistry());
    act(() => result.current.closeBook());
    expect(result.current.activeBook).toBeNull();
    expect(result.current.books).toHaveLength(1);
    expect(stored().active_book_id).toBeUndefined();
  });
});

describe("useBookRegistry — renameBook", () => {
  it("renames the cached name and keeps the id", () => {
    store({ books: [entry(A, "Alice")], active_book_id: A });
    const { result } = renderHook(() => useBookRegistry());
    act(() => result.current.renameBook(A, "Alicia"));
    expect(result.current.activeBook).toMatchObject({ id: A, name: "Alicia" });
    expect(stored().books[0]).toMatchObject({ id: A, name: "Alicia" });
  });
});

describe("useBookRegistry — deleteBook", () => {
  it("removes the book and deletes its data from the device", async () => {
    store({ books: [entry(A, "Alice"), entry(B, "Bob")] });
    const { result } = renderHook(() => useBookRegistry());
    await act(async () => {
      await result.current.deleteBook(A);
    });
    expect(result.current.books.map((b) => b.id)).toEqual([B]);
    expect(stored().books.map((b) => b.id)).toEqual([B]);
    expect(mockDeleteBookDatabases).toHaveBeenCalledWith(A);
  });

  it("still removes the book, and logs, when its data cannot be deleted", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockDeleteBookDatabases.mockRejectedValue(new Error("blocked"));
    store({ books: [entry(A, "Alice")] });
    const { result } = renderHook(() => useBookRegistry());
    await act(async () => {
      await result.current.deleteBook(A);
    });
    expect(result.current.books).toEqual([]);
    expect(error).toHaveBeenCalled();
  });
});
