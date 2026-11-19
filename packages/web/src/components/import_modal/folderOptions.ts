import type { RecipeFolder, RecipeFolderId } from "@recipe-book/shared";
import type { ReadonlyDeep } from "type-fest";

export type FolderOption = { id: RecipeFolderId; path: string };

/**
 * Every folder with its full path ("Dinner / Soups"), sorted by path, for a flat list to choose a
 * destination from. A folder whose parent is missing is listed from the top, and a loop of parents
 * is cut rather than followed.
 */
export function folderOptions(
  folders: ReadonlyDeep<Array<Omit<RecipeFolder, "children">>>,
): FolderOption[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return folders
    .map((folder) => {
      const names: string[] = [];
      const seen = new Set<string>();
      let current: (typeof folders)[number] | undefined = folder;
      while (current !== undefined && !seen.has(current.id)) {
        seen.add(current.id);
        names.unshift(current.name);
        current =
          current.parent_folder_id === undefined ? undefined : byId.get(current.parent_folder_id);
      }
      return { id: folder.id, path: names.join(" / ") };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
}
