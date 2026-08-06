import type { ReadonlyDeep } from "type-fest";
import "./RowActions.css";

export type EditButtonProps = ReadonlyDeep<{
  /** Accessible name, e.g. "Edit container: Bowl". */
  label: string;
  onClick: () => void;
}>;

/**
 * The "✎" that opens a row's inline editor. It leads the row, to the left of
 * the text it edits, so it is nowhere near the "✕" that removes the row — the
 * two are far enough apart that a stylus cannot mistake one for the other.
 */
export function EditButton({ label, onClick }: EditButtonProps) {
  return (
    <button
      type="button"
      className="row-action row-action--edit"
      onClick={onClick}
      aria-label={label}
    >
      ✎
    </button>
  );
}
