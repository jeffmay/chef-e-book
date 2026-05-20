import "./nav_menu.css";

type NavPage = "bulk_ingredient_editor" | "recipe_editor";

interface NavMenuProps {
  readonly onNavigate: (page: NavPage) => void;
}

export function NavMenu({ onNavigate }: NavMenuProps) {
  return (
    <details className="nav_menu">
      <summary className="nav_menu_trigger" aria-label="Navigation menu">
        ☰
      </summary>
      <nav className="nav_menu_dropdown" aria-label="Main navigation">
        <button
          className="nav_menu_item"
          onClick={() => onNavigate("recipe_editor")}
        >
          Recipes
        </button>
        <button
          className="nav_menu_item"
          onClick={() => onNavigate("bulk_ingredient_editor")}
        >
          Ingredients
        </button>
      </nav>
    </details>
  );
}
