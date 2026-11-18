import { type } from "arktype";
import type { ReadonlyDeep } from "type-fest";
import type * as Y from "yjs";
import { buildNameIndex, findNameClash, type NameIndex } from "../names/nameIndex.ts";
import { labelNameKey } from "../names/nameKey.ts";
import type { NameClash } from "../names/nameClash.ts";
import { readNameKey, readStoredNameKey } from "../names/storedName.ts";
import { Companion } from "../types/companion.ts";
import { loadId, randomId } from "../types/ids.ts";
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
    "name_key?": "string",
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

/** Every write goes through here, so the stored `name_key` is always derived from the name. */
function toStored(label: ReadonlyDeep<KitchenwareLabel>) {
  return {
    name: label.name,
    name_key: labelNameKey(label.name),
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

/** The ids by name key, from the keys stored with each label. */
export function getLabelNameIndex(doc: Y.Doc): NameIndex<KitchenwareLabelId> {
  const entries: Array<{ id: KitchenwareLabelId; key: string }> = [];
  getLabelsYmap(doc).forEach((value, id) => {
    const key = readNameKey(value, labelNameKey);
    if (key !== undefined) entries.push({ id: loadId(KitchenwareLabelId, id), key });
  });
  return buildNameIndex(entries);
}

/**
 * The existing label that already holds `name` — ignoring case, surrounding whitespace, and
 * Unicode form, but **not** plurals: "Spices" and "Spice" are different labels — or `undefined`
 * if the name is free. `exclude` is the label being renamed, or the labels being merged.
 */
export function findLabelNameClash(
  doc: Y.Doc,
  name: string,
  exclude?: KitchenwareLabelId | readonly KitchenwareLabelId[],
): NameClash<KitchenwareLabelId> | undefined {
  const id = findNameClash(getLabelNameIndex(doc), labelNameKey(name), exclude);
  if (id === undefined) return undefined;
  const existing = validateLabel(id, getLabelsYmap(doc).get(id));
  return isInvalid(existing) ? undefined : { id, name: existing.name };
}

/** The label that holds `name` by the label-name rules (see `findLabelNameClash`), or `null`. */
export function findLabelByName(doc: Y.Doc, name: string): KitchenwareLabel | null {
  const clash = findLabelNameClash(doc, name);
  if (clash === undefined) return null;
  const label = validateLabel(clash.id, getLabelsYmap(doc).get(clash.id));
  return isInvalid(label) ? null : label;
}

/** Rewrites every label whose stored `name_key` is missing or differs from the current rules. */
export function rekeyLabels(doc: Y.Doc): void {
  const map = getLabelsYmap(doc);
  doc.transact(() => {
    map.forEach((value, id) => {
      const label = validateLabel(id, value);
      if (isInvalid(label)) return;
      if (readStoredNameKey(value) === labelNameKey(label.name)) return;
      map.set(id, toStored(label));
    });
  });
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
