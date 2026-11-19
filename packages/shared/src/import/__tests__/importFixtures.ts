import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type RecipeBookExport,
} from "../../export/recipeBookExport.ts";
import type { ImportOptions } from "../importPlan.ts";

export const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

export function makeBundle(parts: Partial<RecipeBookExport> = {}): RecipeBookExport {
  return {
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: NOW,
    ingredients: [],
    containers: [],
    labels: [],
    recipe_folders: [],
    recipes: [],
    missing_references: [],
    ...parts,
  };
}

export function makeOptions(overrides: Partial<ImportOptions> = {}): ImportOptions {
  return {
    folder_mode: "retain",
    on_match: "merge_version",
    source_label: "Family Recipes",
    now: NOW,
    ...overrides,
  };
}
