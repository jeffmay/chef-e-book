import { useEffect, useState } from "react";
import {
  assertNotValidationError,
  type CreateRecipeInput,
  type Recipe,
  type RecipeId,
  type SaveRecipeInput,
  copyRecipe,
  createRecipe,
  deleteRecipe,
  deleteRecipes,
  getRecipe,
  getRecipeYmap,
  getRecipes,
  mergeRecipes,
  saveRecipe,
} from "@recipe-book/shared";
import type { RecipeFolderId } from "@recipe-book/shared";
import { useRecipeBookDoc } from "../contexts/docContext.ts";
import type { ReadonlyDeep } from "type-fest";

export interface RecipeStore {
  recipes: Recipe[];
  create: (input: ReadonlyDeep<Omit<CreateRecipeInput, "created_by">>) => Recipe;
  save: (recipeId: RecipeId, input: ReadonlyDeep<Omit<SaveRecipeInput, "created_by">>) => Recipe;
  copy: (recipeId: RecipeId, newTitle: string, newFolderId?: RecipeFolderId) => Recipe;
  remove: (recipeId: RecipeId) => void;
  removeAll: (recipeIds: readonly RecipeId[]) => void;
  merge: (recipeIds: readonly RecipeId[], newTitle: string, newFolderId?: RecipeFolderId) => Recipe;
}

export function useRecipeStore(): RecipeStore {
  const { doc, whenSynced } = useRecipeBookDoc();
  const [recipes, setRecipes] = useState<Recipe[]>(() => getRecipes(doc));

  useEffect(() => {
    const map = getRecipeYmap(doc);
    function update() {
      setRecipes(getRecipes(doc));
    }
    map.observe(update);
    whenSynced.then(() => setRecipes(getRecipes(doc)));
    return () => map.unobserve(update);
  }, [doc, whenSynced]);

  return {
    recipes,
    create: (input) => createRecipe(doc, { ...input /* created_by: userName */ }),
    save: (recipeId, input) => {
      saveRecipe(doc, recipeId, { ...input /* created_by: userName */ });
      const saved = getRecipe(doc, recipeId);
      assertNotValidationError(saved);
      return saved;
    },
    copy: (recipeId, newTitle, newFolderId) =>
      copyRecipe(doc, recipeId, newTitle, newFolderId /* userName */),
    remove: (recipeId) => deleteRecipe(doc, recipeId),
    removeAll: (recipeIds) => deleteRecipes(doc, recipeIds),
    merge: (recipeIds, newTitle, newFolderId) =>
      mergeRecipes(doc, recipeIds, newTitle, newFolderId),
  };
}

/** Returns the most-recent version of a recipe, or undefined if none exist. */
export function latestVersion<R extends ReadonlyDeep<Recipe>>(
  recipe: R,
): R["versions"][number] | undefined {
  return recipe.versions.at(-1);
}
