import type { KitchenwareLabelId } from "@recipe-book/shared";
import {
  addIngredient,
  createBookUndoManager,
  findOrCreateLabel,
  NameClashError,
  getLabels,
  IngredientId,
  loadId,
  fixedId,
  type Ingredient,
  type KitchenwareKind,
} from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { BookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useIngredientStore } from "../useIngredientStore.ts";

const ingredientKinds: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

const BUTTER_ID = loadId(IngredientId, "------butter");

const DEFAULT_MEASUREMENT = { value: { numerator: 1, denominator: 1 }, unit: "cup" as const };

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: BUTTER_ID,
  name: "Butter",
  default_measurement_value: DEFAULT_MEASUREMENT,
  labels: new Set<KitchenwareLabelId>(),
};

function makeWrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      BookDocContext.Provider,
      { value: { doc, whenSynced: Promise.resolve() } },
      children,
    );
  };
}

// Renders the store and flushes the mount-time `whenSynced.then(...)` re-read and
// async CSV import inside act() so deferred state updates don't trigger warnings.
async function renderStore(doc: Y.Doc) {
  const rendered = renderHook(() => useIngredientStore(), { wrapper: makeWrapper(doc) });
  await flushAsyncEffects();
  return rendered;
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  addIngredient(doc, BUTTER);
});

describe("useIngredientStore — defaults", () => {
  it("does not load the default kitchenware itself", async () => {
    const emptyDoc = new Y.Doc();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = await renderStore(emptyDoc);
    expect(result.current.ingredients).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("useIngredientStore — createIngredient", () => {
  it("adds a new ingredient", async () => {
    const { result } = await renderStore(doc);
    const before = result.current.ingredients.length;
    act(() =>
      result.current.createIngredient({
        name: "Almond Milk",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: ["liquid", "dairy-free"],
      }),
    );
    expect(result.current.ingredients.length).toBe(before + 1);
    expect(result.current.ingredients.find((i) => i.name === "Almond Milk")).toBeDefined();
  });
});

describe("useIngredientStore — createIngredient and undo", () => {
  it("writes the new labels and the ingredient in a single transaction", async () => {
    const { result } = await renderStore(doc);
    let updates = 0;
    doc.on("update", () => updates++);

    act(() =>
      result.current.createIngredient({
        name: "Almond Milk",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: ["liquid", "dairy-free"],
      }),
    );

    expect(updates).toBe(1);
  });

  it("undoes the new ingredient and the labels it created in one step", async () => {
    const { result } = await renderStore(doc);
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();
    const labelsBefore = getLabels(doc).length;

    act(() =>
      result.current.createIngredient({
        name: "Almond Milk",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: ["liquid", "dairy-free"],
      }),
    );
    expect(getLabels(doc).length).toBe(labelsBefore + 2);

    act(() => undoManager.undo());

    expect(result.current.ingredients.find((i) => i.name === "Almond Milk")).toBeUndefined();
    expect(getLabels(doc).length).toBe(labelsBefore);
    undoManager.destroy();
  });
});

describe("useIngredientStore — addLabels / removeLabels", () => {
  it("appends labels to selected ingredients", async () => {
    const { result } = await renderStore(doc);
    act(() =>
      result.current.createIngredient({
        name: "Test Ing",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: ["a"],
      }),
    );
    const id = result.current.ingredients.find((i) => i.name === "Test Ing")?.id;
    if (id === undefined) throw new Error("ingredient not found");
    const bId = findOrCreateLabel(doc, "b", ingredientKinds);
    const cId = findOrCreateLabel(doc, "c", ingredientKinds);
    act(() => result.current.addLabels([id], [bId, cId]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels.has(bId)).toBe(true);
    expect(updated?.labels.has(cId)).toBe(true);
  });

  it("removes labels from selected ingredients", async () => {
    const { result } = await renderStore(doc);
    act(() =>
      result.current.createIngredient({
        name: "Test Ing 2",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: ["x", "y"],
      }),
    );
    const id = result.current.ingredients.find((i) => i.name === "Test Ing 2")?.id;
    if (id === undefined) throw new Error("ingredient not found");
    const xId = findOrCreateLabel(doc, "x", ingredientKinds);
    const yId = findOrCreateLabel(doc, "y", ingredientKinds);
    act(() => result.current.removeLabels([id], [xId]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels.has(xId)).toBe(false);
    expect(updated?.labels.has(yId)).toBe(true);
  });
});

describe("useIngredientStore — setMeasurementValue", () => {
  it("changes the measurement value", async () => {
    const { result } = await renderStore(doc);
    const butter = result.current.ingredients.find((i) => i.id === BUTTER_ID);
    if (butter === undefined) throw new Error("butter not found");
    const weightMeasurement = { value: { numerator: 1, denominator: 1 }, unit: "oz" as const };
    act(() => result.current.setMeasurementValue([butter.id], weightMeasurement));
    expect(
      result.current.ingredients.find((i) => i.id === BUTTER_ID)?.default_measurement_value,
    ).toEqual(weightMeasurement);
  });
});

describe("useIngredientStore — renameIngredient", () => {
  it("updates the ingredient name", async () => {
    const { result } = await renderStore(doc);
    const butter = result.current.ingredients.find((i) => i.id === BUTTER_ID);
    if (butter === undefined) throw new Error("butter not found");
    act(() => result.current.renameIngredient(butter.id, "Salted Butter"));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.name).toBe("Salted Butter");
  });
});

describe("useIngredientStore — setLabels", () => {
  it("replaces all labels for an ingredient", async () => {
    const { result } = await renderStore(doc);
    act(() =>
      result.current.createIngredient({
        name: "Test Ing Labels",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: ["a", "b"],
      }),
    );
    const id = result.current.ingredients.find((i) => i.name === "Test Ing Labels")?.id;
    if (id === undefined) throw new Error("ingredient not found");
    const xId = findOrCreateLabel(doc, "x", ingredientKinds);
    const yId = findOrCreateLabel(doc, "y", ingredientKinds);
    const zId = findOrCreateLabel(doc, "z", ingredientKinds);
    act(() => result.current.setLabels(id, [xId, yId, zId]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels).toEqual(new Set<KitchenwareLabelId>([xId, yId, zId]));
  });
});

describe("useIngredientStore — setParent", () => {
  it("sets and clears parent_id", async () => {
    const { result } = await renderStore(doc);
    const butter = result.current.ingredients.find((i) => i.id === BUTTER_ID);
    if (butter === undefined) throw new Error("butter not found");
    const dairyId = fixedId(IngredientId, "dairy");
    act(() => result.current.setParent([butter.id], dairyId));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.parent_id).toBe(dairyId);
    act(() => result.current.setParent([butter.id], undefined));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.parent_id).toBeUndefined();
  });
});

describe("useIngredientStore — name uniqueness", () => {
  // `doc` already holds BUTTER.
  it("reports the ingredient that already holds a name, as singular, plural, or any case", async () => {
    const { result } = await renderStore(doc);
    expect(result.current.nameClash("Oregano")).toBeUndefined();
    expect(result.current.nameClash("butter")?.id).toBe(BUTTER_ID);
    expect(result.current.nameClash("  BUTTERS  ")).toEqual({ id: BUTTER_ID, name: "Butter" });
  });

  it("does not report an ingredient as clashing with itself", async () => {
    const { result } = await renderStore(doc);
    expect(result.current.nameClash("Butters", BUTTER_ID)).toBeUndefined();
  });

  it("refuses to create an ingredient whose name is taken", async () => {
    const { result } = await renderStore(doc);
    const before = result.current.ingredients.length;
    expect(() =>
      act(() =>
        result.current.createIngredient({
          name: "butters",
          default_measurement_value: DEFAULT_MEASUREMENT,
          label_names: ["new-label"],
        }),
      ),
    ).toThrow(NameClashError);
    expect(result.current.ingredients).toHaveLength(before);
    // Nothing was written, not even the labels it would have created.
    expect(getLabels(doc).find((l) => l.name === "new-label")).toBeUndefined();
  });

  it("refuses to rename an ingredient to a name another ingredient holds", async () => {
    const { result } = await renderStore(doc);
    act(() =>
      result.current.createIngredient({
        name: "Margarine",
        default_measurement_value: DEFAULT_MEASUREMENT,
        label_names: [],
      }),
    );
    const margarine = result.current.ingredients.find((i) => i.name === "Margarine");
    if (margarine === undefined) throw new Error("ingredient not found");

    expect(() => act(() => result.current.renameIngredient(margarine.id, "Butter"))).toThrow(
      'An ingredient named "Butter" already exists',
    );
    expect(result.current.ingredients.find((i) => i.id === margarine.id)?.name).toBe("Margarine");
  });

  it("lets an ingredient be renamed to another spelling of its own name, keeping its id", async () => {
    const { result } = await renderStore(doc);
    act(() => result.current.renameIngredient(BUTTER_ID, "Butters"));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.name).toBe("Butters");
    expect(result.current.ingredients).toHaveLength(1);
    // The stored key follows the rename, so lookups by the new name find it.
    expect(result.current.nameClash("Butter")?.id).toBe(BUTTER_ID);
  });

  it("lists ingredients that already share a name, instead of hiding them", async () => {
    addIngredient(doc, {
      ...BUTTER,
      id: fixedId(IngredientId, "butter2"),
      name: "Butters",
    });
    const { result } = await renderStore(doc);
    expect(result.current.duplicateIds).toEqual(
      new Set([BUTTER_ID, fixedId(IngredientId, "butter2")]),
    );
  });

  it("lists no duplicates when every name is unique", async () => {
    const { result } = await renderStore(doc);
    expect(result.current.duplicateIds.size).toBe(0);
  });
});
