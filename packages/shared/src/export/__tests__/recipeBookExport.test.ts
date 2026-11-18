import { describe, expect, it } from "vitest";
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  parseRecipeBookExport,
  serializeRecipeBookExport,
  type RecipeBookExport,
} from "../recipeBookExport.ts";
import { BAKING_ID, ingredient, label } from "./fixtures.ts";

const VALID: RecipeBookExport = {
  format: EXPORT_FORMAT,
  format_version: EXPORT_FORMAT_VERSION,
  exported_at: 1_700_000_000_000,
  ingredients: [ingredient("flour", "Flour", { labels: new Set([BAKING_ID]) })],
  containers: [],
  labels: [label(BAKING_ID, "baking")],
  recipe_folders: [],
  recipes: [],
  missing_references: [],
};

const text = (value: unknown) => JSON.stringify(value);

describe("serializeRecipeBookExport", () => {
  it("writes Sets as arrays", () => {
    const parsed = JSON.parse(serializeRecipeBookExport(VALID));
    expect(parsed.ingredients[0].labels).toEqual([BAKING_ID]);
    expect(parsed.labels[0].kinds).toEqual(["ingredient"]);
  });

  it("is readable, indented JSON", () => {
    expect(serializeRecipeBookExport(VALID)).toContain('\n  "format": "chefe_book_export"');
  });
});

describe("parseRecipeBookExport", () => {
  it("reads what was written, turning arrays back into Sets", () => {
    const result = parseRecipeBookExport(serializeRecipeBookExport(VALID));
    expect(result).toEqual({ ok: true, value: VALID });
    if (result.ok) expect(result.value.ingredients[0]?.labels).toBeInstanceOf(Set);
  });

  it("says when the file is not JSON", () => {
    expect(parseRecipeBookExport("{truncated")).toEqual({
      ok: false,
      error: "This file is not valid JSON.",
    });
  });

  it.each([
    ["an array", text([])],
    ["an object with no format", text({ ingredients: [] })],
    ["another kind of file", text({ format: "something_else", format_version: 1 })],
    ["a string", text("hello")],
  ])("says when the file is not a recipe book export: %s", (_what, body) => {
    expect(parseRecipeBookExport(body)).toEqual({
      ok: false,
      error: "This file is not a recipe book export.",
    });
  });

  it("refuses a newer format with a message that says what to do", () => {
    const result = parseRecipeBookExport(
      text({ ...VALID, ingredients: [], labels: [], format_version: EXPORT_FORMAT_VERSION + 1 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("newer version of the app");
      expect(result.error).toContain(`format ${EXPORT_FORMAT_VERSION + 1}`);
      expect(result.error).toContain("Update the app");
    }
  });

  it("says when the file is one of ours but does not match the schema", () => {
    const result = parseRecipeBookExport(text({ format: EXPORT_FORMAT, format_version: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("damaged");
  });

  it("says when an entry inside is invalid", () => {
    const body = JSON.parse(serializeRecipeBookExport(VALID));
    body.ingredients[0].default_measurement_value = "a cup";
    expect(parseRecipeBookExport(text(body)).ok).toBe(false);
  });

  it("never throws", () => {
    for (const body of ["", "null", "0", "[]", "{}", '{"format":1}', "\u0000"]) {
      expect(() => parseRecipeBookExport(body)).not.toThrow();
    }
  });
});
