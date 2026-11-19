import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  BAKING_ID,
  DAIRY_ID,
  container,
  folder,
  ingredient,
  ingredientItem,
  label,
  recipe,
  section,
  version,
} from "../../export/__tests__/fixtures.ts";
import { exportRecipes, readExportSource } from "../../export/exportFromDoc.ts";
import { serializeRecipeBookExport } from "../../export/recipeBookExport.ts";
import { fixedId } from "../../types/ids.ts";
import { IngredientId } from "../../types/kitchenware.ts";
import { RecipeId } from "../../types/recipe.ts";
import { getBookMetaYmap } from "../../yjs/bookMetaStore.ts";
import { addContainer } from "../../yjs/containerStore.ts";
import { addIngredient, getIngredients, getIngredientYmap } from "../../yjs/ingredientStore.ts";
import { addLabel, getLabels } from "../../yjs/labelStore.ts";
import { createRecipeFolder, getRecipeFoldersFlat } from "../../yjs/recipeFolderStore.ts";
import { createRecipe, getRecipe, getRecipes, saveRecipe } from "../../yjs/recipeStore.ts";
import { createBookUndoManager } from "../../yjs/undo.ts";
import { isEmptyImportPlan } from "../importPlan.ts";
import {
  applyImportPlan,
  importBundle,
  MAX_IMPORT_FILE_BYTES,
  planImportIntoDoc,
  readImportFile,
  restrictBundleToIngredients,
  summarizeImportPlan,
} from "../applyImport.ts";
import { makeBundle, makeOptions, NOW } from "./importFixtures.ts";

const FLOUR = ingredient("flour", "Flour", { labels: new Set([BAKING_ID]) });
const EGG = ingredient("egg", "Egg");
const CAKE_ID = fixedId(RecipeId, "cake");
const DESSERTS = folder("desserts", "Desserts");
const CAKE = recipe(
  "cake",
  "Cake",
  [
    version(
      "cake1",
      CAKE_ID,
      [section("s", [ingredientItem("f", FLOUR.id), ingredientItem("e", EGG.id)])],
      [FLOUR.id, EGG.id],
    ),
  ],
  { parent_folder_id: DESSERTS.id },
);
const bundle = () =>
  makeBundle({
    ingredients: [FLOUR, EGG],
    containers: [container("bowl", "Bowl")],
    labels: [label(BAKING_ID, "baking")],
    recipe_folders: [DESSERTS],
    recipes: [CAKE],
  });

const names = (items: ReadonlyArray<{ readonly name: string }>) => items.map((i) => i.name);

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

/** Everything undo is meant to restore, as plain data. */
function snapshot(d: Y.Doc) {
  const source = readExportSource(d);
  return JSON.stringify({
    ingredients: source.ingredients.map((i) => ({ ...i, labels: [...i.labels] })),
    containers: source.containers.map((c) => ({ ...c, labels: [...c.labels] })),
    labels: source.labels.map((l) => ({ ...l, kinds: [...l.kinds] })),
    folders: source.recipe_folders,
    recipes: source.recipes,
  });
}

describe("applyImportPlan", () => {
  it("writes everything the plan holds", () => {
    importBundle(doc, bundle(), makeOptions());

    const source = readExportSource(doc);
    expect(names(source.ingredients)).toEqual(["Egg", "Flour"]);
    expect(names(source.containers)).toEqual(["Bowl"]);
    expect(names(source.labels)).toEqual(["baking"]);
    expect(names(source.recipe_folders)).toEqual(["Desserts"]);
    expect(source.recipes.map((r) => r.title)).toEqual(["Cake"]);
    expect(source.recipes[0]?.parent_folder_id).toBe(DESSERTS.id);
  });

  it("stores name keys with what it writes, so the book can match them later", () => {
    importBundle(doc, bundle(), makeOptions());
    expect(getIngredientYmap(doc).get(FLOUR.id)).toMatchObject({ name_key: "flour" });
  });

  it("writes in a single transaction", () => {
    let updates = 0;
    doc.on("update", () => updates++);
    importBundle(doc, bundle(), makeOptions());
    expect(updates).toBe(1);
  });

  it("writes nothing for an empty plan, not even an update", () => {
    importBundle(doc, bundle(), makeOptions());
    let updates = 0;
    doc.on("update", () => updates++);
    importBundle(doc, bundle(), makeOptions());
    expect(updates).toBe(0);
  });

  it("is one undo step, and undoing restores the book exactly as it was", () => {
    addIngredient(doc, ingredient("salt", "Salt"));
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();
    const before = snapshot(doc);

    importBundle(doc, bundle(), makeOptions(), undoManager);
    expect(snapshot(doc)).not.toBe(before);

    undoManager.undo();
    expect(snapshot(doc)).toBe(before);
    expect(undoManager.canUndo()).toBe(false);
    undoManager.destroy();
  });

  it("does not merge with the edit before it, so Undo only takes back the import", () => {
    const undoManager = createBookUndoManager(doc);
    addIngredient(doc, ingredient("salt", "Salt"));

    importBundle(doc, bundle(), makeOptions(), undoManager);
    undoManager.undo();

    expect(names(getIngredients(doc))).toEqual(["Salt"]);
    undoManager.destroy();
  });

  it("adds a version to a recipe the book already has, and undo takes it away again", () => {
    const local = createRecipe(doc, { title: "Cake", description: "Mine" });
    const incoming = recipe("cake", "Cake", [
      version("theirs", local.id, [section("s", [ingredientItem("f", FLOUR.id)])], [FLOUR.id]),
    ]);
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();

    importBundle(
      doc,
      makeBundle({
        ingredients: [FLOUR],
        labels: [label(BAKING_ID, "baking")],
        recipes: [{ ...incoming, id: local.id }],
      }),
      makeOptions(),
      undoManager,
    );
    const merged = getRecipe(doc, local.id);
    if (!("versions" in merged)) throw merged;
    expect(merged.versions).toHaveLength(2);
    expect(merged.versions[1]?.description).toBe("Imported from Family Recipes on 2026-11-18");
    expect(merged.updated_at).toBe(NOW);

    undoManager.undo();
    const reverted = getRecipe(doc, local.id);
    if (!("versions" in reverted)) throw reverted;
    expect(reverted.versions).toHaveLength(1);
    undoManager.destroy();
  });

  it("gives an existing label the kinds it lacked, and undo takes them away", () => {
    const id = addLabel(doc, "dairy", new Set(["ingredient"]));
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();
    const incoming = { ...label(DAIRY_ID, "Dairy"), kinds: new Set(["container" as const]) };

    importBundle(doc, makeBundle({ labels: [incoming] }), makeOptions(), undoManager);
    expect([...(getLabels(doc).find((l) => l.id === id)?.kinds ?? [])].sort()).toEqual([
      "container",
      "ingredient",
    ]);

    undoManager.undo();
    expect([...(getLabels(doc).find((l) => l.id === id)?.kinds ?? [])]).toEqual(["ingredient"]);
    undoManager.destroy();
  });

  it("leaves the book's own ingredients exactly as they are", () => {
    addIngredient(doc, {
      ...ingredient("localflour", "Flour"),
      default_measurement_value: { value: { numerator: 2, denominator: 1 }, unit: "tsp" },
    });
    importBundle(doc, bundle(), makeOptions());
    const flours = getIngredients(doc).filter((i) => i.name === "Flour");
    expect(flours).toHaveLength(1);
    expect(flours[0]?.default_measurement_value.unit).toBe("tsp");
  });

  it("never touches the session or setup maps", () => {
    importBundle(doc, bundle(), makeOptions());
    expect(getBookMetaYmap(doc).size).toBe(0);
  });
});

describe("applyImportPlan on a plan made earlier", () => {
  it("writes what that plan holds", () => {
    const plan = planImportIntoDoc(doc, bundle(), makeOptions());
    applyImportPlan(doc, plan);
    expect(names(getIngredients(doc))).toEqual(["Egg", "Flour"]);
  });
});

describe("importBundle", () => {
  it("plans against the book as it is now, so a stale preview cannot create a duplicate", () => {
    const stalePreview = planImportIntoDoc(doc, bundle(), makeOptions());
    expect(names(stalePreview.ingredients_to_create)).toContain("Flour");

    // The book gains Flour (under another id) between the preview and the import.
    addIngredient(doc, ingredient("localflour", "Flour"));
    importBundle(doc, bundle(), makeOptions());

    expect(getIngredients(doc).filter((i) => i.name === "Flour")).toHaveLength(1);
  });

  it("returns the plan it applied", () => {
    const plan = importBundle(doc, bundle(), makeOptions());
    expect(names(plan.ingredients_to_create)).toEqual(["Egg", "Flour"]);
  });

  it("round-trips a real export from another book into this one", () => {
    const source = new Y.Doc();
    addIngredient(source, FLOUR);
    addIngredient(source, EGG);
    const sourceFolder = createRecipeFolder(source, "Desserts");
    const recipeInSource = createRecipe(source, {
      title: "Cake",
      description: "v1",
      parent_folder_id: sourceFolder.id,
    });
    saveRecipe(source, recipeInSource.id, {
      title: "Cake",
      parent_folder_id: sourceFolder.id,
      create_new_version: true,
      version: version(
        "v2",
        recipeInSource.id,
        [section("s", [ingredientItem("f", FLOUR.id)])],
        [FLOUR.id],
      ),
    });

    const exported = exportRecipes(source, [recipeInSource.id], NOW);
    const result = readImportFile(serializeRecipeBookExport(exported));
    if (!result.ok) throw new Error(result.error);
    importBundle(doc, result.bundle, makeOptions());

    expect(getRecipes(doc).map((r) => r.title)).toEqual(["Cake"]);
    expect(getRecipes(doc)[0]?.versions).toHaveLength(1);
    expect(names(getIngredients(doc))).toEqual(["Flour"]);
    expect(names(getRecipeFoldersFlat(doc))).toEqual(["Desserts"]);
  });
});

describe("restrictBundleToIngredients", () => {
  it("keeps the ingredients and the labels they carry, and nothing else", () => {
    const restricted = restrictBundleToIngredients(
      makeBundle({
        ingredients: [FLOUR],
        containers: [container("bowl", "Bowl")],
        labels: [label(BAKING_ID, "baking"), label(DAIRY_ID, "dairy")],
        recipe_folders: [DESSERTS],
        recipes: [CAKE],
      }),
    );
    expect(names(restricted.ingredients)).toEqual(["Flour"]);
    expect(names(restricted.labels)).toEqual(["baking"]);
    expect(restricted.containers).toEqual([]);
    expect(restricted.recipes).toEqual([]);
    expect(restricted.recipe_folders).toEqual([]);
  });

  it("keeps labels as Sets, as a parsed bundle has them", () => {
    const restricted = restrictBundleToIngredients(
      makeBundle({ ingredients: [FLOUR], labels: [label(BAKING_ID, "baking")] }),
    );
    expect(restricted.ingredients[0]?.labels).toBeInstanceOf(Set);
  });

  it("returns a copy that shares nothing with the bundle it was given", () => {
    const original = makeBundle({
      ingredients: [FLOUR],
      labels: [label(BAKING_ID, "baking")],
    });
    const restricted = restrictBundleToIngredients(original);
    expect(restricted.ingredients[0]).toEqual(original.ingredients[0]);
    expect(restricted.ingredients[0]).not.toBe(original.ingredients[0]);
    expect(restricted.ingredients[0]?.labels).not.toBe(original.ingredients[0]?.labels);
    expect(restricted.ingredients[0]?.default_measurement_value).not.toBe(
      original.ingredients[0]?.default_measurement_value,
    );
    expect(restricted.labels[0]?.kinds).not.toBe(original.labels[0]?.kinds);
    restricted.ingredients[0]?.labels.clear();
    expect(original.ingredients[0]?.labels.size).toBe(1);
  });

  it("keeps the header and the missing references", () => {
    const original = makeBundle({
      ingredients: [FLOUR],
      missing_references: [
        { kind: "label", id: "gone", referenced_by: { kind: "ingredient", id: FLOUR.id } },
      ],
    });
    const restricted = restrictBundleToIngredients(original);
    expect(restricted.exported_at).toBe(original.exported_at);
    expect(restricted.missing_references).toEqual(original.missing_references);
  });
});

describe("readImportFile", () => {
  it("reads a valid export", () => {
    const text = serializeRecipeBookExport(bundle());
    const result = readImportFile(text);
    expect(result.ok).toBe(true);
  });

  it("refuses a file over the size limit before parsing it", () => {
    const result = readImportFile("{", MAX_IMPORT_FILE_BYTES + 1);
    expect(result).toEqual({
      ok: false,
      error: "This file is too large to import (over 10 MB).",
    });
  });

  it("passes on the parser's messages for a file it cannot read", () => {
    expect(readImportFile("{nope")).toEqual({ ok: false, error: "This file is not valid JSON." });
    expect(readImportFile("[]")).toEqual({
      ok: false,
      error: "This file is not a recipe book export.",
    });
    const newer = readImportFile(JSON.stringify({ ...bundle(), format_version: 99 }));
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.error).toContain("newer version of the app");
  });
});

describe("summarizeImportPlan", () => {
  it("says what a plan would do, naming each kind of change", () => {
    const local = new Y.Doc();
    addIngredient(local, ingredient("localegg", "Eggs"));
    const plan = planImportIntoDoc(local, bundle(), makeOptions());
    const { message } = summarizeImportPlan(plan, "preview");
    expect(message).toBe(
      "This will import: 1 recipe added, 1 ingredient added, 1 container added, 1 folder created, 1 label added, 1 reused.",
    );
  });

  it("uses the past tense once done", () => {
    const plan = importBundle(doc, bundle(), makeOptions());
    expect(summarizeImportPlan(plan, "done").message).toMatch(/^Imported: /);
  });

  it("says when there is nothing new", () => {
    importBundle(doc, bundle(), makeOptions());
    const plan = planImportIntoDoc(doc, bundle(), makeOptions());
    expect(summarizeImportPlan(plan, "preview").message).toBe(
      "Nothing new to import: everything in this file is already in the book.",
    );
  });

  it("counts new versions and skips, with the right singular and plural", () => {
    const local = new Y.Doc();
    const a = createRecipe(local, { title: "A", description: "v1" });
    const b = createRecipe(local, { title: "B", description: "v1" });
    const make = (r: typeof a, title: string) =>
      recipe(r.id, title, [version(`n${title}`, r.id, [section(`s${title}`, [])], [], 5)]);
    const plan = planImportIntoDoc(
      local,
      makeBundle({
        recipes: [
          { ...make(a, "A"), id: a.id },
          { ...make(b, "B"), id: b.id },
        ],
      }),
      makeOptions({ recipe_actions: { [b.id]: "skip" } }),
    );
    expect(summarizeImportPlan(plan, "preview").message).toBe(
      "This will import: 1 recipe gets a new version, 1 recipe skipped.",
    );
  });

  it("carries the plan's warnings", () => {
    const orphan = ingredient("orphan", "Orphan", { parent_id: fixedId(IngredientId, "x") });
    const plan = planImportIntoDoc(doc, makeBundle({ ingredients: [orphan] }), makeOptions());
    expect(summarizeImportPlan(plan, "preview").warnings).toHaveLength(1);
  });
});

describe("applyImportPlan with containers and folders", () => {
  it("writes containers and folders with the ids the plan chose", () => {
    addContainer(doc, container("pre", "Pre"));
    importBundle(doc, bundle(), makeOptions());
    expect(readExportSource(doc).recipe_folders[0]?.id).toBe(DESSERTS.id);
  });
});

describe("overwriting kitchenware on import", () => {
  const HALF_TSP = { value: { numerator: 1, denominator: 2 }, unit: "tsp" } as const;
  const overwrite = makeOptions({ overwrite_kitchenware: true });
  const fileSalt = { ...ingredient("salt", "Sea Salt"), default_measurement_value: HALF_TSP };

  it("replaces the book's ingredient under its own id, with a name key to match", () => {
    addIngredient(doc, ingredient("salt", "Salt"));
    importBundle(doc, makeBundle({ ingredients: [fileSalt] }), overwrite);

    const [only] = getIngredients(doc);
    expect(getIngredients(doc)).toHaveLength(1);
    expect(only).toMatchObject({
      id: fileSalt.id,
      name: "Sea Salt",
      default_measurement_value: HALF_TSP,
    });
    expect(getIngredientYmap(doc).get(fileSalt.id)).toMatchObject({ name_key: "sea salt" });
  });

  it("is one undo step, and undo puts the book's own version back", () => {
    addIngredient(doc, ingredient("salt", "Salt"));
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();
    const before = snapshot(doc);

    importBundle(
      doc,
      makeBundle({ ingredients: [fileSalt, ingredient("pepper", "Pepper")] }),
      overwrite,
      undoManager,
    );
    expect(snapshot(doc)).not.toBe(before);

    undoManager.undo();
    expect(snapshot(doc)).toBe(before);
    undoManager.destroy();
  });

  it("writes nothing the second time the same file is imported", () => {
    importBundle(doc, makeBundle({ ingredients: [fileSalt] }), overwrite);
    let updates = 0;
    doc.on("update", () => updates++);
    const again = importBundle(doc, makeBundle({ ingredients: [fileSalt] }), overwrite);
    expect(isEmptyImportPlan(again)).toBe(true);
    expect(updates).toBe(0);
  });

  it("is not done when the option is off", () => {
    addIngredient(doc, ingredient("salt", "Salt"));
    importBundle(doc, makeBundle({ ingredients: [fileSalt] }), makeOptions());
    expect(names(getIngredients(doc))).toEqual(["Salt"]);
  });

  it("overwrites a container too, as part of the same single undo step", () => {
    addContainer(doc, container("bowl", "Bowl"));
    addIngredient(doc, ingredient("salt", "Salt"));
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();
    const before = snapshot(doc);

    importBundle(
      doc,
      makeBundle({ ingredients: [fileSalt], containers: [container("bowl", "Mixing Bowl")] }),
      overwrite,
      undoManager,
    );
    expect(names(readExportSource(doc).containers)).toEqual(["Mixing Bowl"]);
    expect(names(getIngredients(doc))).toEqual(["Sea Salt"]);

    undoManager.undo();
    expect(snapshot(doc)).toBe(before);
    undoManager.destroy();
  });

  it("is summarized as overwritten ingredients and containers", () => {
    addContainer(doc, container("bowl", "Bowl"));
    const plan = planImportIntoDoc(
      doc,
      makeBundle({ ingredients: [fileSalt], containers: [container("bowl", "Mixing Bowl")] }),
      overwrite,
    );
    expect(summarizeImportPlan(plan, "preview").message).toBe(
      "This will import: 1 ingredient added, 1 container overwritten.",
    );
  });

  it("is summarized as overwritten ingredients", () => {
    addIngredient(doc, ingredient("salt", "Salt"));
    const plan = planImportIntoDoc(doc, makeBundle({ ingredients: [fileSalt] }), overwrite);
    expect(summarizeImportPlan(plan, "preview").message).toBe(
      "This will import: 1 ingredient overwritten.",
    );
  });
});
