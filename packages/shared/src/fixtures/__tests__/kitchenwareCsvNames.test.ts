import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ingredientNameKey, labelNameKey } from "../../names/nameKey.ts";
import { parseKitchenwareCsv } from "../kitchenware.ts";

// The default kitchenware every new book is seeded from.
const SHIPPED_CSV = readFileSync(
  new URL("../../../../web/public/kitchenware.csv", import.meta.url),
  "utf8",
);

const templates = parseKitchenwareCsv(SHIPPED_CSV);

describe("the shipped default kitchenware", () => {
  it("has no two items of the same kind that share a name key", () => {
    // A duplicate would be seeded into every new book and then refuse to be renamed. If this fails,
    // fix the CSV — do not loosen the rule.
    for (const kind of ["ingredient", "container", "equipment"] as const) {
      const byKey = new Map<string, string[]>();
      for (const item of templates.filter((t) => t.kind === kind)) {
        const key = ingredientNameKey(item.name);
        byKey.set(key, [...(byKey.get(key) ?? []), item.name]);
      }
      const duplicates = [...byKey.values()].filter((names) => names.length > 1);
      expect(duplicates, `${kind} names that share a key`).toEqual([]);
    }
  });

  it("has no two labels that share a label key", () => {
    const names = new Set(templates.flatMap((t) => t.label_names));
    const byKey = new Map<string, string[]>();
    for (const name of names) {
      const key = labelNameKey(name);
      byKey.set(key, [...(byKey.get(key) ?? []), name]);
    }
    expect([...byKey.values()].filter((group) => group.length > 1)).toEqual([]);
  });

  it("has no blank names", () => {
    expect(templates.filter((t) => ingredientNameKey(t.name) === "")).toEqual([]);
  });
});
