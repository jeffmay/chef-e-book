import type { ReadonlyDeep } from "type-fest";
import "./EditActions.css";

export type EditActionsProps = ReadonlyDeep<{
  /** Accessible name for "↩", e.g. "Cancel changes to container". */
  cancelLabel: string;
  /** Accessible name for "✔︎", e.g. "Accept changes to container". */
  acceptLabel: string;
  onCancel: () => void;
  onAccept: () => void;
}>;

/**
 * The "↩" (cancel changes) / "✔︎" (accept changes) pair every inline editor
 * closes with, in that left-to-right order. Shared so the glyphs, order, and
 * markup cannot drift between editors. It follows the fields it commits inline,
 * and wraps to the next line as one unit when the row runs out of width.
 */
export function EditActions({ cancelLabel, acceptLabel, onCancel, onAccept }: EditActionsProps) {
  return (
    <div className="edit-actions">
      <button
        type="button"
        className="edit-actions-cancel"
        onClick={onCancel}
        aria-label={cancelLabel}
      >
        ↩
      </button>
      <button
        type="button"
        className="edit-actions-accept"
        onClick={onAccept}
        aria-label={acceptLabel}
      >
        ✔︎
      </button>
    </div>
  );
}
