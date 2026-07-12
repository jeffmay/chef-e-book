import { describe, expect, it } from "vitest";
import { fixedId } from "../../types/ids.ts";
import { IngredientId } from "../../types/kitchenware.ts";
import {
  type IngredientItem,
  type Instruction,
  RecipeId,
  type RecipeVersion,
  RecipeVersionId,
  type Section,
  SectionItemId,
} from "../../types/recipe.ts";
import {
  DEFAULT_SECONDS_PER_INGREDIENT,
  computeItemWeights,
  countSessionIngredients,
  minimumEstimatedSeconds,
  progressFraction,
  resolveEstimatedSeconds,
  resolveSecondsPerIngredient,
  totalInstructionSeconds,
} from "../estimation.ts";

const BUTTER = fixedId(IngredientId, "butter");
const FLOUR = fixedId(IngredientId, "flour");

const BUTTER_ID = fixedId(SectionItemId, "i-butter");
const FLOUR_ID = fixedId(SectionItemId, "i-flour");
const MIX_ID = fixedId(SectionItemId, "i-mix");
const BAKE_ID = fixedId(SectionItemId, "i-bake");

function ingredientItem(id: SectionItemId, ingredient_id: IngredientId): IngredientItem {
  return { kind: "ingredient", id, ingredient_id };
}

function instruction(id: SectionItemId, text: string, duration_seconds?: number): Instruction {
  return {
    kind: "instruction",
    id,
    instruction: text,
    ...(duration_seconds !== undefined && { duration_seconds }),
  };
}

function makeVersion(overrides: Partial<RecipeVersion> = {}): RecipeVersion {
  const sections: Section[] = [
    {
      kind: "section",
      id: fixedId(SectionItemId, "s-main"),
      contents: [
        ingredientItem(BUTTER_ID, BUTTER),
        ingredientItem(FLOUR_ID, FLOUR),
        instruction(MIX_ID, "Mix well", 600),
        instruction(BAKE_ID, "Bake"),
      ],
    },
  ];
  return {
    id: fixedId(RecipeVersionId, "v-1"),
    recipe_id: fixedId(RecipeId, "r-1"),
    description: "Test version",
    ingredients: [],
    sections,
    created_at: 1000,
    ...overrides,
  };
}

describe("countSessionIngredients", () => {
  it("counts all ingredient items", () => {
    expect(countSessionIngredients(makeVersion())).toBe(2);
  });
});

describe("totalInstructionSeconds", () => {
  it("sums instruction durations, treating missing durations as 0", () => {
    expect(totalInstructionSeconds(makeVersion())).toBe(600);
  });
});

describe("resolveSecondsPerIngredient", () => {
  it("prefers the version's own value", () => {
    expect(resolveSecondsPerIngredient(makeVersion({ seconds_per_ingredient: 60 }), 300)).toBe(60);
  });

  it("falls back to the provided default", () => {
    expect(resolveSecondsPerIngredient(makeVersion(), 300)).toBe(300);
  });

  it("exports a 2-minute shared default", () => {
    expect(DEFAULT_SECONDS_PER_INGREDIENT).toBe(120);
  });
});

describe("minimumEstimatedSeconds", () => {
  it("is instruction total + per-ingredient time × ingredient count", () => {
    expect(minimumEstimatedSeconds(makeVersion(), 120)).toBe(600 + 120 * 2);
  });
});

describe("resolveEstimatedSeconds", () => {
  it("prefers the version's stored estimate", () => {
    expect(resolveEstimatedSeconds(makeVersion({ estimated_time_seconds: 9000 }), 120)).toBe(9000);
  });

  it("falls back to the computed minimum", () => {
    expect(resolveEstimatedSeconds(makeVersion(), 120)).toBe(840);
  });
});

describe("computeItemWeights", () => {
  it("weighs each ingredient at the per-ingredient time", () => {
    const weights = computeItemWeights(makeVersion(), 840, 120);
    expect(weights.get(BUTTER_ID)).toBe(120);
    expect(weights.get(FLOUR_ID)).toBe(120);
  });

  it("weighs instructions at their own duration when the total equals the minimum", () => {
    const weights = computeItemWeights(makeVersion(), 840, 120);
    expect(weights.get(MIX_ID)).toBe(600);
    expect(weights.get(BAKE_ID)).toBe(0);
  });

  it("scales instruction weights proportionally when the total exceeds the minimum", () => {
    // instruction budget = 1140 - 240 = 900, all of it on the only timed instruction
    const weights = computeItemWeights(makeVersion(), 1140, 120);
    expect(weights.get(MIX_ID)).toBe(900);
    expect(weights.get(BAKE_ID)).toBe(0);
  });

  it("splits the instruction budget evenly when no instruction has a duration", () => {
    const version = makeVersion();
    const sections: Section[] = [
      {
        kind: "section",
        id: fixedId(SectionItemId, "s-main"),
        contents: [
          ingredientItem(BUTTER_ID, BUTTER),
          instruction(MIX_ID, "Mix well"),
          instruction(BAKE_ID, "Bake"),
        ],
      },
    ];
    const weights = computeItemWeights({ ...version, sections }, 320, 120);
    // budget = 320 - 120 = 200, split across 2 instructions
    expect(weights.get(MIX_ID)).toBe(100);
    expect(weights.get(BAKE_ID)).toBe(100);
  });

  it("clamps the instruction budget at zero when the total is below the ingredient time", () => {
    const weights = computeItemWeights(makeVersion(), 100, 120);
    expect(weights.get(MIX_ID)).toBe(0);
  });
});

describe("progressFraction", () => {
  it("is 0 for an empty weight map", () => {
    expect(progressFraction(new Map(), new Set())).toBe(0);
  });

  it("is 0 when nothing is done and 1 when everything is done", () => {
    const weights = computeItemWeights(makeVersion(), 840, 120);
    expect(progressFraction(weights, new Set())).toBe(0);
    expect(progressFraction(weights, new Set([BUTTER_ID, FLOUR_ID, MIX_ID, BAKE_ID]))).toBe(1);
  });

  it("advances by the item's weight share", () => {
    const weights = computeItemWeights(makeVersion(), 840, 120);
    expect(progressFraction(weights, new Set([BUTTER_ID]))).toBeCloseTo(120 / 840);
    expect(progressFraction(weights, new Set([MIX_ID]))).toBeCloseTo(600 / 840);
  });

  it("falls back to a plain count when every weight is zero", () => {
    const weights = new Map<SectionItemId, number>([
      [BUTTER_ID, 0],
      [MIX_ID, 0],
    ]);
    expect(progressFraction(weights, new Set([BUTTER_ID]))).toBe(0.5);
  });
});
