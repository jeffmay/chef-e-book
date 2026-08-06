import { Companion, loadId, RecipeFolderId, RecipeId } from "@recipe-book/shared";
import { type } from "arktype";
import type { ReadonlyDeep } from "type-fest";

/** `localStorage` key holding the BulkRecipeEditorPage tree state for this device. */
export const BULK_RECIPE_VIEW_KEY = "chefe_bulk_recipe_view" as const;

/**
 * The expanded/collapsed shape of the recipe tree, as stored on this device.
 *
 * Collapsed ids are stored rather than expanded ones so that the *empty* state — which is
 * what a device with nothing stored starts from — means "fully expanded". It also means a
 * folder or recipe created later starts expanded like everything else, instead of having to
 * be added to a stored expanded set that predates it.
 *
 * Ids are stored as plain strings: they are branded when read back out, and a stored id
 * whose folder/recipe has since been deleted is simply never matched.
 */
export const BulkRecipeViewState = Companion(
  "BulkRecipeViewState",
  type({
    root_collapsed: "boolean",
    collapsed_folder_ids: "string[]",
    collapsed_recipe_ids: "string[]",
  }),
);

export type BulkRecipeViewState = typeof BulkRecipeViewState.type.infer;

/** The default view: the root, every folder, and every recipe expanded. */
export function fullyExpandedBulkRecipeView(): BulkRecipeViewState {
  return { root_collapsed: false, collapsed_folder_ids: [], collapsed_recipe_ids: [] };
}

export function collapsedFolderIds(
  viewState: ReadonlyDeep<BulkRecipeViewState>,
): ReadonlySet<RecipeFolderId> {
  return new Set(viewState.collapsed_folder_ids.map((id) => loadId(RecipeFolderId, id)));
}

export function collapsedRecipeIds(
  viewState: ReadonlyDeep<BulkRecipeViewState>,
): ReadonlySet<RecipeId> {
  return new Set(viewState.collapsed_recipe_ids.map((id) => loadId(RecipeId, id)));
}

function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export function toggleRootCollapsed(
  viewState: ReadonlyDeep<BulkRecipeViewState>,
): BulkRecipeViewState {
  return { ...toMutable(viewState), root_collapsed: !viewState.root_collapsed };
}

export function toggleFolderCollapsed(
  viewState: ReadonlyDeep<BulkRecipeViewState>,
  folderId: RecipeFolderId,
): BulkRecipeViewState {
  return {
    ...toMutable(viewState),
    collapsed_folder_ids: toggleId(viewState.collapsed_folder_ids, folderId),
  };
}

export function toggleRecipeCollapsed(
  viewState: ReadonlyDeep<BulkRecipeViewState>,
  recipeId: RecipeId,
): BulkRecipeViewState {
  return {
    ...toMutable(viewState),
    collapsed_recipe_ids: toggleId(viewState.collapsed_recipe_ids, recipeId),
  };
}

function toMutable(viewState: ReadonlyDeep<BulkRecipeViewState>): BulkRecipeViewState {
  return {
    root_collapsed: viewState.root_collapsed,
    collapsed_folder_ids: [...viewState.collapsed_folder_ids],
    collapsed_recipe_ids: [...viewState.collapsed_recipe_ids],
  };
}
