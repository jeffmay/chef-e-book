import {
  addContainer,
  type Container,
  ContainerId,
  getContainerYmap,
  KitchenwareLabelId,
  paddedId,
} from "@recipe-book/shared";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { KitchenwareDocContext } from "../../contexts/docContext.js";
import { useContainerStore } from "../useContainerStore.js";

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
    return createElement(
      KitchenwareDocContext.Provider,
      { value: { doc, whenSynced: Promise.resolve() } },
      children,
    );
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

describe("useContainerStore — addContainer", () => {
  it("adds a new container and returns it", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    const before = result.current.containers.length;
    let created: Container | undefined;
    act(() => {
      created = result.current.addContainer({ name: "Pot" });
    });
    expect(result.current.containers.length).toBe(before + 1);
    expect(created?.name).toBe("Pot");
    expect(created?.kind).toBe("container");
  });

  it("stores label_ids when provided", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    let created: Container | undefined;
    act(() => {
      created = result.current.addContainer({ name: "Labeled", label_ids: [LABEL_A] });
    });
    expect(created?.labels.has(LABEL_A)).toBe(true);
  });
});

describe("useContainerStore — renameContainer", () => {
  it("renames a container", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    act(() => result.current.renameContainer(BOWL_ID, "Big Bowl"));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.name).toBe("Big Bowl");
  });
});

describe("useContainerStore — setLabels", () => {
  it("replaces labels for a container", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    act(() => result.current.setLabels(BOWL_ID, [LABEL_A]));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.labels.has(LABEL_A)).toBe(true);
  });
});

describe("useContainerStore — setParent", () => {
  it("sets parent_id on a container", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    let pot_id: ContainerId | undefined;
    act(() => {
      const pot = result.current.addContainer({ name: "Pot" });
      pot_id = pot.id;
    });
    if (pot_id === undefined) throw new Error("pot not found");
    act(() => result.current.setParent(BOWL_ID, pot_id));
    expect(result.current.containers.find((c) => c.id === BOWL_ID)?.parent_id).toBe(pot_id);
  });

  it("clears parent_id when undefined passed", () => {
    const { result } = renderHook(() => useContainerStore(), { wrapper: makeWrapper(doc) });
    let pot_id: ContainerId | undefined;
    act(() => {
      const pot = result.current.addContainer({ name: "Pot" });
      pot_id = pot.id;
    });
    if (pot_id === undefined) throw new Error("pot not found");
    act(() => result.current.setParent(BOWL_ID, pot_id));
    act(() => result.current.setParent(BOWL_ID, undefined));
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
