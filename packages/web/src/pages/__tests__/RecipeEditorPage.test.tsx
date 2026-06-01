import { IngredientId, RecipeFolderId, createRecipe, createRecipeFolder, paddedId } from "@recipe-book/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { IngredientSelectorProps } from "../../components/ingredients_table/IngredientSelector.tsx";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../contexts/docContext.ts";
import { RecipeEditor } from "../RecipeEditorPage.tsx";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
------flour,ingredient,Flour,volume,dry
`;

// Mock IngredientSelector so PrimeReact's TreeSelect doesn't run in jsdom.
vi.mock("../../components/ingredients_table/IngredientSelector.tsx", () => ({
  IngredientSelector: ({
    value,
    options,
    onChange,
    ariaLabel,
    placeholder,
  }: IngredientSelectorProps) => (
    <select
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? (v as IngredientId) : undefined);
      }}
    >
      <option value="">{placeholder ?? "— None —"}</option>
      {options.map((ing) => (
        <option key={ing.id} value={ing.id}>
          {ing.name}
        </option>
      ))}
    </select>
  ),
}));

function makeWrapper(kitchenwareDoc: Y.Doc, recipeBookDoc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      KitchenwareDocContext.Provider,
      { value: { doc: kitchenwareDoc, whenSynced: Promise.resolve() } },
      createElement(
        RecipeBookDocContext.Provider,
        { value: { doc: recipeBookDoc, whenSynced: Promise.resolve() } },
        children,
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setupNewRecipeEditor() {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<RecipeEditor recipe={null} onSave={onSave} onCancel={onCancel} />, {
    wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc),
  });
  return { onSave, onCancel };
}

function setupExistingRecipeEditor(title: string) {
  const recipe = createRecipe(recipeBookDoc, { title });
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<RecipeEditor recipe={recipe} onSave={onSave} onCancel={onCancel} />, {
    wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc),
  });
  return { recipe, onSave, onCancel };
}

describe("RecipeEditor — new recipe form", () => {
  it("shows the New Recipe heading", () => {
    setupNewRecipeEditor();
    expect(screen.getByRole("heading", { name: "New Recipe" })).toBeInTheDocument();
  });

  it("shows all required fields", () => {
    setupNewRecipeEditor();
    expect(screen.getByRole("textbox", { name: "Recipe title" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Recipe subtitle" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source URL" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Version description" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Parent folder" })).toBeInTheDocument();
  });

  it("Save button is disabled when title is empty", () => {
    setupNewRecipeEditor();
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled();
  });

  it("Save button is enabled when title is filled in", async () => {
    setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    expect(screen.getByRole("button", { name: "Save recipe" })).not.toBeDisabled();
  });

  it("calls onSave after saving", async () => {
    const { onSave } = setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const { onCancel } = setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when ← Back is clicked", async () => {
    const { onCancel } = setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Back to recipe list" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("RecipeEditor — initialFolderId", () => {
  it("gracefully degrades to no folder when initialFolderId references a non-existent folder", () => {
    const ghostId = paddedId(RecipeFolderId, "ghost");
    render(
      <RecipeEditor recipe={null} initialFolderId={ghostId} onSave={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc) },
    );
    const select = screen.getByRole("combobox", { name: "Parent folder" }) as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("pre-selects the folder when initialFolderId is provided", () => {
    const folder = createRecipeFolder(recipeBookDoc, "Desserts");
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <RecipeEditor
        recipe={null}
        initialFolderId={folder.id}
        onSave={onSave}
        onCancel={onCancel}
      />,
      {
        wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc),
      },
    );
    const select = screen.getByRole("combobox", { name: "Parent folder" }) as HTMLSelectElement;
    expect(select.value).toBe(folder.id);
  });
});

describe("RecipeEditor — editing existing recipe", () => {
  it("shows the edit heading with recipe title", () => {
    setupExistingRecipeEditor("Banana Bread");
    expect(screen.getByRole("heading", { name: "Edit: Banana Bread" })).toBeInTheDocument();
  });

  it("shows version history for existing recipe", () => {
    setupExistingRecipeEditor("Banana Bread");
    expect(screen.getByText(/Version history/i)).toBeInTheDocument();
  });

  it("shows the 'Create a new version' checkbox when editing", () => {
    setupExistingRecipeEditor("Banana Bread");
    expect(
      screen.getByRole("checkbox", { name: "Create a new version from changes" }),
    ).toBeInTheDocument();
  });

  it("shows Copy recipe button when editing", () => {
    setupExistingRecipeEditor("Banana Bread");
    expect(screen.getByRole("button", { name: "Copy recipe" })).toBeInTheDocument();
  });
});

describe("RecipeEditor — ingredients section", () => {
  it("shows the Ingredients section", () => {
    setupNewRecipeEditor();
    expect(screen.getByRole("region", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("shows empty state message when no sections have ingredients", () => {
    setupNewRecipeEditor();
    expect(
      screen.getByText(/Add ingredients to sections to see them listed here/i),
    ).toBeInTheDocument();
  });

  it("shows computed ingredient totals after adding an ingredient to a section", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));

    const newIngredientGroup = screen.getByRole("group", { name: "New ingredient" });
    const selector = within(newIngredientGroup).getByRole("combobox", {
      name: "Select new ingredient",
    });
    await userEvent.selectOptions(selector, paddedId(IngredientId, "------butter"));

    await userEvent.click(
      within(newIngredientGroup).getByRole("button", { name: /Add Butter to section/i }),
    );

    const ingredientsSection = screen.getByRole("region", { name: "Ingredients" });
    expect(within(ingredientsSection).getByText("Butter")).toBeInTheDocument();
  });
});

describe("RecipeEditor — sections editor", () => {
  it("shows the Instructions section", () => {
    setupNewRecipeEditor();
    expect(screen.getByRole("region", { name: "Instructions" })).toBeInTheDocument();
  });

  it("shows Add section button", () => {
    setupNewRecipeEditor();
    expect(screen.getByRole("button", { name: "Add section" })).toBeInTheDocument();
  });

  it("adds a section when Add section is clicked", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    expect(screen.getByRole("group", { name: /Section:/ })).toBeInTheDocument();
  });

  it("shows IngredientSelector draft row when Add ingredient is clicked", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));
    expect(screen.getByRole("group", { name: "New ingredient" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Select new ingredient" })).toBeInTheDocument();
  });

  it("Add button in draft row is disabled until an ingredient is selected", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));
    expect(screen.getByRole("button", { name: "Confirm add ingredient" })).toBeDisabled();
  });

  it("can add an ingredient to a section via the selector", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));

    const newIngredientGroup = screen.getByRole("group", { name: "New ingredient" });
    await userEvent.selectOptions(
      within(newIngredientGroup).getByRole("combobox", { name: "Select new ingredient" }),
      paddedId(IngredientId, "------butter"),
    );
    await userEvent.click(
      within(newIngredientGroup).getByRole("button", { name: /Add Butter to section/i }),
    );

    expect(screen.getByRole("group", { name: /Ingredient: Butter/i })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "New ingredient" })).not.toBeInTheDocument();
  });

  it("can cancel adding a new ingredient", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));
    expect(screen.getByRole("group", { name: "New ingredient" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel adding ingredient" }));
    expect(screen.queryByRole("group", { name: "New ingredient" })).not.toBeInTheDocument();
  });

  it("double-clicking an ingredient label opens the IngredientSelector", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));

    const newIngredientGroup = screen.getByRole("group", { name: "New ingredient" });
    await userEvent.selectOptions(
      within(newIngredientGroup).getByRole("combobox", { name: "Select new ingredient" }),
      paddedId(IngredientId, "------butter"),
    );
    await userEvent.click(within(newIngredientGroup).getByRole("button", { name: /Add Butter/i }));

    const ingredientGroup = screen.getByRole("group", { name: /Ingredient: Butter/i });
    await userEvent.dblClick(within(ingredientGroup).getByText("Butter"));

    expect(
      within(ingredientGroup).getByRole("combobox", { name: /Change ingredient/i }),
    ).toBeInTheDocument();
  });

  it("can add an instruction to a section", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));
    expect(screen.getByRole("textbox", { name: "Instruction text" })).toBeInTheDocument();
  });

  it("can add a text block to a section", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add text block to section" }));
    expect(screen.getByRole("textbox", { name: "Text block content" })).toBeInTheDocument();
  });

  it("can remove a section", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove section" }));
    expect(screen.queryByRole("group", { name: /Section:/ })).not.toBeInTheDocument();
  });

  it("does not show notes panel anywhere in the editor", () => {
    setupNewRecipeEditor();
    expect(screen.queryByRole("complementary", { name: "Notes" })).not.toBeInTheDocument();
  });
});

describe("RecipeEditor — copy recipe", () => {
  it("opens the copy dialog when Copy recipe is clicked", async () => {
    setupExistingRecipeEditor("Soup");
    await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
    expect(screen.getByRole("dialog", { name: "Copy recipe" })).toBeInTheDocument();
  });

  it("copy dialog pre-fills the title", async () => {
    setupExistingRecipeEditor("Soup");
    await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
    const dialog = screen.getByRole("dialog", { name: "Copy recipe" });
    expect(within(dialog).getByRole("textbox", { name: "New recipe title" })).toHaveValue(
      "Soup (copy)",
    );
  });

  it("cancel closes the copy dialog", async () => {
    setupExistingRecipeEditor("Soup");
    await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
    const dialog = screen.getByRole("dialog", { name: "Copy recipe" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Copy recipe" })).not.toBeInTheDocument();
  });
});
