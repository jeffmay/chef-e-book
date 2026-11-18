import {
  exportFileName,
  exportIngredients,
  exportRecipes,
  type ExportSummary,
  type IngredientId,
  type RecipeBookExport,
  type RecipeId,
  serializeRecipeBookExport,
  summarizeExport,
} from "@recipe-book/shared";
import { useState } from "react";
import { useBookDoc } from "../contexts/docContext.ts";
import { downloadTextFile } from "../utils/downloadTextFile.ts";

export interface BookExport {
  /** Exports the selected ingredients, or all of them, as a JSON download. */
  exportIngredientsFile: (selection: readonly IngredientId[] | "all") => void;
  /** Exports the selected recipes, with the ingredients they need, as a JSON download. */
  exportRecipesFile: (recipeIds: readonly RecipeId[]) => void;
  /** What the last export did, until it is dismissed. */
  summary: ExportSummary | null;
  dismissSummary: () => void;
}

/**
 * Exports from the open book: builds the export, saves it as a file named for the book, what it
 * holds, and today's date, and keeps a summary — including anything that could not be found — for
 * the page to show.
 */
export function useBookExport(): BookExport {
  const { doc } = useBookDoc();
  const [summary, setSummary] = useState<ExportSummary | null>(null);

  function save(book: RecipeBookExport, kind: "ingredients" | "recipes"): void {
    downloadTextFile(exportFileName(book, kind, new Date()), serializeRecipeBookExport(book));
    setSummary(summarizeExport(book));
  }

  return {
    exportIngredientsFile: (selection) => save(exportIngredients(doc, selection), "ingredients"),
    exportRecipesFile: (recipeIds) => save(exportRecipes(doc, recipeIds), "recipes"),
    summary,
    dismissSummary: () => setSummary(null),
  };
}
