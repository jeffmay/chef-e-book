import { describe, expect, it } from "vitest";
import { describeNameClash, NameClashError } from "../nameClash.ts";

describe("describeNameClash", () => {
  it("names the existing item and uses the right article", () => {
    expect(describeNameClash("ingredient", { id: "a", name: "Tomato" })).toBe(
      'An ingredient named "Tomato" already exists',
    );
    expect(describeNameClash("container", { id: "a", name: "Bowl" })).toBe(
      'A container named "Bowl" already exists',
    );
    expect(describeNameClash("label", { id: "a", name: "Dairy" })).toBe(
      'A label named "Dairy" already exists',
    );
  });
});

describe("NameClashError", () => {
  it("carries the kind and the existing entry, with the same message the forms show", () => {
    const error = new NameClashError("ingredient", { id: "a", name: "Tomato" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NameClashError");
    expect(error.kind).toBe("ingredient");
    expect(error.clash).toEqual({ id: "a", name: "Tomato" });
    expect(error.message).toBe('An ingredient named "Tomato" already exists');
  });
});
