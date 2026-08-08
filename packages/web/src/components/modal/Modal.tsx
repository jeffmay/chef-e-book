import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { ReadonlyDeep } from "type-fest";
import "./Modal.css";

/** One entry of a `Modal`'s `buttons` config, keyed in that config by its id. */
export type ModalButton = ReadonlyDeep<{
  /** Visible text, and the accessible name unless `ariaLabel` overrides it. */
  text: string;
  /** Destructive actions (delete, discard) render with the shared danger stripes. */
  dangerous: boolean;
  onClick: () => void;
  /** Accessible name, when the visible text is not specific enough on its own. */
  ariaLabel?: string;
  disabled?: boolean;
}>;

/**
 * `buttons` and `onEnterClickId` stay outside the `ReadonlyDeep<{...}>` wrapper:
 * TypeScript cannot infer `ButtonId` through a mapped type, so wrapping them
 * would widen every `onEnterClickId` to `string` and lose the "must be a key of
 * `buttons`" guarantee.
 */
export type ModalProps<ButtonId extends string> = ReadonlyDeep<{
  /** Heading, and the modal's accessible name unless `ariaLabel` overrides it. */
  title: string;
  ariaLabel?: string;
  /**
   * Called for Escape and for a click on the backdrop. Returns `true` when the
   * modal may close — the owner hides it — and `false` to keep it open, which
   * returns focus to the modal rather than leaving it on the page underneath.
   */
  onClose: () => boolean;
}> & {
  /** Actions rendered in the footer, in insertion order, keyed by id. */
  readonly buttons: Readonly<Record<ButtonId, ModalButton>>;
  /** The button Enter activates, when the focused control does not want Enter itself. */
  readonly onEnterClickId?: NoInfer<ButtonId>;
  readonly children?: ReactNode;
};

/** Controls that take Enter as their own input, so the modal must not steal it. */
const ENTER_PASSTHROUGH_TAGS: ReadonlySet<string> = new Set(["TEXTAREA", "BUTTON", "A"]);

/**
 * The one modal window in the app: a backdrop, a titled card, and a row of
 * actions built from the `buttons` config. Escape (and a backdrop click) asks
 * `onClose`, and Enter activates `onEnterClickId`, so every modal answers the
 * keyboard the same way without each caller re-implementing it.
 */
export function Modal<ButtonId extends string>({
  title,
  ariaLabel,
  buttons,
  onEnterClickId,
  onClose,
  children,
}: ModalProps<ButtonId>) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the card on mount so Escape and Enter reach the modal before the user
  // tabs into it, instead of being handled by whatever is behind the backdrop.
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  function requestClose(): void {
    if (!onClose()) cardRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== "Enter" || onEnterClickId === undefined) return;
    // A dropdown that just picked an option with Enter has already consumed it.
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && ENTER_PASSTHROUGH_TAGS.has(target.tagName)) return;
    const button = buttons[onEnterClickId];
    if (button.disabled === true) return;
    event.preventDefault();
    event.stopPropagation();
    button.onClick();
  }

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>): void {
    // Only a click on the backdrop itself; clicks inside the card bubble here too.
    if (event.target !== event.currentTarget) return;
    requestClose();
  }

  const buttonsById: Readonly<Partial<Record<string, ModalButton>>> = buttons;

  return (
    <div
      className="modal-overlay"
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
      >
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {Object.keys(buttonsById).map((id) => {
            const button = buttonsById[id];
            if (button === undefined) return null;
            return (
              <button
                key={id}
                type="button"
                className={`modal-button${button.dangerous ? " modal-button--dangerous" : ""}`}
                onClick={button.onClick}
                disabled={button.disabled}
                aria-label={button.ariaLabel}
              >
                {button.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
