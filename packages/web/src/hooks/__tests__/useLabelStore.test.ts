import {
  addIngredient,
  createBookUndoManager,
  fixedId,
  getIngredients,
  getLabels,
  IngredientId,
  type Ingredient,
  type KitchenwareKind,
  type KitchenwareLabelId,
  NameClashError,
} from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import * as Y from "yjs";
import { beforeEach, describe, expect, it } from "vitest";
import { BookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useLabelStore } from "../useLabelStore.ts";

const INGREDIENT_KINDS: ReadonlySet<KitchenwareKind> = new Set(["ingredient"]);

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

function makeWrapper(bookDoc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      BookDocContext.Provider,
      { value: { doc: bookDoc, whenSynced: Promise.resolve() } },
      children,
    );
  };
}

async function renderStore() {
  const rendered = renderHook(() => useLabelStore(), { wrapper: makeWrapper(doc) });
  await flushAsyncEffects();
  return rendered;
}

function butterWith(labels: Set<KitchenwareLabelId>): Ingredient {
  return {
    kind: "ingredient",
    id: fixedId(IngredientId, "butter"),
    name: "Butter",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels,
  };
}

describe("useLabelStore — deleteLabels", () => {
  it("removes the label from every ingredient that had it", async () => {
    const { result } = await renderStore();
    let fatId!: KitchenwareLabelId;
    act(() => {
      fatId = result.current.createLabel("fat", INGREDIENT_KINDS);
      addIngredient(doc, butterWith(new Set([fatId])));
    });

    act(() => result.current.deleteLabels([fatId]));

    expect(getLabels(doc)).toEqual([]);
    expect(getIngredients(doc)[0]?.labels.size).toBe(0);
  });

  it("writes the label deletion and the clean-up in a single transaction", async () => {
    const { result } = await renderStore();
    let fatId!: KitchenwareLabelId;
    act(() => {
      fatId = result.current.createLabel("fat", INGREDIENT_KINDS);
      addIngredient(doc, butterWith(new Set([fatId])));
    });
    let updates = 0;
    doc.on("update", () => updates++);

    act(() => result.current.deleteLabels([fatId]));

    expect(updates).toBe(1);
  });

  it("undoes in one step: the label and its place on the ingredient both come back", async () => {
    const { result } = await renderStore();
    let fatId!: KitchenwareLabelId;
    act(() => {
      fatId = result.current.createLabel("fat", INGREDIENT_KINDS);
      addIngredient(doc, butterWith(new Set([fatId])));
    });
    const undoManager = createBookUndoManager(doc);
    undoManager.stopCapturing();

    act(() => result.current.deleteLabels([fatId]));
    expect(getLabels(doc)).toEqual([]);

    act(() => undoManager.undo());

    expect(getLabels(doc).map((l) => l.id)).toEqual([fatId]);
    expect([...(getIngredients(doc)[0]?.labels ?? [])]).toEqual([fatId]);
    // That one press reverted the whole deletion, so there is nothing earlier left in this history.
    expect(undoManager.canUndo()).toBe(false);
    undoManager.destroy();
  });
});

describe("useLabelStore — name uniqueness", () => {
  it("reports the label that holds a name in any case, but not as a plural", async () => {
    const { result } = await renderStore();
    let dairy!: KitchenwareLabelId;
    act(() => {
      dairy = result.current.createLabel("Dairy", INGREDIENT_KINDS);
    });
    expect(result.current.nameClash("  dAIRY ")).toEqual({ id: dairy, name: "Dairy" });
    expect(result.current.nameClash("Dairies")).toBeUndefined();
  });

  it("refuses to create or rename to a name another label holds", async () => {
    const { result } = await renderStore();
    let dairy!: KitchenwareLabelId;
    let fat!: KitchenwareLabelId;
    act(() => {
      dairy = result.current.createLabel("Dairy", INGREDIENT_KINDS);
      fat = result.current.createLabel("Fat", INGREDIENT_KINDS);
    });
    expect(() => act(() => result.current.createLabel("DAIRY", INGREDIENT_KINDS))).toThrow(
      NameClashError,
    );
    expect(() => act(() => result.current.renameLabel(fat, "dairy"))).toThrow(
      'A label named "Dairy" already exists',
    );
    expect(
      getLabels(doc)
        .map((l) => l.id)
        .sort(),
    ).toEqual([dairy, fat].sort());
  });

  it("lets a label be renamed to another case of its own name", async () => {
    const { result } = await renderStore();
    let dairy!: KitchenwareLabelId;
    act(() => {
      dairy = result.current.createLabel("dairy", INGREDIENT_KINDS);
    });
    act(() => result.current.renameLabel(dairy, "Dairy"));
    expect(getLabels(doc).map((l) => l.name)).toEqual(["Dairy"]);
  });

  it("treats Spices and Spice as different labels", async () => {
    const { result } = await renderStore();
    act(() => {
      result.current.createLabel("Spice", INGREDIENT_KINDS);
      result.current.createLabel("Spices", INGREDIENT_KINDS);
    });
    expect(getLabels(doc)).toHaveLength(2);
  });

  it("reuses the label that holds a name when finding or creating it", async () => {
    const { result } = await renderStore();
    let dairy!: KitchenwareLabelId;
    act(() => {
      dairy = result.current.createLabel("Dairy", INGREDIENT_KINDS);
    });
    let found!: KitchenwareLabelId;
    act(() => {
      found = result.current.findOrCreate("DAIRY", INGREDIENT_KINDS);
    });
    expect(found).toBe(dairy);
    expect(getLabels(doc)).toHaveLength(1);
  });

  it("lets labels be merged into the name of one of them", async () => {
    const { result } = await renderStore();
    let fat!: KitchenwareLabelId;
    let fats!: KitchenwareLabelId;
    act(() => {
      fat = result.current.createLabel("Fat", INGREDIENT_KINDS);
      fats = result.current.createLabel("Fats", INGREDIENT_KINDS);
    });
    act(() => {
      result.current.mergeLabels([fat, fats], "Fat");
    });
    expect(getLabels(doc).map((l) => l.name)).toEqual(["Fat"]);
  });

  it("refuses to merge labels into the name of a label outside the merge", async () => {
    const { result } = await renderStore();
    let fat!: KitchenwareLabelId;
    let oil!: KitchenwareLabelId;
    act(() => {
      fat = result.current.createLabel("Fat", INGREDIENT_KINDS);
      oil = result.current.createLabel("Oil", INGREDIENT_KINDS);
      result.current.createLabel("Dairy", INGREDIENT_KINDS);
    });
    expect(() => act(() => result.current.mergeLabels([fat, oil], "dairy"))).toThrow(
      NameClashError,
    );
    expect(getLabels(doc)).toHaveLength(3);
  });
});
