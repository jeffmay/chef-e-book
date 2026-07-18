import type { Measurement, Recipe, RecipeVersion, Session } from "@recipe-book/shared";
import {
  assertNotValidationError,
  collectIngredientItems,
  collectInstructions,
  completeSession,
  ContainerId,
  createRecipe,
  createSession,
  fixedId,
  getRecipe,
  getRecipes,
  IngredientId,
  loadId,
  RecipeVersionId,
  saveRecipe,
  SectionItemId,
  updateSessionItemState,
} from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNode } from "primereact/treenode";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { IngredientSelectorProps } from "../../components/ingredients_table/IngredientSelector.tsx";
import type { InstructionIngredientSelectorProps } from "../../components/recipe_editor/InstructionIngredientSelector.tsx";
import { KitchenwareDocContext, RecipeBookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { RecipeSessionPage } from "../RecipeSessionPage.tsx";

const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
-------flour,ingredient,Flour,volume,dry
`;

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as object), useNavigate: () => mockNavigate };
});

// The summary view renders the full RecipeVersionEditor; mock its PrimeReact
// TreeSelect-based selectors so they render in jsdom (same pattern as the
// RecipeEditorPage tests).
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

vi.mock("../../components/recipe_editor/InstructionIngredientSelector.tsx", () => ({
  InstructionIngredientSelector: ({ nodes }: InstructionIngredientSelectorProps) => (
    <div role="group" aria-label="Instruction ingredients" data-node-count={nodes.length} />
  ),
}));

// Referenced by the mock above so the unused-variable lint rule keeps the
// TreeNode import (the mock factory only uses its type).
void ({} as TreeNode | undefined);

const BUTTER = fixedId(IngredientId, "butter");
const FLOUR = fixedId(IngredientId, "flour");
const BOWL = fixedId(ContainerId, "bowl");

const ITEM_BUTTER = fixedId(SectionItemId, "item-butter");
const ITEM_FLOUR = fixedId(SectionItemId, "item-flour");
const ITEM_MIX = fixedId(SectionItemId, "item-mix");
const ALL_ITEM_IDS = [ITEM_BUTTER, ITEM_FLOUR, ITEM_MIX];

const ONE_CUP: Measurement = { value: { numerator: 1, denominator: 1 }, unit: "cup" };
const TWO_CUPS: Measurement = { value: { numerator: 2, denominator: 1 }, unit: "cup" };

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
  mockNavigate.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Seeds a recipe whose only version has:
 * - Butter (1 cup) at the section top level
 * - Flour (2 cups) inside a Bowl container
 * - a 10-minute "Mix well" instruction
 * - a text block
 * With the default 120s per ingredient: minimum = 600 + 2×120 = 840 seconds.
 */
function seedRecipe(versionOverrides: Partial<RecipeVersion> = {}): {
  recipe: Recipe;
  version: RecipeVersion;
} {
  const created = createRecipe(recipeBookDoc, { title: "Pancakes", description: "v1" });
  const version: RecipeVersion = {
    id: fixedId(RecipeVersionId, "v-1"),
    recipe_id: created.id,
    description: "Test version",
    ingredients: [],
    sections: [
      {
        kind: "section",
        id: fixedId(SectionItemId, "s-main"),
        header: "Main",
        contents: [
          { kind: "ingredient", id: ITEM_BUTTER, ingredient_id: BUTTER, customAmount: ONE_CUP },
          {
            kind: "container",
            id: fixedId(SectionItemId, "c-bowl"),
            container_id: BOWL,
            descriptor: "large",
            contents: [
              { kind: "ingredient", id: ITEM_FLOUR, ingredient_id: FLOUR, customAmount: TWO_CUPS },
            ],
          },
          {
            kind: "instruction",
            id: ITEM_MIX,
            instruction: "Mix well",
            duration_seconds: 600,
          },
          { kind: "text_block", id: fixedId(SectionItemId, "t-rest"), text: "Let rest" },
        ],
      },
    ],
    created_at: Date.now(),
    ...versionOverrides,
  };
  saveRecipe(recipeBookDoc, created.id, {
    title: created.title,
    version,
    create_new_version: false,
  });
  const saved = getRecipe(recipeBookDoc, created.id);
  assertNotValidationError(saved);
  return { recipe: saved, version };
}

function seedSession(): { recipe: Recipe; version: RecipeVersion; session: Session } {
  const { recipe, version } = seedRecipe();
  const session = createSession(recipeBookDoc, recipe.id, version.id);
  return { recipe, version, session };
}

async function setup(sessionId: string) {
  const view = render(<RecipeSessionPage sessionId={sessionId} />, {
    wrapper: makeWrapper(kitchenwareDoc, recipeBookDoc),
  });
  await flushAsyncEffects();
  return view;
}

function progressValue(): string | null {
  return screen.getByRole("progressbar").getAttribute("aria-valuenow");
}

// ---------------------------------------------------------------------------
// Run view
// ---------------------------------------------------------------------------

describe("RecipeSessionPage — run view", () => {
  it("renders the recipe, all checkable items, container, and text block", async () => {
    const { session } = seedSession();
    await setup(session.id);

    expect(screen.getByRole("heading", { name: "Pancakes" })).toBeInTheDocument();
    expect(screen.getByText("Test version")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Butter done" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Flour done" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Mix well done" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Container: Bowl — large" })).toBeInTheDocument();
    expect(screen.getByText("Let rest")).toBeInTheDocument();
  });

  it("starts at 0% and advances by the ingredient's share when checked", async () => {
    const { session } = seedSession();
    const user = userEvent.setup();
    await setup(session.id);

    expect(progressValue()).toBe("0");
    await user.click(screen.getByRole("checkbox", { name: "Mark Butter done" }));
    // 120 / 840 ≈ 14%
    expect(progressValue()).toBe("14");
  });

  it("advances by the instruction's duration share when skipped, and reverts on unskip", async () => {
    const { session } = seedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("button", { name: "Skip Mix well" }));
    // 600 / 840 ≈ 71%
    expect(progressValue()).toBe("71");
    expect(screen.getByText("skipped")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unskip Mix well" }));
    expect(progressValue()).toBe("0");
  });

  it("disables the checkbox while skipped and the skip button while checked", async () => {
    const { session } = seedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("checkbox", { name: "Mark Butter done" }));
    expect(screen.getByRole("button", { name: "Skip Butter" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Skip Flour" }));
    expect(screen.getByRole("checkbox", { name: "Mark Flour done" })).toBeDisabled();
  });

  it("completes the session and shows the summary editor with untouched items skipped", async () => {
    const { session } = seedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("checkbox", { name: "Mark Butter done" }));
    await user.click(screen.getByRole("button", { name: "Complete session" }));

    expect(screen.getByRole("heading", { name: "Session complete" })).toBeInTheDocument();
    // Flour and the instruction were auto-skipped; Butter was completed.
    expect(screen.getByRole("button", { name: "Restore Flour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore Mix well" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore Butter" })).not.toBeInTheDocument();
  });

  it("shows a not-found message for an unknown session", async () => {
    seedSession();
    await setup("nonexistent-session");
    expect(screen.getByText("Session not found.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Summary view
// ---------------------------------------------------------------------------

describe("RecipeSessionPage — summary view", () => {
  /** Completes the session with the given items checked; the rest are auto-skipped. */
  function seedCompletedSession(checkedIds: readonly string[] = [ITEM_BUTTER]) {
    const seeded = seedSession();
    for (const id of checkedIds) {
      updateSessionItemState(recipeBookDoc, seeded.session.id, id, { checked: true });
    }
    completeSession(recipeBookDoc, seeded.session.id, ALL_ITEM_IDS);
    return seeded;
  }

  it("shows the full version editor with skipped items decorated in place", async () => {
    const { session } = seedCompletedSession();
    await setup(session.id);

    expect(screen.getByRole("heading", { name: "Instructions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
    // Skipped rows carry a "skipped" tag and Restore/Dismiss actions.
    expect(screen.getAllByText("skipped")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Restore Flour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss Flour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore Mix well" })).toBeInTheDocument();
    // Completed items keep the normal remove button.
    expect(screen.getByRole("button", { name: "Remove ingredient Butter" })).toBeInTheDocument();
  });

  it("bounds the estimated time slider at the minimum of the kept items", async () => {
    const { session } = seedCompletedSession();
    await setup(session.id);

    // Kept items: Butter only → minimum = 1 × 120s.
    const slider = screen.getByRole("slider", { name: "Estimated total time" });
    expect(slider).toHaveAttribute("min", "120");
    // The stored estimate defaults to the full version's minimum (840s).
    expect(slider).toHaveValue("840");
  });

  it("restoring a skipped item raises the slider minimum again", async () => {
    const { session } = seedCompletedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("button", { name: "Restore Mix well" }));
    // Kept: Butter (120s) + Mix well (600s) → 720s.
    expect(screen.getByRole("slider", { name: "Estimated total time" })).toHaveAttribute(
      "min",
      "720",
    );
    expect(screen.queryByRole("button", { name: "Restore Mix well" })).not.toBeInTheDocument();
  });

  it("requires a description before creating a new version", async () => {
    const { session } = seedCompletedSession();
    await setup(session.id);

    expect(screen.getByRole("button", { name: "Create a new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create a new recipe" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/description is required/i);
  });

  it("creates a new version keeping restored items and dropping still-skipped ones", async () => {
    const { recipe, session } = seedCompletedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("button", { name: "Restore Flour" }));
    await user.type(screen.getByRole("textbox", { name: "Version description" }), "After session");
    await user.click(screen.getByRole("button", { name: "Create a new version" }));

    const updated = getRecipe(recipeBookDoc, recipe.id);
    assertNotValidationError(updated);
    expect(updated.versions).toHaveLength(2);
    const latest = updated.versions.at(-1);
    expect(latest?.description).toBe("After session");
    // Butter was completed and Flour restored; the skipped instruction is dropped.
    const ingredientIds = collectIngredientItems(latest?.sections ?? []).map(
      (i) => i.ingredient_id,
    );
    expect(ingredientIds).toEqual([BUTTER, FLOUR]);
    expect(collectInstructions(latest?.sections ?? [])).toHaveLength(0);
    expect(latest?.seconds_per_ingredient).toBe(120);
    expect(latest?.estimated_time_seconds).toBe(840);
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}`);
  });

  it("dismissing a skipped row removes it from the editor view", async () => {
    const { session } = seedCompletedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("button", { name: "Dismiss Mix well" }));
    expect(screen.queryByRole("group", { name: "Instruction: Mix well" })).not.toBeInTheDocument();
  });

  it("supports adding a new section before saving", async () => {
    const { session } = seedCompletedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("button", { name: "Add section" }));
    expect(screen.getAllByRole("group", { name: /^Section:/ }).length).toBeGreaterThanOrEqual(2);
  });

  it("creates a new recipe with an initial version from the session", async () => {
    const { recipe, session } = seedCompletedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.type(screen.getByRole("textbox", { name: "Version description" }), "Fork it");
    await user.click(screen.getByRole("button", { name: "Create a new recipe" }));

    const all = getRecipes(recipeBookDoc);
    expect(all).toHaveLength(2);
    const copy = all.find((r) => r.title === "Pancakes (copy)");
    expect(copy).toBeDefined();
    expect(copy?.versions).toHaveLength(1);
    expect(copy?.versions[0]?.description).toBe("Fork it");
    // Only the completed Butter item survives; skipped items are dropped.
    expect(
      collectIngredientItems(copy?.versions[0]?.sections ?? []).map((i) => i.ingredient_id),
    ).toEqual([BUTTER]);
    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${copy?.id}`);
    // the original recipe is untouched
    const afterCreate = getRecipe(recipeBookDoc, recipe.id);
    assertNotValidationError(afterCreate);
    expect(afterCreate.versions).toHaveLength(1);
  });

  it("discards without creating anything", async () => {
    const { recipe, session } = seedCompletedSession();
    const user = userEvent.setup();
    await setup(session.id);

    await user.click(screen.getByRole("button", { name: "Discard recipe version" }));

    expect(mockNavigate).toHaveBeenCalledWith("/recipes");
    const afterDiscard = getRecipe(recipeBookDoc, recipe.id);
    assertNotValidationError(afterDiscard);
    expect(afterDiscard.versions).toHaveLength(1);
    expect(getRecipes(recipeBookDoc)).toHaveLength(1);
  });

  it("defaults the per-ingredient time to the version's own config", async () => {
    const { recipe, version } = seedRecipe();
    saveRecipe(recipeBookDoc, recipe.id, {
      title: recipe.title,
      version: { ...version, seconds_per_ingredient: 60 },
      create_new_version: false,
    });
    const session = createSession(recipeBookDoc, recipe.id, version.id);
    for (const id of ALL_ITEM_IDS) {
      updateSessionItemState(recipeBookDoc, session.id, id, { checked: true });
    }
    completeSession(recipeBookDoc, session.id, ALL_ITEM_IDS);
    await setup(session.id);

    // Everything completed → 60s per ingredient → minimum = 600 + 2×60 = 720.
    const slider = screen.getByRole("slider", { name: "Estimated total time" });
    expect(slider).toHaveAttribute("min", "720");
    expect(screen.getByText("1 minute")).toBeInTheDocument();
  });
});
