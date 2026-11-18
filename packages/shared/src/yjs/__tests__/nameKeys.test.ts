import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import * as Y from "yjs";
import { NAME_KEY_VERSION } from "../../names/nameKey.ts";
import { fixedId } from "../../types/ids.ts";
import { ContainerId, IngredientId, KitchenwareLabelId } from "../../types/kitchenware.ts";
import { getBookMetaYmap, getNameKeyVersion, setNameKeyVersion } from "../bookMetaStore.ts";
import { getContainerYmap } from "../containerStore.ts";
import { getIngredientYmap } from "../ingredientStore.ts";
import { getLabelsYmap } from "../labelStore.ts";
import { rekeyBookNames } from "../nameKeys.ts";
import { SETUP_ORIGIN } from "../origins.ts";

const CUP = { value: { numerator: 1, denominator: 1 }, unit: "cup" };
const TOMATO = fixedId(IngredientId, "tomato");
const BASIL = fixedId(IngredientId, "basil");
const BOWL = fixedId(ContainerId, "bowl");
const DAIRY = fixedId(KitchenwareLabelId, "dairy");

let doc: Y.Doc;

/** A book written before name keys existed: entries with names but no `name_key`. */
function seedUnkeyedBook() {
  getIngredientYmap(doc).set(TOMATO, {
    name: "Cherry Tomatoes",
    default_measurement_value: CUP,
    labels: [DAIRY],
    parent_id: BASIL,
  });
  getIngredientYmap(doc).set(BASIL, {
    name: "Basil",
    default_measurement_value: CUP,
    labels: [],
  });
  getContainerYmap(doc).set(BOWL, { name: "Mixing Bowls", labels: [] });
  getLabelsYmap(doc).set(DAIRY, { name: "Dairy Products", kinds: ["ingredient"] });
}

beforeEach(() => {
  doc = new Y.Doc();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rekeyBookNames", () => {
  it("writes the key for every ingredient, container, and label, and records the version", () => {
    seedUnkeyedBook();
    expect(rekeyBookNames(doc)).toBe("rekeyed");

    expect(getIngredientYmap(doc).get(TOMATO)).toMatchObject({ name_key: "cherry tomato" });
    expect(getIngredientYmap(doc).get(BASIL)).toMatchObject({ name_key: "basil" });
    expect(getContainerYmap(doc).get(BOWL)).toMatchObject({ name_key: "mixing bowl" });
    expect(getLabelsYmap(doc).get(DAIRY)).toMatchObject({ name_key: "dairy products" });
    expect(getNameKeyVersion(doc)).toBe(NAME_KEY_VERSION);
  });

  it("changes nothing else about the entries", () => {
    seedUnkeyedBook();
    rekeyBookNames(doc);
    expect(getIngredientYmap(doc).get(TOMATO)).toEqual({
      name: "Cherry Tomatoes",
      name_key: "cherry tomato",
      default_measurement_value: CUP,
      labels: [DAIRY],
      parent_id: BASIL,
    });
  });

  it("replaces a stale key", () => {
    getIngredientYmap(doc).set(TOMATO, {
      name: "Tomatoes",
      name_key: "tomatoes",
      default_measurement_value: CUP,
      labels: [],
    });
    rekeyBookNames(doc);
    expect(getIngredientYmap(doc).get(TOMATO)).toMatchObject({ name_key: "tomato" });
  });

  it("does nothing the second time", () => {
    seedUnkeyedBook();
    rekeyBookNames(doc);
    const before = Y.encodeStateAsUpdate(doc);
    expect(rekeyBookNames(doc)).toBe("current");
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it("rewrites everything in one transaction", () => {
    seedUnkeyedBook();
    let updates = 0;
    doc.on("update", () => updates++);
    rekeyBookNames(doc);
    expect(updates).toBe(1);
  });

  it("can never be undone", () => {
    seedUnkeyedBook();
    const undoManager = new Y.UndoManager([
      getIngredientYmap(doc),
      getContainerYmap(doc),
      getLabelsYmap(doc),
      getBookMetaYmap(doc),
    ]);
    const origins: unknown[] = [];
    doc.on("update", (_update: Uint8Array, origin: unknown) => origins.push(origin));

    rekeyBookNames(doc);

    expect(origins).toEqual([SETUP_ORIGIN]);
    expect(undoManager.canUndo()).toBe(false);
  });

  it("marks an empty book as current without writing any entries", () => {
    expect(rekeyBookNames(doc)).toBe("rekeyed");
    expect(getIngredientYmap(doc).size).toBe(0);
    expect(getNameKeyVersion(doc)).toBe(NAME_KEY_VERSION);
  });

  it("skips entries that are not valid", () => {
    getIngredientYmap(doc).set("garbage", "not an ingredient");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => rekeyBookNames(doc)).not.toThrow();
    expect(getIngredientYmap(doc).get("garbage")).toBe("not an ingredient");
    expect(error).toHaveBeenCalled();
  });

  it("leaves a book keyed by a newer build alone, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    seedUnkeyedBook();
    setNameKeyVersion(doc, NAME_KEY_VERSION + 1);

    expect(rekeyBookNames(doc)).toBe("newer");

    expect(getIngredientYmap(doc).get(TOMATO)).not.toHaveProperty("name_key");
    expect(getNameKeyVersion(doc)).toBe(NAME_KEY_VERSION + 1);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("name key version", () => {
  it("is unset for a book that has never been keyed", () => {
    expect(getNameKeyVersion(doc)).toBeUndefined();
  });

  it("is recorded in book_meta, never undoably", () => {
    const undoManager = new Y.UndoManager(getBookMetaYmap(doc));
    setNameKeyVersion(doc, 1);
    expect(getNameKeyVersion(doc)).toBe(1);
    expect(undoManager.canUndo()).toBe(false);
  });
});
