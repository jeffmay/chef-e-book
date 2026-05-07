import * as Y from "yjs";
import { nanoid } from "nanoid";
import type { ItemLabel } from "../types/item_label.js";
import type { ItemKind } from "../types/item.js";

const LABELS_MAP_KEY = "labels";

interface StoredLabel {
  readonly name: string;
  readonly kinds: readonly string[];
}

export function get_labels_ymap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(LABELS_MAP_KEY);
}

function validate_label(id: string, raw: unknown): ItemLabel | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const name = obj["name"];
  const kinds_raw = obj["kinds"];
  if (typeof name !== "string") return null;
  if (!Array.isArray(kinds_raw)) return null;
  const valid_kinds = new Set<ItemKind>();
  for (const k of kinds_raw) {
    if (k === "ingredient" || k === "container" || k === "equipment") {
      valid_kinds.add(k);
    }
  }
  return {
    id: id as ItemLabel.Id,
    name,
    kinds: valid_kinds,
  };
}

function to_stored(label: ItemLabel): StoredLabel {
  return {
    name: label.name,
    kinds: [...label.kinds],
  };
}

export function get_labels(doc: Y.Doc): ItemLabel[] {
  const map = get_labels_ymap(doc);
  const results: ItemLabel[] = [];
  map.forEach((value, id) => {
    const label = validate_label(id, value);
    if (label !== null) results.push(label);
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function add_label(
  doc: Y.Doc,
  name: string,
  kinds: ReadonlySet<ItemKind>,
): ItemLabel.Id {
  const id = nanoid(7) as ItemLabel.Id;
  get_labels_ymap(doc).set(id, to_stored({ id, name, kinds }));
  return id;
}

export function find_label_by_name(doc: Y.Doc, name: string): ItemLabel | null {
  const map = get_labels_ymap(doc);
  let found: ItemLabel | null = null;
  map.forEach((value, id) => {
    if (found !== null) return;
    const label = validate_label(id, value);
    if (label !== null && label.name === name) found = label;
  });
  return found;
}

export function find_or_create_label(
  doc: Y.Doc,
  name: string,
  kinds: ReadonlySet<ItemKind>,
): ItemLabel.Id {
  const existing = find_label_by_name(doc, name);
  if (existing !== null) return existing.id;
  return add_label(doc, name, kinds);
}

export function delete_labels(doc: Y.Doc, ids: readonly ItemLabel.Id[]): void {
  const map = get_labels_ymap(doc);
  doc.transact(() => {
    for (const id of ids) {
      map.delete(id);
    }
  });
}

export function rename_label(doc: Y.Doc, id: ItemLabel.Id, name: string): void {
  const map = get_labels_ymap(doc);
  const label = validate_label(id, map.get(id));
  if (label === null) return;
  map.set(id, to_stored({ ...label, name }));
}

export function make_label_id(): ItemLabel.Id {
  return nanoid(7) as ItemLabel.Id;
}
