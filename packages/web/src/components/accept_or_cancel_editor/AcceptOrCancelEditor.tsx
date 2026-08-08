import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  /**
   * Focus the editor's first field when it opens. Set it on any editor opened
   * by a control outside itself (a row's "✎"), which would otherwise leave
   * focus on that control, where Escape and Enter never reach this editor.
   */
  readonly autoFocus?: boolean;
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
 * The editor's fields, in document order — what `autoFocus` hands focus to.
 * Buttons are left out on purpose: "↩"/"✔︎" and a row's "✕" are also focusable,
 * and landing on one of those would put the editor one keystroke from closing.
 * `[role="combobox"]` catches the PrimeReact `TreeSelect`, whose trigger is a
 * focusable `div` rather than a real form control.
 */
const EDITOR_FIELD_SELECTOR = [
  'input:not([type="hidden"]):not(:disabled)',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[role="combobox"]',
  '[contenteditable="true"]',
].join(",");

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
  autoFocus = false,
}: AcceptOrCancelEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Runs in the commit that mounts the fields, so focus lands on a live element.
  useEffect(() => {
    if (!autoFocus) return;
    const root = rootRef.current;
    if (root === null) return;
    // A field carrying its own `autoFocus` has already claimed it.
    if (root.contains(document.activeElement)) return;
    root.querySelector<HTMLElement>(EDITOR_FIELD_SELECTOR)?.focus();
  }, [autoFocus]);

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
        ref={rootRef}
        className={`accept-or-cancel-editor${className !== undefined ? ` ${className}` : ""}`}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </AcceptOrCancelContext.Provider>
  );
}
