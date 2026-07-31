import type { ReadonlyDeep } from "type-fest";
import "../../pages/RecipeEditorPage.css";

export type PendingEditsDialogProps = ReadonlyDeep<{
  /** How many rows still hold uncommitted changes. */
  count: number;
  onAcceptAll: () => void;
  onDiscardAll: () => void;
  onCancel: () => void;
}>;

/**
 * Asked before saving when instruction or container rows are still open with
 * uncommitted drafts, so a page-level save never drops them silently.
 */
export function PendingEditsDialog({
  count,
  onAcceptAll,
  onDiscardAll,
  onCancel,
}: PendingEditsDialogProps) {
  return (
    <div
      className="re-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Unsaved row changes"
    >
      <div className="re-dialog">
        <h2 className="re-dialog-title">Unsaved changes</h2>
        <p className="re-dialog-body">
          {count} row{count !== 1 ? "s are" : " is"} still open for editing. Accept those changes
          into the recipe before saving, or discard them?
        </p>
        <div className="re-dialog-actions">
          <button type="button" className="re-dialog-accept-all" onClick={onAcceptAll}>
            Accept all changes
          </button>
          <button type="button" className="re-dialog-discard-all" onClick={onDiscardAll}>
            Discard all changes
          </button>
          <button type="button" className="re-dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
