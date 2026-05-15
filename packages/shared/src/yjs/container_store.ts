import { type } from "arktype";
import * as Y from "yjs";
import { isTypeError } from "../assertions/index.js";
import { loadId } from "../types/ids.js";
import { Container, ContainerId, KitchenwareLabelId } from "../types/kitchenware.js";
import { setOf } from "../types/sets.js";

const MAP_KEY = "containers";

export function getContainerYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

const StoredContainer = type({
  name: "string",
  labels: setOf<KitchenwareLabelId>(KitchenwareLabelId.type),
  "parent_id?": ContainerId.type,
});

function toStored(c: Container) {
  return {
    name: c.name,
    labels: [...c.labels],
    ...(c.parent_id !== undefined && { parent_id: c.parent_id }),
  };
}

function validateStored(id: ContainerId, raw: unknown): Container | null {
  const result = StoredContainer(raw);
  if (isTypeError(result)) return null;
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
    const container = validateStored(loadId(ContainerId, id), value);
    if (container != null) results.push(container);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function addContainer(doc: Y.Doc, container: Container): void {
  getContainerYmap(doc).set(container.id, toStored(container));
}

export function renameContainer(doc: Y.Doc, id: ContainerId, name: string): void {
  const map = getContainerYmap(doc);
  const container = validateStored(id, map.get(id));
  if (container === null) return;
  map.set(id, toStored({ ...container, name }));
}

export function setLabelsForContainer(
  doc: Y.Doc,
  id: ContainerId,
  label_ids: readonly KitchenwareLabelId[],
): void {
  const map = getContainerYmap(doc);
  const container = validateStored(id, map.get(id));
  if (container === null) return;
  map.set(id, toStored({ ...container, labels: new Set(label_ids) }));
}

export function setParentForContainer(
  doc: Y.Doc,
  id: ContainerId,
  parent_id: ContainerId | undefined,
): void {
  const map = getContainerYmap(doc);
  const container = validateStored(id, map.get(id));
  if (container === null) return;
  const updated: Container = {
    kind: "container",
    id: container.id,
    name: container.name,
    labels: container.labels,
    ...(parent_id !== undefined && { parent_id }),
  };
  map.set(id, toStored(updated));
}
