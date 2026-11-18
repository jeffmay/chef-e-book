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
