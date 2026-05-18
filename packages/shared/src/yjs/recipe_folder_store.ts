import { type } from "arktype";
import * as Y from "yjs";
import { isTypeError } from "../assertions/index.js";
import { Companion } from "../types/companion.js";
import { loadId, randomId } from "../types/ids.js";
import { RecipeFolder, RecipeFolderId, SortOrder } from "../types/recipe_group.js";

const MAP_KEY = "recipe_folders";

export function getRecipeFolderYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

// Stored format omits the `children` field — the tree is rebuilt from parent_folder_id
const StoredRecipeFolder = Companion("StoredRecipeFolder", type({
  name: "string",
  "parent_folder_id?": RecipeFolderId.type,
  tags: "string[]",
  sort_order: SortOrder.type,
  "manual_order?": "string[]",
}));
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

function validateStored(id: RecipeFolderId, raw: unknown): Omit<RecipeFolder, "children"> | null {
  const result = StoredRecipeFolder.type(raw);
  if (isTypeError(result)) return null;
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
    if (folder !== null) results.push(folder);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Builds the folder hierarchy from a flat list. Returns root-level folders. */
export function buildFolderTree(flat: Array<Omit<RecipeFolder, "children">>): RecipeFolder[] {
  const by_id = new Map<string, RecipeFolder>();
  for (const f of flat) {
    by_id.set(f.id, { ...f, children: [] });
  }
  const roots: RecipeFolder[] = [];
  for (const folder of by_id.values()) {
    if (folder.parent_folder_id !== undefined) {
      const parent = by_id.get(folder.parent_folder_id);
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
