import { ButtonGroup } from "primereact/buttongroup";
import { Menu } from "primereact/menu";
import type { MenuItem } from "primereact/menuitem";
import { useEffect, useRef, type FocusEvent, type SyntheticEvent } from "react";
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
export function ButtonMenu({ defaultButton, buttons, menuLabel, className }: ButtonMenuProps) {
  const menuRef = useRef<Menu>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const items: MenuItem[] = buttons.map((button) => ({
    label: button.label,
    command: () => button.onSelect(),
    ...(button.disabled !== undefined && { disabled: button.disabled }),
  }));

  function close() {
    menuRef.current?.hide({
      currentTarget: wrapperRef.current ?? document.body,
    } as unknown as SyntheticEvent);
  }

  /** Close on blur (focus leaves the wrapper entirely). */
  function handleBlur(e: FocusEvent<HTMLSpanElement>) {
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (!e.currentTarget.contains(related)) close();
  }

  /** Close on click outside (catches non-focusable targets). */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current !== null &&
        e.target instanceof Node &&
        !wrapperRef.current.contains(e.target) &&
        // The menu popup is rendered via Portal outside wrapperRef, but
        // clicking inside it should not close the menu here — PrimeReact's
        // own item-click handler (onItemClick) fires the command, then
        // calls hide() and stopPropagation().
        (menuRef.current === null || !menuRef.current.getElement()?.contains(e.target))
      ) {
        close();
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  return (
    <span
      ref={wrapperRef}
      className={`button-menu${className !== undefined ? ` ${className}` : ""}`}
      onBlur={handleBlur}
    >
      <ButtonGroup>
        {defaultButton !== undefined && (
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
      <Menu model={items} popup ref={menuRef} className="button-menu-popup" />
    </span>
  );
}
