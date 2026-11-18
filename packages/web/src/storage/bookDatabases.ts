import { ensureBookMeta, setBookName, type RecipeBookId } from "@recipe-book/shared";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  bookDatabaseName,
  legacyDatabaseNames,
  mergeLegacyBookData,
} from "./legacyBookMigration.ts";

/** A book's document, opened on its own. The caller must `dispose` it. */
export type LoadedBook = {
  doc: Y.Doc;
  /** Closes the database after any pending writes have been stored, and frees the document. */
  dispose: () => Promise<void>;
};

/**
 * Opens a book's document **without making it the open book**, so another book can be read from
 * (to import from it) or touched (to rename it) while a different one is on screen.
 *
 * Data an earlier build left in the separate `kitchenware-*` / `recipes-*` databases is merged in,
 * as when the book is opened normally, so a book that has not been opened since that change reads
 * the same here.
 *
 * Do not use this for the book that is open in this tab — use its live document. Two persistences
 * on one database do not see each other's writes until a reload, so this copy could be stale.
 */
export async function loadBookDoc(bookId: RecipeBookId): Promise<LoadedBook> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(bookDatabaseName(bookId), doc);
  try {
    await persistence.whenSynced;
    try {
      await mergeLegacyBookData(doc, bookId);
    } catch (e) {
      console.error("failed to migrate data from the legacy kitchenware/recipes databases: ", e);
    }
  } catch (e) {
    await persistence.destroy();
    doc.destroy();
    throw e;
  }
  return {
    doc,
    dispose: async () => {
      await persistence.destroy();
      doc.destroy();
    },
  };
}

/** Writes a new name into a book's own `book_meta`, whether or not that book is the open one. */
export async function writeBookName(bookId: RecipeBookId, name: string): Promise<void> {
  const { doc, dispose } = await loadBookDoc(bookId);
  try {
    ensureBookMeta(doc, { id: bookId, name });
    setBookName(doc, name);
  } finally {
    await dispose();
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`failed to delete ${name}`));
    // Another connection still has it open. The browser finishes the delete once that connection
    // closes, so this is not a failure — but it is worth knowing about.
    request.onblocked = () => console.warn(`deleting ${name} is blocked until it is closed`);
  });
}

/**
 * Deletes everything this device stores for a book: its document and the legacy databases an
 * earlier build kept. Close the book first — an open connection delays the delete.
 */
export async function deleteBookDatabases(bookId: RecipeBookId): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await Promise.all([bookDatabaseName(bookId), ...legacyDatabaseNames(bookId)].map(deleteDatabase));
}
