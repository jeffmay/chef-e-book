import { type } from "arktype";
import type * as Y from "yjs";
import { Companion } from "../types/companion.ts";
import { loadId } from "../types/ids.ts";
import type { Container } from "../types/kitchenware.ts";
import { ContainerId, KitchenwareLabelId } from "../types/kitchenware.ts";
import { setOf } from "../types/sets.ts";
import type { ValidationError } from "./validation.ts";
import { isInvalid, isValid, validateByIdOrLog } from "./validation.ts";

const MAP_KEY = "containers";

export function getContainerYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

const StoredContainer = Companion(
  "StoredContainer",
  type({
    name: "string",
    labels: setOf<KitchenwareLabelId>(KitchenwareLabelId.type),
    "parent_id?": ContainerId.type,
  }),
);

type StoredContainer = typeof StoredContainer.type.infer;

function toStored(c: Container) {
  return {
    name: c.name,
    labels: [...c.labels],
    ...(c.parent_id !== undefined && { parent_id: c.parent_id }),
  };
}

function validateStoredOrLog(id: ContainerId, raw: unknown): Container | ValidationError {
  const result = validateByIdOrLog(StoredContainer, id, raw, { dataFrom: "localstorage" });
  if (isInvalid(result)) return result;
  return {
    kind: "container",
    id,
    name: result.name,
    labels: result.labels,
    ...(result.parent_id !== undefined && { parent_id: result.parent_id }),
  };
}

export function getContainers(doc: Y.Doc): Container[] {
  const map = getContainerYmap(doc);
  const results: Container[] = [];
  map.forEach((value, id) => {
    const container = validateStoredOrLog(loadId(ContainerId, id), value);
    if (isValid(container)) results.push(container);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function addContainer(doc: Y.Doc, container: Container): void {
  getContainerYmap(doc).set(container.id, toStored(container));
}

export function renameContainer(doc: Y.Doc, id: ContainerId, name: string): void {
  const map = getContainerYmap(doc);
  const container = validateStoredOrLog(id, map.get(id));
  if (isInvalid(container)) return;
  map.set(id, toStored({ ...container, name }));
}

export function setLabelsForContainer(
  doc: Y.Doc,
  id: ContainerId,
  label_ids: readonly KitchenwareLabelId[],
): void {
  const map = getContainerYmap(doc);
  const container = validateStoredOrLog(id, map.get(id));
  if (isInvalid(container)) return;
  map.set(id, toStored({ ...container, labels: new Set(label_ids) }));
}

export function setParentForContainer(
  doc: Y.Doc,
  id: ContainerId,
  parent_id: ContainerId | undefined,
): void {
  const map = getContainerYmap(doc);
  const container = validateStoredOrLog(id, map.get(id));
  if (isInvalid(container)) return;
  const updated: Container = {
    kind: "container",
    id: container.id,
    name: container.name,
    labels: container.labels,
    ...(parent_id !== undefined && { parent_id }),
  };
  map.set(id, toStored(updated));
}
