import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { parseKitchenwareCsv } from "../../fixtures/kitchenware.ts";
import { fixedId } from "../../types/ids.ts";
import type { Ingredient } from "../../types/kitchenware.ts";
import { IngredientId } from "../../types/kitchenware.ts";
import { getBookMetaYmap, isDefaultKitchenwareSeeded } from "../bookMetaStore.ts";
import { needsDefaultKitchenware, seedDefaultKitchenware } from "../defaultKitchenware.ts";
import { addIngredient, getIngredients, getIngredientYmap } from "../ingredientStore.ts";
import { findOrCreateLabel, getLabelsYmap } from "../labelStore.ts";
import { MIGRATION_ORIGIN, SETUP_ORIGIN } from "../origins.ts";

const TEMPLATES = parseKitchenwareCsv(`Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
------cheese,ingredient,Cheese,weight,solid
`);

const SUGAR: Ingredient = {
  kind: "ingredient",
  id: fixedId(IngredientId, "sugar"),
  name: "Sugar",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
  labels: new Set(),
};

const names = (doc: Y.Doc) => getIngredients(doc).map((i) => i.name);

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("needsDefaultKitchenware", () => {
  it("is true for a book that is empty and has never been seeded", () => {
    expect(needsDefaultKitchenware(doc)).toBe(true);
  });

  it("is false once the book has ingredients", () => {
    addIngredient(doc, SUGAR);
    expect(needsDefaultKitchenware(doc)).toBe(false);
  });

  it("is false once the book has labels", () => {
    findOrCreateLabel(doc, "solid", new Set(["ingredient"]));
    expect(needsDefaultKitchenware(doc)).toBe(false);
  });

  it("is false after seeding, even when the book has since been emptied", () => {
    seedDefaultKitchenware(doc, TEMPLATES);
    getIngredientYmap(doc).clear();
    getLabelsYmap(doc).clear();
    expect(needsDefaultKitchenware(doc)).toBe(false);
  });
});

describe("seedDefaultKitchenware", () => {
  it("puts the defaults into an empty book and records that it did", () => {
    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("seeded");
    expect(names(doc)).toEqual(["Butter", "Cheese"]);
    expect(getLabelsYmap(doc).size).toBe(2);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(true);
  });

  it("does nothing the second time", () => {
    seedDefaultKitchenware(doc, TEMPLATES);
    const before = Y.encodeStateAsUpdate(doc);
    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("already_seeded");
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it("does not give the defaults back after the user deletes every ingredient", () => {
    seedDefaultKitchenware(doc, TEMPLATES);
    getIngredientYmap(doc).clear();
    getLabelsYmap(doc).clear();

    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("already_seeded");
    expect(names(doc)).toEqual([]);
  });

  it("leaves a book that already has ingredients alone, and marks it as dealt with", () => {
    addIngredient(doc, SUGAR);
    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("book_has_data");
    expect(names(doc)).toEqual(["Sugar"]);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(true);
  });

  it("leaves a book that only has labels alone", () => {
    findOrCreateLabel(doc, "solid", new Set(["ingredient"]));
    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("book_has_data");
    expect(names(doc)).toEqual([]);
  });

  it("does not seed a book that was flagged elsewhere, e.g. by a sync", () => {
    getBookMetaYmap(doc).set("seeded_defaults", true);
    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("already_seeded");
    expect(names(doc)).toEqual([]);
  });

  it("keeps a book that holds migrated legacy data", () => {
    doc.transact(() => addIngredient(doc, SUGAR), MIGRATION_ORIGIN);
    expect(seedDefaultKitchenware(doc, TEMPLATES)).toBe("book_has_data");
    expect(names(doc)).toEqual(["Sugar"]);
  });

  it("writes everything in one transaction with SETUP_ORIGIN, so it can never be undone", () => {
    const undoManager = new Y.UndoManager([
      getIngredientYmap(doc),
      getLabelsYmap(doc),
      getBookMetaYmap(doc),
    ]);
    const origins: unknown[] = [];
    doc.on("update", (_update: Uint8Array, origin: unknown) => origins.push(origin));

    seedDefaultKitchenware(doc, TEMPLATES);

    expect(origins).toEqual([SETUP_ORIGIN]);
    expect(undoManager.canUndo()).toBe(false);
    undoManager.undo();
    expect(names(doc)).toEqual(["Butter", "Cheese"]);
  });
});
