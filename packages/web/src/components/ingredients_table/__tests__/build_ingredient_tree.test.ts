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
  default_measurement_type: "volume",
  labels: new Set<KitchenwareLabelId>(),
};
const BUTTER: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "butter" as IngredientId,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set([FAT_LABEL.id, SOLID_LABEL.id]),
  parent_id: "dairy" as IngredientId,
};
const MILK: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "milk" as IngredientId,
  name: "Milk",
  default_measurement_type: "volume",
  labels: new Set([LIQUID_LABEL.id]),
  parent_id: "dairy" as IngredientId,
};
const FLOUR: ReadonlyDeep<Ingredient> = {
  kind: "ingredient",
  id: "flour" as IngredientId,
  name: "Flour",
  default_measurement_type: "volume",
  labels: new Set([BAKING_LABEL.id]),
};

describe("buildIngredientTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildIngredientTree([], [])).toEqual([]);
  });

  it("returns a flat list when no parents are set", () => {
    const nodes = buildIngredientTree([FLOUR, BUTTER], ALL_LABELS);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => (n.children ?? []).length === 0)).toBe(true);
  });

  it("nests children under their parent", () => {
    const nodes = buildIngredientTree([DAIRY, BUTTER, MILK], ALL_LABELS);
    expect(nodes).toHaveLength(1);
    const dairy_node = nodes[0]!;
    expect(dairy_node.data.id).toBe("dairy");
    expect(dairy_node.children).toHaveLength(2);
    expect(dairy_node.children!.map((n) => n.data.id).sort()).toEqual(["butter", "milk"]);
  });

  it("populates parent_name from sibling data", () => {
    const nodes = buildIngredientTree([DAIRY, BUTTER], ALL_LABELS);
    const dairy_node = nodes[0]!;
    const butter_node = dairy_node.children![0]!;
    expect(butter_node.data.parent_name).toBe("Dairy");
  });

  it("leaves parent_name empty when no parent_id", () => {
    const nodes = buildIngredientTree([FLOUR], ALL_LABELS);
    expect(nodes[0]!.data.parent_name).toBe("");
  });

  it("treats unknown parent_id as a root-level row and uses id as parent_name fallback", () => {
    const orphan: ReadonlyDeep<Ingredient> = {
      ...BUTTER,
      id: "salted_butter" as IngredientId,
      parent_id: "nonexistent" as IngredientId,
    };
    const nodes = buildIngredientTree([orphan], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.data.parent_name).toBe("nonexistent");
  });

  it("sorts root rows alphabetically by name", () => {
    const nodes = buildIngredientTree([FLOUR, DAIRY], ALL_LABELS);
    expect(nodes.map((n) => n.data.name)).toEqual(["Dairy", "Flour"]);
  });

  it("sorts child rows alphabetically within each parent", () => {
    const nodes = buildIngredientTree([DAIRY, MILK, BUTTER], ALL_LABELS);
    const children = nodes[0]!.children!.map((n) => n.data.name);
    expect(children).toEqual(["Butter", "Milk"]);
  });

  it("resolves label IDs to names on each row", () => {
    const nodes = buildIngredientTree([BUTTER, DAIRY], ALL_LABELS);
    const dairy_node = nodes.find((n) => n.data.id === "dairy")!;
    const butter_node = dairy_node.children![0]!;
    expect(butter_node.data.labels).toEqual(["fat", "solid"]);
  });

  it("preserves all IngredientNodeData fields on each node", () => {
    const nodes = buildIngredientTree([BUTTER, DAIRY], ALL_LABELS);
    const dairy_node = nodes.find((n) => n.data.id === "dairy")!;
    const butter_node = dairy_node.children![0]!;
    expect(butter_node.data.name).toBe("Butter");
    expect(butter_node.data.default_measurement_type).toBe("volume");
    expect(butter_node.data.labels).toEqual(["fat", "solid"]);
    expect(butter_node.data.parent_id).toBe("dairy");
  });
});
