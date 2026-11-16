import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { ReadonlyDeep } from "type-fest";
import { isEnterPassthrough, isEscapeForOpenPopup } from "../accept_or_cancel_editor/keyboard.ts";
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

/** What Tab can land on inside the card. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  'input:not([type="hidden"]):not(:disabled)',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

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
  // Focus goes back to whatever opened the modal when it closes, so the user
  // keeps their place on the page instead of restarting from the top.
  useEffect(() => {
    const opener = document.activeElement;
    cardRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Keeps Tab inside the card: it is `aria-modal`, and the keys this component
  // answers never reach it once focus has wandered onto the page behind.
  function trapTab(event: KeyboardEvent<HTMLDivElement>): void {
    const card = cardRef.current;
    if (card === null || event.defaultPrevented) return;
    // A popup portalled out of the card (its DOM is elsewhere) manages its own Tab.
    if (!(event.target instanceof Node) || !card.contains(event.target)) return;
    // `*` + `matches` rather than one `querySelectorAll(FOCUSABLE_SELECTOR)`, which
    // jsdom answers grouped per selector instead of in document order.
    const focusable = Array.from(card.querySelectorAll<HTMLElement>("*")).filter((element) =>
      element.matches(FOCUSABLE_SELECTOR),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function requestClose(): void {
    if (!onClose()) cardRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Tab") {
      trapTab(event);
      return;
    }
    if (event.key === "Escape") {
      // A field with its dropdown open closes that first; see `isEscapeForOpenPopup`.
      if (isEscapeForOpenPopup(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== "Enter" || onEnterClickId === undefined) return;
    // A dropdown that just picked an option with Enter has already consumed it.
    if (event.defaultPrevented) return;
    if (isEnterPassthrough(event.target)) return;
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
