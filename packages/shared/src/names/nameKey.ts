import pluralize from "pluralize";

/**
 * The version of the name-key rules below. Bump it whenever `ingredientNameKey`, `labelNameKey`, or
 * the exceptions change: every book stores the version its keys were written with
 * (`book_meta.name_key_version`) and re-keys itself on open when that is older.
 */
export const NAME_KEY_VERSION = 1;

/**
 * Words whose last word must be left alone: they end in "s" but are not plurals, so singularizing
 * them would mangle them ("molasses" → "molass") and could collide with a different word.
 */
const NOT_PLURAL: ReadonlySet<string> = new Set([
  "asparagus",
  "bitters",
  "brussels",
  "citrus",
  "couscous",
  "grits",
  "hibiscus",
  "hummus",
  "lemongrass",
  "molasses",
  "pastis",
  "swiss",
  "watercress",
]);

/** Plurals the inflection library gets wrong, mapped to the singular the rest of the rules agree on. */
const SINGULAR_OVERRIDES: ReadonlyMap<string, string> = new Map([["chilies", "chili"]]);

/**
 * Trim, Unicode-normalize (NFKC), lowercase, and collapse runs of whitespace to one space.
 *
 * Only for matching: the name the user typed is never altered. Lowercasing is locale-independent,
 * so a key is the same on every device. Accents are *not* folded: "jalapeño" and "jalapeno" are
 * different keys.
 */
function normalizeName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** The singular of one lowercase word, leaving words that merely end in "s" alone. */
function singularizeWord(word: string): string {
  if (NOT_PLURAL.has(word)) return word;
  return SINGULAR_OVERRIDES.get(word) ?? pluralize.singular(word);
}

/**
 * The key two ingredient, container, or equipment names share when they are "the same name":
 * normalized, with the **last word** singularized, so "Cherry Tomatoes", "cherry  tomato" and
 * "CHERRY TOMATOES" all key to `"cherry tomato"`. Only the last word changes — "bay leaves" and
 * "bay leaf" agree, and "Brussels sprouts" and "Brussels sprout" agree.
 */
export function ingredientNameKey(name: string): string {
  const normalized = normalizeName(name);
  const lastSpace = normalized.lastIndexOf(" ");
  const head = normalized.slice(0, lastSpace + 1);
  const last = normalized.slice(lastSpace + 1);
  return head + singularizeWord(last);
}

/**
 * The key two label names share: normalized, and **not** singularized. Labels are unique only by
 * trimmed, normalized, case-insensitive name, so "Spices" and "Spice" are different labels.
 */
export function labelNameKey(name: string): string {
  return normalizeName(name);
}
