import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as Y from "yjs";
import type * as LegacyBookMigration from "../../storage/legacyBookMigration.ts";

const mockDestroy = vi.fn();
const MockIndexeddbPersistence = vi.fn().mockImplementation(() => ({
  destroy: mockDestroy,
  whenSynced: Promise.resolve(),
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: MockIndexeddbPersistence,
}));

const mockMergeLegacyBookData = vi.fn();

vi.mock("../../storage/legacyBookMigration.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof LegacyBookMigration>()),
  mergeLegacyBookData: mockMergeLegacyBookData,
}));

const { useBookDoc } = await import("../useYjsDoc.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockMergeLegacyBookData.mockResolvedValue([]);
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

  it("returns the same object on every render, so a context it feeds does not churn", () => {
    const { result, rerender } = renderHook(() => useBookDoc("book1"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("shares one doc between kitchenware and recipe data", () => {
    const { result } = renderHook(() => useBookDoc("book1"));
    const { doc } = result.current;
    doc.getMap("ingredients").set("i1", { name: "Butter" });
    doc.getMap("recipes").set("r1", { title: "Pie" });
    expect(doc.getMap("ingredients").size).toBe(1);
    expect(doc.getMap("recipes").size).toBe(1);
  });

  describe("legacy data migration", () => {
    function deferred() {
      let resolve!: (merged: string[]) => void;
      const promise = new Promise<string[]>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    it("merges legacy data for this book into the book doc", async () => {
      const { result } = renderHook(() => useBookDoc("book1"));
      await result.current.whenSynced;
      expect(mockMergeLegacyBookData).toHaveBeenCalledWith(
        result.current.doc,
        "book1",
        expect.objectContaining({ isCancelled: expect.any(Function) }),
      );
    });

    it("does not resolve whenSynced until the merge has finished", async () => {
      const merge = deferred();
      mockMergeLegacyBookData.mockReturnValue(merge.promise);
      const { result } = renderHook(() => useBookDoc("book1"));
      let resolved = false;
      void result.current.whenSynced.then(() => {
        resolved = true;
      });

      await waitFor(() => expect(mockMergeLegacyBookData).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(resolved).toBe(false);

      merge.resolve(["recipes-book1"]);
      await result.current.whenSynced;
      expect(resolved).toBe(true);
    });

    it("still resolves whenSynced, and logs, when the merge fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockMergeLegacyBookData.mockRejectedValue(new Error("blocked"));
      const { result } = renderHook(() => useBookDoc("book1"));
      await result.current.whenSynced;
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it("cancels the merge on unmount and never resolves whenSynced", async () => {
      const merge = deferred();
      mockMergeLegacyBookData.mockReturnValue(merge.promise);
      const { result, unmount } = renderHook(() => useBookDoc("book1"));
      let resolved = false;
      void result.current.whenSynced.then(() => {
        resolved = true;
      });
      await waitFor(() => expect(mockMergeLegacyBookData).toHaveBeenCalled());
      const options = mockMergeLegacyBookData.mock.calls[0]?.[2] as { isCancelled: () => boolean };
      expect(options.isCancelled()).toBe(false);

      unmount();
      merge.resolve([]);
      await new Promise((r) => setTimeout(r, 0));

      expect(options.isCancelled()).toBe(true);
      expect(resolved).toBe(false);
    });
  });
});
