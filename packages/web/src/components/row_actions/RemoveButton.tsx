import type { ReadonlyDeep } from "type-fest";
import "./RowActions.css";

export type RemoveButtonProps = ReadonlyDeep<{
  /** Accessible name, e.g. "Remove container Bowl". */
  label: string;
  onClick: () => void;
}>;

/**
 * The "✕" that removes a row, floated into the row's upper-right corner. Rows
 * reserve that corner with their own `padding-right` so no content renders
 * underneath it. "✕" is the only remove glyph in the app.
 */
export function RemoveButton({ label, onClick }: RemoveButtonProps) {
  return (
    <button
      type="button"
      className="row-action row-action--remove"
      onClick={onClick}
      aria-label={label}
    >
      ✕
    </button>
  );
}
