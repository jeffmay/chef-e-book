import { useEffect, useRef, type FocusEvent } from "react";
import { Link } from "react-router";
import "./NavMenu.css";

export function NavMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function handleBlur(e: FocusEvent<HTMLDetailsElement>) {
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (!e.currentTarget.contains(related)) close();
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
      </nav>
    </details>
  );
}
