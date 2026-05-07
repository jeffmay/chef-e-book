import { describe, it, expect } from "vitest";
import {
  is_ingredient,
  is_container,
  is_equipment,
  type Item,
  type Ingredient,
  type Container,
  type Equipment,
} from "../item.js";
import type { ItemLabel } from "../item_label.js";

describe("kitchenware type guards", () => {
  const ingredient: Item = {
    kind: "ingredient",
    id: "butter" as Ingredient.Id,
    name: "Butter",
    default_measurement_type: "volume",
    labels: new Set<ItemLabel.Id>(),
  };

  const container: Item = {
    kind: "container",
    id: "bowl" as Container.Id,
    name: "Bowl",
    labels: new Set<ItemLabel.Id>(),
  };

  const equipment: Item = {
    kind: "equipment",
    id: "oven" as Equipment.Id,
    name: "Oven",
    labels: new Set<ItemLabel.Id>(),
  };

  it("is_ingredient returns true only for ingredient", () => {
    expect(is_ingredient(ingredient)).toBe(true);
    expect(is_ingredient(container)).toBe(false);
    expect(is_ingredient(equipment)).toBe(false);
  });

  it("is_container returns true only for container", () => {
    expect(is_container(ingredient)).toBe(false);
    expect(is_container(container)).toBe(true);
    expect(is_container(equipment)).toBe(false);
  });

  it("is_equipment returns true only for equipment", () => {
    expect(is_equipment(ingredient)).toBe(false);
    expect(is_equipment(container)).toBe(false);
    expect(is_equipment(equipment)).toBe(true);
  });
});
