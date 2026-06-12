import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { paddedId } from "../ids.ts";
import { RecipeFolder, RecipeFolderId, SortOrder } from "../recipeGroup.ts";

const ROOT_ID = paddedId(RecipeFolderId, "root");
const CHILD_ID = paddedId(RecipeFolderId, "child");
const GRANDCHILD_ID = paddedId(RecipeFolderId, "grandchild");

describe("RecipeFolder", () => {
  it("accepts a minimal folder (no parent, no children)", () => {
    const folder: RecipeFolder = {
      id: ROOT_ID,
      name: "Desserts",
      tags: [],
      sort_order: "alphabetical",
    };
    const result = RecipeFolder.type(folder);
    expect(result instanceof type.errors).toBe(false);
  });

  it("accepts a folder with a parent_folder_id", () => {
    const child: RecipeFolder = {
      id: CHILD_ID,
      name: "Cakes",
      parent_folder_id: ROOT_ID,
      tags: [],
      sort_order: "alphabetical",
    };
    const result = RecipeFolder.type(child);
    expect(result instanceof type.errors).toBe(false);
    expect(child.parent_folder_id).toBe(ROOT_ID);
  });

  it("accepts nested children (recursive structure)", () => {
    const grandchild: RecipeFolder = {
      id: GRANDCHILD_ID,
      name: "Chocolate Cakes",
      parent_folder_id: CHILD_ID,
      tags: [],
      sort_order: "manual",
    };
    const child: RecipeFolder = {
      id: CHILD_ID,
      name: "Cakes",
      parent_folder_id: ROOT_ID,
      tags: [],
      sort_order: "alphabetical",
      children: [grandchild],
    };
    const root: RecipeFolder = {
      id: ROOT_ID,
      name: "Desserts",
      tags: [],
      sort_order: "alphabetical",
      children: [child],
    };
    const result = RecipeFolder.type(root);
    expect(result instanceof type.errors).toBe(false);
    expect(root.children?.[0]?.children?.[0]?.name).toBe("Chocolate Cakes");
  });

  it("accepts all sort order values", () => {
    for (const sortOrder of SortOrder.values) {
      const folder: RecipeFolder = {
        id: ROOT_ID,
        name: "Folder",
        tags: [],
        sort_order: sortOrder,
      };
      const result = RecipeFolder.type(folder);
      expect(result instanceof type.errors).toBe(false);
    }
  });

  it("accepts a folder with tags and manual_order", () => {
    const folder: RecipeFolder = {
      id: ROOT_ID,
      name: "Favorites",
      tags: ["quick", "family"],
      sort_order: "manual",
      manual_order: [CHILD_ID, GRANDCHILD_ID],
    };
    const result = RecipeFolder.type(folder);
    expect(result instanceof type.errors).toBe(false);
    expect(folder.manual_order).toHaveLength(2);
  });
});
