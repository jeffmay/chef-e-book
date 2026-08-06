import {
  createRecipe,
  createRecipeFolder,
  DEFAULT_VERSION_DESCRIPTION,
  deleteRecipe,
  getSessions,
} from "@recipe-book/shared";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { BulkRecipeEditorPage } from "../BulkRecipeEditorPage.tsx";
import { BULK_RECIPE_VIEW_KEY } from "../bulkRecipeViewState.ts";

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
  // The tree's expand/collapse state persists in localStorage, so it must not leak between tests.
  localStorage.clear();
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
    expect(screen.getByRole("button", { name: "New Recipe" })).toBeInTheDocument();
  });

  it("shows empty state when no recipes exist", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByText(/No recipes yet/i)).toBeInTheDocument();
  });

  it("+ New recipe navigates to /recipes/new", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New Recipe" }));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new");
  });
});

describe("BulkRecipeEditorPage — recipe rows", () => {
  it("shows recipe title in the table", async () => {
    createRecipe(recipeBookDoc, {
      title: "Banana Bread",
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Banana Bread")).toBeInTheDocument();
  });

  it("shows created and updated dates", async () => {
    createRecipe(recipeBookDoc, { title: "Pasta", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await flushAsyncEffects();
    const today = new Date().toLocaleDateString();
    const dateCells = screen.getAllByText(today);
    expect(dateCells.length).toBeGreaterThanOrEqual(2);
  });

  it("Edit in the recipe row menu navigates to the latest version", async () => {
    const recipe = createRecipe(recipeBookDoc, {
      title: "Soup",
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    const latestVersionId = recipe.versions.at(-1)?.id;
    setup();
    await userEvent.click(screen.getByRole("button", { name: "More actions for recipe Soup" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "🖊️ Edit" }));
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${latestVersionId}`);
  });

  it("shows table with recipe rows when recipes exist", async () => {
    createRecipe(recipeBookDoc, { title: "Pizza", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("table", { name: "Recipe list" })).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — mobile view", () => {
  function stubMobileView(): void {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(max-width: 600px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }

  it("folds the recipe row default action into the menu (chevron only)", async () => {
    stubMobileView();
    createRecipe(recipeBookDoc, { title: "Gumbo", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await flushAsyncEffects();

    // The default "Start" button is not shown as a standalone button in mobile view.
    expect(
      screen.queryByRole("button", { name: "Start session for Gumbo" }),
    ).not.toBeInTheDocument();

    // Its action is available inside the actions menu instead, above Edit.
    await userEvent.click(screen.getByRole("button", { name: "More actions for recipe Gumbo" }));
    expect(screen.getByRole("menuitem", { name: "▶ Start" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "🖊️ Edit" })).toBeInTheDocument();
  });

  it("keeps the default action visible on wider screens", async () => {
    // No mobile matchMedia stub — useMobileView falls back to desktop.
    createRecipe(recipeBookDoc, { title: "Gumbo", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Start session for Gumbo" })).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — expand/collapse", () => {
  it("shows recipe versions without expanding, because rows start expanded", async () => {
    const recipe = createRecipe(recipeBookDoc, {
      title: "Cake",
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    const version = recipe.versions[0];
    setup();
    await flushAsyncEffects();
    expect(screen.getByText(DEFAULT_VERSION_DESCRIPTION)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `Start session for version ${version?.description || DEFAULT_VERSION_DESCRIPTION}`,
      }),
    ).toBeInTheDocument();
  });

  it("version row menu Edit navigates to the specific version", async () => {
    const recipe = createRecipe(recipeBookDoc, {
      title: "Cake",
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    const version = recipe.versions[0];
    setup();
    await userEvent.click(
      screen.getByRole("button", {
        name: `More actions for version ${version?.description || DEFAULT_VERSION_DESCRIPTION}`,
      }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "🖊️ Edit" }));
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${version?.id}`);
  });

  it("collapses and re-expands recipe versions", async () => {
    createRecipe(recipeBookDoc, { title: "Pie", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse versions of Pie" }));
    expect(screen.queryByText(DEFAULT_VERSION_DESCRIPTION)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand versions of Pie" }));
    expect(screen.getByText(DEFAULT_VERSION_DESCRIPTION)).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — folder rows", () => {
  it("shows folder in the table", async () => {
    createRecipeFolder(recipeBookDoc, "Desserts");
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Desserts")).toBeInTheDocument();
  });

  it("shows recipes inside a folder without expanding, because folders start expanded", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Mains");
    createRecipe(recipeBookDoc, {
      title: "Roast Chicken",
      parent_folder_id: folder.id,
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Roast Chicken")).toBeInTheDocument();
  });

  it("collapses and re-expands a folder", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Soups");
    createRecipe(recipeBookDoc, {
      title: "Tomato Soup",
      parent_folder_id: folder.id,
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse folder Soups" }));
    expect(screen.queryByText("Tomato Soup")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand folder Soups" }));
    expect(screen.getByText("Tomato Soup")).toBeInTheDocument();
  });

  it("shows a folder created after the view state was stored as expanded", async () => {
    createRecipeFolder(recipeBookDoc, "Soups");
    const { unmount } = setup();
    // Collapse an unrelated folder so a view state exists in localStorage.
    await userEvent.click(screen.getByRole("button", { name: "Collapse folder Soups" }));
    unmount();

    const folder = createRecipeFolder(recipeBookDoc, "Stews");
    createRecipe(recipeBookDoc, {
      title: "Beef Stew",
      parent_folder_id: folder.id,
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Beef Stew")).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — selection", () => {
  it("checkbox selects a recipe", async () => {
    createRecipe(recipeBookDoc, { title: "Tacos", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Tacos" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("shows bulk action bar when recipe is selected", async () => {
    createRecipe(recipeBookDoc, { title: "Tacos", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Tacos" }));
    expect(screen.getByRole("region", { name: "Recipe bulk actions" })).toBeInTheDocument();
  });

  it("Clear button deselects all", async () => {
    createRecipe(recipeBookDoc, { title: "Tacos", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Tacos" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("select-all checkbox selects all recipes", async () => {
    createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all recipes" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});

describe("BulkRecipeEditorPage — delete", () => {
  it("shows delete confirmation dialog", async () => {
    createRecipe(recipeBookDoc, { title: "Burgers", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Burgers" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected recipes" }));
    expect(screen.getByRole("dialog", { name: "Confirm delete recipes" })).toBeInTheDocument();
  });

  it("confirming delete removes the recipe", async () => {
    createRecipe(recipeBookDoc, { title: "Burgers", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe Burgers" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected recipes" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.queryByText("Burgers")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelling delete keeps the recipe", async () => {
    createRecipe(recipeBookDoc, { title: "Burgers", description: DEFAULT_VERSION_DESCRIPTION });
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
    createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    expect(
      screen.queryByRole("button", { name: "Merge selected recipes" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    expect(screen.getByRole("button", { name: "Merge selected recipes" })).toBeInTheDocument();
  });

  it("clicking Merge shows the merge name input", async () => {
    createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    expect(screen.getByRole("textbox", { name: "Merged recipe name" })).toBeInTheDocument();
  });

  it("submitting merge with a name creates merged recipe and removes originals", async () => {
    createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
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
    createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    expect(screen.getByRole("button", { name: "Confirm merge" })).toBeDisabled();
  });

  it("Cancel merge hides the form", async () => {
    createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select recipe B" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge selected recipes" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel merge" }));
    expect(screen.queryByRole("textbox", { name: "Merged recipe name" })).not.toBeInTheDocument();
  });

  it("shows an error alert and keeps the form open when merge throws", async () => {
    const a = createRecipe(recipeBookDoc, { title: "A", description: DEFAULT_VERSION_DESCRIPTION });
    createRecipe(recipeBookDoc, { title: "B", description: DEFAULT_VERSION_DESCRIPTION });
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
    createRecipe(recipeBookDoc, { title: "Stew", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Collapse Recipes folder" })).toBeInTheDocument();
    expect(screen.getByText("Stew")).toBeInTheDocument();
  });

  it("collapsing root hides all recipes", async () => {
    createRecipe(recipeBookDoc, { title: "Stew", description: DEFAULT_VERSION_DESCRIPTION });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Recipes folder" }));
    expect(screen.queryByText("Stew")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Recipes folder" })).toBeInTheDocument();
  });

  it("collapsing then expanding root shows recipes again", async () => {
    createRecipe(recipeBookDoc, { title: "Stew", description: DEFAULT_VERSION_DESCRIPTION });
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

// ---------------------------------------------------------------------------
// Persisted view state
// ---------------------------------------------------------------------------

describe("BulkRecipeEditorPage — persisted expand/collapse state", () => {
  it("restores a collapsed folder after a reload", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Soups");
    createRecipe(recipeBookDoc, {
      title: "Tomato Soup",
      parent_folder_id: folder.id,
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    const { unmount } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse folder Soups" }));
    unmount();

    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Expand folder Soups" })).toBeInTheDocument();
    expect(screen.queryByText("Tomato Soup")).not.toBeInTheDocument();
  });

  it("restores a collapsed recipe's versions after a reload", async () => {
    createRecipe(recipeBookDoc, { title: "Pie", description: DEFAULT_VERSION_DESCRIPTION });
    const { unmount } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse versions of Pie" }));
    unmount();

    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Expand versions of Pie" })).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_VERSION_DESCRIPTION)).not.toBeInTheDocument();
  });

  it("restores the collapsed root folder after a reload", async () => {
    createRecipe(recipeBookDoc, { title: "Stew", description: DEFAULT_VERSION_DESCRIPTION });
    const { unmount } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Recipes folder" }));
    unmount();

    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Expand Recipes folder" })).toBeInTheDocument();
    expect(screen.queryByText("Stew")).not.toBeInTheDocument();
  });

  it("falls back to fully expanded when the stored view state is unreadable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(BULK_RECIPE_VIEW_KEY, '{"root_collapsed":"nope"}');
    const folder = createRecipeFolder(recipeBookDoc, "Soups");
    createRecipe(recipeBookDoc, {
      title: "Tomato Soup",
      parent_folder_id: folder.id,
      description: DEFAULT_VERSION_DESCRIPTION,
    });
    setup();
    await flushAsyncEffects();
    expect(screen.getByText("Tomato Soup")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(BULK_RECIPE_VIEW_KEY));
    warn.mockRestore();
  });
});

describe("BulkRecipeEditorPage — New menu on root folder", () => {
  it("root folder row has a New Recipe default button and a chevron menu", async () => {
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "New recipe in Recipes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New item in Recipes" })).toBeInTheDocument();
  });

  it("the default New Recipe button navigates to /recipes/new", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe in Recipes" }));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new");
  });

  it("clicking the chevron opens a menu with New Folder option", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    expect(await screen.findByRole("menuitem", { name: "📂 Folder" })).toBeInTheDocument();
  });

  it("New Folder menu item shows inline folder name form", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "📂 Folder" }));
    expect(screen.getByRole("textbox", { name: "New folder name" })).toBeInTheDocument();
  });

  it("submitting the new root folder creates the folder", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "📂 Folder" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New folder name" }), "Desserts");
    await userEvent.click(screen.getByRole("button", { name: "Confirm new folder" }));
    expect(screen.getByText("Desserts")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("cancelling the new root folder hides the form", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "📂 Folder" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel new folder" }));
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("Escape closes the chevron menu", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in Recipes" }));
    expect(await screen.findByRole("menuitem", { name: "📂 Folder" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "📂 Folder" })).not.toBeInTheDocument(),
    );
  });
});

describe("BulkRecipeEditorPage — New menu on folder rows", () => {
  it("folder rows have a New Recipe default button and a chevron menu", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "New recipe in folder Mains" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New item in folder Mains" })).toBeInTheDocument();
  });

  it("the default New Recipe button navigates with parentFolderId state", async () => {
    const folder = createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New recipe in folder Mains" }));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new", {
      state: { parentFolderId: folder.id },
    });
  });

  it("New Folder menu item shows inline folder name form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "📂 Folder" }));
    expect(screen.getByRole("textbox", { name: "New folder name" })).toBeInTheDocument();
  });

  it("cancelling the new sub-folder form hides the form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "📂 Folder" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel new folder" }));
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("submitting the new sub-folder creates it and hides the form", async () => {
    createRecipeFolder(recipeBookDoc, "Mains");
    setup();
    // Mains starts expanded, so the new child folder is visible after creation.
    await userEvent.click(screen.getByRole("button", { name: "New item in folder Mains" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "📂 Folder" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New folder name" }), "Pasta");
    await userEvent.click(screen.getByRole("button", { name: "Confirm new folder" }));
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "More actions for recipe Lasagne" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "🖊️ Edit" }));
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${latestVersionId}`);
    // Recipe must still be visible — Edit does not delete or clear it
    expect(screen.getByText("Lasagne")).toBeInTheDocument();
  });

  it("Edit a specific version navigates to that version and keeps recipe in list", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Risotto" });
    const version = recipe.versions[0];
    setup();
    await userEvent.click(
      screen.getByRole("button", {
        name: `More actions for version ${version?.description || "Untitled version"}`,
      }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "🖊️ Edit" }));
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}/v/${version?.id}`);
    // Recipe row must still be present — version edit does not mutate the list
    expect(screen.getByText("Risotto")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

describe("BulkRecipeEditorPage — start session", () => {
  it("recipe row Start creates a session for the latest version and navigates to it", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Risotto" });
    setup();
    await flushAsyncEffects();

    await userEvent.click(screen.getByRole("button", { name: "Start session for Risotto" }));

    const sessions = getSessions(recipeBookDoc);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.recipe_id).toBe(recipe.id);
    expect(sessions[0]?.recipe_version_id).toBe(recipe.versions.at(-1)?.id);
    expect(mockNavigate).toHaveBeenCalledWith(`/sessions/${sessions[0]?.id}`);
  });

  it("version row Start creates a session for that specific version", async () => {
    const recipe = createRecipe(recipeBookDoc, { title: "Risotto" });
    const version = recipe.versions[0];
    setup();
    await flushAsyncEffects();

    await userEvent.click(
      screen.getByRole("button", {
        name: `Start session for version ${version?.description || "Untitled version"}`,
      }),
    );

    const sessions = getSessions(recipeBookDoc);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.recipe_version_id).toBe(version?.id);
    expect(mockNavigate).toHaveBeenCalledWith(`/sessions/${sessions[0]?.id}`);
  });
});
