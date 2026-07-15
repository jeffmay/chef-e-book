import { type } from "arktype";
import type * as Y from "yjs";
import { Companion } from "../types/companion.ts";
import { loadId, randomId } from "../types/ids.ts";
import type { RecipeFolder } from "../types/recipeGroup.ts";
import { RecipeFolderId, SortOrder } from "../types/recipeGroup.ts";
import type { ValidationError } from "./validation.ts";
import { isInvalid, isValid, validateByIdOrLog } from "./validation.ts";

const MAP_KEY = "recipe_folders";

export function getRecipeFolderYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

// Stored format omits the `children` field — the tree is rebuilt from parent_folder_id
const StoredRecipeFolder = Companion(
  "StoredRecipeFolder",
  type({
    name: "string",
    "parent_folder_id?": RecipeFolderId.type,
    tags: "string[]",
    sort_order: SortOrder.type,
    "manual_order?": "string[]",
  }),
);
type StoredRecipeFolder = typeof StoredRecipeFolder.type.infer;

function toStored(folder: RecipeFolder): StoredRecipeFolder {
  return {
    name: folder.name,
    tags: folder.tags,
    sort_order: folder.sort_order,
    ...(folder.parent_folder_id !== undefined && { parent_folder_id: folder.parent_folder_id }),
    ...(folder.manual_order !== undefined && { manual_order: folder.manual_order }),
  };
}

function validateStored(
  id: RecipeFolderId,
  raw: unknown,
): Omit<RecipeFolder, "children"> | ValidationError {
  const result = validateByIdOrLog(StoredRecipeFolder, id, raw, { dataFrom: "localstorage" });
  if (isInvalid(result)) return result;
  return {
    id,
    name: result.name,
    tags: result.tags,
    sort_order: result.sort_order,
    ...(result.parent_folder_id !== undefined && { parent_folder_id: result.parent_folder_id }),
    ...(result.manual_order !== undefined && { manual_order: result.manual_order }),
  };
}

/** Returns a flat list of all folders (without the children array). */
export function getRecipeFoldersFlat(doc: Y.Doc): Array<Omit<RecipeFolder, "children">> {
  const map = getRecipeFolderYmap(doc);
  const results: Array<Omit<RecipeFolder, "children">> = [];
  map.forEach((value, id) => {
    const folder = validateStored(loadId(RecipeFolderId, id), value);
    if (isValid(folder)) results.push(folder);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Builds the folder hierarchy from a flat list. Returns root-level folders. */
export function buildFolderTree(flat: Array<Omit<RecipeFolder, "children">>): RecipeFolder[] {
  const byId = new Map<string, RecipeFolder>();
  for (const f of flat) {
    byId.set(f.id, { ...f, children: [] });
  }
  const roots: RecipeFolder[] = [];
  for (const folder of byId.values()) {
    if (folder.parent_folder_id !== undefined) {
      const parent = byId.get(folder.parent_folder_id);
      if (parent !== undefined) {
        (parent.children ??= []).push(folder);
        continue;
      }
    }
    roots.push(folder);
  }
  return roots;
}

/** Returns the full folder tree (root folders with nested children). */
export function getRecipeFolders(doc: Y.Doc): RecipeFolder[] {
  return buildFolderTree(getRecipeFoldersFlat(doc));
}

export function createRecipeFolder(
  doc: Y.Doc,
  name: string,
  parent_folder_id?: RecipeFolderId,
): RecipeFolder {
  const id = randomId(RecipeFolderId);
  const folder: RecipeFolder = {
    id,
    name,
    tags: [],
    sort_order: "manual",
    ...(parent_folder_id !== undefined && { parent_folder_id }),
  };
  getRecipeFolderYmap(doc).set(id, toStored(folder));
  return folder;
}

export function updateRecipeFolder(doc: Y.Doc, folder: RecipeFolder): void {
  const map = getRecipeFolderYmap(doc);
  if (!map.has(folder.id)) return;
  map.set(folder.id, toStored(folder));
}

export function deleteRecipeFolder(doc: Y.Doc, id: RecipeFolderId): void {
  getRecipeFolderYmap(doc).delete(id);
}
