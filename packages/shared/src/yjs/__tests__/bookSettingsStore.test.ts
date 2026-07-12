import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  getBookSettings,
  getBookSettingsYmap,
  setBookSecondsPerIngredient,
} from "../bookSettingsStore.ts";

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("getBookSettings", () => {
  it("returns no values for an empty doc", () => {
    expect(getBookSettings(doc)).toEqual({});
  });

  it("ignores invalid stored values", () => {
    getBookSettingsYmap(doc).set("seconds_per_ingredient", "ninety");
    expect(getBookSettings(doc)).toEqual({});
    getBookSettingsYmap(doc).set("seconds_per_ingredient", -5);
    expect(getBookSettings(doc)).toEqual({});
  });
});

describe("setBookSecondsPerIngredient", () => {
  it("stores the per-ingredient time", () => {
    setBookSecondsPerIngredient(doc, 90);
    expect(getBookSettings(doc)).toEqual({ seconds_per_ingredient: 90 });
  });

  it("clears the value with undefined", () => {
    setBookSecondsPerIngredient(doc, 90);
    setBookSecondsPerIngredient(doc, undefined);
    expect(getBookSettings(doc)).toEqual({});
  });
});
