import { describe, expect, it } from "vitest";
import { ingredientNameKey, labelNameKey, NAME_KEY_VERSION } from "../nameKey.ts";

describe("NAME_KEY_VERSION", () => {
  it("starts at 1", () => {
    expect(NAME_KEY_VERSION).toBe(1);
  });
});

describe("ingredientNameKey", () => {
  it.each([
    ["Tomato", "tomato"],
    ["TOMATO", "tomato"],
    ["  Tomato  ", "tomato"],
    ["Cherry   Tomato", "cherry tomato"],
    ["Cherry\tTomato", "cherry tomato"],
    ["", ""],
    ["   ", ""],
  ])("normalizes %j to %j", (name, key) => {
    expect(ingredientNameKey(name)).toBe(key);
  });

  it("normalizes Unicode (NFKC), so a decomposed name matches a composed one", () => {
    expect(ingredientNameKey("Crème fraiche")).toBe(ingredientNameKey("Crème fraiche"));
    expect(ingredientNameKey("ﬁg")).toBe("fig");
  });

  it("does not fold accents", () => {
    expect(ingredientNameKey("Jalapeño")).not.toBe(ingredientNameKey("Jalapeno"));
  });

  describe("singular and plural forms share a key", () => {
    it.each([
      ["Tomato", "Tomatoes"],
      ["Potato", "Potatoes"],
      ["Cherry", "Cherries"],
      ["Blueberry", "Blueberries"],
      ["Bay Leaf", "Bay Leaves"],
      ["Knife", "Knives"],
      ["Egg", "Eggs"],
      ["Pea", "Peas"],
      ["Chocolate Chip", "Chocolate Chips"],
      ["Brussels Sprout", "Brussels Sprouts"],
      ["Sun-dried Tomato", "Sun-dried Tomatoes"],
      ["French Fry", "French Fries"],
      ["Radish", "Radishes"],
      ["Chili", "Chilies"],
      ["Chili", "Chilis"],
      ["Cheese", "Cheeses"],
      ["Anchovy", "Anchovies"],
    ])("%s and %s", (singular, plural) => {
      expect(ingredientNameKey(singular)).toBe(ingredientNameKey(plural));
    });

    it("keeps the earlier words as they are, singularizing only the last", () => {
      expect(ingredientNameKey("Cherry Tomatoes")).toBe("cherry tomato");
      expect(ingredientNameKey("Cherries and Tomatoes")).toBe("cherries and tomato");
    });
  });

  describe("words that only look plural are left alone", () => {
    it.each([
      "Molasses",
      "Hummus",
      "Couscous",
      "Asparagus",
      "Swiss",
      "Hibiscus",
      "Citrus",
      "Watercress",
      "Lemongrass",
      "Bitters",
      "Grits",
    ])("%s", (word) => {
      expect(ingredientNameKey(word)).toBe(word.toLowerCase());
    });

    it("when they end a longer name", () => {
      expect(ingredientNameKey("Dark Molasses")).toBe("dark molasses");
      expect(ingredientNameKey("Israeli Couscous")).toBe("israeli couscous");
    });
  });

  it.each([
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__defineGetter__",
  ])("treats the name %s as plain text, not as a property of the override table", (name) => {
    expect(ingredientNameKey(name)).toBe(name.toLowerCase());
  });

  it("does not make unrelated prototype-named ingredients collide", () => {
    expect(ingredientNameKey("__proto__")).not.toBe(ingredientNameKey("__defineGetter__"));
  });

  it("keeps words that are the same in both numbers", () => {
    expect(ingredientNameKey("Fish")).toBe("fish");
    expect(ingredientNameKey("Rice")).toBe("rice");
    expect(ingredientNameKey("Bass")).toBe("bass");
  });

  it("keeps different ingredients apart", () => {
    expect(ingredientNameKey("Tomato")).not.toBe(ingredientNameKey("Tomato Paste"));
    expect(ingredientNameKey("Cherry Tomato")).not.toBe(ingredientNameKey("Tomato"));
    expect(ingredientNameKey("Pea")).not.toBe(ingredientNameKey("Peach"));
  });

  it("is idempotent: a key keyed again is unchanged", () => {
    for (const name of ["Cherry Tomatoes", "Bay Leaves", "Molasses", "Chilies", "Fish"]) {
      const key = ingredientNameKey(name);
      expect(ingredientNameKey(key)).toBe(key);
    }
  });
});

describe("labelNameKey", () => {
  it.each([
    ["Spice", "spice"],
    ["  SPICE  ", "spice"],
    ["Dry   Goods", "dry goods"],
    ["", ""],
  ])("normalizes %j to %j", (name, key) => {
    expect(labelNameKey(name)).toBe(key);
  });

  it("ignores case, surrounding whitespace, and Unicode form", () => {
    expect(labelNameKey("Fat")).toBe(labelNameKey("  fAT "));
    expect(labelNameKey("Crème")).toBe(labelNameKey("Crème"));
  });

  it("does not singularize: Spices and Spice are different labels", () => {
    expect(labelNameKey("Spices")).not.toBe(labelNameKey("Spice"));
    expect(labelNameKey("Spices")).toBe("spices");
  });
});
