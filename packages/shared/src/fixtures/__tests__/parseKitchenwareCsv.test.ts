import { describe, it, expect } from "vitest";
import { parseKitchenwareCsv } from "../kitchenware.ts";
import { fixedId } from "../../types/ids.ts";
import { ContainerId, EquipmentId, IngredientId } from "../../types/kitchenware.ts";

// IDs are left-padded to 12 characters with "-" by the parser
const SAMPLE_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
butter,ingredient,Butter,volume,baking+fat+solid
bowl,container,Bowl,count,vessel
oven,equipment,Oven,count,heat
`;

const BUTTER_ID = fixedId(IngredientId, "butter");
const BOWL_ID = fixedId(ContainerId, "bowl");
const OVEN_ID = fixedId(EquipmentId, "oven");

describe("parseKitchenwareCsv", () => {
  it("parses ingredient rows", () => {
    const result = parseKitchenwareCsv(SAMPLE_CSV);
    const ingredient = result.find((k) => k.id === BUTTER_ID);
    expect(ingredient).toBeDefined();
    if (ingredient === undefined) return;
    expect(ingredient.kind).toBe("ingredient");
    if (ingredient.kind !== "ingredient") return;
    expect(ingredient.name).toBe("Butter");
    expect(ingredient.default_measurement_type).toBe("volume");
    expect(ingredient.label_names).toEqual(["baking", "fat", "solid"]);
  });

  it("parses container rows", () => {
    const result = parseKitchenwareCsv(SAMPLE_CSV);
    const container = result.find((k) => k.id === BOWL_ID);
    expect(container).toBeDefined();
    if (container === undefined) return;
    expect(container.kind).toBe("container");
    if (container.kind !== "container") return;
    expect(container.name).toBe("Bowl");
    expect(container.label_names).toEqual(["vessel"]);
  });

  it("parses equipment rows", () => {
    const result = parseKitchenwareCsv(SAMPLE_CSV);
    const equipment = result.find((k) => k.id === OVEN_ID);
    expect(equipment).toBeDefined();
    if (equipment === undefined) return;
    expect(equipment.kind).toBe("equipment");
    if (equipment.kind !== "equipment") return;
    expect(equipment.name).toBe("Oven");
    expect(equipment.label_names).toEqual(["heat"]);
  });

  it("left-pads short IDs to 12 characters with '-'", () => {
    const result = parseKitchenwareCsv(SAMPLE_CSV);
    for (const item of result) {
      expect(item.id).toHaveLength(12);
      expect(
        item.id.endsWith("butter") || item.id.endsWith("bowl") || item.id.endsWith("oven"),
      ).toBe(true);
    }
  });

  it("passes through IDs that are already 12 characters", () => {
    const csv = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,
`;
    const result = parseKitchenwareCsv(csv);
    expect(result[0]?.id).toBe("------butter");
  });

  it("returns empty array for header-only CSV", () => {
    expect(
      parseKitchenwareCsv("Unique ID,Type,Description,Default Measurement Type,Labels\n"),
    ).toEqual([]);
  });

  it("throws on unknown type", () => {
    const bad = `Unique ID,Type,Description,Default Measurement Type,Labels
x,widget,X,volume,
`;
    expect(() => parseKitchenwareCsv(bad)).toThrow("Unknown kitchenware type");
  });

  it("throws on unknown measurement type", () => {
    const bad = `Unique ID,Type,Description,Default Measurement Type,Labels
x,ingredient,X,units,
`;
    expect(() => parseKitchenwareCsv(bad)).toThrow("Unknown measurement type");
  });

  it("handles empty labels", () => {
    const csv = `Unique ID,Type,Description,Default Measurement Type,Labels
water,ingredient,Water,volume,
`;
    const result = parseKitchenwareCsv(csv);
    const water = result.find((k) => k.id === fixedId(IngredientId, "water"));
    expect(water).toBeDefined();
    if (water === undefined) return;
    if (water.kind !== "ingredient") return;
    expect(water.label_names).toEqual([]);
  });
});
