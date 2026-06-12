import { describe, expect, it } from "vitest";
import { paddedId } from "../ids.ts";
import { ContainerId, EquipmentId, IngredientId } from "../kitchenware.ts";
import {
  type ContainerItem,
  type IngredientItem,
  type Instruction,
  isContainerItem,
  isIngredientItem,
  isInstruction,
  isSection,
  isTextBlock,
  RecipeIngredient,
  RecipeIngredientId,
  type Section,
  type SectionItem,
  SectionItemId,
  type TextBlock,
} from "../recipe.ts";

describe("recipe item type guards", () => {
  const ingredientItem: IngredientItem = {
    kind: "ingredient",
    id: paddedId(SectionItemId, "item-1"),
    ingredient_id: paddedId(IngredientId, "butter"),
    customAmount: { value: { numerator: 1, denominator: 2 }, unit: "cup" },
  };

  const containerItem: ContainerItem = {
    kind: "container",
    id: paddedId(SectionItemId, "item-2"),
    container_id: paddedId(ContainerId, "bowl"),
    descriptor: "large",
    contents: [],
  };

  const section: Section = {
    kind: "section",
    id: paddedId(SectionItemId, "item-3"),
    header: "Wet ingredients",
    contents: [],
  };

  const textBlock: TextBlock = {
    kind: "text_block",
    id: paddedId(SectionItemId, "item-4"),
    text: "Whisk until combined.",
  };

  const instruction: Instruction = {
    kind: "instruction",
    id: paddedId(SectionItemId, "item-5"),
    equipment_id: paddedId(EquipmentId, "oven"),
    instruction: "Bake at 350°F",
    duration_seconds: 1200,
  };

  const allItems: SectionItem[] = [ingredientItem, containerItem, section, textBlock, instruction];

  it("isIngredientItem identifies only ingredient items", () => {
    expect(allItems.filter(isIngredientItem)).toEqual([ingredientItem]);
  });

  it("isContainerItem identifies only container items", () => {
    expect(allItems.filter(isContainerItem)).toEqual([containerItem]);
  });

  it("is_section_label identifies only section labels", () => {
    expect(allItems.filter(isSection)).toEqual([section]);
  });

  it("is_instruction_block identifies only instruction blocks", () => {
    expect(allItems.filter(isTextBlock)).toEqual([textBlock]);
  });

  it("is_equipment_instruction identifies only equipment instructions", () => {
    expect(allItems.filter(isInstruction)).toEqual([instruction]);
  });
});

describe("IngredientItem", () => {
  const oneTbsp = { value: { numerator: 1, denominator: 1 }, unit: "tbsp" } as const;

  it("accepts an item without a custom amount", () => {
    const item: IngredientItem = {
      kind: "ingredient",
      id: paddedId(SectionItemId, "item-1"),
      ingredient_id: paddedId(IngredientId, "butter"),
    };
    expect(item.customAmount).toBeUndefined();
  });

  it("accepts an item with notes", () => {
    const item: IngredientItem = {
      kind: "ingredient",
      id: paddedId(SectionItemId, "item-1"),
      ingredient_id: paddedId(IngredientId, "butter"),
      customAmount: oneTbsp,
      notes: ["add more to taste", "better at room temp"],
    };
    expect(item.notes).toHaveLength(2);
  });
});

describe("ContainerItem", () => {
  it("requires a descriptor", () => {
    const item: ContainerItem = {
      kind: "container",
      id: paddedId(SectionItemId, "item-2"),
      container_id: paddedId(ContainerId, "bowl"),
      descriptor: "wet ingredients",
      contents: [],
    };
    expect(item.descriptor).toBe("wet ingredients");
  });

  it("accepts an ordered container", () => {
    const item: ContainerItem = {
      kind: "container",
      id: paddedId(SectionItemId, "item-2"),
      container_id: paddedId(ContainerId, "bowl"),
      descriptor: "large",
      ordered: true,
      contents: [],
    };
    expect(item.ordered).toBe(true);
  });
});

describe("Instruction", () => {
  it("accepts ingredient_ids for referenced ingredients", () => {
    const instr: Instruction = {
      kind: "instruction",
      id: paddedId(SectionItemId, "item-5"),
      instruction: "Mix together",
      ingredient_ids: [paddedId(IngredientId, "butter"), paddedId(IngredientId, "flour")],
    };
    expect(instr.ingredient_ids).toHaveLength(2);
  });

  it("accepts a duration in seconds", () => {
    const instr: Instruction = {
      kind: "instruction",
      id: paddedId(SectionItemId, "item-5"),
      instruction: "Bake",
      duration_seconds: 1800,
    };
    expect(instr.duration_seconds).toBe(1800);
  });
});

describe("RecipeIngredient", () => {
  it("accepts an ingredient without amount", () => {
    const ri: RecipeIngredient = {
      id: paddedId(RecipeIngredientId, "ri-1"),
      ingredient_id: paddedId(IngredientId, "butter"),
    };
    expect(ri.amount).toBeUndefined();
  });

  it("accepts an ingredient with an amount", () => {
    const ri: RecipeIngredient = {
      id: paddedId(RecipeIngredientId, "ri-1"),
      ingredient_id: paddedId(IngredientId, "butter"),
      amount: { value: { numerator: 1, denominator: 2 }, unit: "cup" },
    };
    expect(ri.amount?.unit).toBe("cup");
  });

  it("validates via ArkType companion", () => {
    const ri = {
      id: paddedId(RecipeIngredientId, "ri-1"),
      ingredient_id: paddedId(IngredientId, "butter"),
    };
    const result = RecipeIngredient.type(ri);
    expect(result instanceof Error).toBe(false);
  });
});
