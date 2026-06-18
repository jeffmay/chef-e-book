import type { Ingredient, Measurement, RecipeFolder, Section } from "@recipe-book/shared";
import {
  ContainerId,
  createRecipe,
  createRecipeFolder,
  IngredientId,
  loadId,
  fixedId,
  randomId,
  RecipeFolderId,
  SectionItemId,
} from "@recipe-book/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNode } from "primereact/treenode";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { IngredientSelectorProps } from "../../components/ingredients_table/IngredientSelector.tsx";
import type { InstructionIngredientSelectorProps } from "../../components/recipe_editor/InstructionIngredientSelector.tsx";
import type { RecipeFolderSelectorProps } from "../../components/recipe_folder/RecipeFolderSelector.tsx";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
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
        onChange(v ? loadId(IngredientId, v) : undefined);
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

// Mock RecipeFolderSelector down to a plain <select> so the editor's folder
// field is a queryable combobox without PrimeReact's TreeSelect.
vi.mock("../../components/recipe_folder/RecipeFolderSelector.tsx", () => ({
  RecipeFolderSelector: ({ value, folders, onChange, ariaLabel }: RecipeFolderSelectorProps) => {
    const flat: Array<{ id: string; label: string }> = [];
    function collect(fs: readonly RecipeFolder[], depth: number) {
      for (const f of fs) {
        flat.push({ id: f.id, label: "  ".repeat(depth) + f.name });
        if (f.children) collect(f.children, depth + 1);
      }
    }
    collect(folders, 0);
    return (
      <select
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value ? loadId(RecipeFolderId, e.target.value) : undefined)
        }
      >
        <option value="">— None —</option>
        {flat.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    );
  },
}));

// Mock InstructionIngredientSelector to a flat list of checkboxes for each leaf
// (ingredient) node, so instruction ingredient selection is testable in jsdom.
vi.mock("../../components/recipe_editor/InstructionIngredientSelector.tsx", () => ({
  InstructionIngredientSelector: ({
    nodes,
    selectedIds,
    onChange,
  }: InstructionIngredientSelectorProps) => {
    const leaves: Array<{ id: IngredientId; label: string }> = [];
    function collect(ns: TreeNode[]) {
      for (const n of ns) {
        const children = n.children;
        if (children && children.length > 0) {
          collect(children);
          continue;
        }
        const data: unknown = n.data;
        if (typeof data === "object" && data !== null && "ingredient_id" in data) {
          const raw = Reflect.get(data, "ingredient_id");
          if (typeof raw === "string") {
            leaves.push({ id: loadId(IngredientId, raw), label: String(n.label ?? "") });
          }
        }
      }
    }
    collect(nodes);
    return (
      <div role="group" aria-label="Instruction ingredients">
        {leaves.map((leaf) => {
          const checked = selectedIds.includes(leaf.id);
          return (
            <label key={leaf.id}>
              <input
                type="checkbox"
                aria-label={leaf.label}
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== leaf.id)
                      : [...selectedIds, leaf.id],
                  )
                }
              />
              {leaf.label}
            </label>
          );
        })}
      </div>
    );
  },
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
    id: fixedId(IngredientId, "dairy"),
    name: "Dairy",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  };
  const SKIM_MILK: Ingredient = {
    kind: "ingredient",
    id: fixedId(IngredientId, "skim-milk"),
    name: "Skim Milk",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: new Set(),
    parent_id: fixedId(IngredientId, "dairy"),
  };
  // child of Dairy but different measurement type
  const BUTTER: Ingredient = {
    kind: "ingredient",
    id: fixedId(IngredientId, "butter"),
    name: "Butter",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "oz" },
    labels: new Set(),
    parent_id: fixedId(IngredientId, "dairy"),
  };
  // unrelated ingredient
  const FLOUR: Ingredient = {
    kind: "ingredient",
    id: fixedId(IngredientId, "flour"),
    name: "Flour",
    default_measurement_value: { value: { numerator: 2, denominator: 1 }, unit: "cup" },
    labels: new Set(),
  };
  // count-unit parent and child
  const EGGS: Ingredient = {
    kind: "ingredient",
    id: fixedId(IngredientId, "eggs"),
    name: "Eggs",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "whole" },
    labels: new Set(),
  };
  const LARGE_EGGS: Ingredient = {
    kind: "ingredient",
    id: fixedId(IngredientId, "large-eggs"),
    name: "Large Eggs",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "whole" },
    labels: new Set(),
    parent_id: fixedId(IngredientId, "eggs"),
  };
  const PINCH_SALT: Ingredient = {
    kind: "ingredient",
    id: fixedId(IngredientId, "pinch-salt"),
    name: "Salt (pinch)",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "pinch" },
    labels: new Set(),
    parent_id: fixedId(IngredientId, "eggs"),
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
  const BUTTER_ID = fixedId(IngredientId, "butter");
  const FLOUR_ID = fixedId(IngredientId, "flour");
  const BOWL_ID = fixedId(ContainerId, "bowl");

  const ONE_CUP = {
    value: { numerator: 1, denominator: 1 },
    unit: "cup",
  } as const satisfies Measurement;
  const TWO_CUPS = {
    value: { numerator: 2, denominator: 1 },
    unit: "cup",
  } as const satisfies Measurement;
  const ONE_TSP = {
    value: { numerator: 1, denominator: 1 },
    unit: "tsp",
  } as const satisfies Measurement;

  it("creates one entry per unique ingredient, using the first occurrence's amount", () => {
    const sections = [
      {
        kind: "section",
        id: randomId(SectionItemId),
        contents: [
          {
            kind: "ingredient",
            id: randomId(SectionItemId),
            ingredient_id: BUTTER_ID,
            customAmount: TWO_CUPS,
          },
          {
            kind: "ingredient",
            id: randomId(SectionItemId),
            ingredient_id: BUTTER_ID,
            customAmount: ONE_TSP,
          },
          {
            kind: "ingredient",
            id: randomId(SectionItemId),
            ingredient_id: FLOUR_ID,
          },
        ],
      },
    ] as const satisfies Section[];
    const result = computeTopIngredients(sections);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.ingredient_id === BUTTER_ID)?.amount).toEqual(TWO_CUPS);
    expect(result.find((r) => r.ingredient_id === FLOUR_ID)?.amount).toBeUndefined();
  });

  it("includes ingredients from container contents and nested sections", () => {
    const sections = [
      {
        kind: "section",
        id: randomId(SectionItemId),
        contents: [
          {
            kind: "container",
            id: randomId(SectionItemId),
            container_id: BOWL_ID,
            descriptor: "mixing",
            contents: [
              {
                kind: "ingredient",
                id: randomId(SectionItemId),
                ingredient_id: BUTTER_ID,
                customAmount: ONE_CUP,
              },
            ],
          },
          {
            kind: "section",
            id: randomId(SectionItemId),
            contents: [
              {
                kind: "ingredient",
                id: randomId(SectionItemId),
                ingredient_id: FLOUR_ID,
                customAmount: TWO_CUPS,
              },
            ],
          },
        ],
      },
    ] as const satisfies Section[];
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
  it("shows the New Recipe heading", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
    expect(screen.getByRole("heading", { name: "New Recipe" })).toBeInTheDocument();
  });

  it("shows all required fields", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
    expect(screen.getByRole("textbox", { name: "Recipe title" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Recipe subtitle" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source URL" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Version description" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Parent folder" })).toBeInTheDocument();
  });

  it("Save button is disabled when title is empty", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
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
  it("gracefully degrades to no folder when initialFolderId references a non-existent folder", async () => {
    const ghostId = fixedId(RecipeFolderId, "ghost");
    render(
      <RecipeEditor recipe={null} initialFolderId={ghostId} onSave={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc) },
    );
    await flushAsyncEffects();
    const select = screen.getByRole("combobox", { name: "Parent folder" }) as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("pre-selects the folder when initialFolderId is provided", async () => {
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
    await flushAsyncEffects();
    const select = screen.getByRole("combobox", { name: "Parent folder" }) as HTMLSelectElement;
    expect(select.value).toBe(folder.id);
  });
});

describe("RecipeEditor — editing existing recipe", () => {
  it("shows the edit heading with recipe title", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await flushAsyncEffects();
    expect(screen.getByRole("heading", { name: "Edit: Banana Bread" })).toBeInTheDocument();
  });

  it("shows version history for existing recipe", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await flushAsyncEffects();
    expect(screen.getByText(/Version history/i)).toBeInTheDocument();
  });

  it("shows the 'Create a new version' checkbox when editing", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await flushAsyncEffects();
    expect(
      screen.getByRole("checkbox", { name: "Create a new version from changes" }),
    ).toBeInTheDocument();
  });

  it("shows Copy recipe button when editing", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await flushAsyncEffects();
    expect(screen.getByRole("button", { name: "Copy recipe" })).toBeInTheDocument();
  });
});

describe("RecipeEditor — description validation", () => {
  it("shows a description required error alert when the description is empty", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await flushAsyncEffects();
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

  it("disables Save when the description is empty", async () => {
    setupExistingRecipeEditor("Banana Bread");
    await flushAsyncEffects();
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

describe("RecipeEditor — title validation", () => {
  it("shows a required error when the title is empty", () => {
    setupNewRecipeEditor();
    expect(screen.getByText("Title is required")).toBeInTheDocument();
  });

  it("clears the title error once a title is entered", async () => {
    setupNewRecipeEditor();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe title" }), "Apple Pie");
    expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
  });
});

describe("RecipeEditor — create new version", () => {
  it("clicking Create new version clears the description and focuses its input", async () => {
    setupExistingRecipeEditor("Beef Stew");
    const descInput = screen.getByRole("textbox", { name: "Version description" });
    await userEvent.type(descInput, "Old description");
    expect(descInput).toHaveValue("Old description");

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Create a new version from changes" }),
    );

    expect(descInput).toHaveValue("");
    expect(descInput).toHaveFocus();
  });
});

describe("RecipeEditor — ingredients section", () => {
  it("shows the Ingredients section", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
    expect(screen.getByRole("region", { name: "Ingredients" })).toBeInTheDocument();
  });

  it("shows empty state message when no sections have ingredients", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
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
    await userEvent.selectOptions(selector, fixedId(IngredientId, "------butter"));

    await userEvent.click(
      within(newIngredientGroup).getByRole("button", { name: /Add Butter to section/i }),
    );

    const ingredientsSection = screen.getByRole("region", { name: "Ingredients" });
    expect(within(ingredientsSection).getByText("Butter")).toBeInTheDocument();
  });
});

describe("RecipeEditor — sections editor", () => {
  it("shows the Instructions section", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
    expect(screen.getByRole("region", { name: "Instructions" })).toBeInTheDocument();
  });

  it("shows Add section button", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
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
      fixedId(IngredientId, "------butter"),
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
      fixedId(IngredientId, "------butter"),
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

  it("does not show notes panel anywhere in the editor", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
    expect(screen.queryByRole("complementary", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("does not show the Create new version checkbox for a new recipe", async () => {
    setupNewRecipeEditor();
    await flushAsyncEffects();
    expect(
      screen.queryByRole("checkbox", { name: "Create a new version from changes" }),
    ).not.toBeInTheDocument();
  });

  it("instruction ingredient selector offers only ingredients already in the recipe", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.click(screen.getByRole("button", { name: "Add instruction to section" }));

    // The store has Butter and Flour, but neither is in the recipe yet, so the
    // instruction's ingredient selector offers nothing.
    expect(screen.queryByRole("checkbox", { name: "Butter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Flour" })).not.toBeInTheDocument();
  });

  it("can toggle an instruction ingredient once it has been added to the recipe", async () => {
    setupNewRecipeEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));

    // Add Butter to the section so it becomes available to instructions.
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient to section" }));
    const newIngredientGroup = screen.getByRole("group", { name: "New ingredient" });
    await userEvent.selectOptions(
      within(newIngredientGroup).getByRole("combobox", { name: "Select new ingredient" }),
      fixedId(IngredientId, "------butter"),
    );
    await userEvent.click(
      within(newIngredientGroup).getByRole("button", { name: /Add Butter to section/i }),
    );

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
