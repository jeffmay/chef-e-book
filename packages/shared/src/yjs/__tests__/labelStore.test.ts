import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { KitchenwareLabelId } from "../../types/kitchenware.ts";
import {
  addLabel,
  deleteLabels,
  findLabelByName,
  findOrCreateLabel,
  getLabels,
  renameLabel,
} from "../labelStore.ts";
import { paddedId } from "../../types/ids.ts";

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

const INGREDIENT_KINDS = new Set<"ingredient" | "container" | "equipment">(["ingredient"]);

describe("getLabels", () => {
  it("returns empty array for empty doc", () => {
    expect(getLabels(doc)).toEqual([]);
  });

  it("returns sorted labels after add", () => {
    addLabel(doc, "solid", INGREDIENT_KINDS);
    addLabel(doc, "fat", INGREDIENT_KINDS);
    const result = getLabels(doc);
    expect(result.map((l) => l.name)).toEqual(["fat", "solid"]);
  });
});

describe("addLabel", () => {
  it("returns an ID and stores the label", () => {
    const id = addLabel(doc, "liquid", INGREDIENT_KINDS);
    expect(typeof id).toBe("string");
    expect(id).toHaveLength(7);
    const labels = getLabels(doc);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.name).toBe("liquid");
    expect(labels[0]!.id).toBe(id);
  });

  it("stores kinds as a ReadonlySet", () => {
    addLabel(doc, "liquid", INGREDIENT_KINDS);
    const label = getLabels(doc)[0]!;
    expect(label.kinds instanceof Set).toBe(true);
    expect(label.kinds.has("ingredient")).toBe(true);
  });

  it("creates unique IDs for different labels", () => {
    const a = addLabel(doc, "fat", INGREDIENT_KINDS);
    const b = addLabel(doc, "solid", INGREDIENT_KINDS);
    expect(a).not.toBe(b);
  });
});

describe("findLabelByName", () => {
  it("returns null when no label matches", () => {
    expect(findLabelByName(doc, "missing")).toBeNull();
  });

  it("returns the label when found", () => {
    const id = addLabel(doc, "fat", INGREDIENT_KINDS);
    const found = findLabelByName(doc, "fat");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.name).toBe("fat");
  });

  it("returns null for a different name", () => {
    addLabel(doc, "fat", INGREDIENT_KINDS);
    expect(findLabelByName(doc, "solid")).toBeNull();
  });
});

describe("findOrCreateLabel", () => {
  it("creates a new label when one does not exist", () => {
    const id = findOrCreateLabel(doc, "baking", INGREDIENT_KINDS);
    expect(getLabels(doc)).toHaveLength(1);
    expect(getLabels(doc)[0]!.id).toBe(id);
  });

  it("returns the existing id when a label with that name already exists", () => {
    const first_id = addLabel(doc, "baking", INGREDIENT_KINDS);
    const second_id = findOrCreateLabel(doc, "baking", INGREDIENT_KINDS);
    expect(second_id).toBe(first_id);
    expect(getLabels(doc)).toHaveLength(1);
  });
});

describe("deleteLabels", () => {
  it("removes specified labels", () => {
    const fat_id = addLabel(doc, "fat", INGREDIENT_KINDS);
    addLabel(doc, "solid", INGREDIENT_KINDS);
    deleteLabels(doc, [fat_id]);
    const remaining = getLabels(doc);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.name).toBe("solid");
  });

  it("silently ignores unknown ids", () => {
    addLabel(doc, "fat", INGREDIENT_KINDS);
    expect(() => deleteLabels(doc, ["nonexist" as KitchenwareLabelId])).not.toThrow();
    expect(getLabels(doc)).toHaveLength(1);
  });

  it("deletes multiple labels atomically", () => {
    const a_id = addLabel(doc, "a", INGREDIENT_KINDS);
    const b_id = addLabel(doc, "b", INGREDIENT_KINDS);
    addLabel(doc, "c", INGREDIENT_KINDS);
    deleteLabels(doc, [a_id, b_id]);
    const remaining = getLabels(doc);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.name).toBe("c");
  });
});

describe("renameLabel", () => {
  it("updates the label name", () => {
    const id = addLabel(doc, "fat", INGREDIENT_KINDS);
    renameLabel(doc, id, "saturated fat");
    const label = findLabelByName(doc, "saturated fat");
    expect(label).not.toBeNull();
    expect(label!.id).toBe(id);
  });

  it("preserves kinds when renaming", () => {
    const id = addLabel(doc, "fat", INGREDIENT_KINDS);
    renameLabel(doc, id, "saturated fat");
    const label = getLabels(doc).find((l) => l.id === id)!;
    expect(label.kinds.has("ingredient")).toBe(true);
  });

  it("silently skips unknown id", () => {
    expect(() =>
      renameLabel(doc, paddedId(KitchenwareLabelId, "nonexistent"), "new name"),
    ).not.toThrow();
  });
});
