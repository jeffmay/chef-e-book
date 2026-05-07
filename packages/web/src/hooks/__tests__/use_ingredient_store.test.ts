import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { find_or_create_label, type ItemLabel, type ItemKind } from "@recipe-book/shared";
import type { Ingredient } from "@recipe-book/shared";
import { DocContext } from "../../contexts/doc_context.js";
import { use_ingredient_store } from "../use_ingredient_store.js";

const INGREDIENT_KINDS: ReadonlySet<ItemKind> = new Set(["ingredient"]);

function make_wrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(DocContext.Provider, { value: doc }, children);
  };
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("use_ingredient_store", () => {
  it("initialises from defaults on first render", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    expect(result.current.ingredients.length).toBeGreaterThan(0);
  });

  it("create_ingredient adds a new ingredient", () => {
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

  it("add_labels appends labels to selected ingredients", () => {
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

  it("remove_labels removes labels from selected ingredients", () => {
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
    // Labels were created by create_ingredient; look them up by name
    const x_id = find_or_create_label(doc, "x", INGREDIENT_KINDS);
    const y_id = find_or_create_label(doc, "y", INGREDIENT_KINDS);
    act(() => result.current.remove_labels([id], [x_id]));
    const updated = result.current.ingredients.find((i) => i.id === id);
    expect(updated?.labels.has(x_id)).toBe(false);
    expect(updated?.labels.has(y_id)).toBe(true);
  });

  it("set_measurement_type changes the type", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const butter = result.current.ingredients.find((i) => i.id === "butter");
    if (butter === undefined) throw new Error("butter not found in defaults");
    act(() => result.current.set_measurement_type([butter.id], "weight"));
    const updated = result.current.ingredients.find((i) => i.id === "butter");
    expect(updated?.default_measurement_type).toBe("weight");
  });

  it("rename_ingredient updates the ingredient name", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const butter = result.current.ingredients.find((i) => i.id === "butter");
    if (butter === undefined) throw new Error("butter not found in defaults");
    act(() => result.current.rename_ingredient(butter.id, "Salted Butter"));
    expect(result.current.ingredients.find((i) => i.id === "butter")?.name).toBe("Salted Butter");
  });

  it("set_labels replaces all labels for an ingredient", () => {
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
    expect(updated?.labels).toEqual(new Set<ItemLabel.Id>([x_id, y_id, z_id]));
  });

  it("set_parent sets and clears parent_id", () => {
    const { result } = renderHook(() => use_ingredient_store(), {
      wrapper: make_wrapper(doc),
    });
    const butter = result.current.ingredients.find((i) => i.id === "butter");
    if (butter === undefined) throw new Error("butter not found in defaults");
    act(() => result.current.set_parent([butter.id], "dairy" as Ingredient.Id));
    expect(result.current.ingredients.find((i) => i.id === "butter")?.parent_id).toBe("dairy");
    act(() => result.current.set_parent([butter.id], undefined));
    expect(result.current.ingredients.find((i) => i.id === "butter")?.parent_id).toBeUndefined();
  });
});
