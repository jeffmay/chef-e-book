import type * as Y from "yjs";
import { buildNameIndex, findNameClash, type NameIndex } from "../names/nameIndex.ts";
import type { NameClash } from "../names/nameClash.ts";
import { readNameKey, readStoredNameKey } from "../names/storedName.ts";
import { isInvalid, type ValidationError } from "./validation.ts";

/**
 * What the name-key machinery needs to know about one kind of named entry (ingredients, containers,
 * labels): where its entries live, how its names are keyed, and how to read and write one. Written
 * once here so a change to how a missing or stale key is found cannot be made in only one store.
 */
export type NamedStore<
  Id extends string,
  Entry extends { readonly id: Id; readonly name: string },
> = {
  /** The Yjs map holding the entries, keyed by id. */
  map: Y.Map<unknown>;
  keyOf: (name: string) => string;
  /** Brands a stored map key as this kind's id. */
  toId: (raw: string) => Id;
  /** The entry for a stored value, or a `ValidationError` for one that is not valid. */
  read: (id: Id, raw: unknown) => Entry | ValidationError;
  /** Writes an entry back under its own id; the store derives its `name_key` from its name. */
  write: (entry: Entry) => void;
};

/** The ids by name key, from the keys stored with each entry. */
export function nameIndexOf<
  Id extends string,
  Entry extends { readonly id: Id; readonly name: string },
>(store: NamedStore<Id, Entry>): NameIndex<Id> {
  const entries: Array<{ id: Id; key: string }> = [];
  store.map.forEach((value, id) => {
    const key = readNameKey(value, store.keyOf);
    if (key !== undefined) entries.push({ id: store.toId(id), key });
  });
  return buildNameIndex(entries);
}

/**
 * The existing entry that already holds `name`, or `undefined` if it is free. `exclude` is the entry
 * being renamed (or the entries being merged): they never clash with the new name.
 */
export function nameClashIn<
  Id extends string,
  Entry extends { readonly id: Id; readonly name: string },
>(
  store: NamedStore<Id, Entry>,
  name: string,
  exclude?: Id | readonly Id[],
): NameClash<Id> | undefined {
  const id = findNameClash(nameIndexOf(store), store.keyOf(name), exclude);
  if (id === undefined) return undefined;
  const existing = store.read(id, store.map.get(id));
  return isInvalid(existing) ? undefined : { id, name: existing.name };
}

/** Rewrites every entry whose stored `name_key` is missing or differs from the current rules. */
export function rekeyIn<
  Id extends string,
  Entry extends { readonly id: Id; readonly name: string },
>(doc: Y.Doc, store: NamedStore<Id, Entry>): void {
  doc.transact(() => {
    store.map.forEach((value, id) => {
      const entry = store.read(store.toId(id), value);
      if (isInvalid(entry)) return;
      if (readStoredNameKey(value) === store.keyOf(entry.name)) return;
      store.write(entry);
    });
  });
}
