import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { paddedId } from "../../types/ids.js";
import { type Container, ContainerId, KitchenwareLabelId } from "../../types/kitchenware.js";
import {
  addContainer,
  getContainers,
  renameContainer,
  setLabelsForContainer,
  setParentForContainer,
} from "../container_store.js";

const BOWL_ID = paddedId(ContainerId, "bowl");
const POT_ID = paddedId(ContainerId, "pot");
const LABEL_A = paddedId(KitchenwareLabelId, "aaa");
const LABEL_B = paddedId(KitchenwareLabelId, "bbb");

const BOWL: Container = {
  kind: "container",
  id: BOWL_ID,
  name: "Bowl",
  labels: new Set(),
};
const POT: Container = {
  kind: "container",
  id: POT_ID,
  name: "Pot",
  labels: new Set([LABEL_A]),
};

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
});

describe("getContainers", () => {
  it("returns empty array for empty doc", () => {
    expect(getContainers(doc)).toEqual([]);
  });

  it("returns sorted containers after add", () => {
    addContainer(doc, POT);
    addContainer(doc, BOWL);
    const result = getContainers(doc);
    expect(result.map((c) => c.name)).toEqual(["Bowl", "Pot"]);
  });
});

describe("addContainer", () => {
  it("stores all fields", () => {
    addContainer(doc, BOWL);
    const result = getContainers(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: BOWL_ID, name: "Bowl", kind: "container" });
  });

  it("stores parent_id when present", () => {
    const child: Container = { ...BOWL, id: paddedId(ContainerId, "sml"), parent_id: POT_ID };
    addContainer(doc, child);
    const result = getContainers(doc);
    expect(result[0]?.parent_id).toBe(POT_ID);
  });

  it("stores container without parent_id cleanly", () => {
    addContainer(doc, BOWL);
    const result = getContainers(doc);
    expect(result[0]).not.toHaveProperty("parent_id");
  });
});

describe("renameContainer", () => {
  it("updates the container name", () => {
    addContainer(doc, BOWL);
    renameContainer(doc, BOWL_ID, "Large Bowl");
    const result = getContainers(doc).find((c) => c.id === BOWL_ID);
    expect(result?.name).toBe("Large Bowl");
  });

  it("silently skips unknown ids", () => {
    expect(() => renameContainer(doc, paddedId(ContainerId, "unk"), "Name")).not.toThrow();
  });
});

describe("setLabelsForContainer", () => {
  it("replaces labels for the container", () => {
    addContainer(doc, BOWL);
    setLabelsForContainer(doc, BOWL_ID, [LABEL_A, LABEL_B]);
    const result = getContainers(doc).find((c) => c.id === BOWL_ID);
    expect(result?.labels).toEqual(new Set([LABEL_A, LABEL_B]));
  });

  it("clears labels when empty array passed", () => {
    addContainer(doc, POT);
    setLabelsForContainer(doc, POT_ID, []);
    const result = getContainers(doc).find((c) => c.id === POT_ID);
    expect(result?.labels).toEqual(new Set());
  });

  it("silently skips unknown ids", () => {
    expect(() =>
      setLabelsForContainer(doc, paddedId(ContainerId, "unk"), [LABEL_A]),
    ).not.toThrow();
  });
});

describe("setParentForContainer", () => {
  it("sets parent_id", () => {
    addContainer(doc, BOWL);
    setParentForContainer(doc, BOWL_ID, POT_ID);
    const result = getContainers(doc).find((c) => c.id === BOWL_ID);
    expect(result?.parent_id).toBe(POT_ID);
  });

  it("clears parent_id when undefined passed", () => {
    const child: Container = { ...BOWL, parent_id: POT_ID };
    addContainer(doc, child);
    setParentForContainer(doc, BOWL_ID, undefined);
    const result = getContainers(doc).find((c) => c.id === BOWL_ID);
    expect(result?.parent_id).toBeUndefined();
  });
});
