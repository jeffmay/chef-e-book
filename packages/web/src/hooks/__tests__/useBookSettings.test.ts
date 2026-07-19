import { setBookSecondsPerIngredient } from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { BUILD_SECONDS_PER_INGREDIENT } from "../../config.ts";
import { RecipeBookDocContext } from "../../contexts/docContext.ts";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useBookSettings } from "../useBookSettingsStore.ts";

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

function makeWrapper(recipeBookDoc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      RecipeBookDocContext.Provider,
      { value: { doc: recipeBookDoc, whenSynced: Promise.resolve() } },
      children,
    );
  };
}

async function renderBookSettings() {
  const rendered = renderHook(() => useBookSettings(), { wrapper: makeWrapper(doc) });
  await flushAsyncEffects();
  return rendered;
}

describe("useBookSettings", () => {
  it("falls back to the build default when the book has no override", async () => {
    const { result } = await renderBookSettings();
    expect(result.current.secondsPerIngredient).toBe(BUILD_SECONDS_PER_INGREDIENT);
    expect(result.current.bookSecondsPerIngredient).toBeUndefined();
  });

  it("uses the book-level override when set", async () => {
    setBookSecondsPerIngredient(doc, 45);
    const { result } = await renderBookSettings();
    expect(result.current.secondsPerIngredient).toBe(45);
    expect(result.current.bookSecondsPerIngredient).toBe(45);
  });

  it("reflects external changes via the observer", async () => {
    const { result } = await renderBookSettings();
    act(() => setBookSecondsPerIngredient(doc, 60));
    expect(result.current.secondsPerIngredient).toBe(60);
  });

  it("sets and clears the override through the store setter", async () => {
    const { result } = await renderBookSettings();
    act(() => result.current.setSecondsPerIngredient(75));
    expect(result.current.secondsPerIngredient).toBe(75);
    act(() => result.current.setSecondsPerIngredient(undefined));
    expect(result.current.secondsPerIngredient).toBe(BUILD_SECONDS_PER_INGREDIENT);
  });
});
