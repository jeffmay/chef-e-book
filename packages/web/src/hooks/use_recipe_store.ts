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
  getRecipeYmap,
  getRecipes,
  saveRecipe,
} from "@recipe-book/shared";
import type { RecipeFolderId } from "@recipe-book/shared";
import { useDoc } from "../contexts/doc_context.js";

export interface RecipeStore {
  readonly recipes: Recipe[];
  readonly create: (input: Omit<CreateRecipeInput, "created_by">) => Recipe;
  readonly save: (recipeId: RecipeId, input: Omit<SaveRecipeInput, "created_by">) => Recipe;
  readonly copy: (recipeId: RecipeId, new_title: string, newFolderId?: RecipeFolderId) => Recipe;
  readonly remove: (recipeId: RecipeId) => void;
}

export function useRecipeStore(userName: string): RecipeStore {
  const doc = useDoc();
  const [recipes, setRecipes] = useState<Recipe[]>(() => getRecipes(doc));

  useEffect(() => {
    const map = getRecipeYmap(doc);
    function update() {
      setRecipes(getRecipes(doc));
    }
    map.observe(update);
    return () => map.unobserve(update);
  }, [doc]);

  return {
    recipes,
    create: (input) => createRecipe(doc, { ...input, created_by: userName }),
    save: (recipeId, input) => saveRecipe(doc, recipeId, { ...input, created_by: userName }),
    copy: (recipeId, new_title, newFolderId) =>
      copyRecipe(doc, recipeId, new_title, newFolderId, userName),
    remove: (recipeId) => deleteRecipe(doc, recipeId),
  };
}

/** Returns the most-recent version of a recipe, or undefined if none exist. */
export function latestVersion(recipe: Recipe): RecipeVersion | undefined {
  return recipe.versions.at(-1);
}
