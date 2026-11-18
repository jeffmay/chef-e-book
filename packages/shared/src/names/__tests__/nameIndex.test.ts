import { describe, expect, it } from "vitest";
import { buildNameIndex, duplicateIds, findNameClash } from "../nameIndex.ts";

describe("buildNameIndex", () => {
  it("maps each key to the ids that hold it", () => {
    const index = buildNameIndex([
      { id: "a", key: "tomato" },
      { id: "b", key: "basil" },
    ]);
    expect(index.get("tomato")).toEqual(["a"]);
    expect(index.get("basil")).toEqual(["b"]);
    expect(index.get("nothing")).toBeUndefined();
  });

  it("keeps duplicates as a list, lowest id first", () => {
    const index = buildNameIndex([
      { id: "c", key: "tomato" },
      { id: "a", key: "tomato" },
      { id: "b", key: "tomato" },
    ]);
    expect(index.get("tomato")).toEqual(["a", "b", "c"]);
  });

  it("leaves out entries with a blank key", () => {
    const index = buildNameIndex([{ id: "a", key: "" }]);
    expect(index.size).toBe(0);
  });
});

describe("findNameClash", () => {
  const index = buildNameIndex([
    { id: "a", key: "tomato" },
    { id: "b", key: "basil" },
  ]);

  it("is undefined for a free key", () => {
    expect(findNameClash(index, "oregano")).toBeUndefined();
  });

  it("finds the id that holds the key", () => {
    expect(findNameClash(index, "basil")).toBe("b");
  });

  it("does not count the entity's own entry, so it can be renamed to another spelling of its own name", () => {
    expect(findNameClash(index, "tomato", "a")).toBeUndefined();
  });

  it("still finds a different entity that holds the key", () => {
    expect(findNameClash(index, "basil", "a")).toBe("b");
  });

  it("can exclude several ids, e.g. the labels being merged into one name", () => {
    const merging = buildNameIndex([
      { id: "a", key: "fat" },
      { id: "b", key: "fat" },
      { id: "c", key: "fat" },
    ]);
    expect(findNameClash(merging, "fat", ["a", "b"])).toBe("c");
    expect(findNameClash(merging, "fat", ["a", "b", "c"])).toBeUndefined();
  });

  it("returns the lowest id when several hold the key", () => {
    const duplicated = buildNameIndex([
      { id: "z", key: "tomato" },
      { id: "m", key: "tomato" },
    ]);
    expect(findNameClash(duplicated, "tomato")).toBe("m");
    expect(findNameClash(duplicated, "tomato", "m")).toBe("z");
  });

  it("never reports a clash for a blank key", () => {
    expect(findNameClash(index, "")).toBeUndefined();
  });
});

describe("duplicateIds", () => {
  it("lists every id that shares a key with another", () => {
    const index = buildNameIndex([
      { id: "a", key: "tomato" },
      { id: "b", key: "tomato" },
      { id: "c", key: "basil" },
    ]);
    expect(duplicateIds(index)).toEqual(new Set(["a", "b"]));
  });

  it("is empty when every key is unique", () => {
    expect(duplicateIds(buildNameIndex([{ id: "a", key: "x" }])).size).toBe(0);
  });
});
