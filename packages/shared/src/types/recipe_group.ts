import { type } from "arktype";
import { ScopedCompanion } from "./companion.js";
import { IdCompanion } from "./ids.js";
import { EnumCompanion } from "./enums.js";

export const SortOrder = EnumCompanion("SortOrder", ["last_modified", "created", "alphabetical", "manual"]);
export type SortOrder = typeof SortOrder.type.infer;

export const RecipeFolderId = IdCompanion("RecipeFolderId", 12);
export type RecipeFolderId = typeof RecipeFolderId.type.infer;

// Use scope syntax for the self-recursive `children` field — arktype's
// inline `"this[]"` reference trips a "shallow resolution cycle" parse error
// at module load.
const recipeFolderScope = type.scope({
  RecipeFolder: {
    id: () => RecipeFolderId.type,
    name: "string",
    "parent_folder_id?": () => RecipeFolderId.type,
    tags: "string[]",
    sort_order: () => SortOrder.type,
    "manual_order?": "string[]",
    "children?": "RecipeFolder[]",
  },
}).export();

export const RecipeFolder = ScopedCompanion(recipeFolderScope, "RecipeFolder");
export type RecipeFolder = typeof recipeFolderScope.RecipeFolder.infer;
