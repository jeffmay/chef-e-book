import {
  addIngredient,
  fixedId,
  getBookMetaYmap,
  getIngredients,
  IngredientId,
  isDefaultKitchenwareSeeded,
  type Ingredient,
} from "@recipe-book/shared";
import { renderHook } from "@testing-library/react";
import * as Y from "yjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushAsyncEffects } from "../../testUtils.ts";
import { useSeedDefaultKitchenware } from "../useSeedDefaultKitchenware.ts";

const CSV = `Unique ID,Type,Description,Default Measurement Type,Labels
------butter,ingredient,Butter,volume,fat+solid
------cheese,ingredient,Cheese,weight,solid
`;

const SUGAR: Ingredient = {
  kind: "ingredient",
  id: fixedId(IngredientId, "sugar"),
  name: "Sugar",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" },
  labels: new Set(),
};

const names = (doc: Y.Doc) => getIngredients(doc).map((i) => i.name);
const okResponse = (csv: string) => ({ ok: true, text: () => Promise.resolve(csv) });

let doc: Y.Doc;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  doc = new Y.Doc();
  fetchMock = vi.fn().mockResolvedValue(okResponse(CSV));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderSeed(whenSynced: Promise<unknown> = Promise.resolve()) {
  return renderHook(() => useSeedDefaultKitchenware({ doc, whenSynced }));
}

describe("useSeedDefaultKitchenware", () => {
  it("seeds an empty book from the shipped CSV and records it", async () => {
    renderSeed();
    await flushAsyncEffects();
    expect(names(doc)).toEqual(["Butter", "Cheese"]);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does nothing until the document has synced", async () => {
    let finishSync!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    renderSeed(whenSynced);
    await flushAsyncEffects();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(names(doc)).toEqual([]);

    finishSync();
    await flushAsyncEffects();
    expect(names(doc)).toEqual(["Butter", "Cheese"]);
  });

  it("does not fetch for a book that already has ingredients, and marks it as dealt with", async () => {
    addIngredient(doc, SUGAR);
    renderSeed();
    await flushAsyncEffects();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(names(doc)).toEqual(["Sugar"]);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(true);
  });

  it("does not fetch, or re-seed, a book that was seeded and then emptied", async () => {
    getBookMetaYmap(doc).set("seeded_defaults", true);
    renderSeed();
    await flushAsyncEffects();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(names(doc)).toEqual([]);
  });

  it("seeds only once when two instances race on the same book", async () => {
    renderSeed();
    renderSeed();
    await flushAsyncEffects();
    expect(names(doc)).toEqual(["Butter", "Cheese"]);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(true);
  });

  it("leaves the book unmarked when the fetch fails, and succeeds on the next open", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const first = renderSeed();
    await flushAsyncEffects();
    expect(warn).toHaveBeenCalled();
    expect(isDefaultKitchenwareSeeded(doc)).toBe(false);
    expect(names(doc)).toEqual([]);
    first.unmount();

    renderSeed();
    await flushAsyncEffects();
    expect(names(doc)).toEqual(["Butter", "Cheese"]);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(true);
  });

  it("leaves the book unmarked when the server does not return the file", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") });
    renderSeed();
    await flushAsyncEffects();
    expect(isDefaultKitchenwareSeeded(doc)).toBe(false);
  });

  it("leaves the book unmarked when the CSV has no rows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(okResponse(""));
    renderSeed();
    await flushAsyncEffects();
    expect(warn).toHaveBeenCalled();
    expect(isDefaultKitchenwareSeeded(doc)).toBe(false);
  });

  it("writes nothing if unmounted before the fetch finishes", async () => {
    let respond!: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        respond = resolve;
      }),
    );
    const { unmount } = renderSeed();
    await flushAsyncEffects();
    unmount();
    respond(okResponse(CSV));
    await flushAsyncEffects();
    expect(names(doc)).toEqual([]);
    expect(isDefaultKitchenwareSeeded(doc)).toBe(false);
  });
});
