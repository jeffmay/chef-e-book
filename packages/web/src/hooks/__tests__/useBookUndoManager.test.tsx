import {
  addIngredient,
  fixedId,
  getIngredients,
  IngredientId,
  type Ingredient,
} from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookUndoContext, useBookUndo } from "../../contexts/undoContext.ts";
import { useBookUndoManager } from "../useBookUndoManager.ts";

function ingredient(key: string, name: string): Ingredient {
  return {
    kind: "ingredient",
    id: fixedId(IngredientId, key),
    name,
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  };
}

const BUTTER = ingredient("butter", "Butter");
const FLOUR = ingredient("flour", "Flour");
const names = (doc: Y.Doc) => getIngredients(doc).map((i) => i.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBookUndoManager", () => {
  it("starts with nothing to undo or redo", () => {
    const { result } = renderHook(() => useBookUndoManager(new Y.Doc()));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("can undo once the book has been edited", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useBookUndoManager(doc));
    act(() => addIngredient(doc, BUTTER));
    expect(result.current.canUndo).toBe(true);
  });

  it("undoes an edit, which makes it redoable, and redoes it", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useBookUndoManager(doc));
    act(() => addIngredient(doc, BUTTER));

    act(() => result.current.undo());
    expect(names(doc)).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(names(doc)).toEqual(["Butter"]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("does nothing when there is nothing to undo", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useBookUndoManager(doc));
    expect(() => act(() => result.current.undo())).not.toThrow();
    expect(result.current.canUndo).toBe(false);
  });

  it("ends the current step on stopCapturing, so the next edit is its own step", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useBookUndoManager(doc));
    act(() => addIngredient(doc, BUTTER));
    act(() => result.current.stopCapturing());
    act(() => addIngredient(doc, FLOUR));

    act(() => result.current.undo());
    expect(names(doc)).toEqual(["Butter"]);
  });

  it("does not offer to undo edits that arrive from elsewhere", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useBookUndoManager(doc));
    const remote = new Y.Doc();
    addIngredient(remote, FLOUR);
    act(() => Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), "remote"));
    expect(result.current.canUndo).toBe(false);
  });

  it("starts a different book with an empty history", () => {
    const first = new Y.Doc();
    const { result, rerender } = renderHook(({ doc }) => useBookUndoManager(doc), {
      initialProps: { doc: first },
    });
    act(() => addIngredient(first, BUTTER));
    expect(result.current.canUndo).toBe(true);

    rerender({ doc: new Y.Doc() });
    expect(result.current.canUndo).toBe(false);
  });

  it("stops tracking the old book once it is closed", () => {
    const doc = new Y.Doc();
    const { unmount } = renderHook(() => useBookUndoManager(doc));
    unmount();
    expect(() => addIngredient(doc, BUTTER)).not.toThrow();
  });

  it("destroys the manager it created, and only that one, even under StrictMode", () => {
    const destroy = vi.spyOn(Y.UndoManager.prototype, "destroy");
    const doc = new Y.Doc();
    const { result, unmount } = renderHook(() => useBookUndoManager(doc), { wrapper: StrictMode });

    act(() => addIngredient(doc, BUTTER));
    act(() => result.current.undo());
    expect(names(doc)).toEqual([]);

    unmount();
    // StrictMode mounts, unmounts, and mounts again: two managers were created, so two are destroyed.
    expect(destroy).toHaveBeenCalledTimes(2);
  });
});

describe("useBookUndo", () => {
  it("throws outside a provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useBookUndo())).toThrow("BookUndoContext.Provider");
    error.mockRestore();
  });

  it("returns what the provider supplies", () => {
    const value = {
      undo: vi.fn(),
      redo: vi.fn(),
      stopCapturing: vi.fn(),
      canUndo: true,
      canRedo: false,
    };
    const { result } = renderHook(() => useBookUndo(), {
      wrapper: ({ children }) => (
        <BookUndoContext.Provider value={value}>{children}</BookUndoContext.Provider>
      ),
    });
    expect(result.current).toBe(value);
  });
});
