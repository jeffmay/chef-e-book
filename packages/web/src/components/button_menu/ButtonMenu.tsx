import { ButtonGroup } from "primereact/buttongroup";
import { Menu } from "primereact/menu";
import type { MenuItem } from "primereact/menuitem";
import { useCallback, useEffect, useRef, type SyntheticEvent } from "react";
import type { ReadonlyDeep } from "type-fest";
import "./ButtonMenu.css";

export type ButtonMenuItem = ReadonlyDeep<{
  label: string;
  onSelect: () => void;
  /** Accessible name for the default button; menu entries use the label. */
  ariaLabel?: string;
  disabled?: boolean;
}>;

export type ButtonMenuProps = ReadonlyDeep<{
  /**
   * The action performed by clicking the main button. When undefined, only
   * the chevron menu button is shown.
   */
  defaultButton?: ButtonMenuItem;
  /** All available actions, listed in the chevron menu. */
  buttons: ButtonMenuItem[];
  /** Accessible name for the chevron menu trigger. */
  menuLabel: string;
  /**
   * When true, the default button is not rendered and its action is instead
   * moved to the top of the chevron menu — so only the "▾" trigger shows.
   * Useful in constrained layouts (e.g. mobile view).
   */
  hideDefault?: boolean;
  className?: string;
}>;

/**
 * A split button: a default action button grouped with a chevron that opens
 * a PrimeReact Menu listing every available action (PrimeReact `ButtonGroup`
 * + popup `Menu`).
 *
 * Outside-click detection uses `pointerdown` (not `click`) to avoid racing
 * PrimeReact's overlay listener (which uses `click`). The menu popup is
 * rendered via Portal outside `wrapperRef`, so we skip closing when the
 * click target is inside the popup — letting PrimeReact's own item-click
 * handler fire the `command` before the menu is hidden.
 */
export function ButtonMenu({
  defaultButton,
  buttons,
  menuLabel,
  hideDefault = false,
  className,
}: ButtonMenuProps) {
  const menuRef = useRef<Menu>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // When hiding the default button, fold its action into the top of the menu.
  const showDefault = defaultButton !== undefined && !hideDefault;
  const menuButtons =
    hideDefault && defaultButton !== undefined ? [defaultButton, ...buttons] : buttons;

  const items: MenuItem[] = menuButtons.map((button) => ({
    label: button.label,
    command: () => button.onSelect(),
    ...(button.disabled !== undefined && { disabled: button.disabled }),
  }));

  // close/isInsideWidget are wrapped in useCallback (deps: [], since both
  // only read stable refs) rather than left as plain render-scope functions,
  // so the outside-click effect below can list them in its dependency array
  // instead of relying on an empty array that captures whichever closures
  // existed on mount. That "[]-deps effect closing over render-scope
  // functions" pattern is otherwise easy to leave stale: if either function
  // ever started reading state instead of only refs, an empty deps array
  // would silently keep using the first render's version, while listing
  // them here makes `react-hooks/exhaustive-deps` catch a missing
  // dependency immediately.
  const close = useCallback(() => {
    menuRef.current?.hide({
      currentTarget: wrapperRef.current ?? document.body,
    } as unknown as SyntheticEvent);
  }, []);

  /**
   * The menu popup is rendered via Portal outside wrapperRef (for stacking),
   * so a node "belongs" to this widget if it's inside either the wrapper or
   * the popup itself.
   *
   * Assumption: a click/focus target inside `menuRef.current?.getElement()`
   * only happens while the popup is genuinely open. `transitionOptions={{
   * disabled: true }}` on the `<Menu>` below means a closed popup is either
   * unmounted or otherwise unable to receive real pointer/focus events (the
   * exact mechanism and its timing are PrimeReact-internal and not a
   * contract this component should depend on precisely) — so in practice
   * this check can't be satisfied by a stale reference to a closed popup.
   * If the popup's open/close rendering ever changes such that a closed
   * panel remains hit-testable/focusable, this would need an explicit "is
   * the menu open" guard alongside the containment check.
   */
  const isInsideWidget = useCallback((node: Node | null): boolean => {
    if (node === null) return false;
    if (wrapperRef.current?.contains(node) === true) return true;
    return menuRef.current?.getElement()?.contains(node) === true;
  }, []);

  /** Close on click outside and on focus leaving the widget. */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.target instanceof Node && !isInsideWidget(e.target)) {
        close();
      }
    }
    /**
     * `focusout` (unlike React's `onBlur` on the wrapper span) bubbles all
     * the way to `document` regardless of where in the DOM tree focus was
     * lost — including from inside the portaled popup, which isn't a
     * descendant of the wrapper. That matters both when the menu opens (the
     * popup auto-focuses its list, which isInsideWidget must NOT treat as
     * leaving the widget) and when a keyboard user tabs past the last menu
     * item to an element outside the widget (which SHOULD close the menu,
     * but never reached a wrapper-only blur handler).
     */
    function handleFocusOut(e: FocusEvent) {
      const target = e.target instanceof Node ? e.target : null;
      const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
      if (target !== null && isInsideWidget(target) && !isInsideWidget(related)) {
        close();
      }
    }
    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [close, isInsideWidget]);

  return (
    <span
      ref={wrapperRef}
      className={`button-menu${className !== undefined ? ` ${className}` : ""}`}
    >
      <ButtonGroup>
        {showDefault && defaultButton !== undefined && (
          <button
            type="button"
            className="button-menu-default"
            onClick={defaultButton.onSelect}
            disabled={defaultButton.disabled ?? false}
            aria-label={defaultButton.ariaLabel ?? defaultButton.label}
          >
            {defaultButton.label}
          </button>
        )}
        <button
          type="button"
          className="button-menu-chevron"
          onClick={(e) => menuRef.current?.toggle(e)}
          aria-label={menuLabel}
          aria-haspopup="true"
        >
          ▾
        </button>
      </ButtonGroup>
      {/* PrimeReact CSSTransition is disabled (transitionOptions.disabled) —
          e-ink screens never animate, and a real click landing mid-transition
          can miss the still-scaling menu item, registering as an outside
          click that hides the menu without running the item's action. */}
      <Menu
        model={items}
        popup
        ref={menuRef}
        className="button-menu-popup"
        transitionOptions={{ timeout: 0, disabled: true }}
      />
    </span>
  );
}
