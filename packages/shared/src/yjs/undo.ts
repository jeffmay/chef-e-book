import * as Y from "yjs";
import { getBookMetaYmap } from "./bookMetaStore.ts";
import { getBookSettingsYmap } from "./bookSettingsStore.ts";
import { getContainerYmap } from "./containerStore.ts";
import { getIngredientYmap } from "./ingredientStore.ts";
import { getLabelsYmap } from "./labelStore.ts";
import { getRecipeFolderYmap } from "./recipeFolderStore.ts";
import { getRecipeYmap } from "./recipeStore.ts";

/**
 * Everything in the book document that an Undo is allowed to touch: the ingredients list and the
 * recipes tree, together, so one undo history covers both.
 *
 * **The session maps (`sessions`, `session_item_states`) are deliberately not here.** Ticking off a
 * step while cooking is run-state, not an edit to the book, and Undo must not uncheck steps or
 * reopen a finished session. Saving a recipe version *from* a session writes to `recipes`, which is
 * in scope, so that is undoable.
 *
 * A new root map is outside the undo history until it is added here.
 */
export function getBookUndoScope(doc: Y.Doc): Y.Map<unknown>[] {
  return [
    getIngredientYmap(doc),
    getContainerYmap(doc),
    getLabelsYmap(doc),
    getRecipeYmap(doc),
    getRecipeFolderYmap(doc),
    getBookSettingsYmap(doc),
    getBookMetaYmap(doc),
  ];
}

/**
 * One `Y.UndoManager` for the whole book.
 *
 * It tracks only local edits — transactions with the default `null` origin. Everything the app
 * writes on the user's behalf (`SETUP_ORIGIN`, `MIGRATION_ORIGIN`), what IndexedDB loads, and what a
 * future sync provider applies use other origins, so none of it can be undone, and undoing never
 * reverts another device's edit.
 *
 * Edits made within `captureTimeout` (Yjs's default 500 ms) of each other merge into one step, so a
 * burst of writes from one gesture undoes together. Anything that must be exactly one step
 * regardless of timing — an import — goes through `runAsUndoStep`.
 *
 * Call `destroy()` when the book is closed.
 */
export function createBookUndoManager(doc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager(getBookUndoScope(doc));
}

/**
 * Runs `fn` as exactly one undo step: it never merges with the edit before it or the edit after it,
 * and everything it writes is one transaction, so a single Undo reverts all of it.
 */
export function runAsUndoStep<T>(undoManager: Y.UndoManager, doc: Y.Doc, fn: () => T): T {
  undoManager.stopCapturing();
  try {
    return doc.transact(fn);
  } finally {
    undoManager.stopCapturing();
  }
}
