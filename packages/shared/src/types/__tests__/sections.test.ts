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

function ingredientItem(id: string, ingredient_id: IngredientId, amount?: Measurement) {
  return {
    kind: "ingredient",
    id: fixedId(SectionItemId, id),
    ingredient_id,
    ...(amount !== undefined && { customAmount: amount }),
  } as const satisfies IngredientItem;
}

function instruction(id: string, text: string, duration_seconds?: number) {
  return {
    kind: "instruction",
    id: fixedId(SectionItemId, id),
    instruction: text,
    ...(duration_seconds !== undefined && { duration_seconds }),
  } as const satisfies Instruction;
}

function container(id: string, contents: IngredientItem[]) {
  return {
    kind: "container",
    id: fixedId(SectionItemId, id),
    container_id: BOWL,
    descriptor: "large",
    contents,
  } as const satisfies ContainerItem;
}

function section<Id extends string>(id: Id, contents: Section["contents"], header?: string) {
  return {
    kind: "section",
    id: fixedId(SectionItemId, id),
    ...(header !== undefined && { header }),
    contents,
  } as const satisfies Section;
}

const BUTTER_ITEM = ingredientItem("i-butter", BUTTER, ONE_CUP);
const FLOUR_ITEM = ingredientItem("i-flour", FLOUR, TWO_CUPS);
const MIX = instruction("i-mix", "Mix well", 600);
const BAKE = instruction("i-bake", "Bake");

const mainSection = {
  kind: "section",
  id: fixedId(SectionItemId, "s-main"),
  header: "Main",
  contents: [
    BUTTER_ITEM,
    container("c-bowl", [FLOUR_ITEM]),
    MIX,
    section("s-sub", [BAKE], "Finish"),
  ],
} as const satisfies Section;

const exampleSections = [mainSection] as const satisfies Section[];

describe("collectIngredientItems", () => {
  it("collects ingredients from sections, containers, and sub-sections in order", () => {
    const items = collectIngredientItems(exampleSections);
    expect(items.map((i) => i.id)).toEqual([BUTTER_ITEM.id, FLOUR_ITEM.id]);
  });

  it("returns empty for empty sections", () => {
    expect(collectIngredientItems([section("s-empty", [])])).toEqual([]);
  });
});

describe("collectInstructions", () => {
  it("collects instructions from sections and sub-sections in order", () => {
    const items = collectInstructions(exampleSections);
    expect(items.map((i) => i.id)).toEqual([MIX.id, BAKE.id]);
  });
});

describe("computeTopIngredients", () => {
  it("returns one entry per distinct ingredient with its amount", () => {
    const result = computeTopIngredients(exampleSections);
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
    const result = removeSectionItemsById(exampleSections, new Set([BUTTER_ITEM.id]));
    expect(collectIngredientItems(result).map((i) => i.id)).toEqual([FLOUR_ITEM.id]);
  });

  it("removes an ingredient nested inside a container", () => {
    const result = removeSectionItemsById(exampleSections, new Set([FLOUR_ITEM.id]));
    expect(collectIngredientItems(result).map((i) => i.id)).toEqual([BUTTER_ITEM.id]);
    // the container itself remains
    const main = result[0];
    expect(main?.contents.some((c) => c.kind === "container")).toBe(true);
  });

  it("removes an instruction nested inside a sub-section", () => {
    expect(mainSection.contents[3].contents[0]?.id).toEqual(BAKE.id);
    const result = removeSectionItemsById(exampleSections, new Set([BAKE.id]));
    expect(collectInstructions(result).map((i) => i.id)).toEqual([MIX.id]);
  });

  it("removes a container along with its contents when the container id is removed", () => {
    const container = exampleSections[0].contents[1];
    const containerItemIdSet = new Set(container.contents.map((i) => i.id));
    const result = removeSectionItemsById(exampleSections, new Set([container.id]));
    const remainingIngredientIds = collectIngredientItems(result)
      .map((i) => i.id)
      .filter((id) => containerItemIdSet.has(id));
    expect(remainingIngredientIds).toHaveLength(0);
  });

  it("leaves an empty container by default when its contents are removed", () => {
    const container = exampleSections[0].contents[1];
    const itemsIds = container.contents.map((i) => i.id);
    const result = removeSectionItemsById(exampleSections, new Set(itemsIds));
    expect(result[0]?.contents[1]?.id).toEqual(container.id);
  });

  it("removes an empty container when its contents are removed", () => {
    const container = exampleSections[0].contents[1];
    const itemsIds = container.contents.map((i) => i.id);
    const result = removeSectionItemsById(exampleSections, new Set(itemsIds), true);
    const topLevelItems = result[0]?.contents ?? [];
    expect(topLevelItems).not.toHaveLength(0);
    const topLevelIds = topLevelItems.map((i) => i.id);
    expect(topLevelIds).not.toContainEqual(container.id);
  });

  it("does not mutate the input sections", () => {
    removeSectionItemsById(exampleSections, new Set([BUTTER_ITEM.id, MIX.id]));
    expect(collectIngredientItems(exampleSections)).toHaveLength(2);
    expect(collectInstructions(exampleSections)).toHaveLength(2);
  });
});
