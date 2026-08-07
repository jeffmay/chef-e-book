import { createContext, useContext, type KeyboardEvent, type ReactNode } from "react";
import type { ReadonlyDeep } from "type-fest";
import "./AcceptOrCancelEditor.css";

export type AcceptOrCancelActions = ReadonlyDeep<{
  /** Accessible name for "↩", e.g. "Cancel changes to container". */
  cancelLabel: string;
  /** Accessible name for "✔︎", e.g. "Accept changes to container". */
  acceptLabel: string;
  onCancel: () => void;
  onAccept: () => void;
}>;

export type AcceptOrCancelEditorProps = AcceptOrCancelActions & {
  readonly children: ReactNode;
  /** Extra classes for the wrapper, which is layout-transparent by default. */
  readonly className?: string;
};

const AcceptOrCancelContext = createContext<AcceptOrCancelActions | null>(null);

/**
 * The accept/cancel actions of the closest enclosing `AcceptOrCancelEditor`.
 * Throws rather than returning a default, so a stray `EditActions` outside an
 * editor fails at the first render instead of rendering two dead buttons.
 */
export function useAcceptOrCancel(): AcceptOrCancelActions {
  const actions = useContext(AcceptOrCancelContext);
  if (actions === null) {
    throw new Error("EditActions must be rendered inside an <AcceptOrCancelEditor>");
  }
  return actions;
}

/** Controls that take Enter as their own input, so the editor must not steal it. */
const ENTER_PASSTHROUGH_TAGS: ReadonlySet<string> = new Set(["TEXTAREA", "BUTTON", "A"]);

/**
 * Wraps an inline editor so the keyboard can close it: Escape cancels, Enter
 * accepts. Both stop propagating once handled, so in nested editors (a
 * `MeasurementEditor` inside an ingredient row, say) only the closest editor
 * responds and its parent stays open.
 *
 * The wrapper element is `display: contents`, so adopting it never changes a
 * row's layout — it exists to catch the keys bubbling out of the fields, and to
 * hand the same two actions to `EditActions` through context, so the buttons and
 * the keys can never drift apart.
 *
 * A field that consumes Escape itself (a `react-select` closing its menu, a
 * `TreeSelect` closing its panel) must stop propagation while it is open, or the
 * key would both close the dropdown and cancel the editor around it. Enter needs
 * no such care: those components `preventDefault` when they consume it, which
 * this checks.
 */
export function AcceptOrCancelEditor({
  cancelLabel,
  acceptLabel,
  onCancel,
  onAccept,
  children,
  className,
}: AcceptOrCancelEditorProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Enter") return;
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && ENTER_PASSTHROUGH_TAGS.has(target.tagName)) return;
    event.preventDefault();
    event.stopPropagation();
    onAccept();
  }

  return (
    <AcceptOrCancelContext.Provider value={{ cancelLabel, acceptLabel, onCancel, onAccept }}>
      <div
        className={`accept-or-cancel-editor${className !== undefined ? ` ${className}` : ""}`}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </AcceptOrCancelContext.Provider>
  );
}
