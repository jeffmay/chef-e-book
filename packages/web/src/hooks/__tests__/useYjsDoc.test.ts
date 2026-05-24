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

const { useKitchenwareDoc, useRecipeBookDoc } = await import("../useYjsDoc.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useKitchenwareDoc", () => {
  it("returns a Y.Doc instance", () => {
    const { result } = renderHook(() => useKitchenwareDoc("Alice"));
    expect(result.current).toBeInstanceOf(Y.Doc);
  });

  it("creates IndexeddbPersistence keyed with kitchenware- prefix", () => {
    renderHook(() => useKitchenwareDoc("Alice"));
    expect(MockIndexeddbPersistence).toHaveBeenCalledWith("kitchenware-Alice", expect.any(Y.Doc));
  });

  it("destroys persistence on unmount", () => {
    const { unmount } = renderHook(() => useKitchenwareDoc("Alice"));
    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("returns the same doc instance across re-renders", () => {
    const { result, rerender } = renderHook(() => useKitchenwareDoc("Alice"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("useRecipeBookDoc", () => {
  it("returns a Y.Doc instance", () => {
    const { result } = renderHook(() => useRecipeBookDoc("Alice"));
    expect(result.current).toBeInstanceOf(Y.Doc);
  });

  it("creates IndexeddbPersistence keyed with recipes- prefix", () => {
    renderHook(() => useRecipeBookDoc("Alice"));
    expect(MockIndexeddbPersistence).toHaveBeenCalledWith("recipes-Alice", expect.any(Y.Doc));
  });

  it("destroys persistence on unmount", () => {
    const { unmount } = renderHook(() => useRecipeBookDoc("Alice"));
    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("returns the same doc instance across re-renders", () => {
    const { result, rerender } = renderHook(() => useRecipeBookDoc("Alice"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("useKitchenwareDoc", () => {
  it("returns a Y.Doc instance", () => {
<<<<<<< HEAD
    const { result } = renderHook(() => useYjsDoc("Alice"));
    expect(result.current.doc).toBeInstanceOf(Y.Doc);
=======
    const { result } = renderHook(() => useKitchenwareDoc("Alice"));
    expect(result.current).toBeInstanceOf(Y.Doc);
>>>>>>> a3ae51f (📦 Separate kitchenware and recipe documents, add RecipeBook API and storage backends)
  });

  it("creates IndexeddbPersistence keyed with kitchenware- prefix", () => {
    renderHook(() => useKitchenwareDoc("Alice"));
    expect(MockIndexeddbPersistence).toHaveBeenCalledWith("kitchenware-Alice", expect.any(Y.Doc));
  });

  it("destroys persistence on unmount", () => {
    const { unmount } = renderHook(() => useKitchenwareDoc("Alice"));
    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });
});

<<<<<<< HEAD
  it("returns the same doc instance across re-renders", () => {
    const { result, rerender } = renderHook(() => useYjsDoc("Alice"));
    const first = result.current.doc;
    rerender();
    expect(result.current.doc).toBe(first);
=======
describe("useRecipeBookDoc", () => {
  it("returns a Y.Doc instance", () => {
    const { result } = renderHook(() => useRecipeBookDoc("Alice"));
    expect(result.current).toBeInstanceOf(Y.Doc);
  });

  it("creates IndexeddbPersistence keyed with recipes- prefix", () => {
    renderHook(() => useRecipeBookDoc("Alice"));
    expect(MockIndexeddbPersistence).toHaveBeenCalledWith("recipes-Alice", expect.any(Y.Doc));
  });

  it("destroys persistence on unmount", () => {
    const { unmount } = renderHook(() => useRecipeBookDoc("Alice"));
    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
>>>>>>> a3ae51f (📦 Separate kitchenware and recipe documents, add RecipeBook API and storage backends)
  });
});
