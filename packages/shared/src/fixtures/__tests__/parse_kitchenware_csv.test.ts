import { describe, it, expect } from "vitest";
import { parse_kitchenware_csv } from "../parse_kitchenware_csv.js";

// IDs are left-padded to 12 characters with "-" by the parser
const SAMPLE_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
butter,ingredient,Butter,volume,baking+fat+solid
bowl,container,Bowl,count,vessel
oven,equipment,Oven,count,heat
`;

const BUTTER_ID = "------butter";
const BOWL_ID   = "--------bowl";
const OVEN_ID   = "--------oven";

describe("parse_kitchenware_csv", () => {
  it("parses ingredient rows", () => {
    const result = parse_kitchenware_csv(SAMPLE_CSV);
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
    const result = parse_kitchenware_csv(SAMPLE_CSV);
    const container = result.find((k) => k.id === BOWL_ID);
    expect(container).toBeDefined();
    if (container === undefined) return;
    expect(container.kind).toBe("container");
    if (container.kind !== "container") return;
    expect(container.name).toBe("Bowl");
    expect(container.label_names).toEqual(["vessel"]);
  });

  it("parses equipment rows", () => {
    const result = parse_kitchenware_csv(SAMPLE_CSV);
    const equipment = result.find((k) => k.id === OVEN_ID);
    expect(equipment).toBeDefined();
    if (equipment === undefined) return;
    expect(equipment.kind).toBe("equipment");
    if (equipment.kind !== "equipment") return;
    expect(equipment.name).toBe("Oven");
    expect(equipment.label_names).toEqual(["heat"]);
  });

  it("left-pads short IDs to 12 characters with '-'", () => {
    const result = parse_kitchenware_csv(SAMPLE_CSV);
    for (const item of result) {
      expect(item.id).toHaveLength(12);
      expect(item.id.endsWith("butter") || item.id.endsWith("bowl") || item.id.endsWith("oven")).toBe(true);
    }
  });

  it("passes through IDs that are already 12 characters", () => {
    const csv = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,
`;
    const result = parse_kitchenware_csv(csv);
    expect(result[0]?.id).toBe("------butter");
  });

  it("returns empty array for header-only CSV", () => {
    expect(parse_kitchenware_csv("Unique ID,Type,Description,Default Measurement Type,Labels\n")).toEqual([]);
  });

  it("throws on unknown type", () => {
    const bad = `Unique ID,Type,Description,Default Measurement Type,Labels
x,widget,X,volume,
`;
    expect(() => parse_kitchenware_csv(bad)).toThrow("Unknown kitchenware type");
  });

  it("throws on unknown measurement type", () => {
    const bad = `Unique ID,Type,Description,Default Measurement Type,Labels
x,ingredient,X,units,
`;
    expect(() => parse_kitchenware_csv(bad)).toThrow("Unknown measurement type");
  });

  it("handles empty labels", () => {
    const csv = `Unique ID,Type,Description,Default Measurement Type,Labels
water,ingredient,Water,volume,
`;
    const result = parse_kitchenware_csv(csv);
    const water = result.find((k) => k.id === "-------water");
    expect(water).toBeDefined();
    if (water === undefined) return;
    if (water.kind !== "ingredient") return;
    expect(water.label_names).toEqual([]);
  });
});
