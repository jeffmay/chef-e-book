import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import * as Y from "yjs";

const mockDestroy = vi.fn();
const MockIndexeddbPersistence = vi.fn().mockImplementation(() => ({
  destroy: mockDestroy,
  whenSynced: Promise.resolve(),
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: MockIndexeddbPersistence,
}));

const { useBookDoc } = await import("../useYjsDoc.ts");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBookDoc", () => {
  it("returns a Y.Doc instance", () => {
    const { result } = renderHook(() => useBookDoc("book1"));
    expect(result.current.doc).toBeInstanceOf(Y.Doc);
  });

  it("creates a single IndexeddbPersistence keyed with the book- prefix", () => {
    renderHook(() => useBookDoc("book1"));
    expect(MockIndexeddbPersistence).toHaveBeenCalledTimes(1);
    expect(MockIndexeddbPersistence).toHaveBeenCalledWith("book-book1", expect.any(Y.Doc));
  });

  it("destroys persistence on unmount", () => {
    const { unmount } = renderHook(() => useBookDoc("book1"));
    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("returns the same doc instance across re-renders", () => {
    const { result, rerender } = renderHook(() => useBookDoc("book1"));
    const first = result.current.doc;
    rerender();
    expect(result.current.doc).toBe(first);
  });

  it("shares one doc between kitchenware and recipe data", () => {
    const { result } = renderHook(() => useBookDoc("book1"));
    const { doc } = result.current;
    doc.getMap("ingredients").set("i1", { name: "Butter" });
    doc.getMap("recipes").set("r1", { title: "Pie" });
    expect(doc.getMap("ingredients").size).toBe(1);
    expect(doc.getMap("recipes").size).toBe(1);
  });
});
