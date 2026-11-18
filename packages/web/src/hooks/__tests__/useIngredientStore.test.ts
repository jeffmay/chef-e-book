import type { KitchenwareLabelId } from "@recipe-book/shared";
import {
  addIngredient,
  createBookUndoManager,
  findOrCreateLabel,
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
