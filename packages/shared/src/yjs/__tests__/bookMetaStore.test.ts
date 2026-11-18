import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { fixedId, randomId } from "../../types/ids.ts";
import { RecipeBookId } from "../../types/recipeBook.ts";
import {
  BOOK_SCHEMA_VERSION,
  ensureBookMeta,
  getBookMeta,
  getBookMetaYmap,
  setBookName,
} from "../bookMetaStore.ts";

const BOOK_ID = fixedId(RecipeBookId, "book-one");
const OTHER_BOOK_ID = fixedId(RecipeBookId, "book-two");
const NOW = 1_700_000_000_000;

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getBookMeta", () => {
  it("is undefined for a book that has not been initialised", () => {
    expect(getBookMeta(doc)).toBeUndefined();
  });

  it("is undefined, and logs, when what is stored is not valid", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getBookMetaYmap(doc).set("name", "Half a book");
    expect(getBookMeta(doc)).toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });
});

describe("ensureBookMeta", () => {
  it("writes the id, name, creation time and schema version into a new book", () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    expect(getBookMeta(doc)).toEqual({
      id: BOOK_ID,
      name: "Family Recipes",
      created_at: NOW,
      schema_version: BOOK_SCHEMA_VERSION,
    });
  });

  it("starts the schema version at 1", () => {
    expect(BOOK_SCHEMA_VERSION).toBe(1);
  });

  it("never overwrites what is already there", () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    ensureBookMeta(doc, { id: BOOK_ID, name: "Renamed Elsewhere" }, NOW + 1000);
    expect(getBookMeta(doc)).toEqual({
      id: BOOK_ID,
      name: "Family Recipes",
      created_at: NOW,
      schema_version: BOOK_SCHEMA_VERSION,
    });
  });

  it("makes no change, and emits no update, when nothing is missing", () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    const onUpdate = vi.fn();
    doc.on("update", onUpdate);
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW + 1000);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("fills in only the missing parts of a partial map", () => {
    const map = getBookMetaYmap(doc);
    map.set("id", BOOK_ID);
    map.set("name", "Kept Name");
    ensureBookMeta(doc, { id: BOOK_ID, name: "Other Name" }, NOW);
    expect(getBookMeta(doc)).toEqual({
      id: BOOK_ID,
      name: "Kept Name",
      created_at: NOW,
      schema_version: BOOK_SCHEMA_VERSION,
    });
  });

  it("leaves a document that belongs to a different book untouched, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    ensureBookMeta(doc, { id: OTHER_BOOK_ID, name: "Other Book" }, NOW);
    const before = Y.encodeStateAsUpdate(doc);

    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW + 1000);

    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(getBookMeta(doc)?.id).toBe(OTHER_BOOK_ID);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("warns about, but does not downgrade, a newer schema version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    getBookMetaYmap(doc).set("schema_version", BOOK_SCHEMA_VERSION + 1);

    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);

    expect(getBookMeta(doc)?.schema_version).toBe(BOOK_SCHEMA_VERSION + 1);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("can never be undone", () => {
    const undoManager = new Y.UndoManager(getBookMetaYmap(doc));
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    expect(undoManager.canUndo()).toBe(false);
    undoManager.undo();
    expect(getBookMeta(doc)?.name).toBe("Family Recipes");
  });

  it("accepts a freshly generated book id", () => {
    const id = randomId(RecipeBookId);
    ensureBookMeta(doc, { id, name: "New Book" }, NOW);
    expect(getBookMeta(doc)?.id).toBe(id);
  });
});

describe("setBookName", () => {
  it("renames the book", () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    setBookName(doc, "Grandma's Recipes");
    expect(getBookMeta(doc)?.name).toBe("Grandma's Recipes");
  });

  it("can be undone, back to the previous name", () => {
    const undoManager = new Y.UndoManager(getBookMetaYmap(doc));
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" }, NOW);
    setBookName(doc, "Grandma's Recipes");
    expect(undoManager.canUndo()).toBe(true);
    undoManager.undo();
    expect(getBookMeta(doc)?.name).toBe("Family Recipes");
  });
});
