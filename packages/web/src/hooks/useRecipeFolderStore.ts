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
import { useRecipeBookDoc } from "../contexts/docContext.ts";

export interface RecipeFolderStore {
  folders: RecipeFolder[];
  flatFolders: Array<Omit<RecipeFolder, "children">>;
  createFolder: (name: string, parentId?: RecipeFolderId) => RecipeFolder;
  updateFolder: (folder: RecipeFolder) => void;
  deleteFolder: (id: RecipeFolderId) => void;
}

export function useRecipeFolderStore(): RecipeFolderStore {
  const { doc, whenSynced } = useRecipeBookDoc();
  const [folders, setFolders] = useState<RecipeFolder[]>(() => getRecipeFolders(doc));
  const [flatFolders, setFlatFolders] = useState(() => getRecipeFoldersFlat(doc));

  useEffect(() => {
    const map = getRecipeFolderYmap(doc);
    function update() {
      setFolders(getRecipeFolders(doc));
      setFlatFolders(getRecipeFoldersFlat(doc));
    }
    map.observe(update);
    whenSynced.then(() => {
      setFolders(getRecipeFolders(doc));
      setFlatFolders(getRecipeFoldersFlat(doc));
    });
    return () => map.unobserve(update);
  }, [doc, whenSynced]);

  return {
    folders,
    flatFolders,
    createFolder: (name, parentId) => createRecipeFolder(doc, name, parentId),
    updateFolder: (folder) => updateRecipeFolder(doc, folder),
    deleteFolder: (id) => deleteRecipeFolder(doc, id),
  };
}
