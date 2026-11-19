import {
  fixedId,
  getIngredientYmap,
  getNameKeyVersion,
  IngredientId,
  NAME_KEY_VERSION,
} from "@recipe-book/shared";
import { renderHook } from "@testing-library/react";
import * as Y from "yjs";
import { beforeEach, describe, expect, it } from "vitest";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useRekeyBookNames } from "../useRekeyBookNames.ts";

const TOMATO = fixedId(IngredientId, "tomato");

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  // An ingredient from before name keys existed.
  getIngredientYmap(doc).set(TOMATO, {
    name: "Cherry Tomatoes",
    default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
    labels: [],
  });
});

describe("useRekeyBookNames", () => {
  it("keys the book's names once the document has synced", async () => {
    renderHook(() => useRekeyBookNames({ doc, whenSynced: Promise.resolve() }));
    await flushAsyncEffects();
    expect(getIngredientYmap(doc).get(TOMATO)).toMatchObject({ name_key: "cherry tomato" });
    expect(getNameKeyVersion(doc)).toBe(NAME_KEY_VERSION);
  });

  it("waits for the book's metadata to be in place before recording the version", async () => {
    let metaReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      metaReady = resolve;
    });
    renderHook(() => useRekeyBookNames({ doc, whenSynced: Promise.resolve() }, ready));
    await flushAsyncEffects();
    expect(getNameKeyVersion(doc)).toBeUndefined();

    metaReady();
    await flushAsyncEffects();
    expect(getNameKeyVersion(doc)).toBe(NAME_KEY_VERSION);
  });

  it("does nothing until the document has synced", async () => {
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    renderHook(() => useRekeyBookNames({ doc, whenSynced }));
    await flushAsyncEffects();
    expect(getNameKeyVersion(doc)).toBeUndefined();

    finishSync();
    await flushAsyncEffects();
    expect(getNameKeyVersion(doc)).toBe(NAME_KEY_VERSION);
  });

  it("writes nothing if unmounted before the document syncs", async () => {
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    const { unmount } = renderHook(() => useRekeyBookNames({ doc, whenSynced }));
    unmount();
    finishSync();
    await flushAsyncEffects();
    expect(getNameKeyVersion(doc)).toBeUndefined();
  });

  it("is safe to run on every open", async () => {
    const first = renderHook(() => useRekeyBookNames({ doc, whenSynced: Promise.resolve() }));
    await flushAsyncEffects();
    first.unmount();
    const before = Y.encodeStateAsUpdate(doc);

    renderHook(() => useRekeyBookNames({ doc, whenSynced: Promise.resolve() }));
    await flushAsyncEffects();
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });
});
