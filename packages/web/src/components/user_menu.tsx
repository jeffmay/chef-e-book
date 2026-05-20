import "./user_menu.css";

interface UserMenuProps {
  readonly userName: string;
  readonly onProfile: () => void;
}

export function UserMenu({ userName, onProfile }: UserMenuProps) {
  return (
    <details className="user_menu">
      <summary className="user_menu_trigger" aria-label={`User menu for ${userName}`}>
        {userName} ▾
      </summary>
      <div className="user_menu_dropdown" role="menu">
        <button
          className="user_menu_item"
          role="menuitem"
          onClick={onProfile}
        >
          Profile settings
        </button>
      </div>
    </details>
  );
}
