import { useEffect, useState } from "react";
import {
  type RecipeFolder,
  type RecipeFolderId,
  createRecipeFolder,
  deleteRecipeFolder,
  getRecipeFolderYmap,
  getRecipeFolders,
  getRecipeFoldersFlat,
  updateRecipeFolder,
} from "@recipe-book/shared";
import { useRecipeBookDoc } from "../contexts/docContext.js";

export interface RecipeFolderStore {
  readonly folders: RecipeFolder[];
  readonly flatFolders: Array<Omit<RecipeFolder, "children">>;
  readonly createFolder: (name: string, parent_id?: RecipeFolderId) => RecipeFolder;
  readonly updateFolder: (folder: RecipeFolder) => void;
  readonly deleteFolder: (id: RecipeFolderId) => void;
}

export function useRecipeFolderStore(): RecipeFolderStore {
  const { doc, whenSynced } = useRecipeBookDoc();
  const [folders, setFolders] = useState<RecipeFolder[]>(() => getRecipeFolders(doc));
  const [flatFolders, setFlatFolders] = useState(() => getRecipeFoldersFlat(doc));

  useEffect(() => {
    (async function syncRecipeFolder() {
      await whenSynced;
      const map = getRecipeFolderYmap(doc);
      function update() {
        setFolders(getRecipeFolders(doc));
        setFlatFolders(getRecipeFoldersFlat(doc));
      }
      map.observe(update);
      return () => map.unobserve(update);
    })();
  }, [doc, whenSynced]);

  return {
    folders,
    flatFolders,
    createFolder: (name, parent_id) => createRecipeFolder(doc, name, parent_id),
    updateFolder: (folder) => updateRecipeFolder(doc, folder),
    deleteFolder: (id) => deleteRecipeFolder(doc, id),
  };
}
