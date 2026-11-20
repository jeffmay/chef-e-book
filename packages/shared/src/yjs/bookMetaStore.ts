import { type } from "arktype";
import type { ReadonlyDeep } from "type-fest";
import type * as Y from "yjs";
import { Companion } from "../types/companion.ts";
import { RecipeBookId } from "../types/recipeBook.ts";
import { SETUP_ORIGIN } from "./origins.ts";
import { isInvalid, validate } from "./validation.ts";

const MAP_KEY = "book_meta";

/**
 * The layout version of the book document, bumped whenever the shape of what is stored in it
 * changes in a way that needs a migration. A document written by a newer build than this one is
 * left alone (and warned about) rather than rewritten.
 */
export const BOOK_SCHEMA_VERSION = 1;

export function getBookMetaYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

/**
 * Descriptive data about the book that travels with the document.
 *
 * This is **advisory display data, not authorization**: every writer to a Yjs document can edit
 * every map in it, so nothing here may be trusted to decide who may read or write the book. The
 * authoritative access list belongs on the server (or in an owner-only document).
 */
export const BookMeta = Companion(
  "BookMeta",
  type({
    id: RecipeBookId.type,
    name: "string > 0",
    created_at: "number.epoch",
    "updated_at?": "number.epoch",
    schema_version: "number.integer >= 1",
    "seeded_defaults?": "boolean",
    "name_key_version?": "number.integer >= 1",
  }),
);

export type BookMeta = typeof BookMeta.type.infer;

/**
 * The book's metadata, or `undefined` when the book has not been initialised yet (an empty map is
 * normal for a brand-new or pre-`book_meta` book) or when what is stored is not valid.
 */
export function getBookMeta(doc: Y.Doc): BookMeta | undefined {
  const raw = getBookMetaYmap(doc).toJSON();
  if (Object.keys(raw).length === 0) return undefined;
  const result = validate(BookMeta, raw);
  if (isInvalid(result)) {
    console.error(`Invalid book_meta, ignoring. ${result.reason}`);
    return undefined;
  }
  return result;
}

/**
 * Fills in whatever part of `book_meta` is missing, and never overwrites what is there — so it is
 * safe to call on every open, repairs a partial map, and cannot clobber a rename made on another
 * device. Written with `SETUP_ORIGIN`, so it can never be undone.
 *
 * Books that predate `book_meta` get `created_at: now`, which is when they were first opened by
 * this build, not when they were really created. `updated_at` starts equal to `created_at`; a book
 * that has `created_at` but predates `updated_at` is given one on its next open.
 *
 * A document whose stored `id` is a different book's is left untouched (it is not this book's
 * metadata to fill in), and one with a newer `schema_version` than this build understands is only
 * warned about.
 */
export function ensureBookMeta(
  doc: Y.Doc,
  book: ReadonlyDeep<{ id: RecipeBookId; name: string }>,
  now: number = Date.now(),
): void {
  const map = getBookMetaYmap(doc);
  const storedId = map.get("id");
  if (storedId !== undefined && storedId !== book.id) {
    console.warn(
      `book_meta belongs to a different book (id=${String(storedId)}, expected ${book.id}); leaving it as is.`,
    );
    return;
  }
  const storedVersion = map.get("schema_version");
  if (typeof storedVersion === "number" && storedVersion > BOOK_SCHEMA_VERSION) {
    console.warn(
      `This book uses schema version ${storedVersion}, newer than the ${BOOK_SCHEMA_VERSION} this app understands.`,
    );
  }
  const defaults: Record<string, unknown> = {
    id: book.id,
    name: book.name,
    created_at: now,
    updated_at: now,
    schema_version: BOOK_SCHEMA_VERSION,
  };
  doc.transact(() => {
    for (const [key, value] of Object.entries(defaults)) {
      if (!map.has(key)) map.set(key, value);
    }
  }, SETUP_ORIGIN);
}

/** Whether the default kitchenware has already been put into this book (see `defaultKitchenware.ts`). */
export function isDefaultKitchenwareSeeded(doc: Y.Doc): boolean {
  return getBookMetaYmap(doc).get("seeded_defaults") === true;
}

/** Records that the default kitchenware has been dealt with, so it is never seeded again. */
export function markDefaultKitchenwareSeeded(doc: Y.Doc): void {
  doc.transact(() => getBookMetaYmap(doc).set("seeded_defaults", true), SETUP_ORIGIN);
}

/**
 * The `NAME_KEY_VERSION` this book's stored name keys were written with, or `undefined` if it has
 * never been keyed (a book from before name keys existed).
 */
export function getNameKeyVersion(doc: Y.Doc): number | undefined {
  const version = getBookMetaYmap(doc).get("name_key_version");
  return typeof version === "number" ? version : undefined;
}

/** Records the `NAME_KEY_VERSION` the book's keys are now written with. Never undoable. */
export function setNameKeyVersion(doc: Y.Doc, version: number): void {
  doc.transact(() => getBookMetaYmap(doc).set("name_key_version", version), SETUP_ORIGIN);
}

/**
 * Renames the book and stamps `updated_at`. This is a user edit, so (unlike `ensureBookMeta`) it can
 * be undone, and the name and the timestamp change in one transaction, so one Undo restores both.
 *
 * Only renames move `updated_at`: setup writes (seeding, re-keying, migration) are not the user's
 * edits and leave it alone.
 */
export function setBookName(doc: Y.Doc, name: string, now: number = Date.now()): void {
  const map = getBookMetaYmap(doc);
  doc.transact(() => {
    map.set("name", name);
    map.set("updated_at", now);
  });
}
