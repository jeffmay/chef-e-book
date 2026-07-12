import { describe, expect, it } from "vitest";
import { fixedId } from "../ids.ts";
import { ContainerId, IngredientId } from "../kitchenware.ts";
import type { Measurement } from "../measurement.ts";
import {
  type ContainerItem,
  type IngredientItem,
  type Instruction,
  type Section,
  SectionItemId,
} from "../recipe.ts";
import {
  collectIngredientItems,
  collectInstructions,
  computeTopIngredients,
  removeSectionItemsById,
} from "../sections.ts";

const FLOUR = fixedId(IngredientId, "flour");
const BUTTER = fixedId(IngredientId, "butter");
const BOWL = fixedId(ContainerId, "bowl");

const ONE_CUP: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };
const TWO_CUPS: Measurement = { value: { numerator: 2, denominator: 1 }, unit: "cup" };

function ingredientItem(
  id: string,
  ingredient_id: IngredientId,
  amount?: Measurement,
): IngredientItem {
  return {
    kind: "ingredient",
    id: fixedId(SectionItemId, id),
    ingredient_id,
    ...(amount !== undefined && { customAmount: amount }),
  };
}

function instruction(id: string, text: string, duration_seconds?: number): Instruction {
  return {
    kind: "instruction",
    id: fixedId(SectionItemId, id),
    instruction: text,
    ...(duration_seconds !== undefined && { duration_seconds }),
  };
}

function container(id: string, contents: IngredientItem[]): ContainerItem {
  return {
    kind: "container",
    id: fixedId(SectionItemId, id),
    container_id: BOWL,
    descriptor: "large",
    contents,
  };
}

function section(id: string, contents: Section["contents"], header?: string): Section {
  return {
    kind: "section",
    id: fixedId(SectionItemId, id),
    ...(header !== undefined && { header }),
    contents,
  };
}

const BUTTER_ITEM = ingredientItem("i-butter", BUTTER, ONE_CUP);
const FLOUR_ITEM = ingredientItem("i-flour", FLOUR, TWO_CUPS);
const MIX = instruction("i-mix", "Mix well", 600);
const BAKE = instruction("i-bake", "Bake");

function makeSections(): Section[] {
  return [
    section(
      "s-main",
      [BUTTER_ITEM, container("c-bowl", [FLOUR_ITEM]), MIX, section("s-sub", [BAKE], "Finish")],
      "Main",
    ),
  ];
}

describe("collectIngredientItems", () => {
  it("collects ingredients from sections, containers, and sub-sections in order", () => {
    const items = collectIngredientItems(makeSections());
    expect(items.map((i) => i.id)).toEqual([BUTTER_ITEM.id, FLOUR_ITEM.id]);
  });

  it("returns empty for empty sections", () => {
    expect(collectIngredientItems([section("s-empty", [])])).toEqual([]);
  });
});

describe("collectInstructions", () => {
  it("collects instructions from sections and sub-sections in order", () => {
    const items = collectInstructions(makeSections());
    expect(items.map((i) => i.id)).toEqual([MIX.id, BAKE.id]);
  });
});

describe("computeTopIngredients", () => {
  it("returns one entry per distinct ingredient with its amount", () => {
    const result = computeTopIngredients(makeSections());
    expect(result).toHaveLength(2);
    expect(result[0]?.ingredient_id).toBe(BUTTER);
    expect(result[0]?.amount).toEqual(ONE_CUP);
    expect(result[1]?.ingredient_id).toBe(FLOUR);
  });

  it("de-duplicates repeated ingredients, keeping the first amount", () => {
    const sections = [
      section("s-main", [
        ingredientItem("i-b1", BUTTER, ONE_CUP),
        ingredientItem("i-b2", BUTTER, TWO_CUPS),
      ]),
    ];
    const result = computeTopIngredients(sections);
    expect(result).toHaveLength(1);
    expect(result[0]?.amount).toEqual(ONE_CUP);
  });

  it("omits the amount when the item has none", () => {
    const result = computeTopIngredients([section("s-main", [ingredientItem("i-b", BUTTER)])]);
    expect(result[0]?.amount).toBeUndefined();
  });
});

describe("removeSectionItemsById", () => {
  it("removes a top-level item from a section", () => {
    const result = removeSectionItemsById(makeSections(), new Set([BUTTER_ITEM.id]));
    expect(collectIngredientItems(result).map((i) => i.id)).toEqual([FLOUR_ITEM.id]);
  });

  it("removes an ingredient nested inside a container", () => {
    const result = removeSectionItemsById(makeSections(), new Set([FLOUR_ITEM.id]));
    expect(collectIngredientItems(result).map((i) => i.id)).toEqual([BUTTER_ITEM.id]);
    // the container itself remains
    const main = result[0];
    expect(main?.contents.some((c) => c.kind === "container")).toBe(true);
  });

  it("removes an instruction nested inside a sub-section", () => {
    const result = removeSectionItemsById(makeSections(), new Set([BAKE.id]));
    expect(collectInstructions(result).map((i) => i.id)).toEqual([MIX.id]);
  });

  it("removes a container along with its contents when the container id is removed", () => {
    const containerId = fixedId(SectionItemId, "c-bowl");
    const result = removeSectionItemsById(makeSections(), new Set([containerId]));
    expect(collectIngredientItems(result).map((i) => i.id)).toEqual([BUTTER_ITEM.id]);
  });

  it("does not mutate the input sections", () => {
    const sections = makeSections();
    removeSectionItemsById(sections, new Set([BUTTER_ITEM.id, MIX.id]));
    expect(collectIngredientItems(sections)).toHaveLength(2);
    expect(collectInstructions(sections)).toHaveLength(2);
  });
});
