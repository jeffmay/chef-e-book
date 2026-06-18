import { createRecipe, createRecipeFolder, deleteRecipe } from "@recipe-book/shared";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { BulkRecipeEditorPage } from "../BulkRecipeEditorPage.tsx";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
`;

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as object), useNavigate: () => mockNavigate };
});

function makeWrapper(kitchenwareDoc: Y.Doc, recipeBookDoc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      null,
      createElement(
        KitchenwareDocContext.Provider,
        { value: { doc: kitchenwareDoc, whenSynced: Promise.resolve() } },
        createElement(
          RecipeBookDocContext.Provider,
          { value: { doc: recipeBookDoc, whenSynced: Promise.resolve() } },
          children,
        ),
      ),
    );
  };
}

let kitchenwareDoc: Y.Doc;
let recipeBookDoc: Y.Doc;

beforeEach(() => {
  kitchenwareDoc = new Y.Doc();
  recipeBookDoc = new Y.Doc();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: () => Promise.resolve(MOCK_CSV) }));
  mockNavigate.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  return render(<BulkRecipeEditorPage />, {
    wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc),
  });
}

describe("BulkRecipeEditorPage — empty state", () => {
  it("renders the Recipes heading", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
  });

  it("shows the + New recipe button", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "New recipe" })).toBeInTheDocument();
  });

  it("shows empty state when no recipes exist", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByText(/No recipes yet/i)).toBeInTheDocument();
  });

  it("+ New recipe navigates to /recipes/new", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new");
  });
});

describe("BulkRecipeEditorPage — recipe rows", () => {
  it("shows recipe title in the table", async () => {
    createRecipe(recipeBookDoc, { title: "Banana Bread" });
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Banana Bread")).toBeInTheDocument();
  });

  it("shows created and updated dates", async () => {
    createRecipe(recipeBookDoc, { title: "Pasta" });
    setup();
    await flushAsyncEffects();
    const today = new Date().toLocaleDateString();
    const dateCells = screen.getAllByText(today);
    expect(dateCells.length).toBeGreaterThanOrEqual(2);
  });

  it("Edit button navigates to the latest version", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Soup" });
    const latestVersionId = recipe.versions.at(-1)?.id;
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Edit recipe Soup" }));
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${latestVersionId}`);
  });

  it("shows table with recipe rows when recipes exist", async () => {
    createRecipe(recipeBookDoc, { title: "Pizza" });
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("table", { name: "Recipe list" })).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — expand/collapse", () => {
  it("expands recipe to show versions", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Cake" });
    const version = recipe.versions[0];
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Expand versions of Cake" }));
    expect(screen.getByText(/Untitled version/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `Edit version ${version?.description || "Untitled version"}`,
      }),
    ).toBeInTheDocument();
  });

  it("version Edit button navigates to the specific version", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Cake" });
    const version = recipe.versions[0];
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Expand versions of Cake" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: `Edit version ${version?.description || "Untitled version"}`,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${version?.id}`);
  });

  it("collapses recipe versions on second click", async () => {
    createRecipe(recipeBookDoc, { title: "Pie" });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Expand versions of Pie" }));
    expect(screen.getByText(/Untitled version/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Collapse versions of Pie" }));
    expect(screen.queryByText(/Untitled version/i)).not.toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — folder rows", () => {
  it("shows folder in the table", async () => {
    createRecipeFolder(recipeBookDoc, "Desserts");
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Desserts")).toBeInTheDocument();
  });

  it("expands folder to show recipes inside it", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Mains");
    createRecipe(recipeBookDoc, { title: "Roast Chicken", parent_folder_id: folder.id });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Expand folder Mains" }));
    expect(screen.getByText("Roast Chicken")).toBeInTheDocument();
  });

  it("collapses folder on second click", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Soups");
    createRecipe(recipeBookDoc, { title: "Tomato Soup", parent_folder_id: folder.id });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Expand folder Soups" }));
    expect(screen.getByText("Tomato Soup")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Collapse folder Soups" }));
    expect(screen.queryByText("Tomato Soup")).not.toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — selection", () => {
  it("checkbox selects a recipe", async () => {
    createRecipe(recipeBookDoc, { title: "Tacos" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Tacos" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("shows bulk action bar when recipe is selected", async () => {
    createRecipe(recipeBookDoc, { title: "Tacos" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Tacos" }));
    expect(screen.getByRole("region", { name: "Recipe bulk actions" })).toBeInTheDocument();
  });

  it("Clear button deselects all", async () => {
    createRecipe(recipeBookDoc, { title: "Tacos" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Tacos" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("select-all checkbox selects all recipes", async () => {
    createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all recipes" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — delete", () => {
  it("shows delete confirmation dialog", async () => {
    createRecipe(recipeBookDoc, { title: "Burgers" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Burgers" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected recipes" }));
    expect(screen.getByRole("dialog", { name: "Confirm delete recipes" })).toBeInTheDocument();
  });

  it("confirming delete removes the recipe", async () => {
    createRecipe(recipeBookDoc, { title: "Burgers" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Burgers" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected recipes" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.queryByText("Burgers")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelling delete keeps the recipe", async () => {
    createRecipe(recipeBookDoc, { title: "Burgers" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Burgers" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected recipes" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel delete" }));
    expect(screen.getByText("Burgers")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — merge", () => {
  it("Merge button appears only when 2+ recipes are selected", async () => {
    createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    expect(
      screen.queryByRole("button", { name: "Merge selected recipes" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    expect(screen.getByRole("button", { name: "Merge selected recipes" })).toBeInTheDocument();
  });

  it("clicking Merge shows the merge name input", async () => {
    createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    expect(screen.getByRole("textbox", { name: "Merged recipe name" })).toBeInTheDocument();
  });

  it("submitting merge with a name creates merged recipe and removes originals", async () => {
    createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Merged recipe name" }), "A+B");
    await userEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(screen.getByText("A+B")).toBeInTheDocument();
  });

  it("Confirm merge is disabled when name is empty", async () => {
    createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    expect(screen.getByRole("button", { name: "Confirm merge" })).toBeDisabled();
  });

  it("Cancel merge hides the form", async () => {
    createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel merge" }));
    expect(screen.queryByRole("textbox", { name: "Merged recipe name" })).not.toBeInTheDocument();
  });

  it("shows an error alert and keeps the form open when merge throws", async () => {
    const a = createRecipe(recipeBookDoc, { title: "A" });
    createRecipe(recipeBookDoc, { title: "B" });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Merged recipe name" }), "A+B");

    // Delete recipe A externally so merge() will throw "Recipe not found".
    // Wrap in act() because the external mutation fires the store observer's setState.
    act(() => deleteRecipe(recipeBookDoc, a.id));

    await userEvent.click(screen.getByRole("button", { name: "Confirm merge" }));

    // Error alert must appear and the form must stay open
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Merged recipe name" })).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — virtual root folder", () => {
  it("shows the virtual Recipes folder row", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Collapse Recipes folder" })).toBeInTheDocument();
    // "Recipes" appears in both the h1 heading and the virtual root folder cell
    expect(screen.getAllByText("Recipes").length).toBeGreaterThanOrEqual(2);
  });

  it("Recipes folder is expanded by default", async () => {
    createRecipe(recipeBookDoc, { title: "Stew" });
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Collapse Recipes folder" })).toBeInTheDocument();
    expect(screen.getByText("Stew")).toBeInTheDocument();
  });

  it("collapsing root hides all recipes", async () => {
    createRecipe(recipeBookDoc, { title: "Stew" });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Recipes folder" }));
    expect(screen.queryByText("Stew")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Recipes folder" })).toBeInTheDocument();
  });

  it("collapsing then expanding root shows recipes again", async () => {
    createRecipe(recipeBookDoc, { title: "Stew" });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Recipes folder" }));
    await userEvent.click(screen.getByRole("button", { name: "Expand Recipes folder" }));
    expect(screen.getByText("Stew")).toBeInTheDocument();
  });

  it("shows empty message inside table when no recipes exist", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByText(/No recipes yet/i)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Recipe list" })).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — New menu on root folder", () => {
  it("root folder row has a New button", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "New item in Recipes" })).toBeInTheDocument();
  });

  it("clicking New opens a menu with Recipe and Folder options", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    expect(screen.getByRole("menuitem", { name: "Recipe" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Folder" })).toBeInTheDocument();
  });

  it("New > Recipe from root navigates to /recipes/new without folder state", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Recipe" }));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new");
  });

  it("New > Folder from root shows inline folder name form", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
    expect(screen.getByRole("textbox", { name: "New folder name" })).toBeInTheDocument();
  });

  it("submitting the new root folder creates the folder", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New folder name" }), "Desserts");
    await userEvent.click(screen.getByRole("button", { name: "Confirm new folder" }));
    expect(screen.getByText("Desserts")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("cancelling the new root folder hides the form", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel new folder" }));
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — New menu on folder rows", () => {
  it("folder rows have a New button", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "New item in folder Mains" })).toBeInTheDocument();
  });

  it("clicking New on a folder opens a menu with Recipe and Folder options", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    expect(screen.getByRole("menuitem", { name: "Recipe" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Folder" })).toBeInTheDocument();
  });

  it("New > Recipe from a folder navigates to /recipes/new with parentFolderId state", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Recipe" }));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new", {
      state: { parentFolderId: folder.id },
    });
  });

  it("New > Folder from a folder shows inline folder name form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
    expect(screen.getByRole("textbox", { name: "New folder name" })).toBeInTheDocument();
  });

  it("cancelling the new sub-folder form hides the form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel new folder" }));
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("submitting the new sub-folder creates it and hides the form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    // Expand Mains first so the new child folder will be visible after creation.
    await userEvent.click(screen.getByRole("button", { name: "Expand folder Mains" }));
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New folder name" }), "Pasta");
    await userEvent.click(screen.getByRole("button", { name: "Confirm new folder" }));
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — New menu keyboard navigation", () => {
  it("autoFocus puts focus on Recipe when menu opens", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    expect(screen.getByRole("menuitem", { name: "Recipe" })).toHaveFocus();
  });

  it("ArrowDown moves focus from Recipe to Folder", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Folder" })).toHaveFocus();
  });

  it("ArrowDown wraps from Folder back to Recipe", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Recipe" })).toHaveFocus();
  });

  it("ArrowUp from Recipe wraps to Folder (last item)", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Folder" })).toHaveFocus();
  });

  it("Escape closes the menu", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — inline folder rename", () => {
  it("double-clicking a folder name shows the rename input pre-filled with the current name", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    const input = screen.getByRole("textbox", { name: "Rename folder Mains" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Mains");
  });

  it("changing the name and confirming updates the folder", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    const input = screen.getByRole("textbox", { name: "Rename folder Mains" });
    await userEvent.clear(input);
    await userEvent.type(input, "Dinners");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rename folder" }));
    expect(screen.queryByRole("textbox", { name: "Rename folder Mains" })).not.toBeInTheDocument();
    expect(screen.getByText("Dinners")).toBeInTheDocument();
  });

  it("pressing Escape cancels the rename and restores the original name", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Rename folder Mains" })).not.toBeInTheDocument();
    expect(screen.getByText("Mains")).toBeInTheDocument();
  });

  it("clicking the cancel button hides the rename form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel rename folder" }));
    expect(screen.queryByRole("textbox", { name: "Rename folder Mains" })).not.toBeInTheDocument();
    expect(screen.getByText("Mains")).toBeInTheDocument();
  });

  it("confirm button is disabled when the name is empty", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    await userEvent.clear(screen.getByRole("textbox", { name: "Rename folder Mains" }));
    expect(screen.getByRole("button", { name: "Confirm rename folder" })).toBeDisabled();
  });

  it("pressing Enter on the folder name span starts the rename", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    screen.getByText("Mains").focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Rename folder Mains" })).toBeInTheDocument();
  });

  it("clicking outside the rename form cancels it", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    await userEvent.click(screen.getByRole("heading", { name: "Recipes" }));
    expect(screen.queryByRole("textbox", { name: "Rename folder Mains" })).not.toBeInTheDocument();
  });

  it("Escape returns focus to the folder name span", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("Mains")).toHaveFocus();
  });

  it("after submitting a rename focus returns to the updated folder name span", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.dblClick(screen.getByText("Mains"));
    await userEvent.clear(screen.getByRole("textbox", { name: "Rename folder Mains" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Rename folder Mains" }), "Dinners");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("Dinners")).toHaveFocus();
  });
});

describe("BulkRecipeEditorPage — edit navigation", () => {
  it("Edit keeps the recipe in the list after navigating away", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Lasagne" });
    const latestVersionId = recipe.versions.at(-1)?.id;
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Edit recipe Lasagne" }));
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${latestVersionId}`);
    // Recipe must still be visible — Edit does not delete or clear it
    expect(screen.getByText("Lasagne")).toBeInTheDocument();
  });

  it("Edit a specific version navigates to that version and keeps recipe in list", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Risotto" });
    const version = recipe.versions[0];
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Expand versions of Risotto" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: `Edit version ${version?.description || "Untitled version"}`,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${version?.id}`);
    // Recipe row must still be present — version edit does not mutate the list
    expect(screen.getByText("Risotto")).toBeInTheDocument();
  });
});
