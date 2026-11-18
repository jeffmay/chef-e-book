import {
  addIngredient,
  createRecipe,
  ensureBookMeta,
  fixedId,
  IngredientId,
  parseRecipeBookExport,
  RecipeBookId,
  type Ingredient,
} from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookDocContext } from "../../contexts/docContext.ts";

const mockDownload = vi.hoisted(() => vi.fn());
vi.mock("../../utils/downloadTextFile.ts", () => ({ downloadTextFile: mockDownload }));

const { useBookExport } = await import("../useBookExport.ts");

const FLOUR: Ingredient = {
  kind: "ingredient",
  id: fixedId(IngredientId, "flour"),
  name: "Flour",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
  labels: new Set(),
};

let doc: Y.Doc;

beforeEach(() => {
  mockDownload.mockReset();
  doc = new Y.Doc();
  ensureBookMeta(doc, { id: fixedId(RecipeBookId, "book-one"), name: "Family Recipes" });
  addIngredient(doc, FLOUR);
});

function renderExport() {
  return renderHook(() => useBookExport(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        BookDocContext.Provider,
        { value: { doc, whenSynced: Promise.resolve() } },
        children,
      ),
  });
}

/** The file the hook asked to be downloaded: its name, and its text read back as an export. */
function downloaded() {
  const [filename, text] = mockDownload.mock.calls.at(-1) ?? [];
  const parsed = parseRecipeBookExport(String(text));
  if (!parsed.ok) throw new Error(parsed.error);
  return { filename: String(filename), book: parsed.value };
}

describe("useBookExport", () => {
  it("starts with no summary", () => {
    expect(renderExport().result.current.summary).toBeNull();
  });

  it("downloads every ingredient as a JSON file named for the book", () => {
    const { result } = renderExport();
    act(() => result.current.exportIngredientsFile("all"));

    const { filename, book } = downloaded();
    expect(filename).toMatch(/^family-recipes-ingredients-\d{4}-\d{2}-\d{2}\.json$/);
    expect(book.ingredients.map((i) => i.name)).toEqual(["Flour"]);
    expect(book.source_book?.name).toBe("Family Recipes");
  });

  it("downloads only the selected ingredients", () => {
    const { result } = renderExport();
    act(() => result.current.exportIngredientsFile([]));
    expect(downloaded().book.ingredients).toEqual([]);
  });

  it("downloads recipes under a name that says so", () => {
    const recipe = createRecipe(doc, { title: "Pie", description: "v1" });
    const { result } = renderExport();
    act(() => result.current.exportRecipesFile([recipe.id]));

    const { filename, book } = downloaded();
    expect(filename).toMatch(/^family-recipes-recipes-\d{4}-\d{2}-\d{2}\.json$/);
    expect(book.recipes.map((r) => r.title)).toEqual(["Pie"]);
  });

  it("keeps a summary of the last export until it is dismissed", () => {
    const { result } = renderExport();
    act(() => result.current.exportIngredientsFile("all"));
    expect(result.current.summary).toEqual({ message: "Exported 1 ingredient.", warnings: [] });

    act(() => result.current.dismissSummary());
    expect(result.current.summary).toBeNull();
  });

  it("warns about what it could not find", () => {
    const { result } = renderExport();
    act(() => result.current.exportIngredientsFile([fixedId(IngredientId, "gone")]));
    expect(result.current.summary?.warnings).toEqual([
      "1 ingredient could not be found in this book and was left out of the file.",
    ]);
  });
});
