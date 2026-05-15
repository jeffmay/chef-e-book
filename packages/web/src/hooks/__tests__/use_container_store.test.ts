import {
  addContainer,
  type Container,
  ContainerId,
  getContainerYmap,
  KitchenwareLabelId,
} from "@recipe-book/shared";
import { paddedId } from "@recipe-book/shared/src/types/ids.js";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { DocContext } from "../../contexts/doc_context.js";
import { useContainerStore } from "../use_container_store.js";

const BOWL_ID = paddedId(ContainerId, "bowl");
const LABEL_A = paddedId(KitchenwareLabelId, "aaa");

const BOWL: Container = {
  kind: "container",
  id: BOWL_ID,
  name: "Bowl",
  labels: new Set(),
};

function makeWrapper(doc: Y.Doc) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(DocContext.Provider, { value: doc }, children);
  };
}

let doc: Y.Doc;

beforeEach(() => {
  doc = new Y.Doc();
  addContainer(doc, BOWL);
});

describe("useContainerStore — initial state", () => {
  it("returns existing containers from doc", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    expect(result.current.containers).toHaveLength(1);
    expect(result.current.containers[0]?.name).toBe("Bowl");
  });
});

describe("useContainerStore — add_container", () => {
  it("adds a new container and returns it", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    const before = result.current.containers.length;
    let created: Container | undefined;
    act(() => {
      created = result.current.add_container({ name: "Pot" });
    });
    expect(result.current.containers.length).toBe(before + 1);
    expect(created?.name).toBe("Pot");
    expect(created?.kind).toBe("container");
  });

  it("stores label_ids when provided", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    let created: Container | undefined;
    act(() => {
      created = result.current.add_container({ name: "Labeled", label_ids: [LABEL_A] });
    });
    expect(created?.labels.has(LABEL_A)).toBe(true);
  });
});

describe("useContainerStore — rename_container", () => {
  it("renames a container", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    act(() => result.current.rename_container(BOWL_ID, "Big Bowl"));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.name).toBe("Big Bowl");
  });
});

describe("useContainerStore — set_labels", () => {
  it("replaces labels for a container", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    act(() => result.current.set_labels(BOWL_ID, [LABEL_A]));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.labels.has(LABEL_A)).toBe(true);
  });
});

describe("useContainerStore — set_parent", () => {
  it("sets parent_id on a container", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    let pot_id: ContainerId | undefined;
    act(() => {
      const pot = result.current.add_container({ name: "Pot" });
      pot_id = pot.id;
    });
    if (pot_id === undefined) throw new Error("pot not found");
    act(() => result.current.set_parent(BOWL_ID, pot_id));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.parent_id).toBe(pot_id);
  });

  it("clears parent_id when undefined passed", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    let pot_id: ContainerId | undefined;
    act(() => {
      const pot = result.current.add_container({ name: "Pot" });
      pot_id = pot.id;
    });
    if (pot_id === undefined) throw new Error("pot not found");
    act(() => result.current.set_parent(BOWL_ID, pot_id));
    act(() => result.current.set_parent(BOWL_ID, undefined));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.parent_id).toBeUndefined();
  });

  it("reacts to external yjs changes", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    const map = getContainerYmap(doc);
    act(() => {
      map.set(BOWL_ID, { name: "External Update", labels: [] });
    });
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.name).toBe("External Update");
  });
});
