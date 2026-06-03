import { type } from "arktype";
import type * as Y from "yjs";
import { isTypeError } from "../assertions/index.ts";
import { loadId, randomId } from "../types/ids.ts";
import { ContainerId, EquipmentId, IngredientId } from "../types/kitchenware.ts";
import type { Measurement } from "../types/measurement.ts";
import {
  type ContainerItem,
  type IngredientItem,
  type Instruction,
  type Recipe,
  type RecipeIngredient,
  type RecipeVersion,
  type Section,
  type SectionItem,
  type TextBlock,
  RecipeId,
  RecipeIngredientId,
  RecipeVersionId,
  SectionItemId,
} from "../types/recipe.ts";
import { RecipeFolderId } from "../types/recipeGroup.ts";

const MAP_KEY = "recipes";

export function getRecipeYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

// ---------------------------------------------------------------------------
// Stored shape validation (uses `unknown` for nested arrays to avoid deep
// ArkType schemas; individual sub-objects are validated structurally).
// ---------------------------------------------------------------------------

const StoredRecipe = type({
  title: "string",
  "subtitle?": "string",
  "source_url?": "string",
  "parent_folder_id?": RecipeFolderId.type,
  versions: "unknown[]",
  created_at: "number",
  updated_at: "number",
});

function validateIngredientItem(raw: unknown): IngredientItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["kind"] !== "ingredient") return null;
  if (typeof r["id"] !== "string" || typeof r["ingredient_id"] !== "string") return null;
  return {
    kind: "ingredient",
    id: loadId(SectionItemId, r["id"]),
    ingredient_id: loadId(IngredientId, r["ingredient_id"]),
    ...(r["amount"] !== undefined && { amount: r["amount"] as Measurement }),
    ...(Array.isArray(r["notes"]) && { notes: r["notes"] as string[] }),
  };
}

function validateContainerItem(raw: unknown): ContainerItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["kind"] !== "container") return null;
  if (typeof r["id"] !== "string" || typeof r["container_id"] !== "string") return null;
  const contents: IngredientItem[] = [];
  if (Array.isArray(r["contents"])) {
    for (const c of r["contents"]) {
      const item = validateIngredientItem(c);
      if (item !== null) contents.push(item);
    }
  }
  return {
    kind: "container",
    id: loadId(SectionItemId, r["id"]),
    container_id: loadId(ContainerId, r["container_id"] as string),
    descriptor: typeof r["descriptor"] === "string" ? r["descriptor"] : "",
    ...(typeof r["ordered"] === "boolean" && { ordered: r["ordered"] }),
    contents,
    ...(Array.isArray(r["notes"]) && { notes: r["notes"] as string[] }),
  };
}

function validateTextBlock(raw: unknown): TextBlock | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["kind"] !== "text_block") return null;
  if (typeof r["id"] !== "string" || typeof r["text"] !== "string") return null;
  return {
    kind: "text_block",
    id: loadId(SectionItemId, r["id"]),
    text: r["text"],
    ...(Array.isArray(r["notes"]) && { notes: r["notes"] as string[] }),
  };
}

function validateInstruction(raw: unknown): Instruction | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["kind"] !== "instruction") return null;
  if (typeof r["id"] !== "string" || typeof r["instruction"] !== "string") return null;
  return {
    kind: "instruction",
    id: loadId(SectionItemId, r["id"]),
    instruction: r["instruction"],
    ...(typeof r["equipment_id"] === "string" && {
      equipment_id: loadId(EquipmentId, r["equipment_id"] as string),
    }),
    ...(Array.isArray(r["ingredient_ids"]) && {
      ingredient_ids: (r["ingredient_ids"] as string[]).map((id) => loadId(IngredientId, id)),
    }),
    ...(typeof r["duration_seconds"] === "number" && { duration_seconds: r["duration_seconds"] }),
    ...(Array.isArray(r["notes"]) && { notes: r["notes"] as string[] }),
  };
}

function validateSection(raw: unknown): Section | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["kind"] !== "section") return null;
  if (typeof r["id"] !== "string") return null;
  const contents: SectionItem[] = [];
  if (Array.isArray(r["contents"])) {
    for (const c of r["contents"]) {
      const item = validateSectionItem(c);
      if (item !== null) contents.push(item);
    }
  }
  return {
    kind: "section",
    id: loadId(SectionItemId, r["id"]),
    ...(typeof r["header"] === "string" && { header: r["header"] }),
    contents,
    ...(Array.isArray(r["notes"]) && { notes: r["notes"] as string[] }),
  };
}

function validateSectionItem(raw: unknown): SectionItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const kind = (raw as Record<string, unknown>)["kind"];
  if (kind === "ingredient") return validateIngredientItem(raw);
  if (kind === "container") return validateContainerItem(raw);
  if (kind === "text_block") return validateTextBlock(raw);
  if (kind === "instruction") return validateInstruction(raw);
  if (kind === "section") return validateSection(raw);
  return null;
}

function validateRecipeIngredient(raw: unknown): RecipeIngredient | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["id"] !== "string" || typeof r["ingredient_id"] !== "string") return null;
  return {
    id: loadId(RecipeIngredientId, r["id"]),
    ingredient_id: loadId(IngredientId, r["ingredient_id"]),
    ...(r["amount"] !== undefined && { amount: r["amount"] as Measurement }),
  };
}

function validateRecipeVersion(raw: unknown): RecipeVersion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r["id"] !== "string" ||
    typeof r["recipe_id"] !== "string" ||
    typeof r["description"] !== "string" ||
    typeof r["created_at"] !== "number"
  )
    return null;

  const ingredients: RecipeIngredient[] = [];
  if (Array.isArray(r["ingredients"])) {
    for (const i of r["ingredients"]) {
      const ri = validateRecipeIngredient(i);
      if (ri !== null) ingredients.push(ri);
    }
  }
  const sections: Section[] = [];
  if (Array.isArray(r["sections"])) {
    for (const s of r["sections"]) {
      const section = validateSection(s);
      if (section !== null) sections.push(section);
    }
  }
  return {
    id: loadId(RecipeVersionId, r["id"]),
    recipe_id: loadId(RecipeId, r["recipe_id"]),
    description: r["description"],
    ingredients,
    sections,
    created_at: r["created_at"],
    // created_by: r["created_by"],
  };
}

function validateStored(id: RecipeId, raw: unknown): Recipe | null {
  const result = StoredRecipe(raw);
  if (isTypeError(result)) return null;

  const versions: RecipeVersion[] = [];
  for (const v of result.versions) {
    const version = validateRecipeVersion(v);
    if (version !== null) versions.push(version);
  }
  return {
    id,
    title: result.title,
    versions,
    created_at: result.created_at,
    updated_at: result.updated_at,
    ...(result.subtitle !== undefined && { subtitle: result.subtitle }),
    ...(result.source_url !== undefined && { source_url: result.source_url }),
    ...(result.parent_folder_id !== undefined && { parent_folder_id: result.parent_folder_id }),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getRecipes(doc: Y.Doc): Recipe[] {
  const map = getRecipeYmap(doc);
  const results: Recipe[] = [];
  map.forEach((value, id) => {
    const recipe = validateStored(loadId(RecipeId, id), value);
    if (recipe !== null) results.push(recipe);
  });
  return results.sort((a, b) => b.updated_at - a.updated_at);
}

export function getRecipe(doc: Y.Doc, id: RecipeId): Recipe | null {
  return validateStored(id, getRecipeYmap(doc).get(id));
}

export interface CreateRecipeInput {
  title: string;
  subtitle?: string;
  source_url?: string;
  parent_folder_id?: RecipeFolderId;
  description?: string;
  // created_by: string;
}

export function createRecipe(doc: Y.Doc, input: CreateRecipeInput): Recipe {
  const now = Date.now();
  const recipe_id = randomId(RecipeId);
  const initial_version: RecipeVersion = {
    id: randomId(RecipeVersionId),
    recipe_id,
    description: input.description ?? "",
    ingredients: [],
    sections: [],
    created_at: now,
    // created_by: input.created_by,
  };
  const recipe: Recipe = {
    id: recipe_id,
    title: input.title,
    versions: [initial_version],
    created_at: now,
    updated_at: now,
    ...(input.subtitle !== undefined && { subtitle: input.subtitle }),
    ...(input.source_url !== undefined && { source_url: input.source_url }),
    ...(input.parent_folder_id !== undefined && { parent_folder_id: input.parent_folder_id }),
  };
  getRecipeYmap(doc).set(recipe_id, recipe);
  return recipe;
}

export interface SaveRecipeInput {
  title: string;
  subtitle?: string;
  source_url?: string;
  parent_folder_id?: RecipeFolderId;
  /** The current active version to save. */
  version: RecipeVersion;
  /** When true, adds the version as a new entry instead of replacing the latest. */
  create_new_version: boolean;
  // created_by: string;
}

export function saveRecipe(doc: Y.Doc, recipe_id: RecipeId, input: SaveRecipeInput): Recipe {
  const existing = getRecipe(doc, recipe_id);
  if (existing === null) throw new Error(`Recipe ${recipe_id} not found`);

  const now = Date.now();
  let versions: RecipeVersion[];
  if (input.create_new_version) {
    const new_version: RecipeVersion = {
      ...input.version,
      id: randomId(RecipeVersionId),
      recipe_id,
      created_at: now,
      // created_by: input.created_by,
    };
    versions = [...existing.versions, new_version];
  } else {
    // Replace the last version in place
    const updated_version: RecipeVersion = {
      ...input.version,
      recipe_id,
      created_at: input.version.created_at,
      // created_by: input.version.created_by,
    };
    versions =
      existing.versions.length === 0
        ? [updated_version]
        : [...existing.versions.slice(0, -1), updated_version];
  }

  const updated: Recipe = {
    id: existing.id,
    title: input.title,
    versions,
    created_at: existing.created_at,
    updated_at: now,
    ...(input.subtitle !== undefined && { subtitle: input.subtitle }),
    ...(input.source_url !== undefined && { source_url: input.source_url }),
    ...(input.parent_folder_id !== undefined && { parent_folder_id: input.parent_folder_id }),
  };
  getRecipeYmap(doc).set(recipe_id, updated);
  return updated;
}

export function copyRecipe(
  doc: Y.Doc,
  recipe_id: RecipeId,
  new_title: string,
  new_folder_id: RecipeFolderId | undefined,
  // created_by: string,
): Recipe {
  const original = getRecipe(doc, recipe_id);
  if (original === null) throw new Error(`Recipe ${recipe_id} not found`);
  const now = Date.now();
  const new_recipe_id = randomId(RecipeId);
  const copied_versions: RecipeVersion[] = original.versions.map((v) => ({
    ...v,
    id: randomId(RecipeVersionId),
    recipe_id: new_recipe_id,
    created_at: now,
    // created_by,
  }));
  const copy: Recipe = {
    id: new_recipe_id,
    title: new_title,
    versions: copied_versions,
    created_at: now,
    updated_at: now,
    ...(original.subtitle !== undefined && { subtitle: original.subtitle }),
    ...(original.source_url !== undefined && { source_url: original.source_url }),
    ...(new_folder_id !== undefined && { parent_folder_id: new_folder_id }),
  };
  getRecipeYmap(doc).set(new_recipe_id, copy);
  return copy;
}

export function deleteRecipe(doc: Y.Doc, id: RecipeId): void {
  getRecipeYmap(doc).delete(id);
}

export function deleteRecipes(doc: Y.Doc, ids: RecipeId[]): void {
  const map = getRecipeYmap(doc);
  doc.transact(() => {
    for (const id of ids) {
      map.delete(id);
    }
  });
}

export function mergeRecipes(
  doc: Y.Doc,
  recipe_ids: RecipeId[],
  new_title: string,
  new_folder_id?: RecipeFolderId,
): Recipe {
  if (recipe_ids.length < 2) {
    throw new Error(`mergeRecipes requires at least 2 recipes, received: ${recipe_ids.length}`);
  }

  const recipes = recipe_ids.map((id) => {
    const r = getRecipe(doc, id);
    if (r === null) throw new Error(`Recipe ${id} not found`);
    return r;
  });

  const now = Date.now();
  const new_recipe_id = randomId(RecipeId);

  const all_versions: RecipeVersion[] = recipes
    .flatMap((r) => r.versions)
    .sort((a, b) => a.created_at - b.created_at)
    .map((v) => ({ ...v, id: randomId(RecipeVersionId), recipe_id: new_recipe_id }));

  const merged: Recipe = {
    id: new_recipe_id,
    title: new_title,
    versions: all_versions,
    created_at: Math.min(...recipes.map((r) => r.created_at)),
    updated_at: now,
    ...(new_folder_id !== undefined && { parent_folder_id: new_folder_id }),
  };

  const map = getRecipeYmap(doc);
  doc.transact(() => {
    map.set(new_recipe_id, merged);
    for (const id of recipe_ids) {
      map.delete(id);
    }
  });

  return merged;
}
