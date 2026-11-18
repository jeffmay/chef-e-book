import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { parseKitchenwareCsv } from "../../fixtures/kitchenware.ts";
import { fixedId } from "../../types/ids.ts";
import {
  type Container,
  type Ingredient,
  ContainerId,
  IngredientId,
} from "../../types/kitchenware.ts";
import { RecipeBookId } from "../../types/recipeBook.ts";
import { ensureBookMeta, getBookMeta, setBookName } from "../bookMetaStore.ts";
import { getBookSettings, setBookSecondsPerIngredient } from "../bookSettingsStore.ts";
import { addContainer, getContainers } from "../containerStore.ts";
import { seedDefaultKitchenware } from "../defaultKitchenware.ts";
import { addIngredient, getIngredients, getIngredientYmap } from "../ingredientStore.ts";
import { findOrCreateLabel, getLabels } from "../labelStore.ts";
import { MIGRATION_ORIGIN } from "../origins.ts";
import { createRecipeFolder, getRecipeFolders } from "../recipeFolderStore.ts";
import { createRecipe, getRecipes } from "../recipeStore.ts";
import {
  completeSession,
  createSession,
  getSessions,
  getSessionYmap,
  updateSessionItemState,
} from "../sessionStore.ts";
import { createBookUndoManager, getBookUndoScope, runAsUndoStep } from "../undo.ts";

const CUP = { value: { numerator: 1, denominator: 1 }, unit: "cup" } as const;

function ingredient(key: string, name: string): Ingredient {
  return {
    kind: "ingredient",
    id: fixedId(IngredientId, key),
    name,
    default_measurement_value: CUP,
    labels: new Set(),
  };
}

const BUTTER = ingredient("butter", "Butter");
const FLOUR = ingredient("flour", "Flour");
const BOWL: Container = {
  kind: "container",
  id: fixedId(ContainerId, "bowl"),
  name: "Bowl",
  labels: new Set(),
};

const ingredientNames = (doc: Y.Doc) => getIngredients(doc).map((i) => i.name);
const recipeTitles = (doc: Y.Doc) => getRecipes(doc).map((r) => r.title);

let doc: Y.Doc;
let undoManager: Y.UndoManager;

beforeEach(() => {
  doc = new Y.Doc();
  undoManager = createBookUndoManager(doc);
});

afterEach(() => {
  undoManager.destroy();
});

describe("getBookUndoScope", () => {
  it("covers the ingredients list and the recipes tree, but not the session maps", () => {
    const scope = getBookUndoScope(doc);
    expect(scope).toHaveLength(7);
    expect(scope).not.toContain(getSessionYmap(doc));
  });
});

describe("one history for the whole book", () => {
  it("undoes and redoes an edit", () => {
    addIngredient(doc, BUTTER);
    expect(undoManager.canUndo()).toBe(true);

    undoManager.undo();
    expect(ingredientNames(doc)).toEqual([]);
    expect(undoManager.canRedo()).toBe(true);

    undoManager.redo();
    expect(ingredientNames(doc)).toEqual(["Butter"]);
  });

  it("undoes ingredient and recipe edits in the reverse of the order they were made", () => {
    addIngredient(doc, BUTTER);
    undoManager.stopCapturing();
    createRecipe(doc, { title: "Pie", description: "v1" });

    undoManager.undo();
    expect(recipeTitles(doc)).toEqual([]);
    expect(ingredientNames(doc)).toEqual(["Butter"]);

    undoManager.undo();
    expect(ingredientNames(doc)).toEqual([]);
    expect(undoManager.canUndo()).toBe(false);
  });

  it.each([
    [
      "an ingredient",
      (d: Y.Doc) => addIngredient(d, BUTTER),
      (d: Y.Doc) => getIngredients(d).length,
    ],
    ["a container", (d: Y.Doc) => addContainer(d, BOWL), (d: Y.Doc) => getContainers(d).length],
    [
      "a label",
      (d: Y.Doc) => findOrCreateLabel(d, "solid", new Set(["ingredient"])),
      (d: Y.Doc) => getLabels(d).length,
    ],
    [
      "a recipe",
      (d: Y.Doc) => createRecipe(d, { title: "Pie" }),
      (d: Y.Doc) => getRecipes(d).length,
    ],
    [
      "a folder",
      (d: Y.Doc) => createRecipeFolder(d, "Desserts"),
      (d: Y.Doc) => getRecipeFolders(d).length,
    ],
  ])("covers %s", (_what, edit, count) => {
    edit(doc);
    expect(count(doc)).toBe(1);
    undoManager.undo();
    expect(count(doc)).toBe(0);
  });

  it("covers a book setting", () => {
    setBookSecondsPerIngredient(doc, 90);
    undoManager.undo();
    expect(getBookSettings(doc).seconds_per_ingredient).toBeUndefined();
  });

  it("covers renaming the book, back to the previous name", () => {
    const id = fixedId(RecipeBookId, "book-one");
    ensureBookMeta(doc, { id, name: "Old Name" });
    setBookName(doc, "New Name");
    undoManager.undo();
    expect(getBookMeta(doc)?.name).toBe("Old Name");
  });
});

describe("what Undo must not touch", () => {
  it("does not undo session activity, and leaves sessions alone when undoing an edit", () => {
    const recipe = createRecipe(doc, { title: "Pie", description: "v1" });
    const version = recipe.versions[0];
    if (version === undefined) throw new Error("expected a first version");
    undoManager.stopCapturing();

    const session = createSession(doc, recipe.id, version.id);
    updateSessionItemState(doc, session.id, "item-1", { checked: true });
    completeSession(doc, session.id, ["item-1", "item-2"]);

    undoManager.undo();

    expect(recipeTitles(doc)).toEqual([]);
    const sessions = getSessions(doc);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("completed");
    expect(sessions[0]?.item_states["item-1"]?.checked).toBe(true);
    expect(undoManager.canUndo()).toBe(false);
  });

  it("has nothing to undo after only session activity", () => {
    const recipe = createRecipe(doc, { title: "Pie", description: "v1" });
    undoManager.clear();
    const version = recipe.versions[0];
    if (version === undefined) throw new Error("expected a first version");

    createSession(doc, recipe.id, version.id);
    expect(undoManager.canUndo()).toBe(false);
  });

  it("does not undo the default kitchenware, book setup, or migrated data", () => {
    const templates =
      parseKitchenwareCsv(`Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat
`);
    seedDefaultKitchenware(doc, templates);
    ensureBookMeta(doc, { id: fixedId(RecipeBookId, "book-one"), name: "Family" });
    doc.transact(() => addIngredient(doc, FLOUR), MIGRATION_ORIGIN);

    expect(ingredientNames(doc)).toEqual(["Butter", "Flour"]);
    expect(undoManager.canUndo()).toBe(false);
  });

  it("does not undo edits that arrive from elsewhere, and keeps them when undoing a local edit", () => {
    const remote = new Y.Doc();
    addIngredient(remote, FLOUR);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), "remote");
    expect(undoManager.canUndo()).toBe(false);

    addIngredient(doc, BUTTER);
    undoManager.undo();
    expect(ingredientNames(doc)).toEqual(["Flour"]);
  });

  it("stops tracking once destroyed", () => {
    undoManager.destroy();
    addIngredient(doc, BUTTER);
    expect(undoManager.canUndo()).toBe(false);
  });
});

describe("step boundaries", () => {
  it("merges edits made back to back into one step", () => {
    addIngredient(doc, BUTTER);
    addIngredient(doc, FLOUR);
    undoManager.undo();
    expect(ingredientNames(doc)).toEqual([]);
  });

  it("splits them once capturing is stopped", () => {
    addIngredient(doc, BUTTER);
    undoManager.stopCapturing();
    addIngredient(doc, FLOUR);
    undoManager.undo();
    expect(ingredientNames(doc)).toEqual(["Butter"]);
  });
});

describe("runAsUndoStep", () => {
  it("undoes everything it wrote in one press", () => {
    runAsUndoStep(undoManager, doc, () => {
      addIngredient(doc, BUTTER);
      createRecipe(doc, { title: "Pie", description: "v1" });
      createRecipeFolder(doc, "Desserts");
    });

    undoManager.undo();

    expect(ingredientNames(doc)).toEqual([]);
    expect(recipeTitles(doc)).toEqual([]);
    expect(getRecipeFolders(doc)).toEqual([]);
    expect(undoManager.canUndo()).toBe(false);
  });

  it("never merges with the edit before it or the edit after it", () => {
    addIngredient(doc, BUTTER);
    runAsUndoStep(undoManager, doc, () => addIngredient(doc, FLOUR));
    createRecipe(doc, { title: "Pie", description: "v1" });

    undoManager.undo();
    expect(recipeTitles(doc)).toEqual([]);
    expect(ingredientNames(doc)).toEqual(["Butter", "Flour"]);

    undoManager.undo();
    expect(ingredientNames(doc)).toEqual(["Butter"]);

    undoManager.undo();
    expect(ingredientNames(doc)).toEqual([]);
  });

  it("returns what the function returns", () => {
    expect(runAsUndoStep(undoManager, doc, () => 42)).toBe(42);
  });

  it("still ends the step when the function throws", () => {
    expect(() =>
      runAsUndoStep(undoManager, doc, () => {
        addIngredient(doc, BUTTER);
        throw new Error("failed halfway");
      }),
    ).toThrow("failed halfway");

    addIngredient(doc, FLOUR);
    undoManager.undo();
    expect(getIngredientYmap(doc).has(FLOUR.id)).toBe(false);
    expect(getIngredientYmap(doc).has(BUTTER.id)).toBe(true);
  });
});
