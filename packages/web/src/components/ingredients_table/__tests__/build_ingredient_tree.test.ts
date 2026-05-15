import type { Ingredient, IngredientId, KitchenwareKind, KitchenwareLabel, KitchenwareLabelId } from "@recipe-book/shared";
import { describe, expect, it } from "vitest";
import { buildIngredientTree } from "../build_ingredient_tree.js";
import { ReadonlyDeep } from "type-fest";

// Label fixtures
const FAT_LABEL: ReadonlyDeep<KitchenwareLabel> = {
  id: "fat0000" as KitchenwareLabelId,
  name: "fat",
  kinds: new Set<KitchenwareKind>(["ingredient"]),
};
const SOLID_LABEL: ReadonlyDeep<KitchenwareLabel> = {
  id: "sol0000" as KitchenwareLabelId,
  name: "solid",
  kinds: new Set<KitchenwareKind>(["ingredient"]),
};
const LIQUID_LABEL: ReadonlyDeep<KitchenwareLabel> = {
  id: "liq0000" as KitchenwareLabelId,
  name: "liquid",
  kinds: new Set<KitchenwareKind>(["ingredient"]),
};
const BAKING_LABEL: ReadonlyDeep<KitchenwareLabel> = {
  id: "bak0000" as KitchenwareLabelId,
  name: "baking",
  kinds: new Set<KitchenwareKind>(["ingredient"]),
};

const ALL_LABELS: ReadonlyDeep<KitchenwareLabel[]> = [FAT_LABEL, SOLID_LABEL, LIQUID_LABEL, BAKING_LABEL];

// Ingredient fixtures
const DAIRY: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "dairy" as IngredientId,
  name: "Dairy",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set<KitchenwareLabelId>(),
};
const BUTTER: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "butter" as IngredientId,
  name: "Butter",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set([FAT_LABEL.id, SOLID_LABEL.id]),
  parent_id: "dairy" as IngredientId,
};
const MILK: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "milk" as IngredientId,
  name: "Milk",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set([LIQUID_LABEL.id]),
  parent_id: "dairy" as IngredientId,
};
const FLOUR: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "flour" as IngredientId,
  name: "Flour",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set([BAKING_LABEL.id]),
};

describe("buildIngredientTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildIngredientTree([], [])).toEqual([]);
  });

  it("returns a flat list when no parents are set", () => {
    const rows = buildIngredientTree([FLOUR, BUTTER], ALL_LABELS);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.subRows.length === 0)).toBe(true);
  });

  it("nests children under their parent", () => {
    const rows = buildIngredientTree([DAIRY, BUTTER, MILK], ALL_LABELS);
    expect(rows).toHaveLength(1);
    const dairy_row = rows[0]!;
    expect(dairy_row.id).toBe("dairy");
    expect(dairy_row.subRows).toHaveLength(2);
    expect(dairy_row.subRows.map((r) => r.id).sort()).toEqual(["butter", "milk"]);
  });

  it("populates parent_name from sibling data", () => {
    const rows = buildIngredientTree([DAIRY, BUTTER], ALL_LABELS);
    const dairy_row = rows[0]!;
    const butter_row = dairy_row.subRows[0]!;
    expect(butter_row.parent_name).toBe("Dairy");
  });

  it("leaves parent_name empty when no parent_id", () => {
    const rows = buildIngredientTree([FLOUR], ALL_LABELS);
    expect(rows[0]!.parent_name).toBe("");
  });

  it("treats unknown parent_id as a root-level row and uses id as parent_name fallback", () => {
    const orphan: ReadonlyDeep<Ingredient> = {
      ...BUTTER,
      id: "salted_butter" as IngredientId,
      parent_id: "nonexistent" as IngredientId,
    };
    const rows = buildIngredientTree([orphan], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.parent_name).toBe("nonexistent");
  });

  it("sorts root rows alphabetically by name", () => {
    const rows = buildIngredientTree([FLOUR, DAIRY], ALL_LABELS);
    expect(rows.map((r) => r.name)).toEqual(["Dairy", "Flour"]);
  });

  it("sorts child rows alphabetically within each parent", () => {
    const rows = buildIngredientTree([DAIRY, MILK, BUTTER], ALL_LABELS);
    const children = rows[0]!.subRows.map((r) => r.name);
    expect(children).toEqual(["Butter", "Milk"]);
  });

  it("resolves label IDs to names on each row", () => {
    const rows = buildIngredientTree([BUTTER, DAIRY], ALL_LABELS);
    const dairy_row = rows.find((r) => r.id === "dairy")!;
    const butter_row = dairy_row.subRows[0]!;
    expect(butter_row.labels).toEqual(["fat", "solid"]);
  });

  it("preserves all Ingredient fields on each row", () => {
    const rows = buildIngredientTree([BUTTER, DAIRY], ALL_LABELS);
    const dairy_row = rows.find((r) => r.id === "dairy")!;
    const butter_row = dairy_row.subRows[0]!;
    expect(butter_row.name).toBe("Butter");
    expect(butter_row.default_measurement_value).toEqual({ value: { numerator: 1, denominator: 1 }, unit: "cup" });
    expect(butter_row.labels).toEqual(["fat", "solid"]);
    expect(butter_row.parent_id).toBe("dairy");
    expect(butter_row.kind).toBe("ingredient");
  });
});
