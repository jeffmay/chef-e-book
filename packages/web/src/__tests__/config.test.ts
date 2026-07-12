import { DEFAULT_SECONDS_PER_INGREDIENT } from "@recipe-book/shared";
import { describe, expect, it } from "vitest";
import { parseSecondsPerIngredient } from "../config.ts";

describe("parseSecondsPerIngredient", () => {
  it("parses a valid number of seconds", () => {
    expect(parseSecondsPerIngredient("90")).toBe(90);
  });

  it("allows zero", () => {
    expect(parseSecondsPerIngredient("0")).toBe(0);
  });

  it("falls back to the shared default when unset", () => {
    expect(parseSecondsPerIngredient(undefined)).toBe(DEFAULT_SECONDS_PER_INGREDIENT);
  });

  it("falls back for empty strings", () => {
    expect(parseSecondsPerIngredient("  ")).toBe(DEFAULT_SECONDS_PER_INGREDIENT);
  });

  it("falls back for non-numeric values", () => {
    expect(parseSecondsPerIngredient("two minutes")).toBe(DEFAULT_SECONDS_PER_INGREDIENT);
  });

  it("falls back for negative values", () => {
    expect(parseSecondsPerIngredient("-30")).toBe(DEFAULT_SECONDS_PER_INGREDIENT);
  });
});
