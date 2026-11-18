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
    created_at: "number",
    schema_version: "number.integer >= 1",
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
 * this build, not when they were really created.
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
    schema_version: BOOK_SCHEMA_VERSION,
  };
  doc.transact(() => {
    for (const [key, value] of Object.entries(defaults)) {
      if (!map.has(key)) map.set(key, value);
    }
  }, SETUP_ORIGIN);
}

/** Renames the book. This is a user edit, so (unlike `ensureBookMeta`) it can be undone. */
export function setBookName(doc: Y.Doc, name: string): void {
  getBookMetaYmap(doc).set("name", name);
}
