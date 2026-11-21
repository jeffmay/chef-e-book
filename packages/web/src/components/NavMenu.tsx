import { useEffect, useRef, type FocusEvent } from "react";
import { Link } from "react-router";
import type { ReadonlyDeep } from "type-fest";
import type { RecipeBookId } from "@recipe-book/shared";
import type { BookRegistryEntry } from "../storage/bookRegistry.ts";
import "./NavMenu.css";

export type NavMenuProps = ReadonlyDeep<{
  /** Every book on this device. */
  books: BookRegistryEntry[];
  /** The open book, marked in the list. */
  activeBookId: RecipeBookId;
  /** "Switch Books": leaves the open book for the book picker. */
  onSwitchBook: () => void;
  /** A book in the list: opens it directly. */
  onOpenBook: (id: RecipeBookId) => void;
}>;

export function NavMenu({ books, activeBookId, onSwitchBook, onOpenBook }: NavMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function handleBlur(e: FocusEvent<HTMLDetailsElement>) {
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    // Only close when focus actually moved to another element outside the menu
    // (e.g. keyboard tab-away). On touch devices (iOS Safari) tapping a link does
    // not focus it, so `related` is null; closing here would collapse the menu and
    // hide the link before its click/navigation fires, stranding the user on the
    // current page. Genuine outside taps are handled by the pointerdown listener
    // below, and link taps close the menu via each Link's onClick={close}.
    if (related !== null && !e.currentTarget.contains(related)) close();
  }

  /** Close on click outside (catches non-focusable targets). */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        detailsRef.current !== null &&
        detailsRef.current.open &&
        e.target instanceof Node &&
        !detailsRef.current.contains(e.target)
      ) {
        close();
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  return (
    <details ref={detailsRef} className="nav-menu" onBlur={handleBlur}>
      <summary className="nav-menu-trigger" aria-label="Navigation menu">
        ☰
      </summary>
      <nav className="nav-menu-dropdown" aria-label="Main navigation">
        <Link className="nav-menu-item" to="/recipes" onClick={close}>
          Recipes
        </Link>
        <Link className="nav-menu-item" to="/ingredients" onClick={close}>
          Ingredients
        </Link>
        <Link className="nav-menu-item" to="/settings" onClick={close}>
          Book Settings
        </Link>
        {/* The books fly out to the right of "Switch Books" on hover or keyboard focus. Where
            there is no hover (touch), the list stays open beneath it instead. */}
        <div className="nav-menu-group">
          <button
            type="button"
            className="nav-menu-item nav-menu-item--button nav-menu-item--parent"
            aria-haspopup="true"
            onClick={() => {
              close();
              onSwitchBook();
            }}
          >
            Switch Books
            <span className="nav-menu-arrow" aria-hidden="true">
              ▸
            </span>
          </button>
          <ul className="nav-menu-submenu" aria-label="Books on this device">
            {books.map((book) => {
              const isActive = book.id === activeBookId;
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    className="nav-menu-item nav-menu-subitem"
                    aria-label={isActive ? `${book.name} (open book)` : `Open book ${book.name}`}
                    aria-current={isActive || undefined}
                    onClick={() => {
                      close();
                      if (!isActive) onOpenBook(book.id);
                    }}
                  >
                    {isActive ? "✔︎ " : ""}
                    {book.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </details>
  );
}
