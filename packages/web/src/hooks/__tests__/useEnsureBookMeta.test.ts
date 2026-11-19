import { fixedId, getBookMeta, RecipeBookId } from "@recipe-book/shared";
import { renderHook } from "@testing-library/react";
import * as Y from "yjs";
import { beforeEach, describe, expect, it } from "vitest";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useEnsureBookMeta } from "../useEnsureBookMeta.ts";

const BOOK_ID = fixedId(RecipeBookId, "book-one");

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("useEnsureBookMeta", () => {
  it("writes the book's metadata once the document has synced", async () => {
    renderHook(() =>
      useEnsureBookMeta(
        { doc, whenSynced: Promise.resolve() },
        { id: BOOK_ID, name: "Family Recipes" },
      ),
    );
    await flushAsyncEffects();
    expect(getBookMeta(doc)).toMatchObject({ id: BOOK_ID, name: "Family Recipes" });
  });

  it("returns a promise that resolves only once the metadata is in place", async () => {
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    const { result } = renderHook(() =>
      useEnsureBookMeta({ doc, whenSynced }, { id: BOOK_ID, name: "Family" }),
    );
    let ready = false;
    void result.current.then(() => {
      ready = true;
    });
    await flushAsyncEffects();
    expect(ready).toBe(false);
    expect(getBookMeta(doc)).toBeUndefined();

    finishSync();
    await flushAsyncEffects();
    expect(ready).toBe(true);
    expect(getBookMeta(doc)?.name).toBe("Family");
  });

  it("returns the same promise across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      useEnsureBookMeta({ doc, whenSynced: Promise.resolve() }, { id: BOOK_ID, name: "Family" }),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("writes nothing until the document has synced", async () => {
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    renderHook(() => useEnsureBookMeta({ doc, whenSynced }, { id: BOOK_ID, name: "Family" }));
    await flushAsyncEffects();
    expect(getBookMeta(doc)).toBeUndefined();

    finishSync();
    await flushAsyncEffects();
    expect(getBookMeta(doc)?.name).toBe("Family");
  });

  it("writes nothing if unmounted before the document syncs", async () => {
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    const { unmount } = renderHook(() =>
      useEnsureBookMeta({ doc, whenSynced }, { id: BOOK_ID, name: "Family" }),
    );
    unmount();
    finishSync();
    await flushAsyncEffects();
    expect(getBookMeta(doc)).toBeUndefined();
  });

  it("does not overwrite the stored name when the local name differs", async () => {
    const { rerender } = renderHook(
      ({ name }) =>
        useEnsureBookMeta({ doc, whenSynced: Promise.resolve() }, { id: BOOK_ID, name }),
      { initialProps: { name: "Family Recipes" } },
    );
    await flushAsyncEffects();
    rerender({ name: "Renamed Locally" });
    await flushAsyncEffects();
    expect(getBookMeta(doc)?.name).toBe("Family Recipes");
  });
});
