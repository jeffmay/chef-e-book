import type * as Y from "yjs";
import { readExportSource } from "../export/exportFromDoc.ts";
import type { RecipeBookExport } from "../export/recipeBookExport.ts";
import { parseRecipeBookExport } from "../export/recipeBookExport.ts";
import type { ReadonlyDeep } from "type-fest";
import { addContainer } from "../yjs/containerStore.ts";
import { addIngredient } from "../yjs/ingredientStore.ts";
import { putLabel, setLabelKinds } from "../yjs/labelStore.ts";
import { putRecipeFolder } from "../yjs/recipeFolderStore.ts";
import { addRecipe, appendRecipeVersion } from "../yjs/recipeStore.ts";
import { runAsUndoStep } from "../yjs/undo.ts";
import {
  copyMeasurement,
  type ImportOptions,
  type ImportPlan,
  isEmptyImportPlan,
  planImport,
} from "./importPlan.ts";

/** The largest export file an import will read. Real exports are a few hundred kilobytes at most. */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Writes a plan into the book, all in **one transaction**, so a single Undo reverts the whole
 * import. Pass the book's undo manager to also keep the import from merging with the edit before
 * or after it (`runAsUndoStep`).
 *
 * This is only writes: everything that could go wrong — matching, id clashes, dangling references —
 * was settled when the plan was made, because a Yjs transaction does not roll back if it throws.
 */
export function applyImportPlan(doc: Y.Doc, plan: ImportPlan, undoManager?: Y.UndoManager): void {
  if (isEmptyImportPlan(plan)) return;
  const write = () => {
    for (const label of plan.labels_to_create) putLabel(doc, label);
    for (const update of plan.label_kind_updates) setLabelKinds(doc, update.id, update.kinds);
    for (const ingredient of plan.ingredients_to_create) addIngredient(doc, ingredient);
    // Overwrites replace the whole entry under its own id; its name key follows its name.
    for (const ingredient of plan.ingredients_to_update) addIngredient(doc, ingredient);
    for (const container of plan.containers_to_create) addContainer(doc, container);
    for (const container of plan.containers_to_update) addContainer(doc, container);
    for (const folder of plan.folders_to_create) putRecipeFolder(doc, folder);
    for (const recipe of plan.recipes_to_create) addRecipe(doc, recipe);
    for (const { recipe_id, version } of plan.versions_to_add) {
      appendRecipeVersion(doc, recipe_id, version, version.created_at);
    }
  };
  if (undoManager === undefined) doc.transact(write);
  else runAsUndoStep(undoManager, doc, write);
}

/** What importing would do to the book as it is *now*. */
export function planImportIntoDoc(
  doc: Y.Doc,
  bundle: ReadonlyDeep<RecipeBookExport>,
  options: ImportOptions,
): ImportPlan {
  return planImport(readExportSource(doc), bundle, options);
}

/**
 * Plans against the book's current state and applies, in one step. Planning and writing run in one
 * synchronous call, so nothing — not a remote Yjs update, not another tab — can change the book
 * between them, and a book that changed since a preview was shown cannot be written with a stale
 * plan. (Call it directly from the confirming click: awaiting anything between a plan you made
 * earlier and `applyImportPlan` is what would reintroduce a stale plan.) Returns the plan that was
 * applied.
 */
export function importBundle(
  doc: Y.Doc,
  bundle: ReadonlyDeep<RecipeBookExport>,
  options: ImportOptions,
  undoManager?: Y.UndoManager,
): ImportPlan {
  const plan = planImportIntoDoc(doc, bundle, options);
  applyImportPlan(doc, plan, undoManager);
  return plan;
}

/**
 * The part of an export an ingredients-only import brings: its ingredients and the labels they
 * carry. Containers, folders, and recipes are left out.
 */
export function restrictBundleToIngredients(
  bundle: ReadonlyDeep<RecipeBookExport>,
): RecipeBookExport {
  const used = new Set(bundle.ingredients.flatMap((i) => [...i.labels]));
  return {
    format: bundle.format,
    format_version: bundle.format_version,
    exported_at: bundle.exported_at,
    ...(bundle.source_book !== undefined && { source_book: { ...bundle.source_book } }),
    ingredients: bundle.ingredients.map((i) => ({
      kind: i.kind,
      id: i.id,
      name: i.name,
      default_measurement_value: copyMeasurement(i.default_measurement_value),
      labels: new Set(i.labels),
      ...(i.parent_id !== undefined && { parent_id: i.parent_id }),
    })),
    containers: [],
    labels: bundle.labels
      .filter((l) => used.has(l.id))
      .map((l) => ({ ...l, kinds: new Set(l.kinds) })),
    recipe_folders: [],
    recipes: [],
    missing_references: bundle.missing_references.map((m) => ({
      ...m,
      referenced_by: { ...m.referenced_by },
    })),
  };
}

export type ReadImportFileResult =
  | { readonly ok: true; readonly bundle: RecipeBookExport }
  | { readonly ok: false; readonly error: string };

/**
 * Reads an export file's text for import, refusing one that is too large before parsing it.
 *
 * `sizeBytes` should be the file's real size in bytes (callers pass `File.size`). The `text.length`
 * default counts UTF-16 code units, which is only a stand-in: it matches the byte count for ASCII
 * and undercounts text with non-ASCII characters, so a caller that has the file should always pass
 * its size.
 */
export function readImportFile(
  text: string,
  sizeBytes: number = text.length,
): ReadImportFileResult {
  if (sizeBytes > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      error: `This file is too large to import (over ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB).`,
    };
  }
  const parsed = parseRecipeBookExport(text);
  return parsed.ok ? { ok: true, bundle: parsed.value } : { ok: false, error: parsed.error };
}

function count(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export type ImportSummary = { message: string; warnings: string[] };

/**
 * A sentence for what a plan does (or, with `done`, did): "3 recipes added, 2 recipes got new
 * versions, 14 ingredients added, 6 reused."
 */
export function summarizeImportPlan(
  plan: ReadonlyDeep<ImportPlan>,
  tense: "preview" | "done",
): ImportSummary {
  const n = (entity: string, action: string) =>
    plan.rows.filter((r) => r.entity === entity && r.action === action).length;
  const parts: string[] = [];
  const add = (amount: number, text: (amount: number) => string) => {
    if (amount > 0) parts.push(text(amount));
  };
  add(n("recipe", "create"), (a) => `${count(a, "recipe")} added`);
  add(n("recipe", "new_version"), (a) =>
    a === 1 ? "1 recipe gets a new version" : `${a} recipes get new versions`,
  );
  add(n("recipe", "unchanged"), (a) => `${count(a, "recipe")} already up to date`);
  add(n("recipe", "skip"), (a) => `${count(a, "recipe")} skipped`);
  add(n("ingredient", "create"), (a) => `${count(a, "ingredient")} added`);
  add(n("ingredient", "update"), (a) => `${count(a, "ingredient")} overwritten`);
  add(n("container", "create"), (a) => `${count(a, "container")} added`);
  add(n("container", "update"), (a) => `${count(a, "container")} overwritten`);
  add(n("folder", "create"), (a) => `${count(a, "folder")} created`);
  add(n("label", "create"), (a) => `${count(a, "label")} added`);
  add(n("ingredient", "reuse") + n("container", "reuse"), (a) => `${a} reused`);

  const prefix = tense === "preview" ? "This will import: " : "Imported: ";
  const message = isEmptyImportPlan(plan)
    ? "Nothing new to import: everything in this file is already in the book."
    : `${prefix}${parts.join(", ")}.`;
  return { message, warnings: [...plan.warnings] };
}
