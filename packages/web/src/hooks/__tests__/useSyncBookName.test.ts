import { ensureBookMeta, fixedId, RecipeBookId, setBookName } from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useSyncBookName } from "../useSyncBookName.ts";

const BOOK_ID = fixedId(RecipeBookId, "book-one");

let doc: Y.Doc;
let onNameChange: ReturnType<typeof vi.fn>;

beforeEach(() => {
  doc = new Y.Doc();
  onNameChange = vi.fn();
});

function renderSync(name: string, whenSynced: Promise<unknown> = Promise.resolve()) {
  return renderHook(
    ({ bookName }) =>
      useSyncBookName({ doc, whenSynced }, { id: BOOK_ID, name: bookName }, onNameChange),
    { initialProps: { bookName: name } },
  );
}

describe("useSyncBookName", () => {
  it("does nothing while the document has no name", async () => {
    renderSync("Cached");
    await flushAsyncEffects();
    expect(onNameChange).not.toHaveBeenCalled();
  });

  it("does nothing when the document's name matches the cache", async () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Same" });
    renderSync("Same");
    await flushAsyncEffects();
    expect(onNameChange).not.toHaveBeenCalled();
  });

  it("tells the registry when the document's name differs from the cached one", async () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "From Document" });
    renderSync("Stale Cache");
    await flushAsyncEffects();
    expect(onNameChange).toHaveBeenCalledWith(BOOK_ID, "From Document");
  });

  it("waits for the document to sync before reading it", async () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "From Document" });
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    renderSync("Stale Cache", whenSynced);
    await flushAsyncEffects();
    expect(onNameChange).not.toHaveBeenCalled();

    finishSync();
    await flushAsyncEffects();
    expect(onNameChange).toHaveBeenCalledWith(BOOK_ID, "From Document");
  });

  it("follows a rename made later, e.g. on another device or by an undo", async () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Original" });
    renderSync("Original");
    await flushAsyncEffects();

    act(() => setBookName(doc, "Renamed Elsewhere"));
    expect(onNameChange).toHaveBeenCalledWith(BOOK_ID, "Renamed Elsewhere");
  });

  it("stops listening once unmounted", async () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Original" });
    const { unmount } = renderSync("Original");
    await flushAsyncEffects();
    unmount();

    setBookName(doc, "After Unmount");
    expect(onNameChange).not.toHaveBeenCalled();
  });
});
