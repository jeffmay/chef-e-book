import { fixedId } from "../../types/ids.ts";
import {
  type Container,
  ContainerId,
  type Ingredient,
  IngredientId,
  type KitchenwareLabel,
  KitchenwareLabelId,
} from "../../types/kitchenware.ts";
import {
  type IngredientItem,
  type Instruction,
  type Recipe,
  RecipeId,
  RecipeIngredientId,
  type RecipeVersion,
  RecipeVersionId,
  type Section,
  type SectionItem,
  SectionItemId,
} from "../../types/recipe.ts";
import { RecipeFolderId, type RecipeFolder } from "../../types/recipeFolder.ts";
import type { ExportSource } from "../buildExport.ts";

export const CUP = { value: { numerator: 1, denominator: 1 }, unit: "cup" } as const;

export const DAIRY_ID = fixedId(KitchenwareLabelId, "dairy");
export const BAKING_ID = fixedId(KitchenwareLabelId, "baking");

export function label(id: KitchenwareLabelId, name: string): KitchenwareLabel {
  return { id, name, kinds: new Set(["ingredient" as const]) };
}

export function ingredient(
  key: string,
  name: string,
  extra: Partial<Pick<Ingredient, "parent_id" | "labels">> = {},
): Ingredient {
  return {
    kind: "ingredient",
    id: fixedId(IngredientId, key),
    name,
    default_measurement_value: CUP,
    labels: new Set(),
    ...extra,
  };
}

export function container(key: string, name: string, labels: KitchenwareLabelId[] = []): Container {
  return { kind: "container", id: fixedId(ContainerId, key), name, labels: new Set(labels) };
}

export const itemId = (key: string) => fixedId(SectionItemId, key);

export function ingredientItem(key: string, ingredientId: IngredientId): IngredientItem {
  return { kind: "ingredient", id: itemId(key), ingredient_id: ingredientId };
}

export function instruction(key: string, ingredientIds: IngredientId[]): Instruction {
  return {
    kind: "instruction",
    id: itemId(key),
    instruction: "mix",
    ingredient_ids: ingredientIds,
  };
}

export function section(key: string, contents: SectionItem[]): Section {
  return { kind: "section", id: itemId(key), contents };
}

export function version(
  key: string,
  recipeId: RecipeId,
  sections: Section[],
  topIngredients: IngredientId[] = [],
  createdAt = 1000,
): RecipeVersion {
  return {
    id: fixedId(RecipeVersionId, key),
    recipe_id: recipeId,
    description: `Version ${key}`,
    ingredients: topIngredients.map((id, i) => ({
      id: fixedId(RecipeIngredientId, `${key}-${i}`),
      ingredient_id: id,
    })),
    sections,
    created_at: createdAt,
  };
}

export function recipe(
  key: string,
  title: string,
  versions: RecipeVersion[],
  extra: Partial<Pick<Recipe, "parent_folder_id" | "source_url">> = {},
): Recipe {
  return {
    id: fixedId(RecipeId, key),
    title,
    versions,
    created_at: 1000,
    updated_at: 2000,
    ...extra,
  };
}

export function folder(
  key: string,
  name: string,
  extra: Partial<Pick<RecipeFolder, "parent_folder_id" | "manual_order">> = {},
): Omit<RecipeFolder, "children"> {
  return {
    id: fixedId(RecipeFolderId, key),
    name,
    tags: [],
    sort_order: "alphabetical",
    ...extra,
  };
}

export function emptySource(): ExportSource {
  return { ingredients: [], containers: [], labels: [], recipe_folders: [], recipes: [] };
}
