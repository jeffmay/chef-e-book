import {
  addIngredient,
  createRecipe,
  ensureBookMeta,
  fixedId,
  getBookMeta,
  getIngredients,
  getRecipes,
  IngredientId,
  RecipeBookId,
  setBookName,
  type Ingredient,
} from "@recipe-book/shared";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteBookDatabases, loadBookDoc, writeBookName } from "../bookDatabases.ts";
import {
  bookDatabaseName,
  indexedDbExists,
  legacyDatabaseNames,
  readIndexedDbDoc,
} from "../legacyBookMigration.ts";

const BOOK_ID = fixedId(RecipeBookId, "book-one");
const OTHER_ID = fixedId(RecipeBookId, "book-two");
const BUTTER_ID = fixedId(IngredientId, "butter");

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: BUTTER_ID,
  name: "Butter",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
  labels: new Set(),
};

/** Stores a document under `name`, then closes the database so the data is on "disk". */
async function seedDatabase(name: string, populate: (doc: Y.Doc) => void): Promise<void> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(name, doc);
  await persistence.whenSynced;
  populate(doc);
  await persistence.destroy();
}

const seedBook = (id: RecipeBookId, populate: (doc: Y.Doc) => void) =>
  seedDatabase(bookDatabaseName(id), populate);

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
});

describe("loadBookDoc", () => {
  it("reads a book's stored document", async () => {
    await seedBook(BOOK_ID, (doc) => addIngredient(doc, BUTTER));
    const { doc, dispose } = await loadBookDoc(BOOK_ID);
    expect(getIngredients(doc).map((i) => i.name)).toEqual(["Butter"]);
    await dispose();
  });

  it("merges legacy data for a book that has not been opened since the single-document change", async () => {
    const [kitchenware, recipes] = legacyDatabaseNames(BOOK_ID);
    await seedDatabase(kitchenware!, (doc) => addIngredient(doc, BUTTER));
    await seedDatabase(recipes!, (doc) => createRecipe(doc, { title: "Pie", description: "v1" }));

    const { doc, dispose } = await loadBookDoc(BOOK_ID);
    expect(getIngredients(doc).map((i) => i.name)).toEqual(["Butter"]);
    expect(getRecipes(doc).map((r) => r.title)).toEqual(["Pie"]);
    await dispose();
  });

  it("does not touch another book's document", async () => {
    await seedBook(OTHER_ID, (doc) => addIngredient(doc, BUTTER));
    const { doc, dispose } = await loadBookDoc(BOOK_ID);
    expect(getIngredients(doc)).toEqual([]);
    await dispose();

    expect(
      getIngredients(await readIndexedDbDoc(bookDatabaseName(OTHER_ID))).map((i) => i.name),
    ).toEqual(["Butter"]);
  });

  it("stores what is written to the document once disposed", async () => {
    const { doc, dispose } = await loadBookDoc(BOOK_ID);
    addIngredient(doc, BUTTER);
    await dispose();

    const reloaded = await readIndexedDbDoc(bookDatabaseName(BOOK_ID));
    expect(getIngredients(reloaded).map((i) => i.name)).toEqual(["Butter"]);
  });
});

describe("writeBookName", () => {
  it("writes the name into a book that has no book_meta yet, keeping its id", async () => {
    await writeBookName(BOOK_ID, "Family Recipes");
    const meta = getBookMeta(await readIndexedDbDoc(bookDatabaseName(BOOK_ID)));
    expect(meta).toMatchObject({ id: BOOK_ID, name: "Family Recipes" });
  });

  it("renames a book that already has book_meta, without changing its id or creation time", async () => {
    await seedBook(BOOK_ID, (doc) => ensureBookMeta(doc, { id: BOOK_ID, name: "Old Name" }, 1234));
    await writeBookName(BOOK_ID, "New Name");

    const meta = getBookMeta(await readIndexedDbDoc(bookDatabaseName(BOOK_ID)));
    expect(meta).toMatchObject({ id: BOOK_ID, name: "New Name", created_at: 1234 });
  });

  it("stamps updated_at when it renames, keeping created_at", async () => {
    await seedBook(BOOK_ID, (doc) => ensureBookMeta(doc, { id: BOOK_ID, name: "Old Name" }, 1234));
    const before = Date.now();
    await writeBookName(BOOK_ID, "New Name");

    const meta = getBookMeta(await readIndexedDbDoc(bookDatabaseName(BOOK_ID)));
    expect(meta?.created_at).toBe(1234);
    expect(meta?.updated_at).toBeGreaterThanOrEqual(before);
  });

  it("leaves the rest of the book alone", async () => {
    await seedBook(BOOK_ID, (doc) => {
      addIngredient(doc, BUTTER);
      setBookName(doc, "Old Name");
    });
    await writeBookName(BOOK_ID, "New Name");
    const reloaded = await readIndexedDbDoc(bookDatabaseName(BOOK_ID));
    expect(getIngredients(reloaded).map((i) => i.name)).toEqual(["Butter"]);
  });
});

describe("deleteBookDatabases", () => {
  it("deletes the book's document and both legacy databases", async () => {
    const [kitchenware, recipes] = legacyDatabaseNames(BOOK_ID);
    await seedBook(BOOK_ID, (doc) => addIngredient(doc, BUTTER));
    await seedDatabase(kitchenware!, (doc) => addIngredient(doc, BUTTER));
    await seedDatabase(recipes!, (doc) => createRecipe(doc, { title: "Pie", description: "v1" }));

    await deleteBookDatabases(BOOK_ID);

    expect(await indexedDbExists(bookDatabaseName(BOOK_ID))).toBe(false);
    expect(await indexedDbExists(kitchenware!)).toBe(false);
    expect(await indexedDbExists(recipes!)).toBe(false);
  });

  it("leaves other books alone", async () => {
    await seedBook(BOOK_ID, (doc) => addIngredient(doc, BUTTER));
    await seedBook(OTHER_ID, (doc) => addIngredient(doc, BUTTER));

    await deleteBookDatabases(BOOK_ID);

    expect(await indexedDbExists(bookDatabaseName(OTHER_ID))).toBe(true);
  });

  it("succeeds for a book that has no stored data", async () => {
    await expect(deleteBookDatabases(BOOK_ID)).resolves.toBeUndefined();
  });
});

describe("deleteBookDatabases — a database another tab holds open", () => {
  it("rejects instead of pretending the data is gone", async () => {
    await seedBook(BOOK_ID, (doc) => addIngredient(doc, BUTTER));
    // Another tab: a connection that does not close when asked to.
    const held = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(bookDatabaseName(BOOK_ID));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    held.onversionchange = () => undefined;

    await expect(deleteBookDatabases(BOOK_ID)).rejects.toThrow("still open in another tab");
    held.close();
  });
});
