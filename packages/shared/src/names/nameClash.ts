/** What stands in the way of using a name: the existing entry that already holds its key. */
export type NameClash<Id extends string> = { readonly id: Id; readonly name: string };

export type NamedKind = "ingredient" | "container" | "label";

const ARTICLE: Readonly<Record<NamedKind, string>> = {
  ingredient: "An",
  container: "A",
  label: "A",
};

/** Sentence for a form field: `An ingredient named "Tomato" already exists`. */
export function describeNameClash(kind: NamedKind, clash: NameClash<string>): string {
  return `${ARTICLE[kind]} ${kind} named "${clash.name}" already exists`;
}

/**
 * Thrown when a local write would give two entries of one kind the same name key. The forms check
 * first and show `describeNameClash`; this is the safety net behind them, so no path through the
 * stores can quietly create a duplicate.
 */
export class NameClashError extends Error {
  public constructor(
    public readonly kind: NamedKind,
    public readonly clash: NameClash<string>,
  ) {
    super(describeNameClash(kind, clash));
    this.name = "NameClashError";
  }
}
