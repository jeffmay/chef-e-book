import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { assertDefined, assertNotValidationError } from "../../assertions/index.ts";
import { fixedId, randomId } from "../../types/ids.ts";
import { IngredientId } from "../../types/kitchenware.ts";
import type { Measurement } from "../../types/measurement.ts";
import { RecipeVersionId, SectionItemId, isIngredientItem } from "../../types/recipe.ts";
import { createRecipe, getRecipe, saveRecipe } from "../recipeStore.ts";

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

const TWO_CUPS: Measurement = { value: { numerator: 2, denominator: 1 }, unit: "cup" };

describe("ingredient item custom amounts", () => {
  it("round-trips customAmount on section ingredient items", () => {
    const recipe = createRecipe(doc, { title: "Pancakes", description: "v1" });
    saveRecipe(doc, recipe.id, {
      title: recipe.title,
      version: {
        id: randomId(RecipeVersionId),
        recipe_id: recipe.id,
        description: "With amounts",
        ingredients: [],
        sections: [
          {
            kind: "section",
            id: fixedId(SectionItemId, "s-main"),
            contents: [
              {
                kind: "ingredient",
                id: fixedId(SectionItemId, "i-flour"),
                ingredient_id: fixedId(IngredientId, "flour"),
                customAmount: TWO_CUPS,
              },
            ],
          },
        ],
        created_at: Date.now(),
      },
      create_new_version: false,
    });

    const loaded = getRecipe(doc, recipe.id);
    assertNotValidationError(loaded);
    const item = loaded.versions.at(-1)?.sections[0]?.contents[0];
    expect(item !== undefined && isIngredientItem(item) && item.customAmount).toEqual(TWO_CUPS);
  });
});

describe("recipe version time fields", () => {
  it("round-trips estimated_time_seconds and seconds_per_ingredient", () => {
    const recipe = createRecipe(doc, { title: "Pancakes", description: "v1" });
    saveRecipe(doc, recipe.id, {
      title: recipe.title,
      version: {
        id: randomId(RecipeVersionId),
        recipe_id: recipe.id,
        description: "Timed version",
        ingredients: [],
        sections: [],
        estimated_time_seconds: 1800,
        seconds_per_ingredient: 90,
        created_at: Date.now(),
      },
      create_new_version: true,
    });

    const loaded = getRecipe(doc, recipe.id);
    assertNotValidationError(loaded);
    const latest = loaded.versions.at(-1);
    assertDefined(latest);
    expect(latest.estimated_time_seconds).toBe(1800);
    expect(latest.seconds_per_ingredient).toBe(90);
  });

  it("leaves the fields undefined when never set", () => {
    const recipe = createRecipe(doc, { title: "Toast", description: "v1" });
    const loaded = getRecipe(doc, recipe.id);
    assertNotValidationError(loaded);
    const latest = loaded.versions.at(-1);
    assertDefined(latest);
    expect(latest.estimated_time_seconds).toBeUndefined();
    expect(latest.seconds_per_ingredient).toBeUndefined();
  });
});
