import type * as Y from "yjs";

const MAP_KEY = "book_settings";
const SECONDS_PER_INGREDIENT_KEY = "seconds_per_ingredient";

export function getBookSettingsYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

/**
 * Book-wide settings. All values are optional; callers fall back to the
 * build defaults. A future settings page will edit these.
 */
export interface BookSettings {
  readonly seconds_per_ingredient?: number;
}

export function getBookSettings(doc: Y.Doc): BookSettings {
  const raw = getBookSettingsYmap(doc).get(SECONDS_PER_INGREDIENT_KEY);
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return { seconds_per_ingredient: raw };
  }
  return {};
}

/** Sets (or clears, with undefined) the book-wide per-ingredient prep time. */
export function setBookSecondsPerIngredient(doc: Y.Doc, seconds: number | undefined): void {
  const map = getBookSettingsYmap(doc);
  if (seconds === undefined) {
    map.delete(SECONDS_PER_INGREDIENT_KEY);
  } else {
    map.set(SECONDS_PER_INGREDIENT_KEY, seconds);
  }
}
