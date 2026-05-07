import { describe, it, expect } from "vitest";
import type { Ingredient, ItemLabel, ItemKind } from "@recipe-book/shared";
import { build_ingredient_tree } from "../build_ingredient_tree.js";

// Label fixtures
const FAT_LABEL: ItemLabel = {
  id: "fat0000" as ItemLabel.Id,
  name: "fat",
  kinds: new Set<ItemKind>(["ingredient"]),
};
const SOLID_LABEL: ItemLabel = {
  id: "sol0000" as ItemLabel.Id,
  name: "solid",
  kinds: new Set<ItemKind>(["ingredient"]),
};
const LIQUID_LABEL: ItemLabel = {
  id: "liq0000" as ItemLabel.Id,
  name: "liquid",
  kinds: new Set<ItemKind>(["ingredient"]),
};
const BAKING_LABEL: ItemLabel = {
  id: "bak0000" as ItemLabel.Id,
  name: "baking",
  kinds: new Set<ItemKind>(["ingredient"]),
};

const ALL_LABELS: ItemLabel[] = [FAT_LABEL, SOLID_LABEL, LIQUID_LABEL, BAKING_LABEL];

// Ingredient fixtures
const DAIRY: Ingredient = {
  kind: "ingredient",
  id: "dairy" as Ingredient.Id,
  name: "Dairy",
  default_measurement_type: "volume",
  labels: new Set<ItemLabel.Id>(),
};
const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter" as Ingredient.Id,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set([FAT_LABEL.id, SOLID_LABEL.id]),
  parent_id: "dairy" as Ingredient.Id,
};
const MILK: Ingredient = {
  kind: "ingredient",
  id: "milk" as Ingredient.Id,
  name: "Milk",
  default_measurement_type: "volume",
  labels: new Set([LIQUID_LABEL.id]),
  parent_id: "dairy" as Ingredient.Id,
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: "flour" as Ingredient.Id,
  name: "Flour",
  default_measurement_type: "volume",
  labels: new Set([BAKING_LABEL.id]),
};

describe("build_ingredient_tree", () => {
  it("returns empty array for empty input", () => {
    expect(build_ingredient_tree([], [])).toEqual([]);
  });

  it("returns a flat list when no parents are set", () => {
    const rows = build_ingredient_tree([FLOUR, BUTTER], ALL_LABELS);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.subRows.length === 0)).toBe(true);
  });

  it("nests children under their parent", () => {
    const rows = build_ingredient_tree([DAIRY, BUTTER, MILK], ALL_LABELS);
    expect(rows).toHaveLength(1);
    const dairy_row = rows[0]!;
    expect(dairy_row.id).toBe("dairy");
    expect(dairy_row.subRows).toHaveLength(2);
    expect(dairy_row.subRows.map((r) => r.id).sort()).toEqual(["butter", "milk"]);
  });

  it("populates parent_name from sibling data", () => {
    const rows = build_ingredient_tree([DAIRY, BUTTER], ALL_LABELS);
    const dairy_row = rows[0]!;
    const butter_row = dairy_row.subRows[0]!;
    expect(butter_row.parent_name).toBe("Dairy");
  });

  it("leaves parent_name empty when no parent_id", () => {
    const rows = build_ingredient_tree([FLOUR], ALL_LABELS);
    expect(rows[0]!.parent_name).toBe("");
  });

  it("treats unknown parent_id as a root-level row and uses id as parent_name fallback", () => {
    const orphan: Ingredient = {
      ...BUTTER,
      id: "salted_butter" as Ingredient.Id,
      parent_id: "nonexistent" as Ingredient.Id,
    };
    const rows = build_ingredient_tree([orphan], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.parent_name).toBe("nonexistent");
  });

  it("sorts root rows alphabetically by name", () => {
    const rows = build_ingredient_tree([FLOUR, DAIRY], ALL_LABELS);
    expect(rows.map((r) => r.name)).toEqual(["Dairy", "Flour"]);
  });

  it("sorts child rows alphabetically within each parent", () => {
    const rows = build_ingredient_tree([DAIRY, MILK, BUTTER], ALL_LABELS);
    const children = rows[0]!.subRows.map((r) => r.name);
    expect(children).toEqual(["Butter", "Milk"]);
  });

  it("resolves label IDs to names on each row", () => {
    const rows = build_ingredient_tree([BUTTER, DAIRY], ALL_LABELS);
    const dairy_row = rows.find((r) => r.id === "dairy")!;
    const butter_row = dairy_row.subRows[0]!;
    expect(butter_row.labels).toEqual(["fat", "solid"]);
  });

  it("preserves all Ingredient fields on each row", () => {
    const rows = build_ingredient_tree([BUTTER, DAIRY], ALL_LABELS);
    const dairy_row = rows.find((r) => r.id === "dairy")!;
    const butter_row = dairy_row.subRows[0]!;
    expect(butter_row.name).toBe("Butter");
    expect(butter_row.default_measurement_type).toBe("volume");
    expect(butter_row.labels).toEqual(["fat", "solid"]);
    expect(butter_row.parent_id).toBe("dairy");
    expect(butter_row.kind).toBe("ingredient");
  });
});
