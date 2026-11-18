import type { ReadonlyDeep } from "type-fest";
import type * as Y from "yjs";
import type { KitchenwareTemplate } from "../fixtures/kitchenware.ts";
import { getBookMetaYmap, isDefaultKitchenwareSeeded } from "./bookMetaStore.ts";
import { getIngredientYmap, initFromKitchenwareTemplates } from "./ingredientStore.ts";
import { getLabelsYmap } from "./labelStore.ts";
import { SETUP_ORIGIN } from "./origins.ts";

/** What `seedDefaultKitchenware` found and did. */
export type DefaultKitchenwareOutcome =
  /** The defaults were put into an empty book. */
  | "seeded"
  /** The book had already been seeded (or dealt with) earlier; nothing changed. */
  | "already_seeded"
  /** The book already held ingredients or labels, so it was marked as dealt with and left alone. */
  | "book_has_data";

/**
 * Whether the book still needs the default kitchenware: it has never been seeded **and** holds no
 * ingredients or labels. Lets a caller skip fetching the defaults when they would not be used.
 */
export function needsDefaultKitchenware(doc: Y.Doc): boolean {
  return (
    !isDefaultKitchenwareSeeded(doc) &&
    getIngredientYmap(doc).size === 0 &&
    getLabelsYmap(doc).size === 0
  );
}

/**
 * Puts the default kitchenware into a book **exactly once**, then records that in
 * `book_meta.seeded_defaults`. Because the record is kept, a user who deliberately deletes every
 * ingredient is not given the defaults back the next time the book opens. A book that already has
 * ingredients or labels (an existing book, or one filled in by a sync or an import) is marked as
 * dealt with without being touched.
 *
 * The check, the seed and the mark happen in one transaction with `SETUP_ORIGIN`, so concurrent
 * callers cannot both seed and Undo can never remove the defaults.
 */
export function seedDefaultKitchenware(
  doc: Y.Doc,
  templates: ReadonlyDeep<KitchenwareTemplate[]>,
): DefaultKitchenwareOutcome {
  let outcome: DefaultKitchenwareOutcome = "already_seeded";
  doc.transact(() => {
    if (isDefaultKitchenwareSeeded(doc)) return;
    if (getIngredientYmap(doc).size > 0 || getLabelsYmap(doc).size > 0) {
      outcome = "book_has_data";
    } else {
      initFromKitchenwareTemplates(doc, templates);
      outcome = "seeded";
    }
    getBookMetaYmap(doc).set("seeded_defaults", true);
  }, SETUP_ORIGIN);
  return outcome;
}
