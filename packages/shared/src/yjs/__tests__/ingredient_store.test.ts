import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  get_ingredients,
  add_ingredient,
  add_labels_to_ingredients,
  remove_labels_from_ingredients,
  set_measurement_type_for_ingredients,
  set_parent_for_ingredients,
  rename_ingredient,
  set_labels_for_ingredient,
  init_ingredients_from_defaults,
} from "../ingredient_store.js";
import type { Ingredient } from "../../types/item.js";
import type { ItemLabel } from "../../types/item_label.js";

// Test label IDs (7 chars like nanoid(7))
const FAT_ID = "fat0000" as ItemLabel.Id;
const SOLID_ID = "sol0000" as ItemLabel.Id;
const BAKING_ID = "bak0000" as ItemLabel.Id;
const POWDER_ID = "pow0000" as ItemLabel.Id;

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter" as Ingredient.Id,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set([FAT_ID, SOLID_ID]),
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: "flour" as Ingredient.Id,
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
      id: "salted_butter" as Ingredient.Id,
      parent_id: "butter" as Ingredient.Id,
    };
    add_ingredient(doc, child);
    const result = get_ingredients(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "salted_butter", parent_id: "butter" });
  });

  it("stores ingredient without parent_id cleanly", () => {
    add_ingredient(doc, BUTTER);
    const result = get_ingredients(doc);
    expect(result[0]).not.toHaveProperty("parent_id");
  });
});

describe("add_labels_to_ingredients", () => {
  const DAIRY_ID = "dai0000" as ItemLabel.Id;

  it("adds new labels and deduplicates", () => {
    add_ingredient(doc, BUTTER);
    add_labels_to_ingredients(doc, ["butter" as Ingredient.Id], [DAIRY_ID, SOLID_ID]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels.has(DAIRY_ID)).toBe(true);
    // Set deduplicates — SOLID_ID appears exactly once
    expect([...result!.labels].filter((l) => l === SOLID_ID)).toHaveLength(1);
  });

  it("silently skips unknown ids", () => {
    add_ingredient(doc, BUTTER);
    expect(() =>
      add_labels_to_ingredients(doc, ["nonexistent" as Ingredient.Id], [DAIRY_ID]),
    ).not.toThrow();
  });
});

describe("remove_labels_from_ingredients", () => {
  it("removes specified labels", () => {
    add_ingredient(doc, BUTTER);
    remove_labels_from_ingredients(doc, ["butter" as Ingredient.Id], [SOLID_ID]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels.has(SOLID_ID)).toBe(false);
    expect(result?.labels.has(FAT_ID)).toBe(true);
  });

  it("ignores labels not present on ingredient", () => {
    add_ingredient(doc, BUTTER);
    expect(() =>
      remove_labels_from_ingredients(doc, ["butter" as Ingredient.Id], [
        "nonexist" as ItemLabel.Id,
      ]),
    ).not.toThrow();
  });
});

describe("set_measurement_type_for_ingredients", () => {
  it("changes measurement type", () => {
    add_ingredient(doc, BUTTER);
    set_measurement_type_for_ingredients(doc, ["butter" as Ingredient.Id], "weight");
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.default_measurement_type).toBe("weight");
  });

  it("ignores ingredients already at that type", () => {
    add_ingredient(doc, BUTTER);
    const map = doc.getMap("ingredients");
    const before = JSON.stringify(map.get("butter"));
    set_measurement_type_for_ingredients(doc, ["butter" as Ingredient.Id], "volume");
    expect(JSON.stringify(map.get("butter"))).toBe(before);
  });
});

describe("set_parent_for_ingredients", () => {
  it("sets parent_id", () => {
    add_ingredient(doc, BUTTER);
    set_parent_for_ingredients(doc, ["butter" as Ingredient.Id], "dairy" as Ingredient.Id);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.parent_id).toBe("dairy");
  });

  it("clears parent_id when undefined passed", () => {
    const child: Ingredient = { ...BUTTER, parent_id: "dairy" as Ingredient.Id };
    add_ingredient(doc, child);
    set_parent_for_ingredients(doc, ["butter" as Ingredient.Id], undefined);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.parent_id).toBeUndefined();
  });
});

describe("rename_ingredient", () => {
  it("updates the ingredient name", () => {
    add_ingredient(doc, BUTTER);
    rename_ingredient(doc, "butter" as Ingredient.Id, "Salted Butter");
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.name).toBe("Salted Butter");
  });

  it("preserves other fields when renaming", () => {
    add_ingredient(doc, BUTTER);
    rename_ingredient(doc, "butter" as Ingredient.Id, "Salted Butter");
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(BUTTER.labels);
    expect(result?.default_measurement_type).toBe(BUTTER.default_measurement_type);
  });

  it("silently skips unknown ids", () => {
    expect(() => rename_ingredient(doc, "nonexistent" as Ingredient.Id, "New Name")).not.toThrow();
  });
});

describe("set_labels_for_ingredient", () => {
  const DAIRY_ID = "dai0000" as ItemLabel.Id;
  const PREMIUM_ID = "pre0000" as ItemLabel.Id;

  it("replaces all labels for the ingredient", () => {
    add_ingredient(doc, BUTTER);
    set_labels_for_ingredient(doc, "butter" as Ingredient.Id, [DAIRY_ID, PREMIUM_ID]);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(new Set([DAIRY_ID, PREMIUM_ID]));
  });

  it("clears labels when empty array passed", () => {
    add_ingredient(doc, BUTTER);
    set_labels_for_ingredient(doc, "butter" as Ingredient.Id, []);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.labels).toEqual(new Set());
  });

  it("silently skips unknown ids", () => {
    expect(() =>
      set_labels_for_ingredient(doc, "nonexistent" as Ingredient.Id, [DAIRY_ID]),
    ).not.toThrow();
  });
});

describe("init_ingredients_from_defaults", () => {
  it("populates the doc when empty", () => {
    init_ingredients_from_defaults(doc);
    expect(get_ingredients(doc).length).toBeGreaterThan(0);
  });

  it("does not overwrite existing ingredients", () => {
    add_ingredient(doc, BUTTER);
    const original_name = BUTTER.name;
    const modified: Ingredient = { ...BUTTER, name: "My Custom Butter" };
    add_ingredient(doc, modified);
    init_ingredients_from_defaults(doc);
    const result = get_ingredients(doc).find((i) => i.id === "butter");
    expect(result?.name).not.toBe(original_name);
  });
});
