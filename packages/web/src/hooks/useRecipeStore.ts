import { useEffect, useState } from "react";
import {
  type CreateRecipeInput,
  type Recipe,
  type RecipeId,
  type RecipeVersion,
  type SaveRecipeInput,
  copyRecipe,
  createRecipe,
  deleteRecipe,
  deleteRecipes,
  getRecipeYmap,
  getRecipes,
  mergeRecipes,
  saveRecipe,
} from "@recipe-book/shared";
import type { RecipeFolderId } from "@recipe-book/shared";
import { useRecipeBookDoc } from "../contexts/docContext.ts";

export interface RecipeStore {
  readonly recipes: Recipe[];
  readonly create: (input: Omit<CreateRecipeInput, "created_by">) => Recipe;
  readonly save: (recipeId: RecipeId, input: Omit<SaveRecipeInput, "created_by">) => Recipe;
  readonly copy: (recipeId: RecipeId, newTitle: string, newFolderId?: RecipeFolderId) => Recipe;
  readonly remove: (recipeId: RecipeId) => void;
  readonly removeAll: (recipeIds: RecipeId[]) => void;
  readonly merge: (recipeIds: RecipeId[], newTitle: string, newFolderId?: RecipeFolderId) => Recipe;
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
    save: (recipeId, input) => saveRecipe(doc, recipeId, { ...input /* created_by: userName */ }),
    copy: (recipeId, newTitle, newFolderId) =>
      copyRecipe(doc, recipeId, newTitle, newFolderId /* userName */),
    remove: (recipeId) => deleteRecipe(doc, recipeId),
    removeAll: (recipeIds) => deleteRecipes(doc, recipeIds),
    merge: (recipeIds, newTitle, newFolderId) =>
      mergeRecipes(doc, recipeIds, newTitle, newFolderId),
  };
}

/** Returns the most-recent version of a recipe, or undefined if none exist. */
export function latestVersion(recipe: Recipe): RecipeVersion | undefined {
  return recipe.versions.at(-1);
}
