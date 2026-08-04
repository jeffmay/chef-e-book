import type { ReadonlyDeep } from "type-fest";
import "./EditActions.css";

export type EditActionsProps = ReadonlyDeep<{
  /** Accessible name for "↩", e.g. "Cancel changes to container". */
  cancelLabel: string;
  /** Accessible name for "✔︎", e.g. "Accept changes to container". */
  acceptLabel: string;
  onCancel: () => void;
  onAccept: () => void;
  /** Extra class on the wrapper, for per-row layout overrides. */
  className?: string | undefined;
}>;

/**
 * The "↩" (cancel changes) / "✔︎" (accept changes) pair every inline editor
 * closes with, in that left-to-right order. Shared so the glyphs, order, and
 * markup cannot drift between editors; the wrapper stacks its buttons wherever
 * a row runs out of horizontal space.
 */
export function EditActions({
  cancelLabel,
  acceptLabel,
  onCancel,
  onAccept,
  className,
}: EditActionsProps) {
  return (
    <div className={`edit-actions${className !== undefined ? ` ${className}` : ""}`}>
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
