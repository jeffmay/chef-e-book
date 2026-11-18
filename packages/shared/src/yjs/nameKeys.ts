import type * as Y from "yjs";
import { NAME_KEY_VERSION } from "../names/nameKey.ts";
import { getNameKeyVersion, setNameKeyVersion } from "./bookMetaStore.ts";
import { rekeyContainers } from "./containerStore.ts";
import { rekeyIngredients } from "./ingredientStore.ts";
import { rekeyLabels } from "./labelStore.ts";
import { SETUP_ORIGIN } from "./origins.ts";

/** What `rekeyBookNames` found and did. */
export type RekeyOutcome =
  /** Keys were (re)written under the current rules, and the version recorded. */
  | "rekeyed"
  /** The book's keys were already written under the current rules; nothing changed. */
  | "current"
  /** The book was keyed by a newer build than this one; it is left alone. */
  | "newer";

/**
 * Brings the stored `name_key` of every ingredient, container, and label up to the current rules.
 *
 * Books from before name keys existed have none, and a future change to the rules (a bump of
 * `NAME_KEY_VERSION`) leaves every book with stale ones. Each book records the version its keys
 * were written under in `book_meta.name_key_version`; when that is missing or older, every entry is
 * rewritten and the version recorded, all in one transaction with `SETUP_ORIGIN` — so it is atomic
 * and can never be undone. Running it again is a no-op.
 *
 * A book keyed by a *newer* build is left alone: rewriting its keys with older rules would fight
 * the newer build every time both open it.
 */
export function rekeyBookNames(doc: Y.Doc): RekeyOutcome {
  const version = getNameKeyVersion(doc);
  if (version === NAME_KEY_VERSION) return "current";
  if (version !== undefined && version > NAME_KEY_VERSION) {
    console.warn(
      `This book's name keys use version ${version}, newer than the ${NAME_KEY_VERSION} this app understands; leaving them as they are.`,
    );
    return "newer";
  }
  doc.transact(() => {
    rekeyIngredients(doc);
    rekeyContainers(doc);
    rekeyLabels(doc);
    setNameKeyVersion(doc, NAME_KEY_VERSION);
  }, SETUP_ORIGIN);
  return "rekeyed";
}
