import { type } from "arktype";
import { describe, expect, it } from "vitest";
import { fixedId } from "../ids.ts";
import {
  Container,
  ContainerId,
  Equipment,
  EquipmentId,
  Ingredient,
  IngredientId,
  isContainer,
  isEquipment,
  isIngredient,
  KitchenwareKind,
  type Kitchenware,
  type KitchenwareLabelId,
} from "../kitchenware.ts";
import { is } from "../enums.ts";

describe("kitchenware type guards", () => {
  const ingredient: Kitchenware = {
    kind: "ingredient",
    id: fixedId(IngredientId, "butter"),
    name: "Butter",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set<KitchenwareLabelId>(),
  };

  const container: Kitchenware = {
    kind: "container",
    id: fixedId(ContainerId, "bowl"),
    name: "Bowl",
    labels: new Set<KitchenwareLabelId>(),
  };

  const equipment: Kitchenware = {
    kind: "equipment",
    id: fixedId(EquipmentId, "oven"),
    name: "Oven",
    labels: new Set<KitchenwareLabelId>(),
  };

  it("isIngredient returns true only for ingredient", () => {
    expect(isIngredient(ingredient)).toBe(true);
    expect(isIngredient(container)).toBe(false);
    expect(isIngredient(equipment)).toBe(false);
  });

  it("isContainer returns true only for container", () => {
    expect(isContainer(ingredient)).toBe(false);
    expect(isContainer(container)).toBe(true);
    expect(isContainer(equipment)).toBe(false);
  });

  it("isEquipment returns true only for equipment", () => {
    expect(isEquipment(ingredient)).toBe(false);
    expect(isEquipment(container)).toBe(false);
    expect(isEquipment(equipment)).toBe(true);
  });
});

describe("ItemKind schema", () => {
  it("accepts valid kinds", () => {
    expect(is(KitchenwareKind, "ingredient")).toBe(true);
    expect(is(KitchenwareKind, "container")).toBe(true);
    expect(is(KitchenwareKind, "equipment")).toBe(true);
  });

  it("rejects invalid kinds", () => {
    expect(is(KitchenwareKind, "widget")).toBe(false);
    expect(is(KitchenwareKind, "")).toBe(false);
  });
});

describe("Kitchenware constructors", () => {
  it("Ingredient accepts a valid ingredient", () => {
    const result = Ingredient.type({
      kind: "ingredient",
      id: fixedId(IngredientId, "butter"),
      name: "Butter",
      default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
      labels: [],
    });
    expect(result instanceof type.errors).toBe(false);
  });

  it("Ingredient rejects a missing required field", () => {
    const result = Ingredient.type({ kind: "ingredient", id: "butter" });
    expect(result instanceof type.errors).toBe(true);
  });

  it("Ingredient rejects an invalid measurement unit", () => {
    const result = Ingredient.type({
      kind: "ingredient",
      id: "butter",
      name: "Butter",
      default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "bad_unit" },
      labels: new Set(),
    });
    expect(result instanceof type.errors).toBe(true);
  });

  it("Container accepts a valid container", () => {
    const result = Container.type({ kind: "container", id: "bowl", name: "Bowl", labels: [] });
    expect(result).instanceOf(type.errors);
  });

  it("Equipment accepts a valid equipment", () => {
    const result = Equipment.type({
      kind: "equipment",
      id: fixedId(EquipmentId, "oven"),
      name: "Oven",
      labels: new Set(),
    });
    expect(result instanceof type.errors).toBe(false);
  });
});
