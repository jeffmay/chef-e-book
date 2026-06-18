import type { KitchenwareLabelId } from "@recipe-book/shared";
import {
  addIngredient,
  findOrCreateLabel,
  IngredientId,
  loadId,
  paddedId,
  type Ingredient,
  type KitchenwareKind,
} from "@recipe-book/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { KitchenwareDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useIngredientStore } from "../useIngredientStore.ts";

const ingredientKinds: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

// A small CSV returned by the mocked fetch
const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
`;

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
      KitchenwareDocContext.Provider,
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
  // Pre-populate so the hook skips async init in most tests
  addIngredient(doc, BUTTER);

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: () => Promise.resolve(MOCK_CSV) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIngredientStore — async default loading", () => {
  it("initialises from the CSV when the store is empty", async () => {
    const emptyDoc = new Y.Doc();
    const { result } = renderHook(() => useIngredientStore(), {
      wrapper: makeWrapper(emptyDoc),
    });
    expect(result.current.ingredients).toHaveLength(0);
    await waitFor(() => expect(result.current.ingredients).toHaveLength(1));
    expect(result.current.ingredients[0]?.name).toBe("Butter");
  });

  it("does not fetch when the store already has data", async () => {
    // doc is pre-populated with BUTTER in beforeEach
    await renderStore(doc);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
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
        labelNames: ["liquid", "dairy-free"],
      }),
    );
    expect(result.current.ingredients.length).toBe(before + 1);
    expect(result.current.ingredients.find((i) => i.name === "Almond Milk")).toBeDefined();
  });
});

describe("useIngredientStore — addLabels / removeLabels", () => {
  it("appends labels to selected ingredients", async () => {
    const { result } = await renderStore(doc);
    act(() =>
      result.current.createIngredient({
        name: "Test Ing",
        default_measurement_value: DEFAULT_MEASUREMENT,
        labelNames: ["a"],
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
        labelNames: ["x", "y"],
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
        labelNames: ["a", "b"],
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
    const dairyId = paddedId(IngredientId, "dairy");
    act(() => result.current.setParent([butter.id], dairyId));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.parent_id).toBe(dairyId);
    act(() => result.current.setParent([butter.id], undefined));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.parent_id).toBeUndefined();
  });
});
