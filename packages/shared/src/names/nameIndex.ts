/**
 * An in-memory lookup from a name key to the ids that hold it, built from a book's entries.
 *
 * It is derived, never stored: Yjs cannot enforce uniqueness across concurrent writers, so a
 * stored `name_key → id` map would be last-writer-wins and could point at the wrong entity. The
 * key lives on each entry instead, where it can never disagree with that entry's name, and this
 * index is rebuilt from the entries whenever they change.
 *
 * Duplicate keys are tolerated (a key maps to a *list* of ids, lowest first), because concurrent
 * edits and older data can produce them even though local writes refuse to.
 */
export type NameIndex<Id extends string> = ReadonlyMap<string, readonly Id[]>;

export type NameIndexEntry<Id extends string> = { readonly id: Id; readonly key: string };

/** Builds the index. Entries with an empty key (a blank name) are left out. */
export function buildNameIndex<Id extends string>(
  entries: Iterable<NameIndexEntry<Id>>,
): NameIndex<Id> {
  const index = new Map<string, Id[]>();
  for (const { id, key } of entries) {
    if (key === "") continue;
    const ids = index.get(key);
    if (ids === undefined) index.set(key, [id]);
    else ids.push(id);
  }
  for (const ids of index.values()) ids.sort();
  return index;
}

/**
 * The id that holds `key`, other than those in `exclude`, or `undefined` if the key is free. When
 * several hold it, the lowest id is returned, so every device resolves a duplicate the same way.
 *
 * `exclude` is what lets an entity be renamed to a different spelling of its own name (Tomato →
 * Tomatoes): its own entry never counts as a clash. It is a list so that merging several labels
 * into one new name does not clash with the labels being merged.
 */
export function findNameClash<Id extends string>(
  index: NameIndex<Id>,
  key: string,
  exclude?: Id | readonly Id[],
): Id | undefined {
  if (key === "") return undefined;
  const excluded = exclude === undefined ? [] : typeof exclude === "string" ? [exclude] : exclude;
  return index.get(key)?.find((id) => !excluded.includes(id));
}

/** The ids that share a key with at least one other entry, for flagging duplicates. */
export function duplicateIds<Id extends string>(index: NameIndex<Id>): Set<Id> {
  const duplicates = new Set<Id>();
  for (const ids of index.values()) {
    if (ids.length > 1) for (const id of ids) duplicates.add(id);
  }
  return duplicates;
}
