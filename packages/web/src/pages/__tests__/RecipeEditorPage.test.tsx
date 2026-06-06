import type { Ingredient } from "@recipe-book/shared";
import {
  ContainerId,
  createRecipe,
  createRecipeFolder,
  IngredientId,
  paddedId,
  randomId,
  RecipeFolderId,
  SectionItemId,
} from "@recipe-book/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { IngredientSelectorProps } from "../../components/ingredients_table/IngredientSelector.tsx";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../contexts/docContext.ts";
import {
  computeTopIngredients,
  isSameMeasurementCategory,
  RecipeEditor,
  resolveAmountOnIngredientChange,
} from "../RecipeEditorPage.tsx";

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

// ---------------------------------------------------------------------------
// Pure helper unit tests
// ---------------------------------------------------------------------------

describe("isSameMeasurementCategory", () => {
  it("returns true for two volume units", () => {
    expect(isSameMeasurementCategory("cup", "tsp")).toBe(true);
  });

  it("returns true for two weight units", () => {
    expect(isSameMeasurementCategory("oz", "lb")).toBe(true);
  });

  it("returns false for volume vs weight", () => {
    expect(isSameMeasurementCategory("cup", "oz")).toBe(false);
  });

  it("returns true for identical count units", () => {
    expect(isSameMeasurementCategory("whole", "whole")).toBe(true);
  });

  it("returns false for different count units (each count unit is its own category)", () => {
    expect(isSameMeasurementCategory("whole", "pinch")).toBe(false);
  });

  it("returns false for count vs volume", () => {
    expect(isSameMeasurementCategory("whole", "cup")).toBe(false);
  });
});

describe("resolveAmountOnIngredientChange", () => {
  const DAIRY: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "dairy"),
    name: "Dairy",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  };
  const SKIM_MILK: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "skim-milk"),
    name: "Skim Milk",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
    parent_id: paddedId(IngredientId, "dairy"),
  };
  // child of Dairy but different measurement type
  const BUTTER: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "butter"),
    name: "Butter",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "oz" },
    labels: new Set(),
    parent_id: paddedId(IngredientId, "dairy"),
  };
  // unrelated ingredient
  const FLOUR: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "flour"),
    name: "Flour",
    default_measurement_value: { value: { numerator: 2, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  };
  // count-unit parent and child
  const EGGS: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "eggs"),
    name: "Eggs",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "whole" },
    labels: new Set(),
  };
  const LARGE_EGGS: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "large-eggs"),
    name: "Large Eggs",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "whole" },
    labels: new Set(),
    parent_id: paddedId(IngredientId, "eggs"),
  };
  const PINCH_SALT: Ingredient = {
    kind: "ingredient",
    id: paddedId(IngredientId, "pinch-salt"),
    name: "Salt (pinch)",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "pinch" },
    labels: new Set(),
    parent_id: paddedId(IngredientId, "eggs"),
  };

  const allIngredients = [DAIRY, SKIM_MILK, BUTTER, FLOUR, EGGS, LARGE_EGGS, PINCH_SALT];
  const currentAmount = { value: { numerator: 3, denominator: 2 }, unit: "cup" as const };

  it("preserves current amount when switching to a child ingredient with same measurement type", () => {
    expect(
      resolveAmountOnIngredientChange(DAIRY.id, SKIM_MILK.id, currentAmount, allIngredients),
    ).toEqual(currentAmount);
  });

  it("resets to default when switching to a child ingredient with a different measurement type", () => {
    expect(
      resolveAmountOnIngredientChange(DAIRY.id, BUTTER.id, currentAmount, allIngredients),
    ).toEqual(BUTTER.default_measurement_value);
  });

  it("resets to default when switching to an unrelated (non-child) ingredient", () => {
    expect(
      resolveAmountOnIngredientChange(DAIRY.id, FLOUR.id, currentAmount, allIngredients),
    ).toEqual(FLOUR.default_measurement_value);
  });

  it("resets to default when there is no previous ingredient", () => {
    expect(
      resolveAmountOnIngredientChange(undefined, FLOUR.id, currentAmount, allIngredients),
    ).toEqual(FLOUR.default_measurement_value);
  });

  it("preserves current amount when switching to a child with the exact same count unit", () => {
    const eggAmount = { value: { numerator: 3, denominator: 1 }, unit: "whole" as const };
    expect(
      resolveAmountOnIngredientChange(EGGS.id, LARGE_EGGS.id, eggAmount, allIngredients),
    ).toEqual(eggAmount);
  });

  it("resets to default when switching to a child with a different count unit", () => {
    const eggAmount = { value: { numerator: 3, denominator: 1 }, unit: "whole" as const };
    expect(
      resolveAmountOnIngredientChange(EGGS.id, PINCH_SALT.id, eggAmount, allIngredients),
    ).toEqual(PINCH_SALT.default_measurement_value);
  });

  it("resets to new ingredient's default when current amount is undefined (no prior amount set)", () => {
    expect(
      resolveAmountOnIngredientChange(DAIRY.id, SKIM_MILK.id, undefined, allIngredients),
    ).toEqual(SKIM_MILK.default_measurement_value);
  });
});

describe("computeTopIngredients", () => {
  const BUTTER_ID = paddedId(IngredientId, "------butter");
  const FLOUR_ID = paddedId(IngredientId, "-------flour");
  const BOWL_ID = paddedId(ContainerId, "--------bowl");

  it("creates one entry per unique ingredient, using the first occurrence's amount", () => {
    const sections = [
      {
        kind: "section" as const,
        id: randomId(SectionItemId),
        contents: [
          {
            kind: "ingredient" as const,
            id: randomId(SectionItemId),
            ingredient_id: BUTTER_ID,
            amount: { value: { numerator: 2, denominator: 1 }, unit: "cup" as const },
          },
          {
            kind: "ingredient" as const,
            id: randomId(SectionItemId),
            ingredient_id: BUTTER_ID,
            amount: { value: { numerator: 1, denominator: 1 }, unit: "tsp" as const },
          },
          {
            kind: "ingredient" as const,
            id: randomId(SectionItemId),
            ingredient_id: FLOUR_ID,
          },
        ],
      },
    ];
    const result = computeTopIngredients(sections);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.ingredient_id === BUTTER_ID)?.amount).toEqual({
      value: { numerator: 2, denominator: 1 },
      unit: "cup",
    });
    expect(result.find((r) => r.ingredient_id === FLOUR_ID)?.amount).toBeUndefined();
  });

  it("includes ingredients from container contents and nested sections", () => {
    const sections = [
      {
        kind: "section" as const,
        id: randomId(SectionItemId),
        contents: [
          {
            kind: "container" as const,
            id: randomId(SectionItemId),
            container_id: BOWL_ID,
            descriptor: "mixing",
            contents: [
              {
                kind: "ingredient" as const,
                id: randomId(SectionItemId),
                ingredient_id: BUTTER_ID,
                amount: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
              },
            ],
          },
          {
            kind: "section" as const,
            id: randomId(SectionItemId),
            contents: [
              {
                kind: "ingredient" as const,
                id: randomId(SectionItemId),
                ingredient_id: FLOUR_ID,
                amount: { value: { numerator: 2, denominator: 1 }, unit: "cup" as const },
              },
            ],
          },
        ],
      },
    ];
    const result = computeTopIngredients(sections);
    expect(result).toHaveLength(2);
    expect(result.some((r) => r.ingredient_id === BUTTER_ID)).toBe(true);
    expect(result.some((r) => r.ingredient_id === FLOUR_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Component tests
// ---------------------------------------------------------------------------

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

  it("Save button is still disabled when title is filled but description is empty", async () => {
    setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled();
  });

  it("shows a description error when description is empty", async () => {
    setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    expect(screen.getByRole("alert")).toHaveTextContent("Version description is required");
  });

  it("Save button is enabled when title and description are filled", async () => {
    setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    await userEvent.type(screen.getByRole("textbox", { name: "Version description" }), "First try");
    expect(screen.getByRole("button", { name: "Save recipe" })).not.toBeDisabled();
  });

  it("calls onSave after filling title and description then saving", async () => {
    const { onSave } = setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Chocolate Cake");
    await userEvent.type(screen.getByRole("textbox", { name: "Version description" }), "First try");
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

describe("RecipeEditor — description validation", () => {
  it("shows a description required error alert when the description is empty", () => {
    setupExistingRecipeEditor("Banana Bread");
    expect(screen.getByRole("alert")).toHaveTextContent("Version description is required");
  });

  it("hides the description error when a description is typed", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Version description" }),
      "Initial version",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables Save when the description is empty", () => {
    setupExistingRecipeEditor("Banana Bread");
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled();
  });

  it("enables Save once description is filled", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Version description" }),
      "Initial version",
    );
    expect(screen.getByRole("button", { name: "Save recipe" })).not.toBeDisabled();
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

  it("does not show the Create new version checkbox for a new recipe", () => {
    setupNewRecipeEditor();
    expect(
      screen.queryByRole("checkbox", { name: "Create a new version from changes" }),
    ).not.toBeInTheDocument();
  });

  it("can toggle an ingredient checkbox in an instruction row", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));

    const butterCheckbox = await screen.findByRole("checkbox", { name: "Butter" });
    expect(butterCheckbox).not.toBeChecked();

    await userEvent.click(butterCheckbox);
    expect(butterCheckbox).toBeChecked();

    await userEvent.click(butterCheckbox);
    expect(butterCheckbox).not.toBeChecked();
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
