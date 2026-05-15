import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { paddedId } from "../../types/ids.js";
import type { IngredientTemplate } from "../../fixtures/parse_kitchenware_csv.js";
import { KitchenwareLabelId, type Ingredient, type IngredientId } from "../../types/kitchenware.js";
import type { Measurement } from "../../types/measurement.js";
import {
  addIngredient,
  addLabelsToIngredients,
  getIngredients,
  initFromKitchenwareTemplates,
  removeLabelsFromIngredients,
  renameIngredient,
  setLabelsForIngredient,
  setMeasurementValueForIngredients,
  setParentForIngredients,
} from "../ingredient_store.js";

// Test label IDs formatted to the expected length
const FAT_ID = paddedId(KitchenwareLabelId, "fat");
const SOLID_ID = paddedId(KitchenwareLabelId, "sol");
const BAKING_ID = paddedId(KitchenwareLabelId, "bak");
const POWDER_ID = paddedId(KitchenwareLabelId, "pow");

const DEFAULT_MEASUREMENT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter" as IngredientId,
  name: "Butter",
  default_measurement_value: DEFAULT_MEASUREMENT,
  labels: new Set([FAT_ID, SOLID_ID]),
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: "flour" as IngredientId,
  name: "Flour",
  default_measurement_value: DEFAULT_MEASUREMENT,
  labels: new Set([BAKING_ID, POWDER_ID, SOLID_ID]),
};

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("getIngredients", () => {
  it("returns empty array for empty doc", () => {
    expect(getIngredients(doc)).toEqual([]);
  });

  it("returns sorted ingredients after add", () => {
    addIngredient(doc, FLOUR);
    addIngredient(doc, BUTTER);
    const result = getIngredients(doc);
    expect(result.map((i) => i.name)).toEqual(["Butter", "Flour"]);
  });
});

describe("addIngredient", () => {
  it("stores all fields including optional parent_id", () => {
    const child: Ingredient = {
      ...BUTTER,
      id: "salted_butter" as IngredientId,
      parent_id: "butter000000" as IngredientId,
    };
    addIngredient(doc, child);
    const result = getIngredients(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "salted_butter", parent_id: "butter000000" });
  });

  it("stores ingredient without parent_id cleanly", () => {
    addIngredient(doc, BUTTER);
    const result = getIngredients(doc);
    expect(result[0]).not.toHaveProperty("parent_id");
  });
});

describe("addLabelsToIngredients", () => {
  const DAIRY_ID = "dai0000" as KitchenwareLabelId;

  it("adds new labels and deduplicates", () => {
    addIngredient(doc, BUTTER);
    addLabelsToIngredients(doc, ["butter" as IngredientId], [DAIRY_ID, SOLID_ID]);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.labels.has(DAIRY_ID)).toBe(true);
    // Set deduplicates — SOLID_ID appears exactly once
    expect([...result!.labels].filter((l) => l === SOLID_ID)).toHaveLength(1);
  });

  it("silently skips unknown ids", () => {
    addIngredient(doc, BUTTER);
    expect(() =>
      addLabelsToIngredients(doc, ["nonexistent" as IngredientId], [DAIRY_ID]),
    ).not.toThrow();
  });
});

describe("removeLabelsFromIngredients", () => {
  it("removes specified labels", () => {
    addIngredient(doc, BUTTER);
    removeLabelsFromIngredients(doc, ["butter" as IngredientId], [SOLID_ID]);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.labels.has(SOLID_ID)).toBe(false);
    expect(result?.labels.has(FAT_ID)).toBe(true);
  });

  it("ignores labels not present on ingredient", () => {
    addIngredient(doc, BUTTER);
    expect(() =>
      removeLabelsFromIngredients(doc, ["butter" as IngredientId], [
        "nonexist" as KitchenwareLabelId,
      ]),
    ).not.toThrow();
  });
});

describe("setMeasurementValueForIngredients", () => {
  const WEIGHT_MEASUREMENT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "oz" };

  it("changes measurement value", () => {
    addIngredient(doc, BUTTER);
    setMeasurementValueForIngredients(doc, ["butter" as IngredientId], WEIGHT_MEASUREMENT);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.default_measurement_value).toEqual(WEIGHT_MEASUREMENT);
  });

  it("ignores ingredients already at that value", () => {
    addIngredient(doc, BUTTER);
    const map = doc.getMap("ingredients");
    const before = JSON.stringify(map.get("butter"));
    setMeasurementValueForIngredients(doc, ["butter" as IngredientId], DEFAULT_MEASUREMENT);
    expect(JSON.stringify(map.get("butter"))).toBe(before);
  });
});

describe("setParentForIngredients", () => {
  it("sets parent_id", () => {
    addIngredient(doc, BUTTER);
    setParentForIngredients(doc, ["butter" as IngredientId], "dairy0000000" as IngredientId);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.parent_id).toBe("dairy0000000");
  });

  it("clears parent_id when undefined passed", () => {
    const child: Ingredient = { ...BUTTER, parent_id: "dairy0000000" as IngredientId };
    addIngredient(doc, child);
    setParentForIngredients(doc, ["butter" as IngredientId], undefined);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.parent_id).toBeUndefined();
  });
});

describe("renameIngredient", () => {
  it("updates the ingredient name", () => {
    addIngredient(doc, BUTTER);
    renameIngredient(doc, "butter" as IngredientId, "Salted Butter");
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.name).toBe("Salted Butter");
  });

  it("preserves other fields when renaming", () => {
    addIngredient(doc, BUTTER);
    renameIngredient(doc, "butter" as IngredientId, "Salted Butter");
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(BUTTER.labels);
    expect(result?.default_measurement_value).toEqual(BUTTER.default_measurement_value);
  });

  it("silently skips unknown ids", () => {
    expect(() => renameIngredient(doc, "nonexistent" as IngredientId, "New Name")).not.toThrow();
  });
});

describe("setLabelsForIngredient", () => {
  const DAIRY_ID = "dai0000" as KitchenwareLabelId;
  const PREMIUM_ID = "pre0000" as KitchenwareLabelId;

  it("replaces all labels for the ingredient", () => {
    addIngredient(doc, BUTTER);
    setLabelsForIngredient(doc, "butter" as IngredientId, [DAIRY_ID, PREMIUM_ID]);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(new Set([DAIRY_ID, PREMIUM_ID]));
  });

  it("clears labels when empty array passed", () => {
    addIngredient(doc, BUTTER);
    setLabelsForIngredient(doc, "butter" as IngredientId, []);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(new Set());
  });

  it("silently skips unknown ids", () => {
    expect(() =>
      setLabelsForIngredient(doc, "nonexistent" as IngredientId, [DAIRY_ID]),
    ).not.toThrow();
  });
});

const BUTTER_TEMPLATE: IngredientTemplate = {
  kind: "ingredient",
  id: "------butter",
  name: "Butter",
  default_measurement_type: "volume",
  label_names: ["fat", "solid"],
};

describe("initFromKitchenwareTemplates", () => {
  it("populates the doc when empty", () => {
    initFromKitchenwareTemplates(doc, [BUTTER_TEMPLATE]);
    expect(getIngredients(doc).length).toBeGreaterThan(0);
  });

  it("does not overwrite existing ingredients when store is non-empty", () => {
    addIngredient(doc, BUTTER);
    const modified: Ingredient = { ...BUTTER, name: "My Custom Butter" };
    addIngredient(doc, modified);
    initFromKitchenwareTemplates(doc, [BUTTER_TEMPLATE]);
    const result = getIngredients(doc).find((i) => i.id === "butter");
    expect(result?.name).toBe("My Custom Butter");
  });
});
