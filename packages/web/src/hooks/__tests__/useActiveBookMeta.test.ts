import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActiveBookMeta, ACTIVE_BOOK_KEY } from "../useActiveBookMetaStore.ts";
import { fixedId, RecipeBookId } from "@recipe-book/shared";

beforeEach(() => {
  localStorage.clear();
});

describe("useBook", () => {
  it("returns null when no book is stored", () => {
    const { result } = renderHook(() => useActiveBookMeta());
    expect(result.current.activeBookMeta).toBeNull();
  });

  it("reads an existing book from localStorage on mount", () => {
    const bookId = fixedId(RecipeBookId, "alice");
    localStorage.setItem(ACTIVE_BOOK_KEY, `{"id":"${bookId}","name":"Alice"}`);
    const { result } = renderHook(() => useActiveBookMeta());
    expect(result.current.activeBookMeta?.name).toBe("Alice");
  });

  it("returns null instead of throwing when the stored book is not valid JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(ACTIVE_BOOK_KEY, "{truncated");

    const { result } = renderHook(() => useActiveBookMeta());

    expect(result.current.activeBookMeta).toBeNull();
    warn.mockRestore();
  });

  it("returns null when the stored book no longer matches the schema", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(ACTIVE_BOOK_KEY, '{"name":"Alice"}');

    const { result } = renderHook(() => useActiveBookMeta());

    expect(result.current.activeBookMeta).toBeNull();
    warn.mockRestore();
  });

  it("setUserName updates state and localStorage", () => {
    const { result } = renderHook(() => useActiveBookMeta());
    act(() => result.current.setActiveBookName("Bob"));
    expect(result.current.activeBookMeta?.name).toBe("Bob");
    expect(localStorage.getItem(ACTIVE_BOOK_KEY)).toContain('"name":"Bob"');
  });

  it("clearUser resets state and removes from localStorage", () => {
    const bookId = fixedId(RecipeBookId, "alice");
    localStorage.setItem(ACTIVE_BOOK_KEY, `{"id":"${bookId}","name":"Alice"}`);
    const { result } = renderHook(() => useActiveBookMeta());
    act(() => result.current.clearActiveBookMeta());
    expect(result.current.activeBookMeta).toBeNull();
    expect(localStorage.getItem(ACTIVE_BOOK_KEY)).toBeNull();
  });
});
