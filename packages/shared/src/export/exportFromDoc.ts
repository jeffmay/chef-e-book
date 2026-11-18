import type * as Y from "yjs";
import type { IngredientId } from "../types/kitchenware.ts";
import type { RecipeId } from "../types/recipe.ts";
import { getBookMeta } from "../yjs/bookMetaStore.ts";
import { getContainers } from "../yjs/containerStore.ts";
import { getIngredients } from "../yjs/ingredientStore.ts";
import { getLabels } from "../yjs/labelStore.ts";
import { getRecipeFoldersFlat } from "../yjs/recipeFolderStore.ts";
import { getRecipes } from "../yjs/recipeStore.ts";
import {
  buildIngredientExport,
  buildRecipeExport,
  type ExportInfo,
  type ExportSource,
} from "./buildExport.ts";
import type { RecipeBookExport } from "./recipeBookExport.ts";

/** Reads what an export can draw from out of a book's document. Invalid entries are skipped (and logged) by the stores. */
export function readExportSource(doc: Y.Doc): ExportSource {
  return {
    ingredients: getIngredients(doc),
    containers: getContainers(doc),
    labels: getLabels(doc),
    recipe_folders: getRecipeFoldersFlat(doc),
    recipes: getRecipes(doc),
  };
}

function exportInfo(doc: Y.Doc, now: number): ExportInfo {
  const meta = getBookMeta(doc);
  return {
    exported_at: now,
    ...(meta !== undefined && { source_book: { id: meta.id, name: meta.name } }),
  };
}

/**
 * Exports the selected ingredients (or every ingredient with `"all"`), each with its ancestors and
 * its labels. See `buildIngredientExport`.
 */
export function exportIngredients(
  doc: Y.Doc,
  selection: readonly IngredientId[] | "all",
  now: number = Date.now(),
): RecipeBookExport {
  const source = readExportSource(doc);
  const ids = selection === "all" ? source.ingredients.map((i) => i.id) : selection;
  return buildIngredientExport(source, ids, exportInfo(doc, now));
}

/**
 * Exports the selected recipes — latest version only — with exactly the ingredients and containers
 * they need. See `buildRecipeExport`.
 */
export function exportRecipes(
  doc: Y.Doc,
  recipeIds: readonly RecipeId[],
  now: number = Date.now(),
): RecipeBookExport {
  return buildRecipeExport(readExportSource(doc), recipeIds, exportInfo(doc, now));
}

function count(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export type ExportSummary = {
  /** What was exported, in a sentence. */
  message: string;
  /** What the file lacks, one sentence per kind of thing, empty when nothing is missing. */
  warnings: string[];
};

/** A short account of an export for the person who made it: what is in it, and what could not be. */
export function summarizeExport(book: RecipeBookExport): ExportSummary {
  const parts = [count(book.ingredients.length, "ingredient")];
  if (book.containers.length > 0) parts.push(count(book.containers.length, "container"));
  const message =
    book.recipes.length > 0
      ? `Exported ${count(book.recipes.length, "recipe")} with ${parts.join(" and ")}.`
      : `Exported ${parts.join(" and ")}.`;

  const warnings: string[] = [];
  for (const kind of ["recipe", "ingredient", "container", "label", "folder"] as const) {
    const n = new Set(book.missing_references.filter((m) => m.kind === kind).map((m) => m.id)).size;
    if (n > 0) {
      warnings.push(
        `${count(n, kind)} could not be found in this book and ${n === 1 ? "was" : "were"} left out of the file.`,
      );
    }
  }
  return { message, warnings };
}

/** `<book-name>-<kind>-<yyyy-mm-dd>.json`, with the name lowercased and made filename-safe. */
export function exportFileName(
  book: RecipeBookExport,
  kind: "ingredients" | "recipes",
  date: Date,
): string {
  const slug =
    (book.source_book?.name ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "recipe-book";
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${slug}-${kind}-${day}.json`;
}
