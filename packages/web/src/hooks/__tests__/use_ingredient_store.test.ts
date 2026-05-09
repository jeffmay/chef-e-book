import type { KitchenwareLabelId } from "@recipe-book/shared";
import {
  add_ingredient,
  find_or_create_label,
  IngredientId,
  type Ingredient,
  type KitchenwareKind,
} from "@recipe-book/shared";
import { load_id, padded_id } from "@recipe-book/shared/src/types/ids.js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { DocContext } from "../../contexts/doc_context.js";
import { use_ingredient_store } from "../use_ingredient_store.js";

const INGREDIENT_KINDS: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

// A small CSV returned by the mocked fetch
const MOCK_CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
`;

const BUTTER_ID = load_id(IngredientId, "------butter");

const BUTTER: Ingredient = {
  kind: "ingredient",
  id: BUTTER_ID,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set<KitchenwareLabelId>(),
};

function make_wrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(DocContext.Provider, { value: doc }, children);
  };
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  // Pre-populate so the hook skips async init in most tests
  add_ingredient(doc, BUTTER);

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ text: () => Promise.resolve(MOCK_CSV) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("use_ingredient_store — async default loading", () => {
  it("initialises from the CSV when the store is empty", async () => {
    const empty_doc = new Y.Doc();
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(empty_doc),
    });
    expect(result.current.ingredients).toHaveLength(0);
    await waitFor(() => expect(result.current.ingredients).toHaveLength(1));
    expect(result.current.ingredients[0]?.name).toBe("Butter");
  });

  it("does not fetch when the store already has data", async () => {
    // doc is pre-populated with BUTTER in beforeEach
    renderHook(() => use_ingredient_store(), { wrapper: make_wrapper(doc) });
    await Promise.resolve(); // flush microtask queue
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("use_ingredient_store — create_ingredient", () => {
  it("adds a new ingredient", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const before = result.current.ingredients.length;
    act(() =>
      result.current.create_ingredient({
        name: "Almond Milk",
        default_measurement_type: "volume",
        label_names: ["liquid", "dairy-free"],
      }),
    );
    expect(result.current.ingredients.length).toBe(before + 1);
    expect(result.current.ingredients.find((i) => i.name === "Almond Milk")).toBeDefined();
  });
});

describe("use_ingredient_store — add_labels / remove_labels", () => {
  it("appends labels to selected ingredients", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    act(() =>
      result.current.create_ingredient({
        name: "Test Ing",
        default_measurement_type: "volume",
        label_names: ["a"],
      }),
    );
    const id = result.current.ingredients.find((i) => i.name === "Test Ing")?.id;
    if (id === undefined) throw new Error("ingredient not found");
    const b_id = find_or_create_label(doc, "b", INGREDIENT_KINDS);
    const c_id = find_or_create_label(doc, "c", INGREDIENT_KINDS);
    act(() => result.current.add_labels([id], [b_id, c_id]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels.has(b_id)).toBe(true);
    expect(updated?.labels.has(c_id)).toBe(true);
  });

  it("removes labels from selected ingredients", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    act(() =>
      result.current.create_ingredient({
        name: "Test Ing 2",
        default_measurement_type: "volume",
        label_names: ["x", "y"],
      }),
    );
    const id = result.current.ingredients.find((i) => i.name === "Test Ing 2")?.id;
    if (id === undefined) throw new Error("ingredient not found");
    const x_id = find_or_create_label(doc, "x", INGREDIENT_KINDS);
    const y_id = find_or_create_label(doc, "y", INGREDIENT_KINDS);
    act(() => result.current.remove_labels([id], [x_id]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels.has(x_id)).toBe(false);
    expect(updated?.labels.has(y_id)).toBe(true);
  });
});

describe("use_ingredient_store — set_measurement_type", () => {
  it("changes the measurement type", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const butter = result.current.ingredients.find((i) => i.id === BUTTER_ID);
    if (butter === undefined) throw new Error("butter not found");
    act(() => result.current.set_measurement_type([butter.id], "weight"));
    expect(
      result.current.ingredients.find((i) => i.id === BUTTER_ID)?.default_measurement_type,
    ).toBe("weight");
  });
});

describe("use_ingredient_store — rename_ingredient", () => {
  it("updates the ingredient name", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const butter = result.current.ingredients.find((i) => i.id === BUTTER_ID);
    if (butter === undefined) throw new Error("butter not found");
    act(() => result.current.rename_ingredient(butter.id, "Salted Butter"));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.name).toBe("Salted Butter");
  });
});

describe("use_ingredient_store — set_labels", () => {
  it("replaces all labels for an ingredient", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    act(() =>
      result.current.create_ingredient({
        name: "Test Ing Labels",
        default_measurement_type: "volume",
        label_names: ["a", "b"],
      }),
    );
    const id = result.current.ingredients.find((i) => i.name === "Test Ing Labels")?.id;
    if (id === undefined) throw new Error("ingredient not found");
    const x_id = find_or_create_label(doc, "x", INGREDIENT_KINDS);
    const y_id = find_or_create_label(doc, "y", INGREDIENT_KINDS);
    const z_id = find_or_create_label(doc, "z", INGREDIENT_KINDS);
    act(() => result.current.set_labels(id, [x_id, y_id, z_id]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels).toEqual(new Set<KitchenwareLabelId>([x_id, y_id, z_id]));
  });
});

describe("use_ingredient_store — set_parent", () => {
  it("sets and clears parent_id", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const butter = result.current.ingredients.find((i) => i.id === BUTTER_ID);
    if (butter === undefined) throw new Error("butter not found");
    const dairy_id = padded_id(IngredientId, "dairy");
    act(() => result.current.set_parent([butter.id], dairy_id));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.parent_id).toBe(dairy_id);
    act(() => result.current.set_parent([butter.id], undefined));
    expect(result.current.ingredients.find((i) => i.id === BUTTER_ID)?.parent_id).toBeUndefined();
  });
});
