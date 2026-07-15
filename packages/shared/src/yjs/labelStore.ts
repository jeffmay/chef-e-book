import { type } from "arktype";
import type { ReadonlyDeep } from "type-fest";
import type * as Y from "yjs";
import { Companion } from "../types/companion.ts";
import { randomId } from "../types/ids.ts";
import {
  KitchenwareKind,
  KitchenwareLabelId,
  type KitchenwareLabel,
} from "../types/kitchenware.ts";
import { setOf } from "../types/sets.ts";
import type { ValidationError } from "./validation.ts";
import { isInvalid, isValid, validate } from "./validation.ts";

const LABELS_MAP_KEY = "labels";

const StoredLabel = Companion(
  "StoredLabel",
  type({
    name: "string",
    kinds: setOf(KitchenwareKind.type),
  }),
);

export function getLabelsYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(LABELS_MAP_KEY);
}

function validateLabel(id: string, raw: unknown): KitchenwareLabel | ValidationError {
  const result = validate(StoredLabel, raw);
  if (isInvalid(result)) return result;
  const labelId = validate(KitchenwareLabelId, id);
  if (isInvalid(labelId)) return labelId;
  return { id: labelId, name: result.name, kinds: result.kinds };
}

function toStored(label: ReadonlyDeep<KitchenwareLabel>) {
  return {
    name: label.name,
    kinds: [...label.kinds],
  };
}

export function getLabels(doc: Y.Doc): KitchenwareLabel[] {
  const map = getLabelsYmap(doc);
  const results: KitchenwareLabel[] = [];
  map.forEach((value, id) => {
    const label = validateLabel(id, value);
    if (isValid(label)) results.push(label);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function addLabel(
  doc: Y.Doc,
  name: string,
  kinds: ReadonlySet<KitchenwareKind>,
): KitchenwareLabelId {
  const id = randomId(KitchenwareLabelId);
  getLabelsYmap(doc).set(id, toStored({ id, name, kinds }));
  return id;
}

export function findLabelByName(doc: Y.Doc, name: string): KitchenwareLabel | null {
  const map = getLabelsYmap(doc);
  let found: KitchenwareLabel | null = null;
  for (const [id, value] of map) {
    const label = validateLabel(id, value);
    if (isValid(label) && label.name === name) {
      found = label;
      break;
    }
  }
  return found;
}

export function findOrCreateLabel(
  doc: Y.Doc,
  name: string,
  kinds: ReadonlySet<KitchenwareKind>,
): KitchenwareLabelId {
  const existing = findLabelByName(doc, name);
  if (existing !== null) return existing.id;
  return addLabel(doc, name, kinds);
}

export function deleteLabels(doc: Y.Doc, ids: readonly KitchenwareLabelId[]): void {
  const map = getLabelsYmap(doc);
  doc.transact(() => {
    for (const id of ids) {
      map.delete(id);
    }
  });
}

export function renameLabel(doc: Y.Doc, id: KitchenwareLabelId, name: string): void {
  const map = getLabelsYmap(doc);
  const label = validateLabel(id, map.get(id));
  if (isInvalid(label)) return;
  map.set(id, toStored({ ...label, name }));
}
