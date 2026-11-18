import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { fixedId } from "../../types/ids.ts";
import { IngredientId } from "../../types/kitchenware.ts";
import { RecipeBookId } from "../../types/recipeBook.ts";
import { ensureBookMeta } from "../../yjs/bookMetaStore.ts";
import { addContainer } from "../../yjs/containerStore.ts";
import { addIngredient } from "../../yjs/ingredientStore.ts";
import { findOrCreateLabel } from "../../yjs/labelStore.ts";
import { createRecipeFolder } from "../../yjs/recipeFolderStore.ts";
import { createRecipe, saveRecipe } from "../../yjs/recipeStore.ts";
import {
  exportFileName,
  exportIngredients,
  exportRecipes,
  summarizeExport,
} from "../exportFromDoc.ts";
import { parseRecipeBookExport, serializeRecipeBookExport } from "../recipeBookExport.ts";
import { container, ingredient, ingredientItem, section, version } from "./fixtures.ts";

const NOW = 1_700_000_000_000;
const BOOK_ID = fixedId(RecipeBookId, "book-one");

const FLOUR = ingredient("flour", "Flour");
const EGG = ingredient("egg", "Egg");
const SAFFRON = ingredient("saffron", "Saffron");

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  addIngredient(doc, FLOUR);
  addIngredient(doc, EGG);
  addIngredient(doc, SAFFRON);
  addContainer(doc, container("bowl", "Bowl"));
});

/** A recipe whose first version is empty and whose latest uses Flour. */
function makeCake() {
  const folder = createRecipeFolder(doc, "Desserts");
  const cake = createRecipe(doc, { title: "Cake", description: "v1", parent_folder_id: folder.id });
  saveRecipe(doc, cake.id, {
    title: "Cake",
    parent_folder_id: folder.id,
    create_new_version: true,
    version: version("cake2", cake.id, [section("s", [ingredientItem("f", FLOUR.id)])], [FLOUR.id]),
  });
  return cake;
}

describe("exportIngredients", () => {
  it("exports every ingredient with 'all'", () => {
    const result = exportIngredients(doc, "all", NOW);
    expect(result.ingredients.map((i) => i.name)).toEqual(["Egg", "Flour", "Saffron"]);
    expect(result.exported_at).toBe(NOW);
  });

  it("exports only the selected ingredients", () => {
    expect(exportIngredients(doc, [EGG.id], NOW).ingredients.map((i) => i.name)).toEqual(["Egg"]);
  });

  it("carries the labels the ingredients have", () => {
    const labelId = findOrCreateLabel(doc, "baking", new Set(["ingredient"]));
    addIngredient(doc, { ...FLOUR, labels: new Set([labelId]) });
    expect(exportIngredients(doc, [FLOUR.id], NOW).labels.map((l) => l.name)).toEqual(["baking"]);
  });

  it("names the book it came from once the book has its metadata", () => {
    ensureBookMeta(doc, { id: BOOK_ID, name: "Family Recipes" });
    expect(exportIngredients(doc, "all", NOW).source_book).toEqual({
      id: BOOK_ID,
      name: "Family Recipes",
    });
  });

  it("leaves the source out for a book that has no metadata yet", () => {
    expect(exportIngredients(doc, "all", NOW)).not.toHaveProperty("source_book");
  });

  it("never includes the stored name keys, which are the importing book's to compute", () => {
    const text = serializeRecipeBookExport(exportIngredients(doc, "all", NOW));
    expect(text).not.toContain("name_key");
  });

  it("round-trips through text", () => {
    const result = exportIngredients(doc, "all", NOW);
    expect(parseRecipeBookExport(serializeRecipeBookExport(result))).toEqual({
      ok: true,
      value: result,
    });
  });
});

describe("exportRecipes", () => {
  it("exports the latest version only, with what it needs", () => {
    const cake = makeCake();
    const result = exportRecipes(doc, [cake.id], NOW);

    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]?.versions).toHaveLength(1);
    expect(result.recipes[0]?.versions[0]?.description).toBe("Version cake2");
    expect(result.ingredients.map((i) => i.name)).toEqual(["Flour"]);
    expect(result.recipe_folders.map((f) => f.name)).toEqual(["Desserts"]);
  });

  it("does not export the book's other recipes or ingredients", () => {
    const cake = makeCake();
    createRecipe(doc, { title: "Other", description: "v1" });
    const result = exportRecipes(doc, [cake.id], NOW);
    expect(result.recipes.map((r) => r.title)).toEqual(["Cake"]);
    expect(result.ingredients.map((i) => i.name)).not.toContain("Saffron");
  });

  it("round-trips through text", () => {
    const cake = makeCake();
    const result = exportRecipes(doc, [cake.id], NOW);
    expect(parseRecipeBookExport(serializeRecipeBookExport(result))).toEqual({
      ok: true,
      value: result,
    });
  });
});

describe("summarizeExport", () => {
  it("counts an ingredient export", () => {
    expect(summarizeExport(exportIngredients(doc, "all", NOW)).message).toBe(
      "Exported 3 ingredients.",
    );
    expect(summarizeExport(exportIngredients(doc, [EGG.id], NOW)).message).toBe(
      "Exported 1 ingredient.",
    );
  });

  it("counts a recipe export with its ingredients and containers", () => {
    const cake = makeCake();
    expect(summarizeExport(exportRecipes(doc, [cake.id], NOW))).toEqual({
      message: "Exported 1 recipe with 1 ingredient.",
      warnings: [],
    });
  });

  it("says what could not be found, once per kind", () => {
    const ghost = fixedId(IngredientId, "ghost");
    const other = fixedId(IngredientId, "ghost2");
    const summary = summarizeExport(exportIngredients(doc, [EGG.id, ghost, other], NOW));
    expect(summary.warnings).toEqual([
      "2 ingredients could not be found in this book and were left out of the file.",
    ]);
  });

  it("uses the singular for a single missing item", () => {
    const summary = summarizeExport(exportIngredients(doc, [fixedId(IngredientId, "ghost")], NOW));
    expect(summary.warnings).toEqual([
      "1 ingredient could not be found in this book and was left out of the file.",
    ]);
  });
});

describe("exportFileName", () => {
  const book = (name?: string) =>
    exportIngredients(
      (() => {
        const d = new Y.Doc();
        if (name !== undefined) ensureBookMeta(d, { id: BOOK_ID, name });
        return d;
      })(),
      "all",
      NOW,
    );
  const MARCH_5 = new Date(2026, 2, 5, 12, 0, 0);

  it("is the book name, what it holds, and the date", () => {
    expect(exportFileName(book("Family Recipes"), "recipes", MARCH_5)).toBe(
      "family-recipes-recipes-2026-03-05.json",
    );
    expect(exportFileName(book("Family Recipes"), "ingredients", MARCH_5)).toBe(
      "family-recipes-ingredients-2026-03-05.json",
    );
  });

  it("makes an awkward name filename-safe", () => {
    expect(exportFileName(book("  Grandma's   Book! / 2026 "), "recipes", MARCH_5)).toBe(
      "grandma-s-book-2026-recipes-2026-03-05.json",
    );
  });

  it("keeps letters from other scripts", () => {
    expect(exportFileName(book("Крем Брюле"), "recipes", MARCH_5)).toBe(
      "крем-брюле-recipes-2026-03-05.json",
    );
  });

  it("falls back to a generic name when the book has none", () => {
    expect(exportFileName(book(), "recipes", MARCH_5)).toBe("recipe-book-recipes-2026-03-05.json");
  });
});
