import {
  addContainer,
  addIngredient,
  ContainerId,
  createBookUndoManager,
  createRecipe,
  createRecipeFolder,
  ensureBookMeta,
  exportRecipes,
  exportIngredients,
  fixedId,
  getIngredients,
  getRecipeFoldersFlat,
  importBundle,
  getRecipes,
  IngredientId,
  parseRecipeBookExport,
  readExportSource,
  RecipeBookId as RecipeBookIdCompanion,
  type RecipeBookId,
  saveRecipe,
  serializeRecipeBookExport,
  type ExportSource,
  type Ingredient,
  type RecipeBookExport,
  RecipeVersionId,
  SectionItemId,
} from "@recipe-book/shared";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookDocContext } from "../../../contexts/docContext.ts";
import { BookUndoContext, type BookUndo } from "../../../contexts/undoContext.ts";
import { BOOK_REGISTRY_KEY } from "../../../storage/bookRegistry.ts";
import { flushAsyncEffects } from "../../../testUtils.ts";

const mockLoadBookSource = vi.hoisted(() => vi.fn());
vi.mock("../../../storage/bookSource.ts", () => ({ loadBookSource: mockLoadBookSource }));

const { ImportModal } = await import("../ImportModal.tsx");

const ACTIVE_ID = fixedId(RecipeBookIdCompanion, "active-book");
const OTHER_ID = fixedId(RecipeBookIdCompanion, "other-book");

const FLOUR: Ingredient = {
  kind: "ingredient",
  id: fixedId(IngredientId, "flour"),
  name: "Flour",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
  labels: new Set(),
};
const EGG: Ingredient = { ...FLOUR, id: fixedId(IngredientId, "egg"), name: "Egg" };

/** A book with a Desserts folder holding a Cake that uses Flour and Egg. */
function makeSourceDoc(): Y.Doc {
  const source = new Y.Doc();
  addIngredient(source, FLOUR);
  addIngredient(source, EGG);
  const desserts = createRecipeFolder(source, "Desserts");
  const cake = createRecipe(source, {
    title: "Cake",
    description: "v1",
    parent_folder_id: desserts.id,
  });
  saveRecipe(source, cake.id, {
    title: "Cake",
    parent_folder_id: desserts.id,
    create_new_version: false,
    version: {
      id: fixedId(RecipeVersionId, "cakev1"),
      recipe_id: cake.id,
      description: "v1",
      ingredients: [],
      sections: [
        {
          kind: "section",
          id: fixedId(SectionItemId, "sec"),
          contents: [
            { kind: "ingredient", id: fixedId(SectionItemId, "i1"), ingredient_id: FLOUR.id },
            { kind: "ingredient", id: fixedId(SectionItemId, "i2"), ingredient_id: EGG.id },
          ],
        },
      ],
      created_at: 1000,
    },
  });
  return source;
}

function recipesFile(source: Y.Doc, name = "cake.json"): File {
  const ids = getRecipes(source).map((r) => r.id);
  return new File([serializeRecipeBookExport(exportRecipes(source, ids))], name, {
    type: "application/json",
  });
}

function ingredientsFile(source: Y.Doc): File {
  return new File(
    [serializeRecipeBookExport(exportIngredients(source, "all"))],
    "ingredients.json",
    {
      type: "application/json",
    },
  );
}

let doc: Y.Doc;
let onClose: ReturnType<typeof vi.fn>;
let undoManager: ReturnType<typeof createBookUndoManager>;

function makeUndo(): BookUndo {
  return {
    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),
    stopCapturing: () => undoManager.stopCapturing(),
    canUndo: true,
    canRedo: false,
  };
}

beforeEach(() => {
  localStorage.clear();
  mockLoadBookSource.mockReset();
  doc = new Y.Doc();
  ensureBookMeta(doc, { id: ACTIVE_ID, name: "Active" });
  undoManager = createBookUndoManager(doc);
  onClose = vi.fn();
});

afterEach(() => {
  undoManager.destroy();
});

function renderModal(scope: "recipes" | "ingredients", { withUndo = true } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const inner = createElement(
      BookDocContext.Provider,
      { value: { doc, whenSynced: Promise.resolve() } },
      children,
    );
    return withUndo ? createElement(BookUndoContext.Provider, { value: makeUndo() }, inner) : inner;
  };
  return render(<ImportModal scope={scope} onClose={onClose} />, { wrapper });
}

function registerBooks(...names: Array<[RecipeBookId, string]>) {
  localStorage.setItem(
    BOOK_REGISTRY_KEY,
    JSON.stringify({
      books: names.map(([id, name]) => ({ id, name, created_at: 1, last_opened_at: 1 })),
      active_book_id: ACTIVE_ID,
    }),
  );
}

const titles = (d: Y.Doc) => getRecipes(d).map((r) => r.title);
const ingredientNames = (d: Y.Doc) => getIngredients(d).map((i) => i.name);

describe("ImportModal — source step", () => {
  it("titles itself for what it imports", () => {
    renderModal("recipes");
    expect(screen.getByRole("dialog", { name: "Import recipes" })).toBeInTheDocument();
  });

  it("titles itself for ingredients on the ingredients page", () => {
    renderModal("ingredients");
    expect(screen.getByRole("dialog", { name: "Import ingredients" })).toBeInTheDocument();
  });

  it("offers a file by default", () => {
    renderModal("recipes");
    expect(screen.getByLabelText("Export file")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "From an export file" })).toBeChecked();
  });

  it("closes on Cancel and on Escape", async () => {
    renderModal("recipes");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    renderModal("recipes");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("says so when there are no other books on the device", async () => {
    registerBooks([ACTIVE_ID, "Active"]);
    renderModal("recipes");
    await userEvent.click(screen.getByRole("radio", { name: "From another book on this device" }));
    expect(screen.getByText("There are no other books on this device.")).toBeInTheDocument();
  });

  it("lists the other books, not the open one", async () => {
    registerBooks([ACTIVE_ID, "Active"], [OTHER_ID, "Grandma's Book"]);
    renderModal("recipes");
    await userEvent.click(screen.getByRole("radio", { name: "From another book on this device" }));
    expect(screen.getByRole("button", { name: "Choose book Grandma's Book" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose book Active" })).not.toBeInTheDocument();
  });
});

describe("ImportModal — a file", () => {
  it("imports recipes from an export file, through preview, in one go", async () => {
    const source = makeSourceDoc();
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));

    // options step
    expect(await screen.findByLabelText("Destination folder")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    // preview
    expect(screen.getByRole("status")).toHaveTextContent(
      "This will import: 1 recipe added, 2 ingredients added, 1 folder created.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(titles(doc)).toEqual(["Cake"]);
    expect(ingredientNames(doc)).toEqual(["Egg", "Flour"]);
    expect(getRecipeFoldersFlat(doc).map((f) => f.name)).toEqual(["Desserts"]);
    expect(screen.getByRole("status")).toHaveTextContent("Imported: 1 recipe added");
  });

  it("rejects a file that is not JSON, and stays on the source step", async () => {
    renderModal("recipes");
    await userEvent.upload(
      screen.getByLabelText("Export file"),
      new File(["{nope"], "bad.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("This file is not valid JSON.");
    expect(screen.getByLabelText("Export file")).toBeInTheDocument();
  });

  it("rejects JSON that is not a recipe book export", async () => {
    renderModal("recipes");
    await userEvent.upload(
      screen.getByLabelText("Export file"),
      new File(['{"hello":1}'], "other.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This file is not a recipe book export.",
    );
  });

  it("rejects an export from a newer version, saying what to do", async () => {
    const source = makeSourceDoc();
    const text = serializeRecipeBookExport({
      ...exportRecipes(
        source,
        getRecipes(source).map((r) => r.id),
      ),
      format_version: 99,
    } satisfies RecipeBookExport);
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), new File([text], "new.json"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Update the app");
  });

  it("rejects a file over the size limit without reading it as an export", async () => {
    renderModal("recipes");
    const big = new File(["{}"], "big.json", { type: "application/json" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText("Export file"), big);
    expect(await screen.findByRole("alert")).toHaveTextContent("too large");
  });

  it("imports only ingredients on the ingredients page, straight to preview", async () => {
    const source = makeSourceDoc();
    renderModal("ingredients");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "This will import: 2 ingredients added.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(ingredientNames(doc)).toEqual(["Egg", "Flour"]);
    expect(titles(doc)).toEqual([]);
  });

  it("refuses a file with no ingredients on the ingredients page", async () => {
    const empty = new Y.Doc();
    renderModal("ingredients");
    await userEvent.upload(screen.getByLabelText("Export file"), ingredientsFile(empty));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This file has no ingredients to import.",
    );
  });
});

describe("ImportModal — options and preview", () => {
  async function toOptions(source = makeSourceDoc()) {
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));
    await screen.findByLabelText("Destination folder");
  }

  it("lists the book's folders, with paths, as destinations", async () => {
    createRecipeFolder(doc, "Mains");
    await toOptions();
    const select = screen.getByLabelText("Destination folder");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Top level", "Mains"]);
  });

  it("imports into a chosen folder", async () => {
    const mains = createRecipeFolder(doc, "Mains");
    await toOptions();
    await userEvent.selectOptions(screen.getByLabelText("Destination folder"), mains.id);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    const desserts = getRecipeFoldersFlat(doc).find((f) => f.name === "Desserts");
    expect(desserts?.parent_folder_id).toBe(mains.id);
  });

  it("imports into a new folder it creates, and flattens the file's folders", async () => {
    await toOptions();
    await userEvent.type(screen.getByLabelText("New folder inside it (optional)"), "From Grandma");
    await userEvent.click(
      screen.getByRole("radio", { name: "Put every recipe straight in the destination" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(getRecipeFoldersFlat(doc).map((f) => f.name)).toEqual(["From Grandma"]);
    const folder = getRecipeFoldersFlat(doc)[0];
    expect(getRecipes(doc)[0]?.parent_folder_id).toBe(folder?.id);
  });

  it("offers the folder choice only when the file has folders", async () => {
    const flat = new Y.Doc();
    addIngredient(flat, FLOUR);
    createRecipe(flat, { title: "Plain", description: "v1" });
    await toOptions(flat);
    expect(
      screen.queryByRole("radio", { name: "Keep the file's folder structure" }),
    ).not.toBeInTheDocument();
  });

  it("goes back from the preview to the options", async () => {
    await toOptions();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Destination folder")).toBeInTheDocument();
  });

  describe("a recipe the book already has", () => {
    /** The book already has Cake (same id), with different content. */
    async function toPreviewWithExistingCake() {
      const source = makeSourceDoc();
      const sourceCake = getRecipes(source)[0];
      if (sourceCake === undefined) throw new Error("expected a recipe");
      addIngredient(doc, FLOUR);
      doc.transact(() => {
        const local = createRecipe(doc, { title: "Cake", description: "Mine" });
        // Same id as the file's recipe, so it matches by id.
        doc.getMap("recipes").delete(local.id);
        doc.getMap("recipes").set(sourceCake.id, {
          ...local,
          id: sourceCake.id,
          versions: [{ ...local.versions[0], recipe_id: sourceCake.id }],
        });
      });
      renderModal("recipes");
      await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));
      await screen.findByLabelText("Destination folder");
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    it("offers a choice for it, defaulting to adding a version", async () => {
      await toPreviewWithExistingCake();
      const choice = screen.getByRole("combobox", { name: "What to do with Cake" });
      expect(choice).toHaveValue("merge_version");
      expect(screen.getByRole("status")).toHaveTextContent("1 recipe gets a new version");
    });

    it("keeps both when asked", async () => {
      await toPreviewWithExistingCake();
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "What to do with Cake" }),
        "keep_both",
      );
      expect(screen.getByRole("status")).toHaveTextContent("1 recipe added");
      await userEvent.click(screen.getByRole("button", { name: "Import" }));
      expect(titles(doc)).toEqual(["Cake", "Cake"]);
    });

    it("skips when asked, which leaves nothing to import", async () => {
      await toPreviewWithExistingCake();
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "What to do with Cake" }),
        "skip",
      );
      expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
      expect(screen.getByRole("status")).toHaveTextContent("1 recipe skipped");
    });
  });

  it("disables Import, and says so, when everything is already in the book", async () => {
    const source = makeSourceDoc();
    const file = recipesFile(source);
    // Import the same file once already.
    const first = parseRecipeBookExport(await file.text());
    if (!first.ok) throw new Error(first.error);
    importBundle(doc, first.value, {
      folder_mode: "retain",
      on_match: "merge_version",
      source_label: "x",
      now: 1,
    });

    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), file);
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("status")).toHaveTextContent("Nothing new to import");
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });
});

describe("ImportModal — done", () => {
  it("is one undo step, which the Undo button's history takes back whole", async () => {
    const source = makeSourceDoc();
    undoManager.stopCapturing();
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(titles(doc)).toEqual(["Cake"]);
    expect(screen.getByText(/takes the whole import back/)).toBeInTheDocument();

    act(() => undoManager.undo());

    expect(titles(doc)).toEqual([]);
    expect(ingredientNames(doc)).toEqual([]);
    expect(getRecipeFoldersFlat(doc)).toEqual([]);
  });

  it("closes from the result", async () => {
    const source = makeSourceDoc();
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("works without an undo history to tell, as on a page outside the book shell", async () => {
    const source = makeSourceDoc();
    renderModal("recipes", { withUndo: false });
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(titles(doc)).toEqual(["Cake"]);
  });
});

describe("ImportModal — another book on this device", () => {
  function sourceOf(d: Y.Doc): ExportSource {
    return readExportSource(d);
  }

  async function chooseOtherBook(scope: "recipes" | "ingredients", source: Y.Doc) {
    registerBooks([ACTIVE_ID, "Active"], [OTHER_ID, "Grandma's Book"]);
    mockLoadBookSource.mockResolvedValue(sourceOf(source));
    renderModal(scope);
    await userEvent.click(screen.getByRole("radio", { name: "From another book on this device" }));
    await userEvent.click(screen.getByRole("button", { name: "Choose book Grandma's Book" }));
  }

  it("opens the book and lets you pick recipes, with their folder in the name", async () => {
    await chooseOtherBook("recipes", makeSourceDoc());
    expect(mockLoadBookSource).toHaveBeenCalledWith(OTHER_ID);
    expect(
      await screen.findByRole("checkbox", { name: "Import Desserts / Cake" }),
    ).not.toBeChecked();
  });

  it("will not go on until something is chosen", async () => {
    await chooseOtherBook("recipes", makeSourceDoc());
    await screen.findByRole("checkbox", { name: "Import Desserts / Cake" });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Import Desserts / Cake" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("selects all and none", async () => {
    await chooseOtherBook("recipes", makeSourceDoc());
    await screen.findByRole("checkbox", { name: "Import Desserts / Cake" });
    await userEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Import Desserts / Cake" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(screen.getByRole("checkbox", { name: "Import Desserts / Cake" })).not.toBeChecked();
  });

  it("imports the chosen recipes, with what they need, from the other book", async () => {
    await chooseOtherBook("recipes", makeSourceDoc());
    await userEvent.click(await screen.findByRole("checkbox", { name: "Import Desserts / Cake" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(titles(doc)).toEqual(["Cake"]);
    expect(ingredientNames(doc)).toEqual(["Egg", "Flour"]);
  });

  it("imports chosen ingredients on the ingredients page", async () => {
    await chooseOtherBook("ingredients", makeSourceDoc());
    await userEvent.click(await screen.findByRole("checkbox", { name: "Import Egg" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("status")).toHaveTextContent("This will import: 1 ingredient added.");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(ingredientNames(doc)).toEqual(["Egg"]);
  });

  it("says when the other book has nothing to bring", async () => {
    await chooseOtherBook("recipes", new Y.Doc());
    expect(await screen.findByText("This book has no recipes.")).toBeInTheDocument();
  });

  it("shows why a book could not be opened, and stays on the list", async () => {
    registerBooks([ACTIVE_ID, "Active"], [OTHER_ID, "Grandma's Book"]);
    mockLoadBookSource.mockRejectedValue(new Error("blocked"));
    renderModal("recipes");
    await userEvent.click(screen.getByRole("radio", { name: "From another book on this device" }));
    await userEvent.click(screen.getByRole("button", { name: "Choose book Grandma's Book" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Could not open "Grandma\'s Book": blocked',
    );
    expect(screen.getByRole("button", { name: "Choose book Grandma's Book" })).toBeEnabled();
  });

  it("goes back to the book list from the scope step", async () => {
    await chooseOtherBook("recipes", makeSourceDoc());
    await screen.findByRole("checkbox", { name: "Import Desserts / Cake" });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: "From an export file" })).toBeInTheDocument();
  });
});

describe("ImportModal — hygiene", () => {
  it("settles without act warnings", async () => {
    renderModal("recipes");
    await flushAsyncEffects();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ImportModal — overwriting my kitchenware", () => {
  const LOCAL_FLOUR: Ingredient = {
    ...FLOUR,
    default_measurement_value: { value: { numerator: 2, denominator: 1 }, unit: "tsp" },
  };
  const unitOfFlour = (d: Y.Doc) =>
    getIngredients(d).find((i) => i.id === FLOUR.id)?.default_measurement_value.unit;

  async function toRecipePreview() {
    addIngredient(doc, LOCAL_FLOUR);
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(makeSourceDoc()));
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
  }

  it("offers the choice on the preview, unticked", async () => {
    await toRecipePreview();
    expect(
      screen.getByRole("checkbox", { name: "Overwrite my kitchenware with the file's versions" }),
    ).not.toBeChecked();
  });

  it("keeps the book's own ingredient when left unticked", async () => {
    await toRecipePreview();
    expect(screen.getByRole("status")).not.toHaveTextContent("overwritten");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(unitOfFlour(doc)).toBe("tsp");
  });

  it("shows what it would overwrite as soon as it is ticked", async () => {
    await toRecipePreview();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Overwrite my kitchenware with the file's versions" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 ingredient overwritten");
  });

  it("overwrites the book's ingredient when ticked, and Undo takes it back", async () => {
    undoManager.stopCapturing();
    await toRecipePreview();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Overwrite my kitchenware with the file's versions" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(unitOfFlour(doc)).toBe("cup");
    expect(screen.getByRole("status")).toHaveTextContent("1 ingredient overwritten");

    act(() => undoManager.undo());
    expect(unitOfFlour(doc)).toBe("tsp");
  });

  it("is offered on the ingredients page too", async () => {
    addIngredient(doc, LOCAL_FLOUR);
    renderModal("ingredients");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(makeSourceDoc()));
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Overwrite my kitchenware with the file's versions",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(unitOfFlour(doc)).toBe("cup");
  });

  it("is not offered when the file has no ingredients", async () => {
    const plain = new Y.Doc();
    createRecipe(plain, { title: "Plain", description: "v1" });
    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(plain));
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.queryByRole("checkbox", { name: "Overwrite my kitchenware with the file's versions" }),
    ).not.toBeInTheDocument();
  });

  it("lists an overwritten ingredient as Overwritten among the other items", async () => {
    await toRecipePreview();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Overwrite my kitchenware with the file's versions" }),
    );
    await userEvent.click(screen.getByText(/Ingredients and other items/));
    const row = within(screen.getByRole("list", { name: "Other items" }))
      .getByText("Flour")
      .closest("li");
    expect(row).toHaveTextContent("Overwritten");
  });

  it("overwrites a container too, and is offered when the file has only containers", async () => {
    const BOWL_ID = fixedId(ContainerId, "bowl");
    const source = new Y.Doc();
    addContainer(source, {
      kind: "container",
      id: BOWL_ID,
      name: "Mixing Bowl",
      labels: new Set(),
    });
    const cake = createRecipe(source, { title: "Cake", description: "v1" });
    saveRecipe(source, cake.id, {
      title: "Cake",
      create_new_version: false,
      version: {
        id: fixedId(RecipeVersionId, "boxv1"),
        recipe_id: cake.id,
        description: "v1",
        ingredients: [],
        sections: [
          {
            kind: "section",
            id: fixedId(SectionItemId, "sec"),
            contents: [
              {
                kind: "container",
                id: fixedId(SectionItemId, "c1"),
                container_id: BOWL_ID,
                descriptor: "",
                contents: [],
              },
            ],
          },
        ],
        created_at: 1,
      },
    });
    addContainer(doc, { kind: "container", id: BOWL_ID, name: "Bowl", labels: new Set() });

    renderModal("recipes");
    await userEvent.upload(screen.getByLabelText("Export file"), recipesFile(source));
    await screen.findByLabelText("Destination folder");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Overwrite my kitchenware with the file's versions" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 container overwritten");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(readExportSource(doc).containers.map((c) => c.name)).toEqual(["Mixing Bowl"]);
  });
});
