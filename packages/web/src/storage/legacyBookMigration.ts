import { MIGRATION_ORIGIN } from "@recipe-book/shared";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

/** IndexedDB database holding a book's one Yjs document. */
export function bookDatabaseName(bookId: string): string {
  return `book-${bookId}`;
}

/**
 * The two IndexedDB databases an earlier build kept per book: `kitchenware-<id>` (ingredients,
 * containers, labels) and `recipes-<id>` (recipes, folders, sessions, settings). Their root map
 * names never overlap, so both can be merged into the one book document without collisions.
 */
export function legacyDatabaseNames(bookId: string): readonly string[] {
  return [`kitchenware-${bookId}`, `recipes-${bookId}`];
}

/** How the migration reaches the old databases. Injectable so failures can be tested. */
export interface LegacyDatabaseAccess {
  exists: (name: string) => Promise<boolean>;
  read: (name: string) => Promise<Y.Doc>;
}

/**
 * Whether an IndexedDB database exists, without creating it. Opening a missing database with
 * `indexedDB.open` would create an empty one (and `y-indexeddb` does exactly that), so the
 * upgrade that a brand-new database triggers is aborted, which leaves nothing behind.
 */
export function indexedDbExists(name: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => {
      request.result.close();
      resolve(true);
    };
    request.onerror = () => resolve(false);
  });
}

/** Loads a stored document into memory and closes the database again; the data is left in place. */
export async function readIndexedDbDoc(name: string): Promise<Y.Doc> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(name, doc);
  try {
    await persistence.whenSynced;
  } finally {
    await persistence.destroy();
  }
  return doc;
}

const indexedDbAccess: LegacyDatabaseAccess = {
  exists: indexedDbExists,
  read: readIndexedDbDoc,
};

export type MergeLegacyOptions = {
  access?: LegacyDatabaseAccess;
  /** Checked before each merge; returning `true` stops without touching the document. */
  isCancelled?: () => boolean;
};

/**
 * Copies whatever an earlier build stored for this book into its single document.
 *
 * Safe to run on every open: applying a Yjs update the document already holds is a no-op, so a
 * second run adds nothing, and an entry the user deleted after the first run stays deleted. The
 * old databases are never modified or removed — they are the rollback path — so this keeps
 * costing a probe per open until a later release deletes them.
 *
 * Writes use `MIGRATION_ORIGIN` so they are persisted like any other update but can never be
 * undone. Returns the names of the legacy databases that were merged.
 */
export async function mergeLegacyBookData(
  bookDoc: Y.Doc,
  bookId: string,
  { access = indexedDbAccess, isCancelled = () => false }: MergeLegacyOptions = {},
): Promise<string[]> {
  const merged: string[] = [];
  for (const name of legacyDatabaseNames(bookId)) {
    if (isCancelled() || !(await access.exists(name))) continue;
    const legacyDoc = await access.read(name);
    try {
      if (isCancelled()) continue;
      Y.applyUpdate(bookDoc, Y.encodeStateAsUpdate(legacyDoc), MIGRATION_ORIGIN);
      merged.push(name);
    } finally {
      legacyDoc.destroy();
    }
  }
  return merged;
}
