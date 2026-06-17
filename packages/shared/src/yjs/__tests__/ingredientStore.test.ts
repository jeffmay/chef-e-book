import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { fixedId } from "../../types/ids.ts";
import type { IngredientTemplate } from "../../fixtures/kitchenware.ts";
import { IngredientId, KitchenwareLabelId, type Ingredient } from "../../types/kitchenware.ts";
import type { Measurement } from "../../types/measurement.ts";
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
} from "../ingredientStore.ts";

// Test label IDs formatted to the expected length
const FAT_ID = fixedId(KitchenwareLabelId, "fat");
const SOLID_ID = fixedId(KitchenwareLabelId, "solid");
const BAKING_ID = fixedId(KitchenwareLabelId, "baking");
const POWDER_ID = fixedId(KitchenwareLabelId, "powder");

const DEFAULT_MEASUREMENT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: fixedId(IngredientId, "butter"),
  name: "Butter",
  default_measurement_value: DEFAULT_MEASUREMENT,
  labels: new Set([FAT_ID, SOLID_ID]),
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: fixedId(IngredientId, "flour"),
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
      id: fixedId(IngredientId, "salted_butter"),
      parent_id: fixedId(IngredientId, "butter"),
    };
    addIngredient(doc, child);
    const result = getIngredients(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: fixedId(IngredientId, "salted_butter"),
      parent_id: fixedId(IngredientId, "butter"),
    });
  });

  it("stores ingredient without parent_id cleanly", () => {
    addIngredient(doc, BUTTER);
    const result = getIngredients(doc);
    expect(result[0]).not.toHaveProperty("parent_id");
  });
});

describe("addLabelsToIngredients", () => {
  const DAIRY_ID = fixedId(KitchenwareLabelId, "dairy");

  it("adds new labels and deduplicates", () => {
    addIngredient(doc, BUTTER);
    addLabelsToIngredients(doc, [fixedId(IngredientId, "butter")], [DAIRY_ID, SOLID_ID]);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.labels.has(DAIRY_ID)).toBe(true);
    // Set deduplicates — SOLID_ID appears exactly once
    expect([...result!.labels].filter((l) => l === SOLID_ID)).toHaveLength(1);
  });

  it("silently skips unknown ids", () => {
    addIngredient(doc, BUTTER);
    expect(() =>
      addLabelsToIngredients(doc, [fixedId(IngredientId, "nonexistent")], [DAIRY_ID]),
    ).not.toThrow();
  });
});

describe("removeLabelsFromIngredients", () => {
  it("removes specified labels", () => {
    addIngredient(doc, BUTTER);
    removeLabelsFromIngredients(doc, [fixedId(IngredientId, "butter")], [SOLID_ID]);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.labels.has(SOLID_ID)).toBe(false);
    expect(result?.labels.has(FAT_ID)).toBe(true);
  });

  it("ignores labels not present on ingredient", () => {
    addIngredient(doc, BUTTER);
    expect(() =>
      removeLabelsFromIngredients(
        doc,
        [fixedId(IngredientId, "butter")],
        [fixedId(KitchenwareLabelId, "nonexist")],
      ),
    ).not.toThrow();
  });
});

describe("setMeasurementValueForIngredients", () => {
  const WEIGHT_MEASUREMENT: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "oz" };

  it("changes measurement value", () => {
    addIngredient(doc, BUTTER);
    setMeasurementValueForIngredients(doc, [fixedId(IngredientId, "butter")], WEIGHT_MEASUREMENT);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.default_measurement_value).toEqual(WEIGHT_MEASUREMENT);
  });

  it("ignores ingredients already at that value", () => {
    addIngredient(doc, BUTTER);
    const map = doc.getMap("ingredients");
    const before = JSON.stringify(map.get(fixedId(IngredientId, "butter")));
    setMeasurementValueForIngredients(doc, [fixedId(IngredientId, "butter")], DEFAULT_MEASUREMENT);
    expect(JSON.stringify(map.get(fixedId(IngredientId, "butter")))).toBe(before);
  });
});

describe("setParentForIngredients", () => {
  it("sets parent_id", () => {
    const DAIRY_ID = fixedId(IngredientId, "dairy");
    addIngredient(doc, BUTTER);
    setParentForIngredients(doc, [fixedId(IngredientId, "butter")], DAIRY_ID);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.parent_id).toBe(DAIRY_ID);
  });

  it("clears parent_id when undefined passed", () => {
    const child: Ingredient = { ...BUTTER, parent_id: fixedId(IngredientId, "dairy0000000") };
    addIngredient(doc, child);
    setParentForIngredients(doc, [fixedId(IngredientId, "butter")], undefined);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.parent_id).toBeUndefined();
  });
});

describe("renameIngredient", () => {
  it("updates the ingredient name", () => {
    addIngredient(doc, BUTTER);
    renameIngredient(doc, fixedId(IngredientId, "butter"), "Salted Butter");
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.name).toBe("Salted Butter");
  });

  it("preserves other fields when renaming", () => {
    addIngredient(doc, BUTTER);
    renameIngredient(doc, fixedId(IngredientId, "butter"), "Salted Butter");
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.labels).toEqual(BUTTER.labels);
    expect(result?.default_measurement_value).toEqual(BUTTER.default_measurement_value);
  });

  it("silently skips unknown ids", () => {
    expect(() =>
      renameIngredient(doc, fixedId(IngredientId, "nonexistent"), "New Name"),
    ).not.toThrow();
  });
});

describe("setLabelsForIngredient", () => {
  const DAIRY_ID = fixedId(KitchenwareLabelId, "dairy");
  const PREMIUM_ID = fixedId(KitchenwareLabelId, "pre0000");

  it("replaces all labels for the ingredient", () => {
    addIngredient(doc, BUTTER);
    setLabelsForIngredient(doc, fixedId(IngredientId, "butter"), [DAIRY_ID, PREMIUM_ID]);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.labels).toEqual(new Set([DAIRY_ID, PREMIUM_ID]));
  });

  it("clears labels when empty array passed", () => {
    addIngredient(doc, BUTTER);
    setLabelsForIngredient(doc, fixedId(IngredientId, "butter"), []);
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.labels).toEqual(new Set());
  });

  it("silently skips unknown ids", () => {
    expect(() =>
      setLabelsForIngredient(doc, fixedId(IngredientId, "nonexistent"), [DAIRY_ID]),
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
    const result = getIngredients(doc).find((i) => i.id === fixedId(IngredientId, "butter"));
    expect(result?.name).toBe("My Custom Butter");
  });
});
