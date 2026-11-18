import {
  addIngredient,
  createRecipe,
  fixedId,
  getIngredients,
  getIngredientYmap,
  getRecipes,
  IngredientId,
  MIGRATION_ORIGIN,
  type Ingredient,
  type KitchenwareLabelId,
} from "@recipe-book/shared";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bookDatabaseName,
  indexedDbExists,
  legacyDatabaseNames,
  mergeLegacyBookData,
  readIndexedDbDoc,
  type LegacyDatabaseAccess,
} from "../legacyBookMigration.ts";

const BOOK_ID = "book-one";
const [KITCHENWARE_DB, RECIPES_DB] = legacyDatabaseNames(BOOK_ID);
if (KITCHENWARE_DB === undefined || RECIPES_DB === undefined) {
  throw new Error("expected two legacy database names");
}

const BUTTER_ID = fixedId(IngredientId, "butter");
const FLOUR_ID = fixedId(IngredientId, "flour");
const SUGAR_ID = fixedId(IngredientId, "sugar");

function makeIngredient(id: IngredientId, name: string): Ingredient {
  return {
    kind: "ingredient",
    id,
    name,
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set<KitchenwareLabelId>(),
  };
}

/** Stores a document under `name` the way an earlier build did, then closes the database. */
async function seedDatabase(name: string, populate: (doc: Y.Doc) => void): Promise<void> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(name, doc);
  await persistence.whenSynced;
  populate(doc);
  // Closing waits for the pending update transactions, so the data is stored when this resolves.
  await persistence.destroy();
}

async function seedLegacyBook(): Promise<void> {
  await seedDatabase(KITCHENWARE_DB!, (doc) => {
    addIngredient(doc, makeIngredient(BUTTER_ID, "Butter"));
    addIngredient(doc, makeIngredient(FLOUR_ID, "Flour"));
  });
  await seedDatabase(RECIPES_DB!, (doc) => {
    createRecipe(doc, { title: "Pancakes", description: "v1" });
  });
}

const ingredientNames = (doc: Y.Doc) => getIngredients(doc).map((i) => i.name);
const recipeTitles = (doc: Y.Doc) => getRecipes(doc).map((r) => r.title);

beforeEach(() => {
  // A fresh in-memory factory per test so databases never leak between tests. y-indexeddb also
  // reads the global IDBKeyRange, which jsdom does not provide.
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
});

describe("indexedDbExists", () => {
  it("is false for a database that was never created", async () => {
    expect(await indexedDbExists("nope")).toBe(false);
  });

  it("does not create the database it probed", async () => {
    await indexedDbExists("nope");
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain("nope");
  });

  it("is true for a database that exists, and leaves its data alone", async () => {
    await seedDatabase("present", (doc) => addIngredient(doc, makeIngredient(BUTTER_ID, "Butter")));
    expect(await indexedDbExists("present")).toBe(true);
    expect(ingredientNames(await readIndexedDbDoc("present"))).toEqual(["Butter"]);
  });
});

describe("mergeLegacyBookData", () => {
  it("merges the kitchenware and recipes databases into the book document", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();

    const merged = await mergeLegacyBookData(bookDoc, BOOK_ID);

    expect(merged).toEqual([KITCHENWARE_DB, RECIPES_DB]);
    expect(ingredientNames(bookDoc)).toEqual(["Butter", "Flour"]);
    expect(recipeTitles(bookDoc)).toEqual(["Pancakes"]);
  });

  it("does nothing when the book has no legacy databases", async () => {
    const bookDoc = new Y.Doc();
    expect(await mergeLegacyBookData(bookDoc, BOOK_ID)).toEqual([]);
    expect(getIngredientYmap(bookDoc).size).toBe(0);
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual([]);
  });

  it("merges whichever single legacy database exists", async () => {
    await seedDatabase(RECIPES_DB!, (doc) =>
      createRecipe(doc, { title: "Soup", description: "v1" }),
    );
    const bookDoc = new Y.Doc();

    expect(await mergeLegacyBookData(bookDoc, BOOK_ID)).toEqual([RECIPES_DB]);
    expect(recipeTitles(bookDoc)).toEqual(["Soup"]);
    expect(getIngredientYmap(bookDoc).size).toBe(0);
  });

  it("keeps entries the book document already holds", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();
    addIngredient(bookDoc, makeIngredient(SUGAR_ID, "Sugar"));

    await mergeLegacyBookData(bookDoc, BOOK_ID);

    expect(ingredientNames(bookDoc)).toEqual(["Butter", "Flour", "Sugar"]);
  });

  it("leaves the legacy databases in place", async () => {
    await seedLegacyBook();
    await mergeLegacyBookData(new Y.Doc(), BOOK_ID);

    expect(await indexedDbExists(KITCHENWARE_DB!)).toBe(true);
    expect(await indexedDbExists(RECIPES_DB!)).toBe(true);
    expect(ingredientNames(await readIndexedDbDoc(KITCHENWARE_DB!))).toEqual(["Butter", "Flour"]);
  });

  it("is idempotent: a second run changes nothing", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();
    await mergeLegacyBookData(bookDoc, BOOK_ID);
    const before = Y.encodeStateAsUpdate(bookDoc);

    await mergeLegacyBookData(bookDoc, BOOK_ID);

    expect(Y.encodeStateAsUpdate(bookDoc)).toEqual(before);
  });

  it("does not bring back an entry deleted after the first run", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();
    await mergeLegacyBookData(bookDoc, BOOK_ID);
    getIngredientYmap(bookDoc).delete(BUTTER_ID);

    await mergeLegacyBookData(bookDoc, BOOK_ID);

    expect(ingredientNames(bookDoc)).toEqual(["Flour"]);
  });

  it("applies the data with MIGRATION_ORIGIN so it can never be undone", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();
    const origins: unknown[] = [];
    bookDoc.on("update", (_update: Uint8Array, origin: unknown) => origins.push(origin));

    await mergeLegacyBookData(bookDoc, BOOK_ID);

    expect(origins.length).toBeGreaterThan(0);
    expect(new Set(origins)).toEqual(new Set([MIGRATION_ORIGIN]));
  });

  it("is persisted to the book database so it survives a reload", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(bookDatabaseName(BOOK_ID), bookDoc);
    await persistence.whenSynced;
    await mergeLegacyBookData(bookDoc, BOOK_ID);
    await persistence.destroy();

    const reloaded = await readIndexedDbDoc(bookDatabaseName(BOOK_ID));
    expect(ingredientNames(reloaded)).toEqual(["Butter", "Flour"]);
    expect(recipeTitles(reloaded)).toEqual(["Pancakes"]);
  });

  it("stops without touching the document once cancelled", async () => {
    await seedLegacyBook();
    const bookDoc = new Y.Doc();

    const merged = await mergeLegacyBookData(bookDoc, BOOK_ID, { isCancelled: () => true });

    expect(merged).toEqual([]);
    expect(getIngredientYmap(bookDoc).size).toBe(0);
  });

  it("propagates a failure reading a legacy database", async () => {
    const access: LegacyDatabaseAccess = {
      exists: () => Promise.resolve(true),
      read: () => Promise.reject(new Error("blocked")),
    };
    await expect(mergeLegacyBookData(new Y.Doc(), BOOK_ID, { access })).rejects.toThrow("blocked");
  });
});
