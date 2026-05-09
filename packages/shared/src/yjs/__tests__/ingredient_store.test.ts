import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { padded_id } from "../../types/ids.js";
import type { IngredientTemplate } from "../../fixtures/parse_kitchenware_csv.js";
import { KitchenwareLabelId, type Ingredient, type IngredientId } from "../../types/kitchenware.js";
import {
  add_ingredient,
  add_labels_to_ingredients,
  get_ingredients,
  init_from_kitchenware_templates,
  remove_labels_from_ingredients,
  rename_ingredient,
  set_labels_for_ingredient,
  set_measurement_type_for_ingredients,
  set_parent_for_ingredients,
} from "../ingredient_store.js";

// Test label IDs formatted to the expected length
const FAT_ID = padded_id(KitchenwareLabelId, "fat");
const SOLID_ID = padded_id(KitchenwareLabelId, "sol");
const BAKING_ID = padded_id(KitchenwareLabelId, "bak");
const POWDER_ID = padded_id(KitchenwareLabelId, "pow");

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter" as IngredientId,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set([FAT_ID, SOLID_ID]),
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: "flour" as IngredientId,
  name: "Flour",
  default_measurement_type: "volume",
  labels: new Set([BAKING_ID, POWDER_ID, SOLID_ID]),
};

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("get_ingredients", () => {
  it("returns empty array for empty doc", () => {
    expect(get_ingredients(doc)).toEqual([]);
  });

  it("returns sorted ingredients after add", () => {
    add_ingredient(doc, FLOUR);
    add_ingredient(doc, BUTTER);
    const result = get_ingredients(doc);
    expect(result.map((i) => i.name)).toEqual(["Butter", "Flour"]);
  });
});

describe("add_ingredient", () => {
  it("stores all fields including optional parent_id", () => {
    const child: Ingredient = {
      ...BUTTER,
      id: "salted_butter" as IngredientId,
      parent_id: "butter000000" as IngredientId,
    };
    add_ingredient(doc, child);
    const result = get_ingredients(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "salted_butter", parent_id: "butter000000" });
  });

  it("stores ingredient without parent_id cleanly", () => {
    add_ingredient(doc, BUTTER);
    const result = get_ingredients(doc);
    expect(result[0]).not.toHaveProperty("parent_id");
  });
});

describe("add_labels_to_ingredients", () => {
  const DAIRY_ID = "dai0000" as KitchenwareLabelId;

  it("adds new labels and deduplicates", () => {
    add_ingredient(doc, BUTTER);
    add_labels_to_ingredients(doc, ["butter" as IngredientId], [DAIRY_ID, SOLID_ID]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels.has(DAIRY_ID)).toBe(true);
    // Set deduplicates — SOLID_ID appears exactly once
    expect([...result!.labels].filter((l) => l === SOLID_ID)).toHaveLength(1);
  });

  it("silently skips unknown ids", () => {
    add_ingredient(doc, BUTTER);
    expect(() =>
      add_labels_to_ingredients(doc, ["nonexistent" as IngredientId], [DAIRY_ID]),
    ).not.toThrow();
  });
});

describe("remove_labels_from_ingredients", () => {
  it("removes specified labels", () => {
    add_ingredient(doc, BUTTER);
    remove_labels_from_ingredients(doc, ["butter" as IngredientId], [SOLID_ID]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels.has(SOLID_ID)).toBe(false);
    expect(result?.labels.has(FAT_ID)).toBe(true);
  });

  it("ignores labels not present on ingredient", () => {
    add_ingredient(doc, BUTTER);
    expect(() =>
      remove_labels_from_ingredients(doc, ["butter" as IngredientId], [
        "nonexist" as KitchenwareLabelId,
      ]),
    ).not.toThrow();
  });
});

describe("set_measurement_type_for_ingredients", () => {
  it("changes measurement type", () => {
    add_ingredient(doc, BUTTER);
    set_measurement_type_for_ingredients(doc, ["butter" as IngredientId], "weight");
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.default_measurement_type).toBe("weight");
  });

  it("ignores ingredients already at that type", () => {
    add_ingredient(doc, BUTTER);
    const map = doc.getMap("ingredients");
    const before = JSON.stringify(map.get("butter"));
    set_measurement_type_for_ingredients(doc, ["butter" as IngredientId], "volume");
    expect(JSON.stringify(map.get("butter"))).toBe(before);
  });
});

describe("set_parent_for_ingredients", () => {
  it("sets parent_id", () => {
    add_ingredient(doc, BUTTER);
    set_parent_for_ingredients(doc, ["butter" as IngredientId], "dairy0000000" as IngredientId);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.parent_id).toBe("dairy0000000");
  });

  it("clears parent_id when undefined passed", () => {
    const child: Ingredient = { ...BUTTER, parent_id: "dairy0000000" as IngredientId };
    add_ingredient(doc, child);
    set_parent_for_ingredients(doc, ["butter" as IngredientId], undefined);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.parent_id).toBeUndefined();
  });
});

describe("rename_ingredient", () => {
  it("updates the ingredient name", () => {
    add_ingredient(doc, BUTTER);
    rename_ingredient(doc, "butter" as IngredientId, "Salted Butter");
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.name).toBe("Salted Butter");
  });

  it("preserves other fields when renaming", () => {
    add_ingredient(doc, BUTTER);
    rename_ingredient(doc, "butter" as IngredientId, "Salted Butter");
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(BUTTER.labels);
    expect(result?.default_measurement_type).toBe(BUTTER.default_measurement_type);
  });

  it("silently skips unknown ids", () => {
    expect(() => rename_ingredient(doc, "nonexistent" as IngredientId, "New Name")).not.toThrow();
  });
});

describe("set_labels_for_ingredient", () => {
  const DAIRY_ID = "dai0000" as KitchenwareLabelId;
  const PREMIUM_ID = "pre0000" as KitchenwareLabelId;

  it("replaces all labels for the ingredient", () => {
    add_ingredient(doc, BUTTER);
    set_labels_for_ingredient(doc, "butter" as IngredientId, [DAIRY_ID, PREMIUM_ID]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(new Set([DAIRY_ID, PREMIUM_ID]));
  });

  it("clears labels when empty array passed", () => {
    add_ingredient(doc, BUTTER);
    set_labels_for_ingredient(doc, "butter" as IngredientId, []);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(new Set());
  });

  it("silently skips unknown ids", () => {
    expect(() =>
      set_labels_for_ingredient(doc, "nonexistent" as IngredientId, [DAIRY_ID]),
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

describe("init_from_kitchenware_templates", () => {
  it("populates the doc when empty", () => {
    init_from_kitchenware_templates(doc, [BUTTER_TEMPLATE]);
    expect(get_ingredients(doc).length).toBeGreaterThan(0);
  });

  it("does not overwrite existing ingredients when store is non-empty", () => {
    add_ingredient(doc, BUTTER);
    const modified: Ingredient = { ...BUTTER, name: "My Custom Butter" };
    add_ingredient(doc, modified);
    init_from_kitchenware_templates(doc, [BUTTER_TEMPLATE]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.name).toBe("My Custom Butter");
  });
});
