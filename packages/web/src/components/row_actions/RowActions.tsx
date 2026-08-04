import type { ReadonlyDeep } from "type-fest";
import "./RowActions.css";

export type RowActionsProps = ReadonlyDeep<{
  /** Accessible name for "✕", e.g. "Remove instruction Whisk". */
  removeLabel: string;
  onRemove: () => void;
  /**
   * Accessible name for "✎". Omit `onEdit` (with its label) on rows that have
   * no separate edit mode, or while their editor is already open.
   */
  editLabel?: string | undefined;
  onEdit?: (() => void) | undefined;
}>;

/**
 * The "✎" (edit) / "✕" (remove) pair floating in a row's upper-right corner,
 * in that left-to-right order. Rows open their editor from "✎" rather than by
 * clicking their text, so the whole summary stays selectable and the tap target
 * is explicit on a stylus-driven screen.
 */
export function RowActions({ removeLabel, onRemove, editLabel, onEdit }: RowActionsProps) {
  return (
    <div className="row-actions">
      {onEdit !== undefined && (
        <button type="button" className="row-actions-edit" onClick={onEdit} aria-label={editLabel}>
          ✎
        </button>
      )}
      <button
        type="button"
        className="row-actions-remove"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        ✕
      </button>
    </div>
  );
}
