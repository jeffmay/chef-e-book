import { fixedId, RecipeFolderId, type RecipeFolder } from "@recipe-book/shared";
import { describe, expect, it } from "vitest";
import { folderOptions } from "../folderOptions.ts";

function folder(key: string, name: string, parent?: string): Omit<RecipeFolder, "children"> {
  return {
    id: fixedId(RecipeFolderId, key),
    name,
    tags: [],
    sort_order: "alphabetical",
    ...(parent !== undefined && { parent_folder_id: fixedId(RecipeFolderId, parent) }),
  };
}

describe("folderOptions", () => {
  it("is empty for no folders", () => {
    expect(folderOptions([])).toEqual([]);
  });

  it("lists each folder with its full path, sorted by path", () => {
    const options = folderOptions([
      folder("soups", "Soups", "dinner"),
      folder("dinner", "Dinner"),
      folder("baking", "Baking"),
    ]);
    expect(options.map((o) => o.path)).toEqual(["Baking", "Dinner", "Dinner / Soups"]);
  });

  it("keeps ids with their paths", () => {
    const [only] = folderOptions([folder("a", "A")]);
    expect(only).toEqual({ id: fixedId(RecipeFolderId, "a"), path: "A" });
  });

  it("lists a folder from the top when its parent is missing", () => {
    expect(folderOptions([folder("orphan", "Orphan", "gone")]).map((o) => o.path)).toEqual([
      "Orphan",
    ]);
  });

  it("cuts a loop of parents instead of following it", () => {
    const options = folderOptions([folder("a", "A", "b"), folder("b", "B", "a")]);
    expect(options).toHaveLength(2);
    expect(options.every((o) => o.path.length > 0)).toBe(true);
  });
});
