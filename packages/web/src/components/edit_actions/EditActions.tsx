import { useAcceptOrCancel } from "../accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import "./EditActions.css";

/**
 * The "↩" (cancel changes) / "✔︎" (accept changes) pair every inline editor
 * closes with, in that left-to-right order. Shared so the glyphs, order, and
 * markup cannot drift between editors. It follows the fields it commits inline,
 * and wraps to the next line as one unit when the row runs out of width.
 *
 * It takes no props: the labels and handlers come from the enclosing
 * `AcceptOrCancelEditor`, so pressing "✔︎" and pressing Enter always run the
 * same action.
 */
export function EditActions() {
  const { cancelLabel, acceptLabel, onCancel, onAccept } = useAcceptOrCancel();
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
