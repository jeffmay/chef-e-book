import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  get_labels,
  add_label,
  find_label_by_name,
  find_or_create_label,
  delete_labels,
  rename_label,
} from "../label_store.js";
import type { ItemLabel } from "../../types/item_label.js";

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

const INGREDIENT_KINDS = new Set<"ingredient" | "container" | "equipment">(["ingredient"]);

describe("get_labels", () => {
  it("returns empty array for empty doc", () => {
    expect(get_labels(doc)).toEqual([]);
  });

  it("returns sorted labels after add", () => {
    add_label(doc, "solid", INGREDIENT_KINDS);
    add_label(doc, "fat", INGREDIENT_KINDS);
    const result = get_labels(doc);
    expect(result.map((l) => l.name)).toEqual(["fat", "solid"]);
  });
});

describe("add_label", () => {
  it("returns an ID and stores the label", () => {
    const id = add_label(doc, "liquid", INGREDIENT_KINDS);
    expect(typeof id).toBe("string");
    expect(id).toHaveLength(7);
    const labels = get_labels(doc);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.name).toBe("liquid");
    expect(labels[0]!.id).toBe(id);
  });

  it("stores kinds as a ReadonlySet", () => {
    add_label(doc, "liquid", INGREDIENT_KINDS);
    const label = get_labels(doc)[0]!;
    expect(label.kinds instanceof Set).toBe(true);
    expect(label.kinds.has("ingredient")).toBe(true);
  });

  it("creates unique IDs for different labels", () => {
    const a = add_label(doc, "fat", INGREDIENT_KINDS);
    const b = add_label(doc, "solid", INGREDIENT_KINDS);
    expect(a).not.toBe(b);
  });
});

describe("find_label_by_name", () => {
  it("returns null when no label matches", () => {
    expect(find_label_by_name(doc, "missing")).toBeNull();
  });

  it("returns the label when found", () => {
    const id = add_label(doc, "fat", INGREDIENT_KINDS);
    const found = find_label_by_name(doc, "fat");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.name).toBe("fat");
  });

  it("returns null for a different name", () => {
    add_label(doc, "fat", INGREDIENT_KINDS);
    expect(find_label_by_name(doc, "solid")).toBeNull();
  });
});

describe("find_or_create_label", () => {
  it("creates a new label when one does not exist", () => {
    const id = find_or_create_label(doc, "baking", INGREDIENT_KINDS);
    expect(get_labels(doc)).toHaveLength(1);
    expect(get_labels(doc)[0]!.id).toBe(id);
  });

  it("returns the existing id when a label with that name already exists", () => {
    const first_id = add_label(doc, "baking", INGREDIENT_KINDS);
    const second_id = find_or_create_label(doc, "baking", INGREDIENT_KINDS);
    expect(second_id).toBe(first_id);
    expect(get_labels(doc)).toHaveLength(1);
  });
});

describe("delete_labels", () => {
  it("removes specified labels", () => {
    const fat_id = add_label(doc, "fat", INGREDIENT_KINDS);
    add_label(doc, "solid", INGREDIENT_KINDS);
    delete_labels(doc, [fat_id]);
    const remaining = get_labels(doc);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.name).toBe("solid");
  });

  it("silently ignores unknown ids", () => {
    add_label(doc, "fat", INGREDIENT_KINDS);
    expect(() => delete_labels(doc, ["nonexist" as ItemLabel.Id])).not.toThrow();
    expect(get_labels(doc)).toHaveLength(1);
  });

  it("deletes multiple labels atomically", () => {
    const a_id = add_label(doc, "a", INGREDIENT_KINDS);
    const b_id = add_label(doc, "b", INGREDIENT_KINDS);
    add_label(doc, "c", INGREDIENT_KINDS);
    delete_labels(doc, [a_id, b_id]);
    const remaining = get_labels(doc);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.name).toBe("c");
  });
});

describe("rename_label", () => {
  it("updates the label name", () => {
    const id = add_label(doc, "fat", INGREDIENT_KINDS);
    rename_label(doc, id, "saturated fat");
    const label = find_label_by_name(doc, "saturated fat");
    expect(label).not.toBeNull();
    expect(label!.id).toBe(id);
  });

  it("preserves kinds when renaming", () => {
    const id = add_label(doc, "fat", INGREDIENT_KINDS);
    rename_label(doc, id, "saturated fat");
    const label = get_labels(doc).find((l) => l.id === id)!;
    expect(label.kinds.has("ingredient")).toBe(true);
  });

  it("silently skips unknown id", () => {
    expect(() => rename_label(doc, "nonexist" as ItemLabel.Id, "new name")).not.toThrow();
  });
});
