import { type } from "arktype";
import { Companion } from "../types/companion.ts";
import { Container, Ingredient, KitchenwareLabel } from "../types/kitchenware.ts";
import { Recipe } from "../types/recipe.ts";
import { RecipeBookId } from "../types/recipeBook.ts";
import { RecipeFolder } from "../types/recipeFolder.ts";

/** Identifies a file as a recipe book export, whatever its name. */
export const EXPORT_FORMAT = "chefe_book_export" as const;

/**
 * The version of the layout below. A file with a *newer* version is refused on import with a clear
 * message rather than half-understood; bump this only for a change an older reader cannot handle.
 */
export const EXPORT_FORMAT_VERSION = 1;

/** A reference the export could not satisfy, kept so the file (and the user) can say so. */
export const MissingReference = Companion(
  "MissingReference",
  type({
    kind: "'ingredient' | 'container' | 'label' | 'folder' | 'recipe'",
    id: "string",
    referenced_by: {
      kind: "'selection' | 'recipe' | 'ingredient' | 'container' | 'folder'",
      id: "string",
    },
  }),
);
export type MissingReference = typeof MissingReference.type.infer;

/**
 * A portable slice of a recipe book: some ingredients, or some recipes and exactly the ingredients
 * and containers they need, with the labels and folders that go with them.
 *
 * Reuses the schemas the book stores its own data under, so what an import validates is the same
 * shape that is stored. `name_key` is **not** in it: it is derived data, and the importing book
 * computes its own under its own rules. Recipes carry only their latest version; history is not part
 * of an export. Equipment is not exported either — instructions refer to it by id, to a list the app
 * ships — so equipment ids travel inside the recipes.
 *
 * Sets (a label list on an ingredient) are plain arrays in the file: `serializeRecipeBookExport`
 * writes them, and parsing turns them back into Sets.
 */
export const RecipeBookExport = Companion(
  "RecipeBookExport",
  type({
    format: `'${EXPORT_FORMAT}'`,
    format_version: "number.integer >= 1",
    exported_at: "number.epoch",
    "source_book?": {
      id: RecipeBookId.type,
      name: "string",
    },
    ingredients: Ingredient.type.array(),
    containers: Container.type.array(),
    labels: KitchenwareLabel.type.array(),
    recipe_folders: RecipeFolder.type.array(),
    recipes: Recipe.type.array(),
    missing_references: MissingReference.type.array(),
  }),
);
export type RecipeBookExport = typeof RecipeBookExport.type.infer;

/** The file's text: JSON, with every Set written as an array. */
export function serializeRecipeBookExport(book: RecipeBookExport): string {
  return JSON.stringify(
    book,
    (_key, value: unknown) => (value instanceof Set ? [...value] : value),
    2,
  );
}

export type ParseExportResult =
  | { readonly ok: true; readonly value: RecipeBookExport }
  | { readonly ok: false; readonly error: string };

const ExportHeader = type({ format: "string", format_version: "number" });

/**
 * Reads an export file's text. Never throws: every way it can be wrong — not JSON, not one of ours,
 * from a newer version, or not matching the schema — comes back as a message the user can read.
 */
export function parseRecipeBookExport(text: string): ParseExportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  const header = ExportHeader(json);
  if (header instanceof type.errors || header.format !== EXPORT_FORMAT) {
    return { ok: false, error: "This file is not a recipe book export." };
  }
  if (header.format_version > EXPORT_FORMAT_VERSION) {
    return {
      ok: false,
      error: `This file was exported by a newer version of the app (format ${header.format_version}); this version reads format ${EXPORT_FORMAT_VERSION}. Update the app to import it.`,
    };
  }
  const parsed = RecipeBookExport.type(json);
  if (parsed instanceof type.errors) {
    return { ok: false, error: `This export file is damaged: ${parsed.summary}` };
  }
  return { ok: true, value: parsed };
}
