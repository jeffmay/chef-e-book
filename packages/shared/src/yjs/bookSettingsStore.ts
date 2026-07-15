import { type } from "arktype";
import type * as Y from "yjs";
import { Companion } from "../types/companion.ts";
import { isInvalid, validate } from "./validation.ts";

const MAP_KEY = "book_settings";

export function getBookSettingsYmap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(MAP_KEY);
}

/**
 * Book-wide settings. All values are optional; callers fall back to the
 * build defaults. A future settings page will edit these.
 */
export const BookSettings = Companion(
  "BookSettings",
  type({
    "seconds_per_ingredient?": "number >= 0 | undefined",
  }),
);

export type BookSettings = typeof BookSettings.type.infer;

function updateSettings(map: Y.Map<unknown>, updates: BookSettings) {
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) {
      map.delete(k);
    } else {
      map.set(k, v);
    }
  }
}

export function getBookSettings(doc: Y.Doc): BookSettings {
  const raw = getBookSettingsYmap(doc).toJSON();
  const result = validate(BookSettings, raw);
  if (isInvalid(result)) {
    console.error(`Invalid BookSettings from localstorage, using defaults. ${result.reason}`);
    return {};
  }
  return result;
}

/** Sets (or clears, with undefined) the book-wide per-ingredient prep time. */
export function setBookSecondsPerIngredient(doc: Y.Doc, seconds: number | undefined): void {
  updateSettings(getBookSettingsYmap(doc), { seconds_per_ingredient: seconds });
}
