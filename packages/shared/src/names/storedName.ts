import { type } from "arktype";

const StoredName = type({
  name: "string",
  "name_key?": "string",
});

/** The `name_key` written with a stored entry, or `undefined` if it has none (older data). */
export function readStoredNameKey(raw: unknown): string | undefined {
  const parsed = StoredName(raw);
  return parsed instanceof type.errors ? undefined : parsed["name_key"];
}

/**
 * The name key of a stored ingredient, container, or label: the `name_key` written with it, or —
 * for an entry written before keys were stored — the key `keyOf` derives from its name. Returns
 * `undefined` for a value that is not a named entry at all.
 *
 * Trusting the stored key is the point of storing it: a lookup does not have to normalize and
 * singularize every name in the book. (A key written under an older `NAME_KEY_VERSION` is rewritten
 * when the book opens; see `rekeyBookNames`.)
 */
export function readNameKey(raw: unknown, keyOf: (name: string) => string): string | undefined {
  const parsed = StoredName(raw);
  if (parsed instanceof type.errors) return undefined;
  return parsed.name_key ?? keyOf(parsed.name);
}
