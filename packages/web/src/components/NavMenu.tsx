import "./NavMenu.css";

type NavPage = "bulk_ingredient_editor" | "recipe_editor";

interface NavMenuProps {
  readonly onNavigate: (page: NavPage) => void;
}

export function NavMenu({ onNavigate }: NavMenuProps) {
  return (
    <details className="nav-menu">
      <summary className="nav-menu-trigger" aria-label="Navigation menu">
        ☰
      </summary>
      <nav className="nav-menu-dropdown" aria-label="Main navigation">
        <button
          className="nav-menu-item"
          onClick={() => onNavigate("recipe_editor")}
        >
          Recipes
        </button>
        <button
          className="nav-menu-item"
          onClick={() => onNavigate("bulk_ingredient_editor")}
        >
          Ingredients
        </button>
      </nav>
    </details>
  );
}
